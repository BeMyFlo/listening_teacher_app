// Worker chấm bài bằng Gemini — dùng chung Writing + Speaking. Gọi từ job
// (pages/api/admin/grading-jobs.js). Trả về "draft" để giáo viên xem lại.

const Submission = require("../models/Submission");
const { resolveVariant, getRubric } = require("./rubric");
const { generateJSON } = require("../gemini");
const { getGradingModels } = require("./aiModels");
const {
  AI_GRADE_JSON_SCHEMA,
  AI_GRADE_SPEAKING_SCHEMA,
  validateAiGrade,
  normaliseAiGrade,
  normaliseAiSpeaking,
} = require("./aiGradeSchema");
const SYS_WRITING = require("./prompts/writingSystem");
const SYS_SPEAKING = require("./prompts/speakingSystem");

function rubricText(variant) {
  const r = getRubric(variant);
  if (!r) return "";
  const lines = [`Rubric: ${r.label}`];
  for (const c of r.criteria) {
    lines.push(`\n${c.label} (${c.key}):`);
    for (const b of [9, 8, 7, 6, 5, 4]) {
      const d = c.bands && c.bands[String(b)];
      if (d && d.en) lines.push(`  Band ${b}: ${d.en}`);
    }
  }
  return lines.join("\n");
}

// Cloudinary lưu audio dạng video/upload/<...>.webm — chèn f_mp3 để lấy mp3
// cho Gemini (Gemini nhận mp3/wav/ogg, không chắc webm).
function toMp3Url(audioUrl) {
  if (!audioUrl) return null;
  if (audioUrl.includes("/upload/")) {
    return audioUrl.replace("/upload/", "/upload/f_mp3/").replace(/\.\w+($|\?)/, ".mp3$1");
  }
  return audioUrl;
}

async function fetchAudioBase64(audioUrl) {
  const url = toMp3Url(audioUrl);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not fetch audio (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 18 * 1024 * 1024) throw new Error("Recording is too large for AI grading");
  return { base64: buf.toString("base64"), mimeType: "audio/mp3" };
}

async function runAiGrade(submissionId) {
  const s = await Submission.findById(submissionId).lean();
  if (!s) throw new Error("Submission not found");
  const models = await getGradingModels();

  if (s.kind === "writing") {
    if (!String(s.essayText || "").trim()) throw new Error("Empty essay");
    const variant = s.rubricVariant || resolveVariant("writing", s.writingTask) || "writing.task2";
    const prompt = `${rubricText(variant)}\n\n--- STUDENT ESSAY (verbatim) ---\n${s.essayText}\n--- END ESSAY ---\n\nGrade this essay now.`;
    const { data: raw, model } = await generateJSON({ systemInstruction: SYS_WRITING, prompt, schema: AI_GRADE_JSON_SCHEMA, models });
    const verr = validateAiGrade(raw, variant);
    if (verr) throw new Error("AI response invalid: " + verr);
    return { kind: "writing", model, draft: normaliseAiGrade(raw, s.essayText, variant) };
  }

  if (s.kind === "speaking") {
    if (!s.audioUrl) throw new Error("No audio recording");
    const audio = await fetchAudioBase64(s.audioUrl);
    const variant = "speaking";
    const prompt = `${rubricText(variant)}\n\nListen to the attached recording and grade the student's spoken answer now.`;
    const { data: raw, model } = await generateJSON({ systemInstruction: SYS_SPEAKING, prompt, schema: AI_GRADE_SPEAKING_SCHEMA, audio, models });
    const verr = validateAiGrade(raw, variant);
    if (verr) throw new Error("AI response invalid: " + verr);
    return { kind: "speaking", model, draft: normaliseAiSpeaking(raw, variant) };
  }

  throw new Error("Only Writing and Speaking can be AI-graded");
}

module.exports = { runAiGrade };
