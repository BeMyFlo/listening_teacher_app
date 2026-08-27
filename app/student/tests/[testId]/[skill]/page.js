"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { readSession } from "@/lib/client/session";
import { SKILL_TABS, QUESTION_SKILLS } from "@/lib/student/constants";
import { latestPromptSub } from "@/lib/student/submissions";
import { useAnswers, SectionBlock, answerLabel } from "@/components/student/questions";
import Countdown from "@/components/student/Countdown";
import { WritingPrompt, SpeakingPrompt } from "@/components/student/PromptBlock";

export default function TakeTestPage() {
  const { testId, skill } = useParams();
  const router = useRouter();
  const tab = SKILL_TABS.find((t) => t.key === skill);
  const [test, setTest] = useState(null);
  const [locked, setLocked] = useState(false);
  const [err, setErr] = useState("");
  const { subs, refresh } = useMySubmissions();

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

  const skillData = test.skills[skill];
  const isQuestion = QUESTION_SKILLS.includes(skill);

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
                {p.instructions && <div className="lesson-text">{p.instructions}</div>}
                {p.imageUrl && (
                  <img src={p.imageUrl} className="diagram-image" style={{ margin: "10px 0" }} alt="" />
                )}
                <div className="prompt-work" style={{ marginTop: 12 }}>
                  {skill === "writing" ? (
                    <WritingPrompt prompt={p} submitContext={{ testId: test.id, skill }} onSubmitted={refresh} />
                  ) : (
                    <SpeakingPrompt prompt={p} submitContext={{ testId: test.id, skill }} onSubmitted={refresh} />
                  )}
                </div>
                <div className="prompt-status" style={{ marginTop: 12 }}>
                  {last &&
                    (last.gradingStatus === "graded" ? (
                      <div className="notice success">
                        <svg className="icon"><use href="#icon-check-circle" /></svg> Graded:{" "}
                        <b>{last.manualScore} pts</b>
                        {last.manualFeedback ? " — Feedback: " + last.manualFeedback : ""}
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
      backLink={backLink}
      onSubmitted={refresh}
      onRetakeDone={() => router.push("/student/tests")}
    />
  );
}

function QuestionRunner({ test, skill, tab, skillData, backLink, onSubmitted }) {
  const answersApi = useAnswers();
  const [replayCount, setReplayCount] = useState(0);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const sections = skillData.sections || [];
  const studentName = (readSession("student") || {}).name || "";

  async function submit() {
    if (busy || result) return;
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
      onSubmitted && onSubmitted();
      window.scrollTo({ top: 0 });
    } catch (e) {
      alert("Submission failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  if (result) {
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
              className="btn secondary"
              onClick={() => {
                setResult(null);
                setReplayCount(0);
                answersApi.reset();
                window.scrollTo({ top: 0 });
              }}
            >
              Retake Test
            </button>
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

  return (
    <section>
      <div className="card">
        {backLink}
        {skillData.durationMinutes ? (
          <Countdown minutes={Number(skillData.durationMinutes)} onExpire={submit} />
        ) : null}
        <span className={"badge test " + skill}>{tab.label} Test</span>
        <h2>{test.unit} · {test.title}</h2>
        <p style={{ color: "var(--muted)", marginBottom: 20 }}>{skillData.instructions}</p>
        <div id="testForm">
          {sections.map((sec, i) => (
            <SectionBlock
              key={i}
              section={sec}
              secIdx={i}
              skill={skill}
              answersApi={answersApi}
              onReplay={() => setReplayCount((n) => n + 1)}
            />
          ))}
        </div>
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
