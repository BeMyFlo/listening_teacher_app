import { api } from "./api";

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const INTERVAL = 4000;
const TIMEOUT = 300000;

function ticker(onTick, t0) {
  if (!onTick) return null;
  onTick(0);
  return setInterval(() => onTick(Math.round((Date.now() - t0) / 1000)), 1000);
}

// Bắt đầu chấm AI: tạo job -> poll tới khi xong. Trả draft hoặc throw.
export async function startAiGrade(submissionId, { onTick } = {}) {
  const { jobId } = await api.teacher.aiGradeSubmission(submissionId);
  const t0 = Date.now();
  const tk = ticker(onTick, t0);
  try {
    while (Date.now() - t0 < TIMEOUT) {
      let job;
      try {
        job = await api.teacher.gradingJob(jobId);
      } catch {
        await sleep(INTERVAL);
        continue;
      }
      if (job.status === "done") return job.draft;
      if (job.status === "error") throw new Error(job.error || "AI grading failed");
      await sleep(INTERVAL);
    }
    throw new Error("AI grading timed out — try again");
  } finally {
    if (tk) clearInterval(tk);
  }
}

// Khi load lại trang: có job đang chạy cho bài này không? Nếu có, poll tới khi
// xong và trả draft. Không có -> null (không throw, không hiện lỗi cũ).
export async function resumeAiGrade(submissionId, { onTick, shouldStop, onActive } = {}) {
  let first;
  try {
    first = await api.teacher.gradingJobFor(submissionId);
  } catch {
    return null;
  }
  if (!first || first.status === "none" || first.status === "error") return null;
  if (first.status === "done") return first.draft;

  onActive && onActive();
  const t0 = Date.now();
  const tk = ticker(onTick, t0);
  try {
    while (Date.now() - t0 < TIMEOUT) {
      if (shouldStop && shouldStop()) return null;
      let job;
      try {
        job = await api.teacher.gradingJobFor(submissionId);
      } catch {
        await sleep(INTERVAL);
        continue;
      }
      if (job.status === "done") return job.draft;
      if (job.status === "error" || job.status === "none") return null;
      await sleep(INTERVAL);
    }
    return null;
  } finally {
    if (tk) clearInterval(tk);
  }
}

// alias cũ
export const pollAiGrade = startAiGrade;
