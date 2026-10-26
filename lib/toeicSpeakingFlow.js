// Máy trạng thái thuần cho Mock Test Speaking TOEIC (Phase 8B bước 6 — mục 5.3).
// Không phụ thuộc React/DOM để test trực tiếp bằng node:test.

const { toeicTask, effectivePrep, effectiveResponse } = require("./toeicTasks");

const PHASES = {
  INTRO: "intro",
  MIC_RECORDING: "mic_recording",
  MIC_READY: "mic_ready",
  // Tải lại trang giữa chừng: chờ học sinh bấm "Continue" (cần thao tác chạm để mở khoá audio/micro).
  RESUME: "resume",
  AUDIO: "audio",
  PREP: "prep",
  RECORD: "record",
  UPLOADING: "uploading",
  RETRY: "retry",
  DONE: "done",
};

const MIC_CHECK_SECONDS = 3;
// Thử tối đa 3 lần (1 lần đầu + thử lại 2 lần theo mục 5.3).
const MAX_UPLOAD_ATTEMPTS = 3;

function storageKeyFor(studentId, testId) {
  return `toeic-speaking:${studentId || "anon"}:${testId}`;
}

function normalizeRunnerPrompts(prompts) {
  if (!Array.isArray(prompts)) return [];
  return prompts.map((p, idx) => {
    const task = toeicTask(p && p.taskType);
    const prep = effectivePrep(p);
    const resp = effectiveResponse(p);
    return {
      id: String(p && p.id != null ? p.id : idx),
      title: (p && p.title) || `Question ${idx + 1}`,
      instructions: (p && p.instructions) || "",
      imageUrl: (p && p.imageUrl) || "",
      taskType: (p && p.taskType) || "",
      taskLabel: (task && task.label) || "",
      audioUrl: (p && p.audioUrl && String(p.audioUrl).trim()) || null,
      audioPlays: Number(p && p.audioPlays) === 2 ? 2 : 1,
      prepSeconds: prep == null ? 0 : Math.max(0, Number(prep) || 0),
      responseSeconds: resp == null ? 15 : Math.max(1, Number(resp) || 15),
    };
  });
}

// Pha đầu tiên khi bước vào 1 đề:
// - Đề mới: có audio -> "audio"; không audio và prep > 0 -> "prep"; prep = 0 -> "record".
// - Tải lại trang giữa chừng (resumeFromPrep = true, quyết định E6): làm lại từ "prep"
//   (nếu prep = 0 thì vào "record" ngay).
function entryPhaseForPrompt(prompt, { resumeFromPrep = false } = {}) {
  if (!prompt) return { phase: PHASES.DONE, secondsLeft: 0, audioPlay: 0, audioPlaysMax: 1 };
  const playsMax = prompt.audioPlays === 2 ? 2 : 1;
  if (!resumeFromPrep && prompt.audioUrl) {
    return {
      phase: PHASES.AUDIO,
      secondsLeft: 0,
      audioPlay: 1,
      audioPlaysMax: playsMax,
    };
  }
  if (prompt.prepSeconds > 0) {
    return {
      phase: PHASES.PREP,
      secondsLeft: prompt.prepSeconds,
      audioPlay: 0,
      audioPlaysMax: playsMax,
    };
  }
  return {
    phase: PHASES.RECORD,
    secondsLeft: prompt.responseSeconds,
    audioPlay: 0,
    audioPlaysMax: playsMax,
  };
}

