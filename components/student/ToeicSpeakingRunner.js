"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { useRecorder } from "@/lib/client/useRecorder";
import { clearCountdown } from "@/components/student/Countdown";
import { latestPromptSub } from "@/lib/student/submissions";
import { formatTimerSec } from "@/lib/toeicTasks";
import {
  PHASES,
  MIC_CHECK_SECONDS,
  MAX_UPLOAD_ATTEMPTS,
  storageKeyFor,
  createInitialFlowState,
  startMicCheck,
  failMicCheck,
  finishMicCheck,
  startTest,
  continueResume,
  onAudioEnded,
  onAudioError,
  onPrepEnded,
  onRecordEnded,
  onUploadSuccess,
  onUploadFailure,
  startRetryUploads,
  forceFinishFlow,
  remainingSeconds,
  progressPct,
  uploadAndSubmitWithRetry,
} from "@/lib/toeicSpeakingFlow";

// File WAV im lặng cực ngắn (44 byte) để mở khoá phần tử <audio> trên iOS/Safari
// ngay trong sự kiện bấm "Start test" của học sinh.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";

function readSavedState(key) {
  if (!key || typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSavedState(key, data) {
  if (!key || typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {}
}

export function isToeicSpeakingCompleted(studentId, testId, prompts, subs) {
  const list = Array.isArray(prompts) ? prompts : [];
  if (!list.length) return false;
  const submittedCount = list.filter((p) => !!latestPromptSub(subs, p.id)).length;
  if (submittedCount >= list.length) return true;
  const saved = readSavedState(storageKeyFor(studentId, testId));
  return Boolean(saved && saved.finished);
}

// Phát tiếng beep ngắn bằng Web Audio khi hết giờ chuẩn bị (không cần file asset).
function playBeep(audioCtxRef) {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
    const ctx = audioCtxRef.current;
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch {}
}

function loadSafetyDeadline(timerKey, durationMinutes) {
  const mins = Number(durationMinutes);
  if (!mins || mins <= 0) return null;
  const fallback = Date.now() + Math.max(1, mins) * 60000;
  if (!timerKey || typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(timerKey);
    const stored = raw ? Number(raw) : NaN;
    if (Number.isFinite(stored)) return stored;
    localStorage.setItem(timerKey, String(fallback));
  } catch {}
  return fallback;
}

const ToeicSpeakingRunner = forwardRef(function ToeicSpeakingRunner(
  {
    test,
    prompts = [],
    subs = [],
    studentId,
    durationMinutes,
    timerKey,
    onSubmitted,
    onFinished,
    onExit,
  },
  ref
) {
  const storageKey = storageKeyFor(studentId, test.id);

  const [flow, setFlow] = useState(() => {
    const serverSubmittedIds = prompts
      .filter((p) => !!latestPromptSub(subs, p.id))
      .map((p) => String(p.id));
    const savedState = readSavedState(storageKey);
    return createInitialFlowState(prompts, { serverSubmittedIds, savedState });
  });

  const [displaySec, setDisplaySec] = useState(flow.secondsLeft || 0);
  const [speakPct, setSpeakPct] = useState(0);
  const [micPreviewUrl, setMicPreviewUrl] = useState("");
  const [recError, setRecError] = useState("");
  const [recRetryTick, setRecRetryTick] = useState(0);

  const flowRef = useRef(flow);
  flowRef.current = flow;
  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;
  const lastMicErrRef = useRef("");
  const qAudioRef = useRef(null);
  const unlockingAudioRef = useRef(false);
  const audioCtxRef = useRef(null);
  const finishingPromptRef = useRef(null);
  const forcingRef = useRef(false);
  const submittedSetRef = useRef(new Set(flow.submittedIds));
  const inflightMapRef = useRef(new Map());
  const failedItemsRef = useRef(new Map());

  const {
    start: startRec,
    stop: stopRec,
    clear: clearRec,
    ensureStream,
    releaseStream,
  } = useRecorder({
    keepStream: true,
    onError: ({ message }) => {
      lastMicErrRef.current = message || "Microphone access is blocked.";
    },
  });

  // Lưu tiến độ xuống localStorage mỗi khi trạng thái bài làm thay đổi.
  useEffect(() => {
    writeSavedState(storageKey, {
      started: flow.started,
      currentIndex: flow.currentIndex,
      submittedIds: flow.submittedIds,
      finished: flow.finished,
      updatedAt: Date.now(),
    });
  }, [storageKey, flow.started, flow.currentIndex, flow.submittedIds, flow.finished]);

  // Khi sang trạng thái chờ upload cuối / retry / done thì tắt micro ngay.
  useEffect(() => {
    if (
      flow.phase === PHASES.UPLOADING ||
      flow.phase === PHASES.RETRY ||
      flow.phase === PHASES.DONE
    ) {
      releaseStream();
    }
    if (flow.phase === PHASES.DONE) {
      clearCountdown(timerKey);
      onFinishedRef.current && onFinishedRef.current();
    }
  }, [flow.phase, releaseStream, timerKey]);

  // Dọn audio câu hỏi và AudioContext khi rời trang.
  useEffect(() => {
    const audioEl = qAudioRef.current;
    return () => {
      if (audioEl) {
        try {
          audioEl.pause();
          audioEl.removeAttribute("src");
        } catch {}
      }
      if (audioCtxRef.current && audioCtxRef.current.close) {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  // Upload + nộp bài ở nền (thử lại tối đa 2 lần = 3 lần tổng cộng; không nộp trùng).
  const queueBackgroundUpload = useCallback(
    (promptId, blob) => {
      const pid = String(promptId);
      if (!blob || blob.size === 0) return Promise.resolve({ ok: false });
      if (submittedSetRef.current.has(pid)) return Promise.resolve({ ok: true });
      if (inflightMapRef.current.has(pid)) return inflightMapRef.current.get(pid);

      const prevFailed = failedItemsRef.current.get(pid);
      const promise = (async () => {
        const res = await uploadAndSubmitWithRetry({
          blob,
          promptId: pid,
          initialUpload: prevFailed?.cachedUpload || null,
          maxAttempts: MAX_UPLOAD_ATTEMPTS,
          retryDelayMs: 600,
          uploadFn: (b) => api.student.uploadSpeakingAudio(b),
          submitFn: async ({ promptId: targetId, audioUrl, audioPublicId }) => {
            if (submittedSetRef.current.has(targetId)) return { ok: true };
            return api.student.submit({
              kind: "speaking",
              testId: test.id,
              skill: "speaking",
              promptId: targetId,
              audioUrl,
              audioPublicId,
            });
          },
        });

        inflightMapRef.current.delete(pid);
        if (res.ok) {
          submittedSetRef.current.add(pid);
          failedItemsRef.current.delete(pid);
          setFlow((s) => onUploadSuccess(s, pid));
          try {
            onSubmitted && (await onSubmitted());
          } catch {}
        } else {
          failedItemsRef.current.set(pid, {
            blob,
            cachedUpload: res.cachedUpload || null,
            error: (res.error && res.error.message) || "Upload failed",
          });
          setFlow((s) => onUploadFailure(s, pid));
        }
        return res;
      })();

      inflightMapRef.current.set(pid, promise);
      return promise;
    },
    [test.id, onSubmitted]
  );

  // Kết thúc ghi âm câu hiện tại (tự dừng khi hết giờ hoặc bấm "Finish early").
  const finishRecordingCurrent = useCallback(async () => {
    const cur = flowRef.current;
    if (cur.phase !== PHASES.RECORD) return;
    const p = cur.prompts[cur.currentIndex];
    if (!p) return;
    const lockKey = `${cur.currentIndex}:${p.id}`;
    if (finishingPromptRef.current === lockKey) return;
    finishingPromptRef.current = lockKey;

    const blob = await stopRec();
    const hasBlob = Boolean(blob && blob.size > 0);
    setFlow((s) => onRecordEnded(s, { hasBlob }));
    if (hasBlob) {
      queueBackgroundUpload(p.id, blob);
    }
  }, [stopRec, queueBackgroundUpload]);

  // Hết giờ cấp kỹ năng (safety deadline) hoặc vi phạm tab-switch guard:
  // dừng câu đang ghi (nếu có), nộp bản ghi đó, huỷ các câu còn lại và kết thúc.
  const handleForceTerminate = useCallback(async () => {
    if (forcingRef.current) return;
    forcingRef.current = true;
    try {
      if (qAudioRef.current) {
        try {
          qAudioRef.current.pause();
        } catch {}
      }
      const cur = flowRef.current;
      if (cur.phase === PHASES.RECORD) {
        const p = cur.prompts[cur.currentIndex];
        const blob = await stopRec();
        if (p && blob && blob.size > 0 && !submittedSetRef.current.has(String(p.id))) {
          await queueBackgroundUpload(p.id, blob);
        }
      } else {
        await stopRec();
      }
      if (inflightMapRef.current.size > 0) {
        await Promise.allSettled(Array.from(inflightMapRef.current.values()));
      }
    } finally {
      releaseStream();
      clearCountdown(timerKey);
      setFlow((s) => {
        const next = forceFinishFlow(s);
        writeSavedState(storageKey, {
          started: true,
          currentIndex: next.prompts.length,
          submittedIds: next.submittedIds,
          finished: true,
          updatedAt: Date.now(),
        });
        return next;
      });
    }
  }, [stopRec, releaseStream, queueBackgroundUpload, timerKey, storageKey]);

  useImperativeHandle(
    ref,
    () => ({
      forceSubmit: handleForceTerminate,
    }),
    [handleForceTerminate]
  );

  // Đồng hồ an toàn cấp kỹ năng (ẩn trên giao diện, chỉ dùng làm mốc hết giờ tổng).
  useEffect(() => {
    if (!flow.started || flow.finished || !durationMinutes) return;
    const safetyDeadline = loadSafetyDeadline(timerKey, durationMinutes);
    if (!safetyDeadline) return;
    if (Date.now() >= safetyDeadline) {
      handleForceTerminate();
      return;
    }
    const id = setInterval(() => {
      if (Date.now() >= safetyDeadline) {
        clearInterval(id);
        handleForceTerminate();
      }
    }, 1000);
    return () => clearInterval(id);
  }, [flow.started, flow.finished, durationMinutes, timerKey, handleForceTerminate]);

  // Đếm ngược 3 giây khi kiểm micro (tính theo mốc Date.now()).
  useEffect(() => {
    if (flow.phase !== PHASES.MIC_RECORDING) return;
    const deadline = Date.now() + MIC_CHECK_SECONDS * 1000;
    setDisplaySec(MIC_CHECK_SECONDS);
    let stopped = false;

    const id = setInterval(async () => {
      const left = remainingSeconds(deadline, Date.now());
      setDisplaySec(left);
      if (left <= 0 && !stopped) {
        stopped = true;
        clearInterval(id);
        const b = await stopRec();
        if (b && b.size > 0) {
          setMicPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(b);
          });
          setFlow((s) => finishMicCheck(s));
        } else {
          setFlow((s) =>
            failMicCheck(s, "No audio was captured. Please check your microphone and try again.")
          );
        }
      }
    }, 150);

    return () => clearInterval(id);
  }, [flow.phase, stopRec]);

  // Pha phát audio câu hỏi (tự phát 1 hoặc 2 lần, lỗi thì báo và sang chuẩn bị ngay).
  useEffect(() => {
    if (flow.phase !== PHASES.AUDIO) return;
    const p = flowRef.current.prompts[flow.currentIndex];
    const el = qAudioRef.current;
    if (!p || !p.audioUrl || !el) {
      setFlow((s) => onAudioEnded(s));
      return;
    }

    unlockingAudioRef.current = false;
    let cancelled = false;
    // Mốc an toàn 7 giây phòng khi URL audio hỏng làm trình duyệt treo ở trạng thái loading.
    const stallTimer = setTimeout(() => {
      if (cancelled) return;
      if (el.paused || el.currentTime === 0) {
        try {
          el.pause();
        } catch {}
        setFlow((s) =>
          onAudioError(s, "Question audio could not be played — continuing to preparation.")
        );
      }
    }, 7000);

    try {
      if (el.getAttribute("src") !== p.audioUrl) {
        el.src = p.audioUrl;
      }
      el.currentTime = 0;
      const playPromise = el.play();
      if (playPromise && playPromise.catch) {
        playPromise.catch(() => {
          if (cancelled) return;
          clearTimeout(stallTimer);
          setFlow((s) =>
            onAudioError(s, "Question audio could not be played — continuing to preparation.")
          );
        });
      }
    } catch {
      clearTimeout(stallTimer);
      setFlow((s) =>
        onAudioError(s, "Question audio could not be played — continuing to preparation.")
      );
    }

    return () => {
      cancelled = true;
      clearTimeout(stallTimer);
    };
  }, [flow.phase, flow.currentIndex, flow.audioPlay]);

  // Pha chuẩn bị (đếm ngược theo Date.now(), hết giờ kêu beep rồi sang ghi âm).
  useEffect(() => {
    if (flow.phase !== PHASES.PREP) return;
    const p = flowRef.current.prompts[flow.currentIndex];
    const totalSec = p ? p.prepSeconds : 0;
    if (totalSec <= 0) {
      playBeep(audioCtxRef);
      setFlow((s) => onPrepEnded(s));
      return;
    }

    // Nếu tải lại trang giữa chừng, mở sẵn stream micro trong lúc chuẩn bị.
    ensureStream();

    const deadline = Date.now() + totalSec * 1000;
    setDisplaySec(totalSec);
    let done = false;

    const id = setInterval(() => {
      const left = remainingSeconds(deadline, Date.now());
      setDisplaySec(left);
      if (left <= 0 && !done) {
        done = true;
        clearInterval(id);
        playBeep(audioCtxRef);
        setFlow((s) => onPrepEnded(s));
      }
    }, 150);

    return () => clearInterval(id);
  }, [flow.phase, flow.currentIndex, ensureStream]);

  // Pha nói (tự bắt đầu ghi âm, đếm ngược theo Date.now() kèm thanh tiến độ, hết giờ tự dừng).
  useEffect(() => {
    if (flow.phase !== PHASES.RECORD) return;
    const p = flowRef.current.prompts[flow.currentIndex];
    const totalSec = p ? p.responseSeconds : 15;
    let cancelled = false;
    let timerId = null;

    setRecError("");
    setDisplaySec(totalSec);
    setSpeakPct(0);

    (async () => {
      const ok = await startRec();
      if (cancelled) return;
      if (!ok) {
        setRecError(
          lastMicErrRef.current ||
            "Microphone disconnected or blocked. Please allow microphone access and click Retry microphone."
        );
        return;
      }
      const deadline = Date.now() + totalSec * 1000;
      timerId = setInterval(() => {
        const now = Date.now();
        const left = remainingSeconds(deadline, now);
        const pct = progressPct(deadline, totalSec, now);
        setDisplaySec(left);
        setSpeakPct(pct);
        if (left <= 0) {
          clearInterval(timerId);
          finishRecordingCurrent();
        }
      }, 150);
    })();

    return () => {
      cancelled = true;
      if (timerId) clearInterval(timerId);
    };
  }, [flow.phase, flow.currentIndex, recRetryTick, startRec, finishRecordingCurrent]);

  async function handleMicCheckClick() {
    lastMicErrRef.current = "";
    const ok = await startRec();
    if (!ok) {
      setFlow((s) =>
        failMicCheck(
          s,
          lastMicErrRef.current ||
            "Microphone access is blocked. Please allow microphone access in your browser settings and try again."
        )
      );
      return;
    }
    setFlow((s) => startMicCheck(s));
  }

  // Mở khoá AudioContext và phần tử <audio> dùng chung ngay trong sự kiện chạm của học sinh.
  // silentClip: phát 1 clip im lặng để mở khoá <audio> (bỏ qua khi đề đầu tiên có audio và sẽ tự phát ngay).
  function unlockAudio(silentClip) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx) {
        if (!audioCtxRef.current) audioCtxRef.current = new Ctx();
        if (audioCtxRef.current.state === "suspended") {
          audioCtxRef.current.resume().catch(() => {});
        }
      }
    } catch {}

    const el = qAudioRef.current;
    if (el && silentClip) {
      try {
        unlockingAudioRef.current = true;
        el.src = SILENT_WAV;
        const p = el.play();
        if (p && p.then) {
          p.then(() => {
            if (unlockingAudioRef.current) {
              el.pause();
              unlockingAudioRef.current = false;
            }
          }).catch(() => {
            unlockingAudioRef.current = false;
          });
        }
      } catch {
        unlockingAudioRef.current = false;
      }
    }
  }

  function handleStartTestClick() {
    if (!flow.micChecked) return;
    const firstIdx = flow.prompts.findIndex((p) => !flow.submittedIds.includes(p.id));
    const firstPrompt = firstIdx >= 0 ? flow.prompts[firstIdx] : null;
    unlockAudio(!firstPrompt || !firstPrompt.audioUrl);

    clearRec({ keepLiveStream: true });
    if (micPreviewUrl) {
      URL.revokeObjectURL(micPreviewUrl);
      setMicPreviewUrl("");
    }
    setFlow((s) => startTest(s));
  }

  // Tải lại trang giữa chừng: đề đang dở bỏ qua audio và vào thẳng chuẩn bị, nên luôn phát clip im lặng
  // để mở khoá <audio> cho các đề sau; xin lại quyền micro ngay trong thao tác chạm này.
  async function handleContinueClick() {
    unlockAudio(true);
    await ensureStream();
    setFlow((s) => continueResume(s));
  }

  function handleRetryUploadsClick() {
    const entries = Array.from(failedItemsRef.current.entries());
    if (!entries.length) {
      setFlow((s) => forceFinishFlow(s));
      return;
    }
    setFlow((s) => startRetryUploads(s));
    for (const [pid, item] of entries) {
      queueBackgroundUpload(pid, item.blob);
    }
  }

  const currentPrompt = flow.prompts[flow.currentIndex] || null;

  return (
    <div className="toeic-speaking-runner">
      {/* Phần tử <audio> dùng lại cho mọi đề (ẩn controls để không tua được) */}
      <audio
        ref={qAudioRef}
        preload="auto"
        style={{ display: "none" }}
        onEnded={() => {
          if (unlockingAudioRef.current) return;
          setFlow((s) => onAudioEnded(s));
        }}
        onError={() => {
          if (unlockingAudioRef.current) return;
          setFlow((s) =>
            onAudioError(s, "Question audio could not be played — continuing to preparation.")
          );
        }}
      />

      {/* Màn tiếp tục: tải lại trang giữa chừng, chờ học sinh bấm để bắt đầu lại từ phần chuẩn bị */}
      {flow.phase === PHASES.RESUME && currentPrompt && (
        <div className="lesson-block toeic-runner-intro">
          <h3 style={{ marginTop: 0 }}>Welcome back</h3>
          <p style={{ color: "var(--muted)", margin: "6px 0 14px" }}>
            Your test is still in progress ({flow.submittedIds.length} of {flow.prompts.length} questions
            already submitted). Question {flow.currentIndex + 1} will restart from its preparation time.
            Click <b>Continue test</b> when you are ready.
          </p>
          <button type="button" className="btn toeic-continue-btn" onClick={handleContinueClick}>
            Continue test
          </button>
        </div>
      )}

      {/* Màn 1: Giới thiệu + Kiểm micro */}
      {(flow.phase === PHASES.INTRO ||
        flow.phase === PHASES.MIC_RECORDING ||
        flow.phase === PHASES.MIC_READY) && (
        <div className="lesson-block toeic-runner-intro">
          <h3 style={{ marginTop: 0 }}>Microphone Check &amp; Instructions</h3>
          <p style={{ color: "var(--muted)", margin: "6px 0 14px" }}>
            This TOEIC Speaking test runs automatically through{" "}
            <b>{flow.prompts.length} questions</b>. For each question, you will prepare and then your
            microphone will start and stop recording automatically. You cannot re-record a question
            once it is completed.
          </p>

          {flow.micError && (
            <div className="notice error" style={{ marginBottom: 14 }}>
              <svg className="icon"><use href="#icon-warning" /></svg> {flow.micError}
            </div>
          )}

          <div className="toeic-mic-box">
            <div className="toeic-mic-actions">
              {flow.phase === PHASES.MIC_RECORDING ? (
                <button type="button" className="btn secondary" disabled>
                  <span className="toeic-rec-dot" /> Recording 3s test... ({displaySec}s)
                </button>
              ) : (
                <button
                  type="button"
                  className="btn secondary toeic-mic-check-btn"
                  onClick={handleMicCheckClick}
                >
                  <svg className="icon"><use href="#icon-mic" /></svg>{" "}
                  {flow.micChecked ? "Test Microphone Again (3s)" : "Test Microphone (3s)"}
                </button>
              )}

              <button
                type="button"
                className="btn toeic-start-test-btn"
                disabled={!flow.micChecked || flow.phase === PHASES.MIC_RECORDING}
                onClick={handleStartTestClick}
              >
                Start test
              </button>
            </div>

            {flow.phase === PHASES.MIC_READY && micPreviewUrl && (
              <div className="toeic-mic-preview" style={{ marginTop: 12 }}>
                <p style={{ margin: "0 0 6px", fontSize: ".85rem", color: "var(--muted)" }}>
                  <svg className="icon"><use href="#icon-check-circle" /></svg> Microphone ready — play
                  back your 3-second test clip below, then click <b>Start test</b>:
                </p>
                <audio controls autoPlay src={micPreviewUrl} className="rec-audio" style={{ width: "100%" }} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Màn 2: Đang làm từng đề (audio -> prep -> record) */}
      {(flow.phase === PHASES.AUDIO ||
        flow.phase === PHASES.PREP ||
        flow.phase === PHASES.RECORD) &&
        currentPrompt && (
          <div className="lesson-block toeic-runner-question">
            <div className="toeic-runner-head">
              <span className="toeic-runner-step">
                Question {flow.currentIndex + 1} of {flow.prompts.length}
              </span>
              {currentPrompt.taskLabel && (
                <span className="pill pill-info toeic-task-label">{currentPrompt.taskLabel}</span>
              )}
            </div>

            <h3 style={{ margin: "8px 0" }}>{currentPrompt.title}</h3>

            {currentPrompt.instructions && (
              <div className="prompt-instructions">
                {currentPrompt.instructions.split(/\n{2,}/).map((para, k) => (
                  <p key={k}>{para}</p>
                ))}
              </div>
            )}

            {currentPrompt.imageUrl && (
              <img
                src={currentPrompt.imageUrl}
                className="diagram-image"
                style={{ margin: "12px 0" }}
                alt=""
              />
            )}

            {flow.audioError && (
              <div className="notice warn" style={{ marginTop: 10 }}>
                <svg className="icon"><use href="#icon-warning" /></svg> {flow.audioError}
              </div>
            )}

            {flow.phase === PHASES.AUDIO && (
              <div className="toeic-runner-stage stage-audio">
                <svg className="icon"><use href="#icon-headphones" /></svg>
                <span>
                  {flow.audioPlaysMax > 1
                    ? `Listening to question audio (${flow.audioPlay}/${flow.audioPlaysMax})...`
                    : "Listening to question audio..."}
                </span>
              </div>
            )}

            {flow.phase === PHASES.PREP && (
              <div className="toeic-runner-stage stage-prep">
                <div className="toeic-stage-row">
                  <span className="toeic-stage-title">
                    <svg className="icon"><use href="#icon-clock" /></svg> Preparation time
                  </span>
                  <span className="toeic-stage-clock">{formatTimerSec(displaySec)}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: ".84rem", color: "var(--muted)" }}>
                  Recording will start automatically after the beep.
                </p>
              </div>
            )}

            {flow.phase === PHASES.RECORD && (
              <div className="toeic-runner-stage stage-record">
                {recError ? (
                  <div className="notice error">
                    <p style={{ margin: "0 0 8px" }}>{recError}</p>
                    <button
                      type="button"
                      className="btn secondary"
                      onClick={() => setRecRetryTick((n) => n + 1)}
                    >
                      Retry microphone
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="toeic-stage-row">
                      <span className="toeic-stage-title">
                        <span className="toeic-rec-dot" /> Recording — Speak now
                      </span>
                      <span className="toeic-stage-clock">{formatTimerSec(displaySec)}</span>
                    </div>
                    <div className="progress-bar" style={{ margin: "10px 0 12px", height: 8 }}>
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${speakPct}%`,
                          background: "var(--red, #dc2626)",
                          transition: "width .15s linear",
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      className="btn secondary toeic-finish-early-btn"
                      onClick={finishRecordingCurrent}
                    >
                      Finish early
                    </button>
                  </>
                )}
              </div>
            )}

            {(flow.inflightIds.length > 0 || flow.failedIds.length > 0) && (
              <p className="toeic-bg-upload-note">
                {flow.inflightIds.length > 0
                  ? `Uploading ${flow.inflightIds.length} recording(s) in the background...`
                  : ""}
                {flow.failedIds.length > 0
                  ? ` · ${flow.failedIds.length} recording(s) queued to retry at the end.`
                  : ""}
              </p>
            )}
          </div>
        )}

      {/* Màn 3: Đang chờ upload câu cuối */}
      {flow.phase === PHASES.UPLOADING && (
        <div className="lesson-block toeic-runner-uploading">
          <div className="notice info">
            <svg className="icon"><use href="#icon-clock" /></svg> Uploading and submitting your
            recordings ({flow.inflightIds.length} remaining)... Please keep this tab open.
          </div>
        </div>
      )}

      {/* Màn 4: Có câu lỗi upload sau 3 lần thử -> cho bấm "Retry upload" */}
      {flow.phase === PHASES.RETRY && (
        <div className="lesson-block toeic-runner-retry">
          <div className="notice warn" style={{ marginBottom: 12 }}>
            <svg className="icon"><use href="#icon-warning" /></svg>{" "}
            {flow.failedIds.length} recording(s) could not be uploaded after {MAX_UPLOAD_ATTEMPTS}{" "}
            attempts. Your audio is still saved in memory — click <b>Retry upload</b> to try again.
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="btn toeic-retry-upload-btn" onClick={handleRetryUploadsClick}>
              Retry upload
            </button>
            <button
              type="button"
              className="btn secondary"
              onClick={() => setFlow((s) => forceFinishFlow(s))}
            >
              Finish without failed items
            </button>
          </div>
        </div>
      )}

      {/* Màn 5: Hoàn tất */}
      {flow.phase === PHASES.DONE && (
        <div className="lesson-block toeic-runner-done">
          <div className="notice success" style={{ marginBottom: 14 }}>
            <svg className="icon"><use href="#icon-check-circle" /></svg>{" "}
            <b>
              Speaking submitted — {flow.recordedCount}/{flow.prompts.length} recorded
            </b>
          </div>
          <button type="button" className="btn" onClick={onExit}>
            Back to Mock Tests
          </button>
        </div>
      )}
    </div>
  );
});

export default ToeicSpeakingRunner;
