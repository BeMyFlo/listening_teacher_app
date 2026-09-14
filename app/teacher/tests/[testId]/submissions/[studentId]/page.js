"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import RubricGrader from "@/components/teacher/RubricGrader";
import RubricResult from "@/components/RubricResult";
import { useDialog } from "@/components/ui/Dialog";
import { pollAiGrade } from "@/lib/client/aiGrade";
import { TEST_SKILLS } from "@/lib/teacher/testBuilder";

function pct(score, total) {
  if (!total) return null;
  return Math.round((score / total) * 100);
}

const fmtDateTime = (d) =>
  d
    ? new Date(d).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "";

// Ring showing score/total as a filled arc — pure SVG, no chart lib.
function ScoreRing({ score, total }) {
  const percent = pct(score, total) || 0;
  const r = 52;
  const c = 2 * Math.PI * r;
  const offset = c - (percent / 100) * c;
  return (
    <svg width="132" height="132" viewBox="0 0 132 132" style={{ flexShrink: 0 }}>
      <circle cx="66" cy="66" r={r} fill="none" stroke="var(--pink-light)" strokeWidth="12" />
      <circle
        cx="66"
        cy="66"
        r={r}
        fill="none"
        stroke="var(--pink)"
        strokeWidth="12"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 66 66)"
      />
      <text x="66" y="63" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--ink)">
        {score}/{total}
      </text>
      <text x="66" y="84" textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--muted)">
        {percent}%
      </text>
    </svg>
  );
}

function MiniStat({ icon, iconChar, tone, label, value, sub }) {
  return (
    <div className={"stat-card-v2 tone-" + tone} style={{ minWidth: 130 }}>
      <div className="stat-top">
        <span className="label">{label}</span>
        <span className="stat-icon">
          {iconChar ? <b>{iconChar}</b> : <svg className="icon"><use href={"#icon-" + icon} /></svg>}
        </span>
      </div>
      <div className="value">{value}</div>
      {sub != null && <div className="sub">{sub}</div>}
    </div>
  );
}

const PAGE_SIZE = 10;
const STATUS_CHIPS = [
  { key: "all", label: "All" },
  { key: "correct", label: "Correct", icon: "check" },
  { key: "incorrect", label: "Incorrect", icon: "cross" },
  { key: "skipped", label: "Skipped" },
];

function bucketOf(d) {
  if (d.submittedText === "(blank)" || d.submittedText === "" || d.submittedText == null) return "skipped";
  return d.correct ? "correct" : "incorrect";
}

