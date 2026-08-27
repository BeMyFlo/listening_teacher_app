"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client/api";

// submitContext: { unitId, categoryKey } (Lesson) hoặc { testId, skill } (Mock Test)
export function WritingPrompt({ prompt, submitContext, onSubmitted }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!text.trim()) {
      alert("Please type your essay before submitting.");
      return;
    }
    setBusy(true);
    try {
      await api.student.submit({
        kind: "writing",
        ...submitContext,
        promptId: prompt.id,
        essayText: text.trim(),
      });
      setText("");
      onSubmitted && (await onSubmitted());
    } catch (e) {
      alert("Submission failed: " + e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <textarea
        rows={8}
        className="essay-input"
        placeholder="Type your essay here..."
        style={{ width: "100%" }}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        type="button"
        className="btn btn-essay-submit"
        style={{ marginTop: 10 }}
        disabled={busy}
        onClick={submit}
      >
        Submit Essay
      </button>
    </>
  );
}

export function SpeakingPrompt({ prompt, submitContext, onSubmitted }) {
  const [recording, setRecording] = useState(false);
  const [blobUrl, setBlobUrl] = useState("");
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const recRef = useRef(null);

  async function toggle() {
    if (recording && recRef.current?.mr?.state === "recording") {
      recRef.current.mr.stop();
      return;
    }
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      alert("Your browser does not support audio recording.");
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
        setHint("");
      };
      mr.start();
      setRecording(true);
      setBlobUrl("");
      setHint("Recording...");
    } catch (e) {
      alert("Unable to access microphone: " + e.message);
    }
  }

  async function submit() {
    const blob = recRef.current?.blob;
    if (!blob) {
      alert("Please record audio before submitting.");
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
      });
      recRef.current = null;
      setBlobUrl("");
      onSubmitted && (await onSubmitted());
    } catch (e) {
      alert("Submission failed: " + e.message);
      setBusy(false);
    }
  }

  return (
    <>
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
          {busy ? "Uploading..." : "Submit Recording"}
        </button>
      </div>
    </>
  );
}
