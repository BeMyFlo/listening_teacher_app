"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import RubricGrader from "@/components/teacher/RubricGrader";
import RubricResult from "@/components/RubricResult";
import { useDialog } from "@/components/ui/Dialog";
import { pollAiGrade } from "@/lib/client/aiGrade";

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

function LateLine({ item }) {
  if (!item.isLate) return null;
  const days = item.daysLate;
  return (
    <p style={{ margin: "4px 0 0", color: "var(--red)", fontWeight: 600, fontSize: ".82rem" }}>
      <svg className="icon"><use href="#icon-warning" /></svg>{" "}
      Submitted late
      {days ? ` — ${days} day${days === 1 ? "" : "s"} after the deadline` : ""}
      {item.dueAt ? ` (due ${fmtDateTime(item.dueAt)})` : ""}
    </p>
  );
}

function QuestionTable({ detail }) {
  return (
    <div className="table-wrap" style={{ marginTop: 8 }}>
      <table className="data-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Question</th>
            <th>Student answer</th>
            <th>Correct answer</th>
            <th style={{ width: 60 }}></th>
          </tr>
        </thead>
        <tbody>
          {detail.map((d) => (
            <tr key={d.id} style={{ background: d.correct ? "#DFF7E9" : "#FFE0E2" }}>
              <td>{d.id}</td>
              <td>{d.label}</td>
              <td>{d.submittedText}</td>
              <td>{d.correct ? "" : <b>{d.answerText}</b>}</td>
              <td>
                <span className={"result-mark " + (d.correct ? "correct" : "wrong")}>
                  <svg className="icon"><use href={d.correct ? "#icon-check" : "#icon-cross"} /></svg>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ExerciseRow({ ex }) {
  const [open, setOpen] = useState(false);
  const done = !!ex.submissionId;
  return (
    <div className="lesson-block" style={{ marginBottom: 10 }}>
      <div className="lesson-block-head">
        <div>
          <h4 style={{ margin: 0 }}>
            {ex.group ? ex.group + " — " : ""}{ex.title}
          </h4>
          <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: ".85rem" }}>
            {done ? (
              <>
                <b style={{ color: "var(--ink)" }}>{ex.score}/{ex.total}</b>
                {" "}({pct(ex.score, ex.total)}%) · {ex.questionCount} questions
                {ex.attempts > 1 && <> · {ex.attempts} attempts</>}
                {" · "}{new Date(ex.submittedAt).toLocaleString("en-US")}
              </>
            ) : (
              <span className="pill pill-muted">Not started</span>
            )}
          </p>
          {done && <LateLine item={ex} />}
        </div>
        {done && ex.detail && ex.detail.length > 0 && (
          <button type="button" className="btn secondary" style={{ padding: "6px 12px" }} onClick={() => setOpen((v) => !v)}>
            {open ? "Hide" : "Review"}
          </button>
        )}
      </div>
      {open && ex.detail && <QuestionTable detail={ex.detail} />}
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
          showDescriptors={false}
        />
        <button type="button" className="btn secondary" style={{ marginTop: 8, padding: "6px 12px" }} onClick={() => setEditing(true)}>
          Edit grade
        </button>
      </div>
    );
  }

  async function save(payload) {
    setBusy(true);
    try {
      await api.teacher.gradeSubmission(submissionId, payload);
      setEditing(false);
      dialog.toast("Grade saved");
      onGraded && (await onGraded());
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to save grade", message: e.message });
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
          criteria: prompt.criteria,
          manualScore: prompt.manualScore,
          manualFeedback: prompt.manualFeedback,
          essayText: prompt.essayText,
          annotations: prompt.annotations,
          audioUrl: prompt.audioUrl,
          transcript: prompt.transcript,
          speakingNotes: prompt.speakingNotes,
          gradeSource: prompt.gradeSource,
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

const REFLECTION_LABELS = {
  writing: ["Lỗi mà em sai nhiều nhất trong bài", "Từ vựng cần thiết", "Ở bài viết sau, em sẽ..."],
  speaking: ["Lỗi/điểm yếu mà em mắc nhiều nhất khi nói", "Từ vựng / cách phát âm cần luyện thêm", "Ở lần ghi âm sau, em sẽ..."],
};

function ReflectionLogView({ kind, log }) {
  if (!log) return null;
  const [l1, l2, l3] = REFLECTION_LABELS[kind] || REFLECTION_LABELS.writing;
  return (
    <div className="card" style={{ marginTop: 10, marginBottom: 10 }}>
      <div className="page-head" style={{ marginBottom: 8 }}>
        <h4 style={{ margin: 0 }}>Reflection Log — học sinh tự nhận xét</h4>
      </div>
      <p style={{ margin: "0 0 6px" }}><b>{l1}:</b> {log.mistake}</p>
      {log.focusTags && log.focusTags.length > 0 && (
        <p style={{ margin: "0 0 6px" }}>
          <b>{l2}:</b>{" "}
          {log.focusTags.map((t, i) => (
            <span className="pill pill-info" key={i} style={{ marginRight: 4 }}>{t}</span>
          ))}
        </p>
      )}
      <p style={{ margin: 0 }}><b>{l3}:</b> {log.nextAction}</p>
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
            {prompt.attempt2 ? "Attempt 1 · " : ""}Submitted {new Date(prompt.submittedAt).toLocaleString("en-US")}
          </p>
          <LateLine item={prompt} />
          <GradeForm
            prompt={prompt}
            submissionId={prompt.submissionId}
            kind={prompt.kind}
            writingTask={prompt.writingTask}
            onGraded={onGraded}
          />

          <ReflectionLogView kind={prompt.kind} log={prompt.reflectionLog} />

          {prompt.attempt2 && (
            <div style={{ marginTop: 12, borderTop: "1px dashed var(--border)", paddingTop: 12 }}>
              <span className="pill pill-warn" style={{ marginBottom: 6, display: "inline-block" }}>Lần 2</span>
              <p style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: ".8rem" }}>
                Submitted {new Date(prompt.attempt2.submittedAt).toLocaleString("en-US")}
              </p>
              <LateLine item={prompt.attempt2} />
              <GradeForm
                prompt={prompt.attempt2}
                submissionId={prompt.attempt2.submissionId}
                kind={prompt.kind}
                writingTask={prompt.writingTask}
                onGraded={onGraded}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function StudentUnitSubmissionPage() {
  const { unitId, studentId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");

  function load() {
    return api.teacher
      .unitSubmissions(unitId, studentId)
      .then(setData)
      .catch((e) => setErr(e.message));
  }
  useEffect(() => {
    load();
  }, [unitId, studentId]); // eslint-disable-line react-hooks/exhaustive-deps

  const head = (
    <div className="page-head">
      <div className="head-left">
        <div className="page-head-icon"><svg className="icon"><use href="#icon-user" /></svg></div>
        <div>
          <h1>{data ? data.student.name : "Student"}</h1>
          <p className="page-sub">
            {data ? `${data.student.className || "No class"} · ${data.unit.name}` : ""}
          </p>
        </div>
      </div>
    </div>
  );

  const back = (
    <p className="back-link" onClick={() => router.push(`/teacher/lessons/${unitId}/submissions`)}>
      <svg className="icon"><use href="#icon-arrow-left" /></svg> Back to class list
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

  const lateCount = data.categories.reduce((n, cat) => {
    const items = cat.kind === "exercise" ? cat.exercises : cat.prompts;
    return n + (items || []).filter((i) => i.isLate).length;
  }, 0);

  return (
    <div className="tab-panel active">
      {head}
      {back}
      {data.student.dueAt && (
        <p className="back-link" style={{ cursor: "default", color: "var(--muted)" }}>
          <svg className="icon"><use href="#icon-clock" /></svg> Unit deadline: {fmtDateTime(data.student.dueAt)}
        </p>
      )}
      {lateCount > 0 && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> This student has {lateCount} late
          submission{lateCount === 1 ? "" : "s"} in this unit.
        </div>
      )}
      {data.categories.map((cat) => {
        const catDue = (data.student.deadlineByCategory || {})[cat.key];
        const ownDeadline = catDue && catDue !== data.student.dueAt;
        return (
        <div className="card" key={cat.key} style={{ marginBottom: 16 }}>
          <div className="page-head" style={{ marginBottom: 8 }}>
            <div className="head-left">
              <h3 style={{ margin: 0 }}>{cat.label}</h3>
              {ownDeadline && (
                <span className="pill pill-info" style={{ marginLeft: 8 }}>
                  Due {fmtDateTime(catDue)}
                </span>
              )}
            </div>
            <div style={{ color: "var(--muted)", fontSize: ".9rem" }}>
              {cat.kind === "exercise"
                ? cat.done > 0
                  ? `${cat.score}/${cat.total} · ${cat.done}/${cat.itemsTotal} exercises`
                  : `0/${cat.itemsTotal} exercises`
                : `${cat.submitted}/${cat.itemsTotal} submitted`}
            </div>
          </div>

          {cat.kind === "exercise" ? (
            cat.exercises.length === 0 ? (
              <div className="empty-state">No exercises in this section.</div>
            ) : (
              cat.exercises.map((ex) => <ExerciseRow key={ex._id} ex={ex} />)
            )
          ) : cat.prompts.length === 0 ? (
            <div className="empty-state">No prompts in this section.</div>
          ) : (
            cat.prompts.map((p) => <PromptRow key={p._id} prompt={p} onGraded={load} />)
          )}
        </div>
        );
      })}
    </div>
  );
}
