"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Hook ghi âm trình duyệt (MediaRecorder) tách từ SpeakingPrompt để PromptBlock
// (IELTS + TOEIC Lesson) và ToeicSpeakingRunner (Mock Test Speaking TOEIC) dùng chung.
export function useRecorder({ onError } = {}) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [hint, setHint] = useState("");
  const recRef = useRef(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  // Dừng các track micro còn đang mở khi unmount.
  useEffect(() => {
    return () => {
      const cur = recRef.current;
      if (cur && cur.stream) {
        cur.stream.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const stop = useCallback(() => {
    const cur = recRef.current;
    if (!cur || !cur.mr || cur.mr.state !== "recording") {
      return Promise.resolve(cur?.blob || null);
    }
    return new Promise((resolve) => {
      const mr = cur.mr;
      const prevOnStop = mr.onstop;
      mr.onstop = (e) => {
        if (prevOnStop) prevOnStop(e);
        resolve(recRef.current?.blob || cur.blob || null);
      };
      mr.stop();
    });
  }, []);

  const start = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices || !window.MediaRecorder) {
      onErrorRef.current &&
        onErrorRef.current({
          code: "unsupported",
          title: "Not supported",
          message: "Your browser does not support audio recording.",
        });
      return false;
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
        setBlob(state.blob);
        setBlobUrl(URL.createObjectURL(state.blob));
        setRecording(false);
        setHint("");
      };
      mr.start();
      setRecording(true);
      setBlob(null);
      setBlobUrl("");
      setHint("Recording...");
      return true;
    } catch (e) {
      onErrorRef.current &&
        onErrorRef.current({
          code: "mic",
          title: "Microphone error",
          message: "Unable to access microphone: " + e.message,
          error: e,
        });
      return false;
    }
  }, []);

  const toggle = useCallback(async () => {
    if (recording && recRef.current?.mr?.state === "recording") {
      await stop();
      return;
    }
    await start();
  }, [recording, start, stop]);

  const clear = useCallback(() => {
    const cur = recRef.current;
    if (cur && cur.stream) {
      cur.stream.getTracks().forEach((t) => t.stop());
    }
    recRef.current = null;
    setRecording(false);
    setBlob(null);
    setBlobUrl("");
    setHint("");
  }, []);

  const getBlob = useCallback(() => recRef.current?.blob || null, []);

  return {
    recording,
    blob,
    blobUrl,
    hint,
    start,
    stop,
    toggle,
    clear,
    getBlob,
  };
}
