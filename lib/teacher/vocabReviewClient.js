// Phía editor của Vocab Review: dựng "nguồn" từ state editor, tuỳ chọn AI nhớ lần
// trước, gộp từ. Phần tính hash / trạng thái dùng chung với server nằm ở
// lib/vocabReviewSource.js.

import { sectionsToPayload } from "./sectionTransforms";
import { MAX_WORDS } from "../vocabReviewSource";

export { REVIEW_SKILLS, isReviewSkill, reviewState, sourceHashOf } from "../vocabReviewSource";

// category (state editor, exercises[]._sections) -> shape mà collectSource đọc.
// Chỉ giữ những field mà collectSource dùng nên cũng là body gọn gửi lên AI
// (không kéo theo noteDoc/TipTap JSON).
export function reviewSourceCat(cat) {
  return {
    key: cat.key,
    vocabReview: cat.vocabReview,
    exercises: (cat.exercises || []).map((ex) => ({
      sections: sectionsToPayload(ex._sections || [], cat.key).map((s) => ({
        transcript: s.transcript,
        passageText: s.passageText,
        noteText: s.noteText,
        noteBlocks: (s.noteBlocks || []).map((b) => ({ noteText: b.noteText })),
        matchOptions: s.matchOptions,
        fields: (s.fields || []).map((f) => ({
          type: f.type,
          label: f.label,
          pre: f.pre,
          post: f.post,
          options: f.options,
          answers: f.answers,
        })),
      })),
    })),
  };
}

export const emptyReview = () => ({ enabled: false, words: [], sourceHash: "" });

// ---- Tuỳ chọn AI nhớ lần dùng trước (localStorage, theo workspace) ----
export const DEFAULT_AI_OPTIONS = {
  studentLevel: "",
  language: "vi",
  wordCount: 15,
  columns: ["partOfSpeech", "ipa", "meaning", "definitionEn", "collocation", "synonyms"],
  notes: "",
};

const storeKey = (scope) => "vocabReviewAi:" + (scope || "default");

// Đọc/ghi localStorage có thể ném lỗi (chế độ riêng tư, bị chặn) -> luôn bọc try/catch.
export function loadAiOptions(scope) {
  try {
    const raw = JSON.parse(localStorage.getItem(storeKey(scope)) || "null");
    if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_OPTIONS };
    return {
      studentLevel: typeof raw.studentLevel === "string" ? raw.studentLevel.slice(0, 80) : "",
      language: raw.language === "en" ? "en" : "vi",
      wordCount: [10, 15, 20].includes(raw.wordCount) ? raw.wordCount : DEFAULT_AI_OPTIONS.wordCount,
      columns: Array.isArray(raw.columns) ? raw.columns.filter((c) => typeof c === "string") : DEFAULT_AI_OPTIONS.columns.slice(),
      notes: "",
    };
  } catch {
    return { ...DEFAULT_AI_OPTIONS };
  }
}

// Ghi chú (notes) thường riêng cho từng bài nên không nhớ.
export function saveAiOptions(scope, opts) {
  try {
    const { notes, ...rest } = opts;
    localStorage.setItem(storeKey(scope), JSON.stringify(rest));
  } catch {
    /* không lưu được thì thôi — chỉ là tiện lợi */
  }
}

// Nối `incoming` vào cuối `current`, bỏ từ trùng (theo chữ thường), tối đa MAX_WORDS.
export function mergeWords(current, incoming) {
  const seen = new Set(current.map((w) => (w.word || "").trim().toLowerCase()));
  const out = [...current];
  let dropped = 0;
  for (const w of incoming) {
    const k = (w.word || "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    if (out.length >= MAX_WORDS) {
      dropped += 1;
      continue;
    }
    seen.add(k);
    out.push(w);
  }
  return { words: out, dropped };
}