function uniqStrings(list) {
  const out = [];
  const seen = new Set();
  for (const x of list || []) {
    const s = String(x);
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  return out;
}

// Quyết định trạng thái sau khi đã đi qua hết các đề (chờ upload nền / retry / hoàn tất).
function settleEndState(state) {
  if (state.inflightIds.length > 0) {
    return { ...state, phase: PHASES.UPLOADING, secondsLeft: 0 };
  }
  if (state.failedIds.length > 0) {
    return { ...state, phase: PHASES.RETRY, secondsLeft: 0 };
  }
  return {
    ...state,
    phase: PHASES.DONE,
    secondsLeft: 0,
    finished: true,
    recordedCount: state.submittedIds.length,
  };
}

// Tìm đề tiếp theo từ `fromIndex` chưa nộp / chưa đang upload / chưa nằm trong danh sách lỗi.
function findNextPendingIndex(prompts, fromIndex, { submittedIds, inflightIds, failedIds }) {
  const doneSet = new Set([
    ...(submittedIds || []).map(String),
    ...(inflightIds || []).map(String),
    ...(failedIds || []).map(String),
  ]);
  for (let i = Math.max(0, fromIndex); i < prompts.length; i++) {
    if (!doneSet.has(String(prompts[i].id))) return i;
  }
  return -1;
}

function enterPrompt(state, fromIndex, { resumeFromPrep = false, audioError = "" } = {}) {
  const nextIdx = findNextPendingIndex(state.prompts, fromIndex, state);
  if (nextIdx < 0) return settleEndState({ ...state, audioError });
  const p = state.prompts[nextIdx];
  const entry = entryPhaseForPrompt(p, { resumeFromPrep });
  return {
    ...state,
    phase: entry.phase,
    currentIndex: nextIdx,
    audioPlay: entry.audioPlay,
    audioPlaysMax: entry.audioPlaysMax,
    prepSeconds: p.prepSeconds,
    responseSeconds: p.responseSeconds,
    secondsLeft: entry.secondsLeft,
    audioError,
  };
}

// Khởi tạo trạng thái từ danh sách đề + các đề đã nộp trên server + tiến độ localStorage.
// Luôn kiểm theo bài nộp trên server (không tin submittedIds chỉ có ở localStorage).
function createInitialFlowState(rawPrompts, { serverSubmittedIds = [], savedState = null } = {}) {
  const prompts = normalizeRunnerPrompts(rawPrompts);
  const validIds = new Set(prompts.map((p) => p.id));
  const submittedIds = uniqStrings(serverSubmittedIds).filter((id) => validIds.has(id));
  const allSubmitted = prompts.length > 0 && submittedIds.length >= prompts.length;
  const markedFinished = Boolean(savedState && savedState.finished);

  const base = {
    phase: PHASES.INTRO,
    prompts,
    currentIndex: 0,
    audioPlay: 0,
    audioPlaysMax: 1,
    prepSeconds: prompts[0] ? prompts[0].prepSeconds : 0,
    responseSeconds: prompts[0] ? prompts[0].responseSeconds : 15,
    secondsLeft: 0,
    micChecked: false,
    micError: "",
    audioError: "",
    started: false,
    resumed: false,
    finished: false,
    alreadyFinished: false,
    submittedIds,
    inflightIds: [],
    failedIds: [],
    recordedCount: submittedIds.length,
  };

  if (prompts.length === 0 || allSubmitted || markedFinished) {
    return {
      ...base,
      phase: PHASES.DONE,
      finished: true,
      alreadyFinished: true,
      currentIndex: prompts.length,
    };
  }

  const hasMidProgress = Boolean((savedState && savedState.started) || submittedIds.length > 0);
  if (hasMidProgress) {
    // Tải lại giữa chừng: bỏ qua các đề đã có bài nộp trên server,
    // đề đang dở làm lại từ phần chuẩn bị (quyết định E6). Dừng ở màn RESUME cho tới khi
    // học sinh bấm "Continue" — không tự chạy đồng hồ khi chưa có thao tác của người dùng.
    const resumedBase = { ...base, micChecked: true, started: true, resumed: true };
    const nextIdx = findNextPendingIndex(prompts, 0, resumedBase);
    if (nextIdx < 0) return enterPrompt(resumedBase, 0, { resumeFromPrep: true });
    return { ...resumedBase, phase: PHASES.RESUME, currentIndex: nextIdx, secondsLeft: 0 };
  }

  return base;
}

function startMicCheck(state) {
  if (state.phase !== PHASES.INTRO && state.phase !== PHASES.MIC_READY) return state;
  return {
    ...state,
    phase: PHASES.MIC_RECORDING,
    secondsLeft: MIC_CHECK_SECONDS,
    micError: "",
  };
}

function failMicCheck(state, errorMessage) {
  return {
    ...state,
    phase: PHASES.INTRO,
    micChecked: false,
    secondsLeft: 0,
    micError: errorMessage || "Microphone access is blocked. Please allow microphone access to start.",
  };
}

function finishMicCheck(state) {
  if (state.phase !== PHASES.MIC_RECORDING) return state;
  return {
    ...state,
    phase: PHASES.MIC_READY,
    micChecked: true,
    secondsLeft: 0,
    micError: "",
  };
}

function startTest(state) {
  if (!state.micChecked) {
    return {
      ...state,
      micError: "Please complete the microphone check before starting the test.",
    };
  }
  return enterPrompt({ ...state, started: true, micError: "" }, 0, { resumeFromPrep: false });
}

// Học sinh bấm "Continue" sau khi tải lại trang: đề đang dở làm lại từ phần chuẩn bị (E6),
// các đề sau đó chạy bình thường (có phát audio vì lúc này đã có thao tác chạm).
function continueResume(state) {
  if (state.phase !== PHASES.RESUME) return state;
  return enterPrompt({ ...state, micError: "" }, 0, { resumeFromPrep: true });
}

// Khi 1 lượt phát audio câu hỏi kết thúc: còn lượt (Q10 phát 2 lần) thì phát tiếp,
// hết lượt thì chuyển sang chuẩn bị (hoặc ghi âm ngay nếu prepSeconds = 0).
function onAudioEnded(state) {
  if (state.phase !== PHASES.AUDIO) return state;
  const p = state.prompts[state.currentIndex];
  if (!p) return settleEndState(state);
  if (state.audioPlay < state.audioPlaysMax) {
    return { ...state, audioPlay: state.audioPlay + 1 };
  }
  if (p.prepSeconds > 0) {
    return {
      ...state,
      phase: PHASES.PREP,
      secondsLeft: p.prepSeconds,
    };
  }
  return {
    ...state,
    phase: PHASES.RECORD,
    secondsLeft: p.responseSeconds,
  };
}

// Audio đề bị lỗi / không phát được -> hiện thông báo và đi tiếp sang chuẩn bị, không treo.
function onAudioError(state, errorMessage) {
  if (state.phase !== PHASES.AUDIO) return state;
  const p = state.prompts[state.currentIndex];
  if (!p) return settleEndState(state);
  const msg =
    errorMessage || "Question audio could not be played — continuing to preparation.";
  if (p.prepSeconds > 0) {
    return {
      ...state,
      phase: PHASES.PREP,
      secondsLeft: p.prepSeconds,
      audioError: msg,
    };
  }
  return {
    ...state,
    phase: PHASES.RECORD,
    secondsLeft: p.responseSeconds,
    audioError: msg,
  };
}

function onPrepEnded(state) {
  if (state.phase !== PHASES.PREP) return state;
  const p = state.prompts[state.currentIndex];
  if (!p) return settleEndState(state);
  return {
    ...state,
    phase: PHASES.RECORD,
    secondsLeft: p.responseSeconds,
  };
}

// Kết thúc ghi âm 1 đề (hết giờ nói hoặc bấm "Finish early") -> đưa đề vào hàng đợi
// upload nền rồi sang đề kế tiếp.
function onRecordEnded(state, { hasBlob = true } = {}) {
  if (state.phase !== PHASES.RECORD) return state;
  const p = state.prompts[state.currentIndex];
  if (!p) return settleEndState(state);
  const pid = String(p.id);
  const alreadyHandled =
    state.submittedIds.includes(pid) || state.inflightIds.includes(pid);
  const inflightIds =
    hasBlob && !alreadyHandled ? [...state.inflightIds, pid] : state.inflightIds;
  const nextState = { ...state, inflightIds, audioError: "" };
  return enterPrompt(nextState, state.currentIndex + 1, { resumeFromPrep: false });
}

function onUploadSuccess(state, promptId) {
  const pid = String(promptId);
  const inflightIds = state.inflightIds.filter((id) => id !== pid);
  const failedIds = state.failedIds.filter((id) => id !== pid);
  const submittedIds = state.submittedIds.includes(pid)
    ? state.submittedIds
    : [...state.submittedIds, pid];
  const next = {
    ...state,
    inflightIds,
    failedIds,
    submittedIds,
    recordedCount: submittedIds.length,
  };
  if (next.phase === PHASES.UPLOADING || next.phase === PHASES.RETRY) {
    return settleEndState(next);
  }
  return next;
}

function onUploadFailure(state, promptId) {
  const pid = String(promptId);
  const inflightIds = state.inflightIds.filter((id) => id !== pid);
  const failedIds =
    state.submittedIds.includes(pid) || state.failedIds.includes(pid)
      ? state.failedIds
      : [...state.failedIds, pid];
  const next = {
    ...state,
    inflightIds,
    failedIds,
  };
  if (next.phase === PHASES.UPLOADING || next.phase === PHASES.RETRY) {
    return settleEndState(next);
  }
  return next;
}

function startRetryUploads(state) {
  if (!state.failedIds.length) return settleEndState(state);
  const inflightIds = uniqStrings([...state.inflightIds, ...state.failedIds]);
  return {
    ...state,
    phase: PHASES.UPLOADING,
    inflightIds,
    failedIds: [],
  };
}

function forceFinishFlow(state) {
  return {
    ...state,
    phase: PHASES.DONE,
    secondsLeft: 0,
    inflightIds: [],
    failedIds: [],
    finished: true,
    recordedCount: state.submittedIds.length,
  };
}

// Tính số giây còn lại từ mốc deadline tuyệt đối (Date.now()).
function remainingSeconds(deadlineMs, nowMs = Date.now()) {
  if (!Number.isFinite(deadlineMs)) return 0;
  return Math.max(0, Math.ceil((deadlineMs - nowMs) / 1000));
}

// Phần trăm tiến độ (0..100) cho thanh thời gian nói.
function progressPct(deadlineMs, totalSeconds, nowMs = Date.now()) {
  const totalMs = Math.max(1, Number(totalSeconds) || 1) * 1000;
  const leftMs = Math.max(0, Math.min(totalMs, deadlineMs - nowMs));
  const elapsedMs = totalMs - leftMs;
  return Math.max(0, Math.min(100, Math.round((elapsedMs / totalMs) * 100)));
}

// Upload + submit 1 bản ghi với tối đa `maxAttempts` lần thử (mặc định 3 = 1 lần đầu + 2 retry).
// Giữ lại kết quả upload Cloudinary nếu bước upload đã xong mà bước submit mạng lỗi,
// và không bao giờ gọi submitFn lần 2 sau khi đã thành công.
async function uploadAndSubmitWithRetry({
  blob,
  promptId,
  uploadFn,
  submitFn,
  initialUpload = null,
  maxAttempts = MAX_UPLOAD_ATTEMPTS,
  retryDelayMs = 500,
}) {
  let cachedUpload = initialUpload;
  let lastError = null;
  const attempts = Math.max(1, Number(maxAttempts) || MAX_UPLOAD_ATTEMPTS);

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      if (!cachedUpload) {
        cachedUpload = await uploadFn(blob);
      }
      await submitFn({
        promptId,
        audioUrl: cachedUpload.audioUrl,
        audioPublicId: cachedUpload.audioPublicId,
      });
      return { ok: true, attempts: attempt, cachedUpload };
    } catch (err) {
      lastError = err;
      if (attempt < attempts && retryDelayMs > 0) {
        await new Promise((r) => setTimeout(r, retryDelayMs));
      }
    }
  }

  return {
    ok: false,
    attempts,
    error: lastError,
    cachedUpload,
  };
}

module.exports = {
  PHASES,
  MIC_CHECK_SECONDS,
  MAX_UPLOAD_ATTEMPTS,
  storageKeyFor,
  normalizeRunnerPrompts,
  entryPhaseForPrompt,
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
};