function QuestionReview({ detail }) {
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);

  const counts = useMemo(() => {
    const c = { all: detail.length, correct: 0, incorrect: 0, skipped: 0 };
    detail.forEach((d) => (c[bucketOf(d)] += 1));
    return c;
  }, [detail]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return detail.filter((d) => {
      if (status !== "all" && bucketOf(d) !== status) return false;
      if (!q) return true;
      return (
        String(d.label || "").toLowerCase().includes(q) ||
        String(d.submittedText || "").toLowerCase().includes(q) ||
        String(d.answerText || "").toLowerCase().includes(q)
      );
    });
  }, [detail, status, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const pageRows = filtered.slice((pageSafe - 1) * PAGE_SIZE, pageSafe * PAGE_SIZE);

  function setStatusAndReset(s) {
    setStatus(s);
    setPage(1);
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="page-head" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-clipboard" /></svg></div>
          <div>
            <h3 style={{ margin: 0 }}>Question Review</h3>
            <p className="page-sub" style={{ margin: "2px 0 0" }}>Review the student's answers and see the correct ones with explanations.</p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {STATUS_CHIPS.map((c) => (
            <button
              key={c.key}
              type="button"
              className={"qr-chip" + (status === c.key ? " active" : "")}
              onClick={() => setStatusAndReset(c.key)}
            >
              {c.icon && <svg className="icon"><use href={"#icon-" + c.icon} /></svg>}
              {c.label} <span className="count">{counts[c.key]}</span>
            </button>
          ))}
          <input
            type="text"
            placeholder="Search question or keyword..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 999, fontSize: ".85rem" }}
          />
        </div>
      </div>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 40, whiteSpace: "nowrap" }}>#</th>
              <th>Question</th>
              <th>Student answer</th>
              <th>Correct answer</th>
              <th>Explanation</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 && (
              <tr><td colSpan={7} style={{ textAlign: "center", color: "var(--muted)" }}>No questions match this filter.</td></tr>
            )}
            {pageRows.map((d) => {
              const bucket = bucketOf(d);
              const open = openId === d.id;
              return (
                <>
                  <tr key={d.id}>
                    <td style={{ whiteSpace: "nowrap" }}>{d.id}</td>
                    <td>{d.label}</td>
                    <td><span className={"answer-pill " + (bucket === "skipped" ? "blank" : bucket === "correct" ? "correct" : "wrong")}>{d.submittedText}</span></td>
                    <td><span className="answer-pill correct">{d.answerText}</span></td>
                    <td style={{ color: "var(--muted)" }}>{d.explanation ? "…" : "—"}</td>
                    <td>
                      <span className={"pill " + (bucket === "correct" ? "pill-ok" : bucket === "skipped" ? "pill-muted" : "pill-danger")}>
                        {bucket === "correct" ? "Correct" : bucket === "skipped" ? "Skipped" : "Incorrect"}
                      </span>
                    </td>
                    <td>
                      {d.explanation && (
                        <button type="button" className="btn secondary" style={{ padding: "5px 10px", fontSize: ".76rem" }} onClick={() => setOpenId(open ? null : d.id)}>
                          {open ? "Hide" : "View explanation"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {open && d.explanation && (
                    <tr key={d.id + "-exp"}>
                      <td></td>
                      <td colSpan={6} style={{ color: "var(--muted)", background: "var(--bg)", fontSize: ".85rem" }}>
                        {d.explanation}
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="qr-pagination">
          <button type="button" disabled={pageSafe <= 1} onClick={() => setPage(pageSafe - 1)}>
            <svg className="icon"><use href="#icon-chevron-right" style={{ transform: "rotate(180deg)" }} /></svg>
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={n === pageSafe ? "active" : ""} onClick={() => setPage(n)}>
              {n}
            </button>
          ))}
          <button type="button" disabled={pageSafe >= totalPages} onClick={() => setPage(pageSafe + 1)}>
            <svg className="icon"><use href="#icon-chevron-right" /></svg>
          </button>
        </div>
      )}
    </div>
  );
}

function AutoSkillPanel({ skill }) {
  if (!skill.submissionId) {
    return <div className="empty-state">Student hasn't attempted this skill yet.</div>;
  }
  const detail = skill.detail || [];
  const correctCount = detail.filter((d) => bucketOf(d) === "correct").length;
  const incorrectCount = detail.filter((d) => bucketOf(d) === "incorrect").length;
  const skippedCount = detail.filter((d) => bucketOf(d) === "skipped").length;
  const attempted = correctCount + incorrectCount;
  const accuracy = attempted ? Math.round((correctCount / attempted) * 100) : null;

  return (
    <div>
      <div className="card" style={{ display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
        <ScoreRing score={skill.score} total={skill.total} />
        <div style={{ flex: "1 1 220px" }}>
          <p style={{ margin: 0, color: "var(--muted)", fontSize: ".85rem", fontWeight: 600 }}>Total Score</p>
          <h2 style={{ margin: "2px 0 8px" }}>
            {skill.score}/{skill.total} <span style={{ color: "var(--muted)", fontWeight: 600, fontSize: "1rem" }}>({pct(skill.score, skill.total)}%)</span>
          </h2>
          <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: ".85rem" }}>
            <svg className="icon"><use href="#icon-calendar" /></svg> Submitted {fmtDateTime(skill.submittedAt)}
          </p>
          {skill.key === "listening" && (
            <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: ".85rem" }}>
              <svg className="icon"><use href="#icon-headphones" /></svg> Listened {skill.replayCount} time{skill.replayCount === 1 ? "" : "s"}
            </p>
          )}
          {skill.attempts > 1 && (
            <p style={{ margin: "4px 0", color: "var(--muted)", fontSize: ".85rem" }}>{skill.attempts} attempts</p>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <MiniStat tone="teal" icon="check-circle" label="Correct" value={correctCount} sub={pct(correctCount, detail.length) + "%"} />
          <MiniStat tone="pink" icon="cross" label="Incorrect" value={incorrectCount} sub={pct(incorrectCount, detail.length) + "%"} />
          <MiniStat tone="indigo" iconChar="–" label="Skipped" value={skippedCount} sub={pct(skippedCount, detail.length) + "%"} />
          <MiniStat tone="purple" icon="star" label="Accuracy" value={accuracy != null ? accuracy + "%" : "—"} sub={attempted ? `${correctCount} / ${attempted}` : null} />
        </div>
      </div>

      {detail.length > 0 && <QuestionReview detail={detail} />}
    </div>
  );
}

function GradeForm({ prompt, submissionId, kind, writingTask, onGraded }) {
  const dialog = useDialog();
  const graded = prompt.gradingStatus === "graded";
  const [editing, setEditing] = useState(!graded);
  const [busy, setBusy] = useState(false);

  if (graded && !editing) {
    return (
      <div style={{ marginTop: 10 }}>
        <RubricResult
          rubricVariant={prompt.rubricVariant}
          criteria={prompt.criteria}
          manualScore={prompt.manualScore}
          manualFeedback={prompt.manualFeedback}
          essayText={prompt.essayText}
          annotations={prompt.annotations}
          audioUrl={prompt.audioUrl}
          transcript={prompt.transcript}
          speakingNotes={prompt.speakingNotes}
          priorities={prompt.priorities}
          topicVocabulary={prompt.topicVocabulary}
          improvedSample={prompt.improvedSample}
          mainIssue={prompt.mainIssue}
          showDescriptors={false}
        />
        <button type="button" className="btn secondary" style={{ marginTop: 8, padding: "6px 12px" }} onClick={() => setEditing(true)}>
          Edit grade
        </button>
      </div>
    );
  }

  async function save(payload) {
    if (payload.publish === false && prompt.gradingStatus === "graded") {
      const ok = await dialog.confirm({
        title: "Move back to draft?",
        message: "This grade is live for the student. Saving a draft will hide it from them until you publish again.",
        confirmText: "Save draft",
      });
      if (!ok) return;
    }
    setBusy(true);
    try {
      await api.teacher.gradeSubmission(submissionId, payload);
      setEditing(false);
      dialog.toast(payload.publish === false ? "Draft saved — not visible to the student" : "Published to the student");
      onGraded && (await onGraded());
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to save grade", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <RubricGrader
        submission={{
          kind,
          submissionId,
          rubricVariant: prompt.rubricVariant,
          writingTask,
          gradingStatus: prompt.gradingStatus,
          criteria: prompt.criteria,
          manualScore: prompt.manualScore,
          manualFeedback: prompt.manualFeedback,
          essayText: prompt.essayText,
          annotations: prompt.annotations,
          audioUrl: prompt.audioUrl,
          transcript: prompt.transcript,
          speakingNotes: prompt.speakingNotes,
          gradeSource: prompt.gradeSource,
          priorities: prompt.priorities,
          topicVocabulary: prompt.topicVocabulary,
          improvedSample: prompt.improvedSample,
          mainIssue: prompt.mainIssue,
        }}
        busy={busy}
        onSave={save}
        onAiGrade={
          (kind === "writing" && prompt.essayText) || (kind === "speaking" && prompt.audioUrl)
            ? (onTick) => pollAiGrade(submissionId, { onTick })
            : undefined
        }
      />
    </div>
  );
}

function PromptRow({ prompt, onGraded }) {
  const done = !!prompt.submissionId;
  return (
    <div className="lesson-block" style={{ marginBottom: 10 }}>
      <h4 style={{ margin: "0 0 4px" }}>{prompt.title || "Prompt"}</h4>
      {prompt.instructions && (
        <div className="prompt-instructions" style={{ fontSize: ".86rem" }}>
          {prompt.instructions.split(/\n{2,}/).map((para, k) => (
            <p key={k}>{para}</p>
          ))}
        </div>
      )}
      {!done ? (
        <span className="pill pill-muted">Not started</span>
      ) : (
        <>
          <p style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: ".8rem" }}>
            Submitted {fmtDateTime(prompt.submittedAt)}
            {prompt.attempts > 1 && <> · {prompt.attempts} attempts</>}
          </p>
          <GradeForm
            prompt={prompt}
            submissionId={prompt.submissionId}
            kind={prompt.kind}
            writingTask={prompt.writingTask}
            onGraded={onGraded}
          />
        </>
      )}
    </div>
  );
}

function PromptSkillPanel({ skill, onGraded }) {
  if (skill.itemsTotal === 0) return <div className="empty-state">No prompts in this skill.</div>;
  return (
    <div>
      <p style={{ margin: "0 0 10px", color: "var(--muted)", fontSize: ".9rem" }}>
        {skill.submitted}/{skill.itemsTotal} submitted
      </p>
      {skill.prompts.map((p) => (
        <PromptRow key={p._id} prompt={p} onGraded={onGraded} />
      ))}
    </div>
  );
}

function Inner() {
  const { testId, studentId } = useParams();
  const router = useRouter();
  const search = useSearchParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [active, setActive] = useState(search.get("tab") || "listening");

  function load() {
    return api.teacher
      .testSubmissions(testId, studentId)
      .then(setData)
      .catch((e) => setErr(e.message));
  }
  useEffect(() => {
    load();
  }, [testId, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const head = (
    <div className="page-head">
      <div className="head-left">
        <div className="page-head-icon"><svg className="icon"><use href="#icon-user" /></svg></div>
        <div>
          <h1>{data ? data.student.name : "Student"}</h1>
          <p className="page-sub">
            {data ? `${data.student.className || "No class"} · ${data.test.title}` : ""}
          </p>
        </div>
      </div>
    </div>
  );

  const back = (
    <p className="back-link" onClick={() => router.push(`/teacher/tests/${testId}/submissions`)}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to student list
    </p>
  );

  if (err)
    return (
      <div className="tab-panel active">
        {head}{back}
        <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>
      </div>
    );
  if (!data)
    return <div className="tab-panel active">{head}<div className="notice info">Loading...</div></div>;

  const skillByKey = Object.fromEntries(data.skills.map((s) => [s.key, s]));
  const activeSkill = skillByKey[active];

  return (
    <div className="tab-panel active">
      {head}
      {back}

      <div className="subject-toggle skill-tabs" style={{ marginBottom: 14 }}>
        {TEST_SKILLS.map((s) => {
          const sk = skillByKey[s.key];
          const attempted = sk && (sk.kind === "auto" ? !!sk.submissionId : sk.submitted > 0);
          const needsGrading = sk && sk.kind === "prompt" && sk.submitted > sk.prompts.filter((p) => p.gradingStatus === "graded").length;
          return (
            <button
              key={s.key}
              type="button"
              className={s.key === active ? "active" : ""}
              onClick={() => setActive(s.key)}
            >
              <svg className="icon"><use href={"#icon-" + s.icon} /></svg> {s.label}
              {attempted && !needsGrading && (
                <span className="cat-done" style={{ marginLeft: 6 }}><svg className="icon"><use href="#icon-check" /></svg></span>
              )}
              {needsGrading && <span className="pill pill-warn" style={{ marginLeft: 6 }}>Grade</span>}
            </button>
          );
        })}
      </div>

      <div className="card">
        {activeSkill.kind === "auto" ? (
          <AutoSkillPanel skill={activeSkill} />
        ) : (
          <PromptSkillPanel skill={activeSkill} onGraded={load} />
        )}
      </div>
    </div>
  );
}

export default function StudentTestSubmissionPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <Inner />
    </Suspense>
  );
}
