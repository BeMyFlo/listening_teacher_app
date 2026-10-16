"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { promptAttempts } from "@/lib/student/submissions";
import { LESSON_CATS } from "@/lib/student/constants";
import { getReflectionQuestions } from "@/lib/grading/reflection";
import { useDialog } from "@/components/ui/Dialog";
import RubricResult from "@/components/RubricResult";
import ReflectionLogForm from "@/components/student/ReflectionLogForm";
import SubmissionStepper from "@/components/student/SubmissionStepper";

const WORD_LIMIT = 250;
const wordCount = (s) => (s.trim() ? s.trim().split(/\s+/).length : 0);

function fmtDate(d) {
  return d
    ? new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" })
    : "";
}

// P3 (Speaking) — ghi âm lại, tái dùng logic MediaRecorder giống SpeakingPrompt
// nhưng thêm badge "Lần 2" và nút "Ghi âm lại" theo đúng thiết kế.
function ResubmitSpeaking({ prompt, submitContext, parentId, onSubmitted }) {
  const dialog = useDialog();
  const [recording, setRecording] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const recRef = useRef(null);

  async function toggle() {
    if (recording && recRef.current?.mr?.state === "recording") {
      recRef.current.mr.stop();
      return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      dialog.alert({ tone: "error", title: "Not supported", message: "Your browser does not support audio recording." });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      const state = { mr, chunks: [], stream, blob: null };
      recRef.current = state;
      mr.ondataavailable = (e) => e.data?.size && state.chunks.push(e.data);
      mr.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        state.blob = new Blob(state.chunks, { type: mr.mimeType || "audio/webm" });
        setBlobUrl(URL.createObjectURL(state.blob));
        setRecording(false);
      };
      mr.start();
      setRecording(true);
      setBlobUrl("");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Microphone error", message: e.message });
    }
  }

  async function submit() {
    const blob = recRef.current?.blob;
    if (!blob) {
      dialog.toast("Please record your answer before submitting.", "error");
      return;
    }
    setBusy(true);
    try {
      const { audioUrl, audioPublicId } = await api.student.uploadSpeakingAudio(blob);
      await api.student.submit({
        kind: "speaking",
        ...submitContext,
        promptId: prompt.id,
        audioUrl,
        audioPublicId,
        parentSubmissionId: parentId,
      });
      dialog.toast("Second recording submitted");
      onSubmitted && (await onSubmitted());
    } catch (e) {
      dialog.alert({ tone: "error", title: "Submission failed", message: e.message });
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>P3 · Record again</h3>
        <span className="pill pill-warn">Attempt 2</span>
      </div>
      <button type="button" className="btn btn-rec-toggle" onClick={toggle}>
        <svg className="icon"><use href={recording ? "#icon-cross" : "#icon-mic"} /></svg>{" "}
        {recording ? "Stop recording" : blobUrl ? "Record again" : "Start recording"}
      </button>
      {blobUrl && (
        <div style={{ marginTop: 12 }}>
          <audio controls style={{ width: "100%" }} src={blobUrl} />
          <button type="button" className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={submit}>
            {busy ? "Submitting..." : "Submit recording"}
          </button>
        </div>
      )}
    </div>
  );
}

// P3 (Writing) — viết lại bài, đếm từ, đối chiếu với bản gốc.
function ResubmitWriting({ prompt, submitContext, parentId, onSubmitted }) {
  const dialog = useDialog();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const words = wordCount(text);

  async function submit() {
    if (!text.trim()) {
      dialog.toast("Please rewrite your essay before submitting.", "error");
      return;
    }
    setBusy(true);
    try {
      await api.student.submit({
        kind: "writing",
        ...submitContext,
        promptId: prompt.id,
        essayText: text.trim(),
        parentSubmissionId: parentId,
      });
      dialog.toast("Rewritten essay submitted");
      onSubmitted && (await onSubmitted());
    } catch (e) {
      dialog.alert({ tone: "error", title: "Submission failed", message: e.message });
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="page-head" style={{ marginBottom: 12 }}>
        <h3 style={{ margin: 0 }}>P3 · Rewrite</h3>
        <span className="pill pill-warn">Attempt 2</span>
      </div>
      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: ".85rem" }}>
        Apply exactly what you wrote in your Reflection Log, then rewrite the essay using your
        teacher's feedback.
      </p>
      <textarea
        rows={8}
        className="essay-input"
        style={{ width: "100%" }}
        placeholder="Rewrite your essay here, paying attention to the grammar, linking words and vocabulary you noted above..."
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <span style={{ color: "var(--muted)", fontSize: ".85rem" }}>{words} / {WORD_LIMIT} words</span>
        <button type="button" className="btn" disabled={busy} onClick={submit}>
          {busy ? "Submitting..." : "Submit rewrite"}
        </button>
      </div>
    </div>
  );
}

