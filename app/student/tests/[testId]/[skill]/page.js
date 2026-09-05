"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { readSession } from "@/lib/client/session";
import { SKILL_TABS, QUESTION_SKILLS } from "@/lib/student/constants";
import { latestPromptSub, latestExamSub } from "@/lib/student/submissions";
import { useAnswers, SectionBlock, answerLabel } from "@/components/student/questions";
import Countdown, { clearCountdown } from "@/components/student/Countdown";
import { WritingPrompt, SpeakingPrompt } from "@/components/student/PromptBlock";
import { useTabSwitchGuard } from "@/components/student/useTabSwitchGuard";
import { useDialog } from "@/components/ui/Dialog";
import RubricResult from "@/components/RubricResult";

export default function TakeTestPage() {
  const { testId, skill } = useParams();
  const router = useRouter();
  const dialog = useDialog();
  const tab = SKILL_TABS.find((t) => t.key === skill);
  const [test, setTest] = useState(null);
  const [locked, setLocked] = useState(false);
  const [err, setErr] = useState("");
  const [promptsDone, setPromptsDone] = useState(false);
  const { subs, loaded: subsLoaded, refresh } = useMySubmissions();
  const promptRefs = useRef({});

  const skillData = test && test.skills[skill];
  const isQuestion = QUESTION_SKILLS.includes(skill);
  const canGuardPrompts = !!(test && !locked && !isQuestion && tab && !promptsDone);

  // Listening/Reading dùng guard riêng trong QuestionRunner (nộp cả bài 1
  // lần). Writing/Speaking nộp theo từng prompt độc lập nên xử lý ở đây:
  // vi phạm quá số lần cho phép -> nộp ngay bài đang làm dở của MỌI prompt
  // (nếu có nội dung), rồi quay lại danh sách test.
  useTabSwitchGuard({
    enabled: canGuardPrompts,
    dialog,
    label: tab ? `bài ${tab.label}` : "bài thi",
    onExceeded: async () => {
      const refs = Object.values(promptRefs.current).filter(Boolean);
      await Promise.all(refs.map((r) => r.forceSubmit && r.forceSubmit().catch(() => {})));
      setPromptsDone(true);
      router.push("/student/tests");
    },
  });

  useEffect(() => {
    api.student
      .getTest(testId)
      .then((d) => {
        setLocked(!!d.locked);
        setTest(d.test);
      })
      .catch((e) => setErr(e.message));
  }, [testId]);

  const backLink = (
    <p className="back-link" onClick={() => router.push("/student/tests")}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to test list
    </p>
  );

  if (err)
    return (
      <section>
        <div className="card">
          {backLink}
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> Failed to load test: {err}
          </div>
        </div>
      </section>
    );
  if (!tab) return <section><div className="card">{backLink}<p>Invalid skill.</p></div></section>;
  if (!test)
    return (
      <section>
        <div className="card">
          <div className="notice info">Loading test...</div>
        </div>
      </section>
    );
  if (locked)
    return (
      <section>
        <div className="card">
          {backLink}
          <div className="notice info">This test is currently locked.</div>
        </div>
      </section>
    );

  if (!isQuestion) {
    return (
      <section>
        <div className="card">
          {backLink}
          <span className={"badge test " + skill}>{tab.label} Test</span>
          <h2>{(test.unit ? test.unit + " · " : "") + test.title}</h2>
          {skillData.instructions && (
            <p style={{ color: "var(--muted)", marginBottom: 20 }}>{skillData.instructions}</p>
          )}
          {(skillData.prompts || []).map((p) => {
            const last = latestPromptSub(subs, p.id);
            return (
              <div className="lesson-block" key={p.id}>
                <h4 style={{ margin: "0 0 8px" }}>{p.title || "Prompt"}</h4>
                {p.instructions && (
                  <div className="prompt-instructions">
                    {p.instructions.split(/\n{2,}/).map((para, k) => (
                      <p key={k}>{para}</p>
                    ))}
                  </div>
                )}
                {p.imageUrl && (
                  <img src={p.imageUrl} className="diagram-image" style={{ margin: "10px 0" }} alt="" />
                )}
                <div className="prompt-work" style={{ marginTop: 12 }}>
                  {skill === "writing" ? (
                    <WritingPrompt
                      ref={(el) => (promptRefs.current[p.id] = el)}
                      prompt={p}
                      submitContext={{ testId: test.id, skill }}
                      onSubmitted={refresh}
                    />
                  ) : (
                    <SpeakingPrompt
                      ref={(el) => (promptRefs.current[p.id] = el)}
                      prompt={p}
                      submitContext={{ testId: test.id, skill }}
                      onSubmitted={refresh}
                    />
                  )}
                </div>
                <div className="prompt-status" style={{ marginTop: 12 }}>
                  {last &&
                    (last.gradingStatus === "graded" ? (
                      <div className="notice success">
                        <svg className="icon"><use href="#icon-check-circle" /></svg> Graded by your teacher
                        <RubricResult
                          rubricVariant={last.rubricVariant}
                          criteria={last.criteria}
                          manualScore={last.manualScore}
                          manualFeedback={last.manualFeedback}
                      essayText={last.essayText}
                      annotations={last.annotations}
                      audioUrl={last.audioUrl}
                      transcript={last.transcript}
                      speakingNotes={last.speakingNotes}
                      priorities={last.priorities}
                      topicVocabulary={last.topicVocabulary}
                      improvedSample={last.improvedSample}
                      mainIssue={last.mainIssue}
                        />
                      </div>
                    ) : (
                      <div className="notice info">Submitted — pending teacher review.</div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <QuestionRunner
      test={test}
      skill={skill}
      tab={tab}
      skillData={skillData}
      subs={subs}
      subsLoaded={subsLoaded}
      router={router}
      onSubmitted={refresh}
    />
  );
}

function QuestionRunner({ test, skill, tab, skillData, subs, subsLoaded, router, onSubmitted }) {
  const dialog = useDialog();
  const answersApi = useAnswers();
  const [replayCount, setReplayCount] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const sections = skillData.sections || [];
  const session = readSession("student") || {};
  const studentName = session.name || "";
  const studentId = (session.payload && session.payload.studentId) || "anon";
  // Neo đồng hồ đếm ngược vào localStorage theo học sinh + bài + kỹ năng —
  // rời trang (Back to test list, đóng tab, mất mạng) rồi quay lại không
  // được đếm lại từ đầu, vì như vậy vô hiệu hoá hoàn toàn giới hạn thời gian.
  const timerKey = `test-timer:${studentId}:${test.id}:${skill}`;
  // Đã có bài nộp trước đó (kể cả khi vừa nộp xong rồi rời trang/tải lại
  // trang) -> luôn hiện lại kết quả, KHÔNG cho vào làm lại bài thi.
  const existing = latestExamSub(subs, test.id, skill);
  const effectiveResult =
    result ||
    (existing
      ? {
          score: existing.score,
          total: existing.total,
          detailById: Object.fromEntries((existing.detail || []).map((d) => [d.id, d])),
        }
      : null);

  // `subs` (nên `existing`) chỉ có sau khi fetch xong, trễ hơn lúc useAnswers()
  // khởi tạo state rỗng — phải nạp lại đáp án đã nộp riêng ở đây thì cột
  // "Your answer" của bài đã nộp mới hiện đúng thay vì trống.
  useEffect(() => {
    if (existing) answersApi.setAll(existing.answers || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  useTabSwitchGuard({
    enabled: !effectiveResult,
    dialog,
    label: `bài ${tab.label}`,
    onExceeded: submit,
  });

  async function submit() {
    if (busy || effectiveResult) return;
    setBusy(true);
    try {
      const res = await api.student.submit({
        kind: "test",
        testId: test.id,
        skill,
        answers: answersApi.collect(sections),
        replayCount,
      });
      const detailById = {};
      (res.detail || []).forEach((d) => (detailById[d.id] = d));
      setResult({ score: res.score, total: res.total, detailById });
      clearCountdown(timerKey);
      onSubmitted && onSubmitted();
      window.scrollTo({ top: 0 });
    } catch (e) {
      dialog.alert({ tone: "error", title: "Submission failed", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function leaveTest() {
    const ok = await dialog.confirm({
      title: "Rời khỏi bài thi?",
      message: "Bài thi sẽ được nộp ngay với các câu trả lời hiện có — không thể quay lại làm tiếp. Bạn chắc chắn muốn rời đi?",
      confirmText: "Nộp & rời đi",
      danger: true,
    });
    if (!ok) return;
    await submit();
    router.push("/student/tests");
  }

  // Chưa biết có bài nộp trước đó hay chưa (đang tải submissions) — đợi thay
  // vì hiện đề thi mới rồi phải tráo qua màn kết quả ngay sau đó, giật giao diện.
  if (!subsLoaded) {
    return (
      <section>
        <div className="card">
          <div className="notice info">Loading test...</div>
        </div>
      </section>
    );
  }

  if (effectiveResult) {
    const result = effectiveResult;
    return (
      <section>
        <div className="card">
          <div className="score-box">
            <div style={{ color: "var(--muted)", fontWeight: 600 }}>
              {test.unit} · {test.title} — {tab.label} — {studentName}
            </div>
            <div className="big">
              <span>{result.score}</span>
              <span>
                {" "}
                / <span>{result.total}</span>
              </span>
            </div>
            <p className="notice success" style={{ display: "inline-block" }}>
              <svg className="icon"><use href="#icon-check-circle" /></svg> Test results submitted to teacher
              successfully.
            </p>
          </div>
          <div id="resultDetail">
            {sections.map((sec, si) => (
              <div key={si} style={{ marginBottom: 24 }}>
                <div className="section-title">{sec.name}</div>
                {(sec.fields || []).map((f) => {
                  const d = result.detailById[f.id];
                  if (!d) return null;
                  const shown = answerLabel(f, answersApi.getValue(f), sec) || "(blank)";
                  return (
                    <div key={f.id} className={"field-row " + (d.correct ? "correct" : "wrong")}>
                      <span className="num">{f.id}.</span>
                      <span className="label">{f.label}</span>
                      <span className="tail" style={{ flex: 1 }}>
                        Your answer: <b>{shown}</b>
                        {!d.correct && (
                          <>
                            {" "}
                            · Correct answer: <b>{d.answer || ""}</b>
                          </>
                        )}
                      </span>
                      <span className={"result-mark " + (d.correct ? "correct" : "wrong")}>
                        <svg className="icon"><use href={d.correct ? "#icon-check" : "#icon-cross"} /></svg>
                      </span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 20 }}>
            <button
              type="button"
              className="btn"
              onClick={() => {
                window.location.href = "/student/tests";
              }}
            >
              Back to Test List
            </button>
          </div>
        </div>
      </section>
    );
  }

  const guardedBackLink = (
    <p className="back-link" onClick={leaveTest}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to test list
    </p>
  );

  return (
    <section>
      <div className="card">
        {guardedBackLink}
        {skillData.durationMinutes ? (
          <Countdown minutes={Number(skillData.durationMinutes)} onExpire={submit} storageKey={timerKey} />
        ) : null}
        <span className={"badge test " + skill}>{tab.label} Test</span>
        <h2>{test.unit} · {test.title}</h2>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>{skillData.instructions}</p>
        {sections.length > 1 && (
          <SectionNav sections={sections} active={activeSection} onSelect={setActiveSection} answersApi={answersApi} />
        )}
        <div id="testForm">
          <SectionBlock
            section={sections[activeSection]}
            secIdx={activeSection}
            skill={skill}
            answersApi={answersApi}
            onReplay={() => setReplayCount((n) => n + 1)}
          />
        </div>
        {sections.length > 1 && (
          <div className="section-nav-footer">
            <button
              type="button"
              className="btn secondary"
              disabled={activeSection === 0}
              onClick={() => setActiveSection((i) => Math.max(0, i - 1))}
            >
              <svg className="icon"><use href="#icon-arrow-left" /></svg> Previous section
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={activeSection === sections.length - 1}
              onClick={() => setActiveSection((i) => Math.min(sections.length - 1, i + 1))}
            >
              Next section <svg className="icon"><use href="#icon-arrow-right" /></svg>
            </button>
          </div>
        )}
        <button
          type="button"
          className="btn"
          style={{ marginTop: 20 }}
          disabled={busy}
          onClick={submit}
        >
          Submit Test
        </button>
      </div>
    </section>
  );
}

// Thanh chuyển section (giống cách IELTS thi thật chia Passage/Part 1,2,3) —
// thay vì xếp hết các section chồng xuống, học sinh bấm số để nhảy tới
// section đang muốn làm. Chấm xanh = section đó đã trả lời hết câu hỏi.
function SectionNav({ sections, active, onSelect, answersApi }) {
  return (
    <div className="section-nav" role="tablist">
      {sections.map((sec, i) => {
        const fields = sec.fields || [];
        const done =
          fields.length > 0 &&
          fields.every((f) => {
            const v = answersApi.getValue(f);
            return Array.isArray(v) ? v.length > 0 : v !== "" && v != null;
          });
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === active}
            className={"section-nav-btn" + (i === active ? " active" : "") + (done ? " done" : "")}
            onClick={() => onSelect(i)}
            title={sec.name || `Section ${i + 1}`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
}
