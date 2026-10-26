"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useRecorder } from "@/lib/client/useRecorder";
import { useDialog } from "@/components/ui/Dialog";
import SubmissionResultModal from "@/components/student/SubmissionResultModal";
import {
  toeicTask,
  effectivePrep,
  effectiveResponse,
  countWords,
  formatTimerSec,
  hasRequiredWord,
} from "@/lib/toeicTasks";

// submitContext: { unitId, categoryKey } (Lesson) hoặc { testId, skill } (Mock Test)
export const WritingPrompt = forwardRef(function WritingPrompt(
  { prompt, submitContext, onSubmitted, resubmit = false },
  ref
) {
  const dialog = useDialog();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pasteHint, setPasteHint] = useState(false);
  const [result, setResult] = useState(null); // { isLate, dueAt }
  const hintTimer = useRef(null);
  const task = toeicTask(prompt && prompt.taskType);
  const isToeic = !!(task && task.skill === "writing");
  const reqWords =
    isToeic && task.needsRequiredWords
      ? (prompt.requiredWords || []).map((w) => String(w || "").trim()).filter(Boolean)
      : [];
  const words = isToeic ? countWords(text) : 0;

  // Bài Writing phải tự gõ — chặn dán / kéo-thả văn bản vào ô soạn.
  function blockPaste(e) {
    e.preventDefault();
    setPasteHint(true);
    clearTimeout(hintTimer.current);
    hintTimer.current = setTimeout(() => setPasteHint(false), 2500);
  }

  async function doSubmit(essayText) {
    setBusy(true);
    try {
      const res = await api.student.submit({
        kind: "writing",
        ...submitContext,
        promptId: prompt.id,
        essayText,
      });
      setText("");
      setResult({ isLate: !!(res && res.isLate), dueAt: res && res.dueAt });
      onSubmitted && (await onSubmitted());
    } catch (e) {
      dialog.alert({ tone: "error", title: "Submission failed", message: e.message });
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    if (!text.trim()) {
      dialog.toast("Please type your essay before submitting.", "error");
      return;
    }
    if (resubmit) {
      const ok = await dialog.confirm({
        title: "Nộp lại bài?",
        message: "Bạn đã nộp bài này và đang chờ giáo viên chấm. Nộp lại sẽ THAY bài cũ.",
        confirmText: "Nộp lại",
      });
      if (!ok) return;
    }
    await doSubmit(text.trim());
  }

  // Gọi từ ngoài (vd: vi phạm rời tab quá số lần cho phép) — nộp ngay bài
  // đang gõ dở nếu có, bỏ qua xác nhận "nộp lại". Không có gì để nộp thì thôi.
  useImperativeHandle(ref, () => ({
    forceSubmit: async () => {
      if (busy || result) return;
      const t = text.trim();
      if (!t) return;
      await doSubmit(t);
    },
  }));

  return (
    <>
      {reqWords.length > 0 && (
        <div className="toeic-req-words">
          <span className="toeic-req-label">Required words:</span>
          {reqWords.map((w, i) => {
            const hit = hasRequiredWord(text, w);
            return (
              <span key={i} className={"toeic-word-chip" + (hit ? " is-used" : "")}>
                {hit ? `✓ ${w}` : w}
              </span>
            );
          })}
        </div>
      )}
      <textarea
        rows={20}
        className="essay-input"
        placeholder="Type your essay here..."
        style={{ width: "100%" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onPaste={blockPaste}
        onDrop={blockPaste}
      />
      {isToeic && (
        <div className="toeic-writing-meta">
          <span className="toeic-word-count">
            {words} {words === 1 ? "word" : "words"}
            {task.wordTarget ? ` · Target: ~${task.wordTarget} words` : ""}
          </span>
        </div>
      )}
      <p style={{ margin: "4px 0 0", color: "var(--muted)", fontSize: ".8rem" }}>
        <svg className="icon"><use href="#icon-info" /></svg> Copy &amp; paste is disabled — please type your answer.
      </p>
      {pasteHint && (
        <p className="notice warn" style={{ marginTop: 8 }}>
          <svg className="icon"><use href="#icon-warning" /></svg> Pasting is not allowed for this task.
        </p>
      )}
      <button
        type="button"
        className="btn btn-essay-submit"
        style={{ marginTop: 10 }}
        disabled={busy}
        onClick={submit}
      >
        {resubmit ? "Nộp lại bài" : "Submit Essay"}
      </button>

      <SubmissionResultModal
        open={!!result}
        onClose={() => setResult(null)}
        variant="prompt"
        skill="writing"
        itemLabel={prompt.title}
        isLate={result?.isLate}
        dueAt={result?.dueAt}
      />
    </>
  );
});

// Thanh công cụ luyện tập Speaking TOEIC trong Lesson (mục 5.1): nhãn dạng đề,
// nút phát audio câu hỏi (tối đa audioPlays lần), và đồng hồ tham khảo Prep -> Speak
// (đổi màu khi hết giờ, không tự dừng ghi âm).
function ToeicSpeakingPracticeBar({ prompt, task }) {
  const prepTotal = effectivePrep(prompt) ?? 0;
  const speakTotal = effectiveResponse(prompt) ?? 0;
  const maxPlays = Number(prompt.audioPlays) === 2 ? 2 : 1;

  const [timer, setTimer] = useState({ phase: "idle", left: prepTotal });
  const [playsUsed, setPlaysUsed] = useState(0);
  const [qPlaying, setQPlaying] = useState(false);
  const [audioErr, setAudioErr] = useState("");
  const qAudioRef = useRef(null);

  useEffect(() => {
    setTimer({ phase: "idle", left: prepTotal });
    setPlaysUsed(0);
    setQPlaying(false);
    setAudioErr("");
  }, [prompt.id, prepTotal, speakTotal]);

  useEffect(() => {
    if (timer.phase !== "prep" && timer.phase !== "speak") return;
    const id = setInterval(() => {
      setTimer((cur) => {
        if (cur.phase === "prep") {
          if (cur.left > 1) return { phase: "prep", left: cur.left - 1 };
          return speakTotal > 0 ? { phase: "speak", left: speakTotal } : { phase: "done", left: 0 };
        }
        if (cur.phase === "speak") {
          if (cur.left > 1) return { phase: "speak", left: cur.left - 1 };
          return { phase: "done", left: 0 };
        }
        return cur;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [timer.phase, speakTotal]);

  function startTimer() {
    if (prepTotal > 0) setTimer({ phase: "prep", left: prepTotal });
    else if (speakTotal > 0) setTimer({ phase: "speak", left: speakTotal });
    else setTimer({ phase: "done", left: 0 });
  }

  function resetTimer() {
    setTimer({ phase: "idle", left: prepTotal });
  }

  function playQuestionAudio() {
    if (qPlaying || playsUsed >= maxPlays) return;
    const el = qAudioRef.current;
    if (!el) return;
    setAudioErr("");
    try {
      el.currentTime = 0;
    } catch {}
    setQPlaying(true);
    const p = el.play();
    if (p && p.catch) {
      p.catch(() => {
        setQPlaying(false);
        setAudioErr("Unable to play question audio.");
      });
    }
  }

  const prepShown =
    timer.phase === "idle" ? prepTotal : timer.phase === "prep" ? timer.left : 0;
  const speakShown =
    timer.phase === "idle" || timer.phase === "prep"
      ? speakTotal
      : timer.phase === "speak"
      ? timer.left
      : 0;

  return (
    <div className="toeic-speaking-bar">
      <div className="toeic-speaking-top">
        <span className="pill pill-info toeic-task-label">{task.label}</span>
        {prompt.audioUrl && (
          <>
            <audio
              ref={qAudioRef}
              src={prompt.audioUrl}
              preload="auto"
              onEnded={() => {
                setQPlaying(false);
                setPlaysUsed((n) => n + 1);
              }}
              onError={() => {
                if (qPlaying) {
                  setQPlaying(false);
                  setAudioErr("Unable to play question audio.");
                }
              }}
            />
            <button
              type="button"
              className="btn secondary toeic-q-audio-btn"
              disabled={qPlaying || playsUsed >= maxPlays}
              onClick={playQuestionAudio}
            >
              <svg className="icon"><use href="#icon-headphones" /></svg>{" "}
              {qPlaying
                ? maxPlays > 1
                  ? `Playing question (${playsUsed + 1}/${maxPlays})...`
                  : "Playing question..."
                : playsUsed >= maxPlays
                ? maxPlays > 1
                  ? `Question audio played (${maxPlays}/${maxPlays})`
                  : "Question audio played"
                : maxPlays > 1
                ? `Play question audio (${playsUsed + 1}/${maxPlays})`
                : "Play question audio"}
            </button>
          </>
        )}
      </div>
      {audioErr && (
        <p className="notice warn" style={{ margin: "6px 0 0", fontSize: ".82rem" }}>
          <svg className="icon"><use href="#icon-warning" /></svg> {audioErr}
        </p>
      )}
      <div
        className={
          "toeic-ref-timer phase-" +
          timer.phase +
          (timer.phase === "done" ? " is-expired" : "")
        }
      >
        <svg className="icon"><use href="#icon-clock" /></svg>
        <span className="toeic-ref-times">
          <span className={timer.phase === "prep" ? "is-active" : ""}>
            Prep {formatTimerSec(prepShown)}
          </span>
          {" · "}
          <span className={timer.phase === "speak" ? "is-active" : ""}>
            Speak {formatTimerSec(speakShown)}
          </span>
        </span>
        {timer.phase !== "idle" && (
          <span className="toeic-ref-phase">
            {timer.phase === "prep"
              ? "Preparing..."
              : timer.phase === "speak"
              ? "Speak now"
              : "Time's up"}
          </span>
        )}
        <button
          type="button"
          className="btn secondary toeic-timer-btn"
          onClick={timer.phase === "idle" ? startTimer : resetTimer}
        >
          {timer.phase === "idle" ? "Start" : "Reset"}
        </button>
      </div>
    </div>
  );
}

export const SpeakingPrompt = forwardRef(function SpeakingPrompt(
  { prompt, submitContext, onSubmitted, resubmit = false },
  ref
) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const { recording, blobUrl, hint, toggle, stop, clear, getBlob } = useRecorder({
    onError: ({ title, message }) => dialog.alert({ tone: "error", title, message }),
  });
  const task = toeicTask(prompt && prompt.taskType);
  const isToeic = !!(task && task.skill === "speaking");

  async function doSubmit(blob) {
    setBusy(true);
    try {
      const { audioUrl, audioPublicId } = await api.student.uploadSpeakingAudio(blob);
      const res = await api.student.submit({
        kind: "speaking",
        ...submitContext,
        promptId: prompt.id,
        audioUrl,
        audioPublicId,
      });
      clear();
      setBusy(false);
      setResult({ isLate: !!(res && res.isLate), dueAt: res && res.dueAt });
      onSubmitted && (await onSubmitted());
    } catch (e) {
      dialog.alert({ tone: "error", title: "Submission failed", message: e.message });
      setBusy(false);
    }
  }

  async function submit() {
    const blob = getBlob();
    if (!blob) {
      dialog.toast("Please record audio before submitting.", "error");
      return;
    }
    if (resubmit) {
      const ok = await dialog.confirm({
        title: "Nộp lại bài?",
        message: "Bạn đã nộp bài ghi âm này và đang chờ giáo viên chấm. Nộp lại sẽ THAY bài cũ.",
        confirmText: "Nộp lại",
      });
      if (!ok) return;
    }
    await doSubmit(blob);
  }

  // Gọi từ ngoài khi vi phạm rời tab quá số lần cho phép — nếu đang ghi âm
  // thì dừng lại rồi nộp ngay bản ghi đó; chưa ghi gì thì bỏ qua (không có
  // gì để nộp).
  useImperativeHandle(ref, () => ({
    forceSubmit: async () => {
      if (busy || result) return;
      const blob = await stop();
      if (!blob) return;
      await doSubmit(blob);
    },
  }));

  return (
    <>
      {isToeic && <ToeicSpeakingPracticeBar prompt={prompt} task={task} />}
      <button type="button" className="btn btn-rec-toggle" onClick={toggle}>
        <svg className="icon"><use href={recording ? "#icon-cross" : "#icon-mic"} /></svg>{" "}
        {recording ? "Stop Recording" : blobUrl ? "Record Again" : "Start Recording"}
      </button>
      <span className="rec-hint" style={{ marginLeft: 10, color: "var(--muted)", fontSize: ".85rem" }}>
        {hint}
      </span>
      <div className="rec-preview" style={{ display: blobUrl ? "block" : "none", marginTop: 12 }}>
        <audio controls className="rec-audio" style={{ width: "100%" }} src={blobUrl || undefined} />
        <button
          type="button"
          className="btn btn-rec-submit"
          style={{ marginTop: 10 }}
          disabled={busy}
          onClick={submit}
        >
          {busy ? "Uploading..." : resubmit ? "Nộp lại bài" : "Submit Recording"}
        </button>
      </div>

      <SubmissionResultModal
        open={!!result}
        onClose={() => setResult(null)}
        variant="prompt"
        skill="speaking"
        itemLabel={prompt.title}
        isLate={result?.isLate}
        dueAt={result?.dueAt}
      />
    </>
  );
});