export default function PromptSubmissionPage() {
  const { unitId, promptId } = useParams();
  const router = useRouter();
  const dialog = useDialog();
  const [unit, setUnit] = useState(null);
  const [err, setErr] = useState("");
  const [reflBusy, setReflBusy] = useState(false);
  const { subs, refresh } = useMySubmissions();

  useEffect(() => {
    api.student.getUnit(unitId).then((d) => setUnit(d.unit)).catch((e) => setErr(e.message));
  }, [unitId]);

  if (err) {
    return (
      <section>
        <div className="card">
          <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>
        </div>
      </section>
    );
  }
  if (!unit) return <section><div className="notice info">Loading...</div></section>;

  let cat = null;
  let prompt = null;
  for (const c of unit.categories || []) {
    const p = (c.prompts || []).find((x) => String(x.id) === String(promptId));
    if (p) {
      cat = c;
      prompt = p;
      break;
    }
  }
  if (!prompt) {
    return (
      <section>
        <div className="card">
          <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> Submission not found.</div>
        </div>
      </section>
    );
  }

  const catMeta = LESSON_CATS.find((c) => c.key === cat.key);
  const { attempt1, attempt2 } = promptAttempts(subs, promptId);
  const submitContext = { unitId, categoryKey: cat.key };

  const step0Done = !!(attempt1 && attempt1.gradingStatus === "graded");
  const step1Done = !!(attempt1 && attempt1.reflectionLog);
  const step2Done = !!attempt2;
  const current = !step0Done ? 0 : !step1Done ? 1 : !step2Done ? 2 : 3;

  async function submitReflection(answers) {
    setReflBusy(true);
    try {
      await api.student.saveReflection(attempt1._id, answers);
      dialog.toast("Reflection Log saved");
      await refresh();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Save failed", message: e.message });
    } finally {
      setReflBusy(false);
    }
  }

  return (
    <section>
      <div className="card">
        <p className="back-link" onClick={() => router.push(`/student/lessons/${unitId}`)}>
          <svg className="icon"><use href="#icon-arrow-left" /></svg> Lessons · {catMeta ? catMeta.label : cat.key} · Submission
        </p>

        <h2 style={{ marginBottom: 8 }}>
          {prompt.title || (cat.key === "speaking" ? "Speaking & Reflection Log" : "Corrected essay & Reflection Log")}
        </h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          <span className="pill pill-info">{catMeta ? catMeta.label : cat.key}</span>
          {attempt1 && <span className="pill pill-muted">Submitted {fmtDate(attempt1.submittedAt)}</span>}
        </div>

        <SubmissionStepper
          labels={cat.key === "speaking" ? ["Graded", "Reflection Log", "Record again"] : ["Corrected", "Reflection Log", "Rewrite"]}
          done={[step0Done, step1Done, step2Done]}
          current={current}
        />
      </div>

      <div className="card">
        <div className="page-head" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>P1 · {cat.key === "speaking" ? "Recording & Feedback" : "Corrections"}</h3>
          <span className="pill pill-muted">Read only</span>
        </div>
        {!attempt1 ? (
          <div className="empty-state">No submission for this task yet.</div>
        ) : attempt1.gradingStatus !== "graded" ? (
          <div className="notice info">Submitted — waiting for your teacher to grade it.</div>
        ) : (
          <RubricResult
            rubricVariant={attempt1.rubricVariant}
            criteria={attempt1.criteria}
            manualScore={attempt1.manualScore}
            manualFeedback={attempt1.manualFeedback}
            essayText={attempt1.essayText}
            annotations={attempt1.annotations}
            audioUrl={attempt1.audioUrl}
            transcript={attempt1.transcript}
            speakingNotes={attempt1.speakingNotes}
            priorities={attempt1.priorities}
            topicVocabulary={attempt1.topicVocabulary}
            improvedSample={attempt1.improvedSample}
            mainIssue={attempt1.mainIssue}
            showDescriptors={false}
            showTranscript={cat.key !== "speaking"}
            showBandHeader={cat.key !== "speaking"}
            showAnnotationList={false}
          />
        )}
      </div>

      {step0Done && (
        <ReflectionLogForm
          questions={getReflectionQuestions(cat.key)}
          value={attempt1.reflectionLog}
          busy={reflBusy}
          onSubmit={submitReflection}
        />
      )}

      {step1Done && !attempt2 && cat.key === "speaking" && (
        <ResubmitSpeaking prompt={prompt} submitContext={submitContext} parentId={attempt1._id} onSubmitted={refresh} />
      )}
      {step1Done && !attempt2 && cat.key === "writing" && (
        <ResubmitWriting prompt={prompt} submitContext={submitContext} parentId={attempt1._id} onSubmitted={refresh} />
      )}

      {attempt2 && (
        <div className="card">
          <div className="page-head" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>P3 · {cat.key === "speaking" ? "Record again" : "Rewrite"}</h3>
            <span className="pill pill-warn">Attempt 2</span>
          </div>
          {attempt2.gradingStatus !== "graded" ? (
            <div className="notice info">Resubmitted — waiting for your teacher to grade it.</div>
          ) : (
            <RubricResult
              rubricVariant={attempt2.rubricVariant}
              criteria={attempt2.criteria}
              manualScore={attempt2.manualScore}
              manualFeedback={attempt2.manualFeedback}
              essayText={attempt2.essayText}
              annotations={attempt2.annotations}
              audioUrl={attempt2.audioUrl}
              transcript={attempt2.transcript}
              speakingNotes={attempt2.speakingNotes}
              priorities={attempt2.priorities}
              topicVocabulary={attempt2.topicVocabulary}
              improvedSample={attempt2.improvedSample}
              mainIssue={attempt2.mainIssue}
              showDescriptors={false}
              showTranscript={cat.key !== "speaking"}
              showBandHeader={cat.key !== "speaking"}
              showAnnotationList={false}
            />
          )}
        </div>
      )}
    </section>
  );
}
