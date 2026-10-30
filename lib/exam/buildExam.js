// Dựng đề in từ 1 Test (Phase 12 G4 bước 4): gắn URL ảnh, trộn theo mã đề, gom đề Writing/Speaking.
// Hàm thuần — ảnh đã được tra URL sẵn (Map id -> url) bởi route.
const { shuffleExam } = require("./shuffleExam");

const QUESTION_SKILLS = ["listening", "reading"];
const PROMPT_SKILLS = ["writing", "speaking"];

const idStr = (v) => (v == null ? "" : String(v && v._id ? v._id : v));

// Mọi imageId mà đề dùng (đoạn văn, câu, đề viết/nói).
function collectImageIds(test) {
  const ids = new Set();
  const skills = (test && test.skills) || {};
  for (const sk of QUESTION_SKILLS) {
    for (const sec of (skills[sk] && skills[sk].sections) || []) {
      if (sec.imageId) ids.add(idStr(sec.imageId));
      for (const f of sec.fields || []) if (f.imageId) ids.add(idStr(f.imageId));
    }
  }
  for (const sk of PROMPT_SKILLS) for (const p of (skills[sk] && skills[sk].prompts) || []) if (p.imageId) ids.add(idStr(p.imageId));
  return [...ids];
}

// code 0..4 -> nhãn in trên đề: "" cho đề gốc, 101..104 cho mã đề.
function codeLabel(code) {
  const n = Number(code);
  return n >= 1 ? String(100 + n) : "Original";
}

function timeLabel(test) {
  const sk = (test && test.skills) || {};
  const total = ["listening", "reading", "writing", "speaking"].reduce((n, k) => n + (Number(sk[k] && sk[k].durationMinutes) || 0), 0);
  return total > 0 ? `${total} minutes` : "";
}

// -> { exam: { parts, answers, prompts }, meta, imageUrls: [url] }
function buildExam(test, { urlById, code }) {
  const urls = urlById || new Map();
  const urlOf = (id) => (id ? urls.get(idStr(id)) || "" : "");
  const skills = {};
  for (const sk of QUESTION_SKILLS) {
    const sections = ((test.skills && test.skills[sk] && test.skills[sk].sections) || []).map((sec) => ({
      ...sec,
      imageUrl: urlOf(sec.imageId),
      fields: (sec.fields || []).map((f) => ({ ...f, imageUrl: urlOf(f.imageId) })),
    }));
    skills[sk] = { sections };
  }
  const shuffled = shuffleExam(skills, { seed: idStr(test._id), code });

  const prompts = [];
  for (const sk of PROMPT_SKILLS) {
    for (const p of (test.skills && test.skills[sk] && test.skills[sk].prompts) || []) {
      prompts.push({ skill: sk, title: String(p.title || ""), instructions: String(p.instructions || ""), imageUrl: urlOf(p.imageId) });
    }
  }

  const exam = { parts: shuffled.parts, answers: shuffled.answers, prompts };
  const meta = {
    title: String(test.title || "Test"),
    grade: test.level != null ? `Grade ${test.level}` : "",
    time: timeLabel(test),
    code: codeLabel(code),
  };
  const imageUrls = new Set();
  for (const p of exam.parts) {
    if (p.imageUrl) imageUrls.add(p.imageUrl);
    for (const q of p.questions) if (q.imageUrl) imageUrls.add(q.imageUrl);
  }
  for (const p of prompts) if (p.imageUrl) imageUrls.add(p.imageUrl);
  return { exam, meta, imageUrls: [...imageUrls] };
}

// Phần gửi cho trang in: đề KHÔNG kèm đáp án.
function examForPrint(exam) {
  return { parts: exam.parts, prompts: exam.prompts };
}

module.exports = { buildExam, collectImageIds, codeLabel, timeLabel, examForPrint };
