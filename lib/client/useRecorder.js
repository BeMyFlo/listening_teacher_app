"use client";

import { useCallback, useEffect, useRef, useState } from "react";

function isStreamLive(stream) {
  if (!stream || typeof stream.getTracks !== "function") return false;
  const tracks = stream.getTracks();
  return tracks.length > 0 && tracks.every((t) => t.readyState === "live");
}

function stopStreamTracks(stream) {
  if (!stream || typeof stream.getTracks !== "function") return;
  stream.getTracks().forEach((t) => {
    try {
      t.stop();
    } catch {}
  });
}

// Hook ghi âm trình duyệt (MediaRecorder) tách từ SpeakingPrompt để PromptBlock
// (IELTS + TOEIC Lesson) và ToeicSpeakingRunner (Mock Test Speaking TOEIC) dùng chung.
// `keepStream = false` (mặc định): mở/đóng stream theo từng lần ghi như hành vi cũ.
// `keepStream = true`: giữ lại MediaStream suốt bài thi để không xin quyền lại ở mỗi câu.
export function useRecorder({ onError, keepStream = false } = {}) {
  const [recording, setRecording] = useState(false);
  const [blob, setBlob] = useState(null);
  const [blobUrl, setBlobUrl] = useState("");
  const [hint, setHint] = useState("");
  const recRef = useRef(null);
  const streamRef = useRef(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const releaseStream = useCallback(() => {
    const cur = recRef.current;
    if (cur && cur.mr && cur.mr.state === "recording") {
      try {
        cur.mr.onstop = null;
        cur.mr.stop();
      } catch {}
    }
    if (cur && cur.stream) stopStreamTracks(cur.stream);
    if (streamRef.current) stopStreamTracks(streamRef.current);
    streamRef.current = null;
  }, []);

  // Dừng các track micro còn đang mở khi unmount.
  useEffect(() => {
    return () => {
      releaseStream();
    };
  }, [releaseStream]);

  const ensureStream = useCallback(async () => {
    if (typeof window === "undefined" || !navigator.mediaDevices || !window.MediaRecorder) {
      onErrorRef.current &&
        onErrorRef.current({
          code: "unsupported",
          title: "Not supported",
          message: "Your browser does not support audio recording.",
        });
      return null;
    }
    if (keepStream && isStreamLive(streamRef.current)) {
      return streamRef.current;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (keepStream) streamRef.current = stream;
      return stream;
    } catch (e) {
      onErrorRef.current &&
        onErrorRef.current({
          code: "mic",
          title: "Microphone error",
          message: "Unable to access microphone: " + e.message,
          error: e,
        });
      return null;
    }
  }, [keepStream]);

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
    const stream = await ensureStream();
    if (!stream) return false;
    try {
      const mr = new MediaRecorder(stream);
      const state = { mr, chunks: [], stream, blob: null };
      recRef.current = state;
      mr.ondataavailable = (e) => e.data?.size && state.chunks.push(e.data);
      mr.onstop = () => {
        if (!keepStream) {
          stopStreamTracks(stream);
        }
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
  }, [ensureStream, keepStream]);

  const toggle = useCallback(async () => {
    if (recording && recRef.current?.mr?.state === "recording") {
      await stop();
      return;
    }
    await start();
  }, [recording, start, stop]);

  const clear = useCallback(
    ({ keepLiveStream = false } = {}) => {
      const cur = recRef.current;
      if (cur && cur.stream && !(keepStream && keepLiveStream)) {
        stopStreamTracks(cur.stream);
      }
      if (!keepLiveStream) {
        if (streamRef.current) stopStreamTracks(streamRef.current);
        streamRef.current = null;
      }
      recRef.current = null;
      setRecording(false);
      setBlob(null);
      setBlobUrl("");
      setHint("");
    },
    [keepStream]
  );

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
    ensureStream,
    releaseStream,
  };
}
