"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { LESSON_CATS, PROMPT_CATS } from "@/lib/student/constants";
import {
  categoryStats,
  latestExerciseSub,
  latestPromptSub,
} from "@/lib/student/submissions";
import { useAnswers, SectionBlock } from "@/components/student/questions";
import { WritingPrompt, SpeakingPrompt } from "@/components/student/PromptBlock";
import GrammarTopicView from "@/components/student/GrammarTopicView";
import { VocabFlashcards, VocabWordList } from "@/components/student/VocabFlashcards";

const LESSON_LIST_CATS = ["grammar", "vocabulary"];

function renderTheoryText(raw) {
  const esc = String(raw || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc
    .replace(/\*\*([^\n]+?)\*\*/g, "<b>$1</b>")
    .replace(/\*([^\n*]+?)\*/g, "<i>$1</i>");
}

export default function UnitDetailPage() {
  const { unitId } = useParams();
  const router = useRouter();
  const [unit, setUnit] = useState(null);
  const [err, setErr] = useState("");
  const [catKey, setCatKey] = useState("grammar");
  const [subTab, setSubTab] = useState("learn");
  const { subs, refresh } = useMySubmissions();

  useEffect(() => {
    api.student
      .getUnit(unitId)
      .then((d) => setUnit(d.unit))
      .catch((e) => setErr(e.message));
  }, [unitId]);

  if (err)
    return (
      <section>
        <div className="card">
          <p className="back-link" onClick={() => router.push("/student/lessons")}>
            <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to lesson list
          </p>
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> Failed to load lesson: {err}
          </div>
        </div>
      </section>
    );
  if (!unit) return <section><div className="notice info">Loading lesson...</div></section>;

  const cat = (unit.categories || []).find((c) => c.key === catKey) || null;
  const catMeta = LESSON_CATS.find((c) => c.key === catKey);
  const isPrompt = PROMPT_CATS.includes(catKey);
  const stats = cat ? categoryStats(cat, subs) : { topics: 0, completed: 0, avgScorePct: null };

  return (
    <section>
      <div className="card">
        <p className="back-link" onClick={() => router.push("/student/lessons")}>
          <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to lesson list
        </p>
        <h2>{unit.name}</h2>

        <div className="unit-cat-tabs">
          {LESSON_CATS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={"unit-cat-tab" + (c.key === catKey ? " active" : "")}
              onClick={() => {
                setCatKey(c.key);
                setSubTab("learn");
              }}
            >
              <svg className="icon"><use href={"#icon-" + c.icon} /></svg> {c.label}
            </button>
          ))}
        </div>

        <div id="lessonCatContent">
          {cat && LESSON_LIST_CATS.includes(catKey) ? (
            <LessonTopicPane cat={cat} unitId={unit.id} subs={subs} onSubmitted={refresh} />
          ) : !cat ? null : (
            <>
              <div className="lesson-header-card">
                <div className="lesson-header-top">
                  <span className="lesson-header-icon"><svg className="icon"><use href={"#icon-" + catMeta.icon} /></svg></span>
                  <div>
                    <h3 style={{ margin: 0 }}>{catMeta.label}</h3>
                    <p style={{ margin: "2px 0 0", color: "var(--muted)", fontSize: ".86rem" }}>
                      {catMeta.desc}
                    </p>
                  </div>
                </div>
                <div className="lesson-stat-row">
                  <div className="lesson-stat">
                    <span className="value">{stats.topics}</span>
                    <span className="label">{isPrompt ? "Prompts" : "Exercises"}</span>
                  </div>
                  <div className="lesson-stat">
                    <span className="value">{stats.completed}</span>
                    <span className="label">Completed</span>
                  </div>
                  {!isPrompt && (
                    <div className="lesson-stat">
                      <span className="value">
                        {stats.avgScorePct != null ? stats.avgScorePct + "%" : "—"}
                      </span>
                      <span className="label">Avg Score</span>
                    </div>
                  )}
                </div>
                <div className="lesson-subtabs">
                  <button
                    type="button"
                    className={"lesson-subtab" + (subTab === "learn" ? " active" : "")}
                    onClick={() => setSubTab("learn")}
                  >
                    <svg className="icon"><use href="#icon-book-open" /></svg> Learn
                  </button>
                  <button
                    type="button"
                    className={"lesson-subtab" + (subTab === "practice" ? " active" : "")}
                    onClick={() => setSubTab("practice")}
                  >
                    <svg className="icon"><use href="#icon-edit" /></svg> Practice
                  </button>
                </div>
              </div>

              {subTab === "learn" ? (
                <TheoryView theory={cat.theory} />
              ) : isPrompt ? (
                <PromptList unitId={unit.id} cat={cat} subs={subs} onSubmitted={refresh} />
              ) : (
                <ExerciseList unitId={unit.id} cat={cat} subs={subs} onSubmitted={refresh} />
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function LessonTopicPane({ cat, unitId, subs, onSubmitted }) {
  const isGrammar = cat.key === "grammar";
  const items = isGrammar ? cat.topics || [] : cat.groups || [];
  const [openId, setOpenId] = useState(null);
  const [vocabView, setVocabView] = useState("cards"); // cards | list

  const item = items.find((x) => String(x.id) === String(openId));

  if (!items.length)
    return (
      <div className="empty-state">
        {isGrammar ? "Chưa có chủ điểm ngữ pháp nào." : "Chưa có nhóm từ nào."}
      </div>
    );

  if (!item) {
    return (
      <div style={{ marginTop: 12 }}>
        {items.map((it) => {
          const exs = it.exercises || [];
          const done = exs.filter((ex) => latestExerciseSub(subs, ex.id)).length;
          return (
            <div
              className="unit-list-row"
              key={it.id}
              onClick={() => {
                setOpenId(it.id);
                setVocabView("cards");
              }}
            >
              <div className="unit-list-num">
                <svg className="icon"><use href={"#icon-" + (isGrammar ? "grammar" : "vocabulary")} /></svg>
              </div>
              <div className="unit-list-meta">
                <h4>{it.name || (isGrammar ? "Chủ điểm" : "Nhóm từ")}</h4>
                <p>
                  {!isGrammar && <span className="meta-icon">{(it.words || []).length} từ</span>}
                  <span className="meta-icon">{exs.length} bài tập</span>
                  {exs.length > 0 && (
                    <span className="meta-icon">
                      {done}/{exs.length} đã làm
                    </span>
                  )}
                </p>
              </div>
              <button type="button" className="icon-btn unit-list-goto">
                <svg className="icon"><use href="#icon-chevron-right" /></svg>
              </button>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div style={{ marginTop: 12 }}>
      <p className="back-link" onClick={() => setOpenId(null)}>
        <svg className="icon"><use href="#icon-arrow-left" /></svg>{" "}
        {isGrammar ? "Danh sách chủ điểm" : "Danh sách nhóm từ"}
      </p>
      <h3 style={{ marginTop: 0 }}>{item.name}</h3>

      {isGrammar ? (
        <GrammarTopicView topic={item} />
      ) : (
        <>
          <div className="lesson-subtabs">
            <button
              type="button"
              className={"lesson-subtab" + (vocabView === "cards" ? " active" : "")}
              onClick={() => setVocabView("cards")}
            >
              Flashcard
            </button>
            <button
              type="button"
              className={"lesson-subtab" + (vocabView === "list" ? " active" : "")}
              onClick={() => setVocabView("list")}
            >
              Bảng từ
            </button>
          </div>
          <div style={{ marginTop: 12 }}>
            {vocabView === "cards" ? (
              <VocabFlashcards words={item.words || []} />
            ) : (
              <VocabWordList words={item.words || []} />
            )}
          </div>
        </>
      )}

      <h3 style={{ marginTop: 24 }}>Bài tập</h3>
      {(item.exercises || []).length === 0 ? (
        <div className="empty-state">Chưa có bài tập.</div>
      ) : (
        item.exercises.map((ex, i) => (
          <ExerciseBlock
            key={ex.id}
            index={i}
            ex={ex}
            unitId={unitId}
            categoryKey={cat.key}
            skill="other"
            last={latestExerciseSub(subs, ex.id)}
            onSubmitted={onSubmitted}
          />
        ))
      )}
    </div>
  );
}

function TheoryView({ theory }) {
  const hasTheory = (theory.html || "").trim() || theory.audioUrl || theory.imageUrl;
  return (
    <div>
      <h3 style={{ marginTop: 6 }}>Theory</h3>
      {!hasTheory ? (
        <div className="empty-state">No theory content available for this section.</div>
      ) : (
        <>
          {(theory.html || "").trim() && (
            <div
              className="lesson-text"
              dangerouslySetInnerHTML={{ __html: renderTheoryText(theory.html) }}
            />
          )}
          {theory.audioUrl && (
            <audio controls src={theory.audioUrl} style={{ width: "100%", margin: "10px 0" }} />
          )}
          {theory.imageUrl && <img src={theory.imageUrl} className="diagram-image" alt="" />}
        </>
      )}
    </div>
  );
}

function ExerciseList({ unitId, cat, subs, onSubmitted }) {
  if (!cat.exercises.length)
    return <div className="empty-state">No exercises available for this section.</div>;
  return (
    <>
      {cat.exercises.map((ex, i) => (
        <ExerciseBlock
          key={ex.id}
          index={i}
          ex={ex}
          unitId={unitId}
          categoryKey={cat.key}
          skill={cat.key === "reading" ? "reading" : "other"}
          last={latestExerciseSub(subs, ex.id)}
          onSubmitted={onSubmitted}
        />
      ))}
    </>
  );
}

function ExerciseBlock({ index, ex, unitId, categoryKey, skill, last, onSubmitted }) {
  const [open, setOpen] = useState(false);
  const answersApi = useAnswers();
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await api.student.submit({
        kind: "exercise",
        unitId,
        categoryKey,
        exerciseId: ex.id,
        answers: answersApi.collect(ex.sections),
      });
      const detailById = {};
      (res.detail || []).forEach((d) => (detailById[d.id] = d));
      setResult({ score: res.score, total: res.total, detailById });
      alert(`Score: ${res.score}/${res.total} correct.`);
      onSubmitted && onSubmitted();
    } catch (e) {
      alert("Submission failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  let badge;
  if (open && !result) badge = <span className="pill pill-warn">In Progress</span>;
  else if (result)
    badge = <span className="pill pill-ok">Completed · {Math.round((result.score / Math.max(result.total, 1)) * 100)}%</span>;
  else if (last)
    badge = <span className="pill pill-ok">Completed · {Math.round((last.score / Math.max(last.total, 1)) * 100)}%</span>;
  else badge = <span className="pill pill-muted">Not started</span>;

  const ctaLabel = open ? "Continue" : last || result ? "Review" : "Start";

  return (
    <div className="lesson-block">
      <div className="lesson-block-head">
        <div>
          <h4 style={{ margin: 0 }}>
            {index + 1}. {ex.title || "Exercise"}
          </h4>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: ".85rem" }}>
            {ex.totalQuestions} questions {badge}
          </p>
        </div>
        <button
          type="button"
          className="btn"
          style={{ padding: "8px 16px" }}
          onClick={() => setOpen((v) => !v)}
        >
          {ctaLabel}
        </button>
      </div>
      {open && (
        <div className="lesson-ex-form" style={{ display: "block", marginTop: 16 }}>
          {(ex.sections || []).map((sec, i) => (
            <SectionBlock
              key={i}
              section={sec}
              secIdx={i}
              skill={skill}
              answersApi={answersApi}
              reviewById={result ? result.detailById : null}
            />
          ))}
          {!result ? (
            <button type="button" className="btn" disabled={busy} onClick={submit}>
              Submit Exercise
            </button>
          ) : (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setResult(null);
                answersApi.reset();
              }}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function PromptList({ unitId, cat, subs, onSubmitted }) {
  if (!cat.prompts.length)
    return <div className="empty-state">No prompts available for this section.</div>;
  return (
    <>
      {cat.prompts.map((p, i) => {
        const last = latestPromptSub(subs, p.id);
        let badge;
        if (!last) badge = <span className="pill pill-muted">Not started</span>;
        else if (last.gradingStatus === "graded")
          badge = <span className="pill pill-ok">Graded · {last.manualScore} pts</span>;
        else badge = <span className="pill pill-warn">Pending review</span>;
        return (
          <div className="lesson-block" key={p.id}>
            <h4 style={{ margin: "0 0 8px" }}>
              {i + 1}. {p.title || "Prompt"} {badge}
            </h4>
            {p.instructions && <div className="lesson-text">{p.instructions}</div>}
            {p.imageUrl && (
              <img src={p.imageUrl} className="diagram-image" style={{ margin: "10px 0" }} alt="" />
            )}
            <div className="prompt-work" style={{ marginTop: 12 }}>
              {cat.key === "writing" ? (
                <WritingPrompt
                  prompt={p}
                  submitContext={{ unitId, categoryKey: cat.key }}
                  onSubmitted={onSubmitted}
                />
              ) : (
                <SpeakingPrompt
                  prompt={p}
                  submitContext={{ unitId, categoryKey: cat.key }}
                  onSubmitted={onSubmitted}
                />
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
    </>
  );
}
