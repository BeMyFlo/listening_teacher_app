// Hợp đồng dữ liệu để AI (Gemini) chấm 1 bài Writing — 1 nguồn sự thật duy
// nhất, khớp với annotation model của giáo viên (lib/grading/annotate.js).
//
// AI trả annotation theo QUOTE + occurrence (không phải offset ký tự) vì LLM
// đếm ký tự không chính xác. Server đổi sang offset bằng resolveQuote.

const { resolveQuote, reconcileAnnotations, CATEGORIES, CRITERIA, IELTS_CRITERIA, SEVERITIES } = require("./annotate");
const { getRubric, overallBand, scoreRange, criterionKeys, overallScore, isGeneralVariant } = require("./rubric");
const { CRITERION_MAX, CRITERION_STEP } = require("./generalRubric");
const { toeicTask, ASPECT_LABELS } = require("../toeicTasks");
const { guardAnnotations, improvedSampleProblems } = require("./meaningGuard");

// Item schema dùng chung cho annotations[] của cả Writing (neo vào essay) và
// Speaking (neo vào transcript) — cùng 1 engine hiển thị (annotate.js).
const ANNOTATION_ITEM_SCHEMA = {
  type: "object",
  properties: {
    quote: { type: "string", description: "Exact substring of the text this refers to. Empty only for a pure insertion." },
    occurrence: { type: "integer", description: "1-based: which occurrence of `quote` in the text (1 if it appears once)." },
    action: { type: "string", enum: ["delete", "replace", "insert", "comment"] },
    insertText: { type: "string", description: "For replace/insert: the corrected text. For insert, this is added right after `quote` (or at start if quote empty)." },
    category: { type: "string", enum: CATEGORIES },
    criterion: { type: "string", enum: IELTS_CRITERIA, description: "Which IELTS criterion this evidences." },
    comment: { type: "string", description: "Short explanation for the teacher/student." },
    severity: { type: "string", enum: SEVERITIES, description: "minor (rare slip) / noticeable (understandable but reduces accuracy) / major (distorts meaning or a repeated pattern)." },
  },
  required: ["quote", "occurrence", "action", "category", "criterion", "comment"],
};

const PRIORITIES_SCHEMA = {
  type: "array",
  items: { type: "string" },
  description: "Exactly 3 concrete priorities for the student's next attempt, ordered by impact.",
};
const SPEAKING_PRIORITIES_SCHEMA = {
  type: "array",
  items: { type: "string" },
  description: "At most 3 concrete priorities for the student's next attempt, ordered by impact. Fewer is fine.",
};
const SPEAKING_TOPIC_VOCAB_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      term: { type: "string" },
      meaning: { type: "string", description: "Short meaning, in Vietnamese." },
      example: { type: "string", description: "One natural example sentence using the term, in English." },
    },
    required: ["term", "meaning", "example"],
  },
  description:
    "0–5 items. Prefer fixing an expression the student actually tried to use. Only add a brand-new word if genuinely " +
    "useful for this topic and within the student's reach. Return an empty list if nothing is worth adding — never pad. " +
    "Never suggest tired clichés (e.g. \"double-edged sword\", \"in this day and age\", \"last but not least\").",
};
const TOPIC_VOCAB_SCHEMA = {
  type: "array",
  items: {
    type: "object",
    properties: {
      term: { type: "string" },
      meaning: { type: "string", description: "Short meaning, in Vietnamese." },
      example: { type: "string", description: "One natural example sentence using the term, in English." },
    },
    required: ["term", "meaning", "example"],
  },
  description:
    "5–8 topic-relevant vocabulary/collocations the student could use, natural and level-appropriate. " +
    "Never suggest tired clichés/fillers (e.g. \"double-edged sword\", \"two sides of the same coin\", " +
    "\"in this day and age\", \"needless to say\", \"last but not least\") — they read as outdated and unnatural.",
};

// responseSchema cho Gemini (tập con OpenAPI).
const AI_GRADE_JSON_SCHEMA = {
  type: "object",
  properties: {
    annotations: { type: "array", items: ANNOTATION_ITEM_SCHEMA },
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: IELTS_CRITERIA },
          band: { type: "integer", description: "Whole band 1–9." },
          comment: { type: "string", description: "Justification tied to concrete evidence in the essay." },
        },
        required: ["key", "band", "comment"],
      },
    },
    overallFeedback: { type: "string", description: "2–4 sentences of overall feedback addressed to the student." },
    suggestedOverall: { type: "number", description: "0–9 in 0.5 steps (server recomputes from criteria)." },
    priorities: PRIORITIES_SCHEMA,
    topicVocabulary: TOPIC_VOCAB_SCHEMA,
    improvedSample: {
      type: "string",
      description:
        "A realistically improved rewrite of the student's own answer (same ideas/position), roughly 0.5–1 band higher — not a Band 9 model. " +
        "Avoid clichéd filler phrases/transitions (e.g. \"double-edged sword\", \"two sides of the same coin\", \"in this day and age\", \"last but not least\") — they read as outdated and unnatural.",
    },
  },
  required: ["annotations", "criteria", "overallFeedback", "priorities", "topicVocabulary", "improvedSample"],
};

const AI_GRADE_FIELD_SPEC = `Return JSON with:
- annotations[]: the high-value corrections and comments only (up to 12, no minimum — never pad). Use action "replace" for wrong wording/grammar (give insertText), "delete" for redundant text, "insert" to add a missing word (quote = the word it goes after, insertText = " missingword"), "comment" to flag an issue without rewriting. Each carries category + the IELTS criterion it evidences + a short comment.
  - category "idea" is for Task Achievement/Task Response issues (unsupported claims, off-topic, weak development, contradictions). Mark it with action "comment" spanning the WHOLE sentence (not delete/replace) — it is rendered as a full-sentence underline, not a word-level strikethrough.
  - category "grammar"/"vocabulary"/"cohesion" are for word/phrase-level errors — use "delete"/"replace"/"insert" so they render as a strikethrough + correction.
  - severity: "minor" (rare slip, meaning fully clear), "noticeable" (reduces accuracy/naturalness but still understandable), or "major" (distorts meaning, hard to understand, or a repeated/systematic pattern).
- criteria[]: one entry per criterion for this rubric, band 1–9 (whole numbers), with a justification.
- overallFeedback: 2–4 sentences to the student.
- priorities: exactly 3 short, concrete action items for next time, ordered by impact — no band numbers.
- topicVocabulary: 5–8 entries relevant to this essay's topic, each with meaning (Vietnamese) and one example sentence (English). Natural and appropriate to the student's level — do not label items "Band 8 vocabulary" or force idioms.
- improvedSample: a realistic rewrite of the student's OWN answer — keep their position, ideas and voice, fix language/logic issues, aim for a realistic ~0.5–1 band improvement. Never turn it into a flawless Band 9 model, never invent facts/experiences the student didn't write.
NO CLICHÉS anywhere you produce wording for the student (topicVocabulary, improvedSample, and any suggested replace/insert text) — avoid tired, overused phrases/transitions such as "double-edged sword", "two sides of the same coin", "in this day and age", "needless to say", "last but not least", "in a nutshell", "at the end of the day". They read as outdated and unnatural, not as genuine natural English.
Quote text EXACTLY as it appears in the essay (respect original spelling/casing) and set occurrence.
Corrections must NOT overlap: never emit two delete/replace/insert annotations covering the same or nested words. If one span needs several fixes, use a single "replace" for the whole span with the fully corrected text. Always set "occurrence" correctly so repeated quotes resolve to the intended spot.

LANGUAGE:
- criteria[].comment: write in ENGLISH (examiner-style band justification).
- annotations[].comment, overallFeedback, priorities[] and topicVocabulary[].meaning: write in VIETNAMESE. Address the student as "em" and refer to the teacher/examiner voice as "chị". Do NOT use "bạn".
- Keep "insertText" (corrected English wording), "quote", topicVocabulary[].example and improvedSample in English — never translate the student's essay.`;

function validateAiGrade(payload, variant) {
  if (!payload || typeof payload !== "object") return "empty AI response";
  if (!Array.isArray(payload.annotations)) return "annotations missing";
  if (!Array.isArray(payload.criteria) || !payload.criteria.length) return "criteria missing";
  const rubric = getRubric(variant);
  const wantKeys = rubric ? rubric.criteria.map((c) => c.key) : IELTS_CRITERIA;
  const seen = new Set();
  for (const c of payload.criteria) {
    if (!c || typeof c !== "object") return "malformed criterion entry";
    if (!wantKeys.includes(c.key)) return `unknown criterion ${c.key}`;
    if (seen.has(c.key)) return `duplicate criterion ${c.key}`;
    seen.add(c.key);
    // Số thật, nguyên, 1–9 — không nhận chuỗi/null/số lẻ rồi âm thầm làm tròn.
    if (typeof c.band !== "number" || !Number.isInteger(c.band) || c.band < 1 || c.band > 9) return `bad band for ${c.key}`;
    if (typeof c.comment !== "string" || !c.comment.trim()) return `missing comment for ${c.key}`;
  }
  // Thiếu 1 tiêu chí mà vẫn tính điểm tổng = điểm tổng bị thổi phồng.
  for (const k of wantKeys) if (!seen.has(k)) return `missing criterion ${k}`;
  for (const a of payload.annotations) {
    if (!a || typeof a !== "object") return "malformed annotation";
    if (!["delete", "replace", "insert", "comment"].includes(a.action)) return `bad action ${a.action}`;
    if (a.severity && !SEVERITIES.includes(a.severity)) return `bad severity ${a.severity}`;
  }
  return null;
}

// Quote+occurrence -> offset, dùng chung cho Writing (neo vào essay) và
// Speaking (neo vào transcript) — cùng 1 dạng annotation, khác text gốc.
function resolveAnnotationsFromQuotes(rawAnnotations, text) {
  const annotations = [];
  let unresolved = 0;
  // Các đoạn đã bị 1 annotation mutating chiếm — tránh 2 correction cùng quote
  // (thiếu/sai `occurrence`) resolve về đúng một chỗ rồi thành overlap.
  const usedSpans = [];
  const overlapsUsed = (s, e) => usedSpans.some((u) => s < u.end && e > u.start);
  for (const a of rawAnnotations || []) {
    let start = 0;
    let end = 0;
    if (a.action === "insert" && !a.quote) {
      start = end = 0;
    } else {
      const wanted = Math.max(1, Number(a.occurrence) || 1);
      const explicit = Number(a.occurrence) >= 1;
      let r = resolveQuote(text, a.quote || "", wanted);
      // Nếu AI không nêu rõ occurrence và chỗ này đã bị chiếm, thử lần kế tiếp.
      for (let occ = wanted + 1; !explicit && r && a.action !== "insert" && overlapsUsed(r.start, r.end) && occ <= wanted + 20; occ++) {
        const next = resolveQuote(text, a.quote || "", occ);
        if (!next) break;
        r = next;
      }
      if (!r) {
        unresolved++;
        continue;
      }
      start = a.action === "insert" ? r.end : r.start;
      end = a.action === "insert" ? r.end : r.end;
      if (a.action !== "insert") usedSpans.push({ start, end });
    }
    annotations.push({
      start,
      end,
      quote: a.quote || "",
      action: a.action,
      insertText: a.action === "replace" || a.action === "insert" ? String(a.insertText || "") : "",
      category: CATEGORIES.includes(a.category) ? a.category : "other",
      criterion: CRITERIA.includes(a.criterion) ? a.criterion : null,
      comment: String(a.comment || ""),
      severity: SEVERITIES.includes(a.severity) ? a.severity : null,
      source: "ai",
    });
  }
  return { annotations, unresolved };
}

// -> { annotations (offset), criteria, overallFeedback, suggestedOverall, unresolved }
// Tối đa 12 annotation (không có tối thiểu): giữ các cái quan trọng nhất, giữ nguyên thứ tự gốc.
const MAX_ANNOTATIONS = 12;
function capAnnotations(list) {
  if (list.length <= MAX_ANNOTATIONS) return list;
  const sev = { major: 0, noticeable: 1, minor: 2 };
  const rank = (a) => (a.category === "idea" || a.category === "task" ? -1 : sev[a.severity] != null ? sev[a.severity] : 1);
  const keep = new Set(
    list.map((a, i) => ({ i, r: rank(a) })).sort((x, y) => x.r - y.r || x.i - y.i).slice(0, MAX_ANNOTATIONS).map((x) => x.i)
  );
  return list.filter((_, i) => keep.has(i));
}

// taskText (tuỳ chọn): đề bài — để kiểm số liệu trong improvedSample.
function normaliseAiGrade(payload, essayText, variant, taskText = "") {
  const resolved = resolveAnnotationsFromQuotes(payload.annotations, essayText);
  const unresolved = resolved.unresolved;
  // Task 1 là bài mô tả số liệu: correction không được làm đổi nghĩa số liệu.
  const guarded = variant === "writing.task1" ? guardAnnotations(resolved.annotations) : { annotations: resolved.annotations, demoted: 0 };
  const annotations = reconcileAnnotations(essayText, capAnnotations(guarded.annotations)).annotations;

  const rubric = getRubric(variant);
  const wantKeys = rubric ? rubric.criteria.map((c) => c.key) : IELTS_CRITERIA;
  const criteria = wantKeys.map((k) => {
    const found = (payload.criteria || []).find((c) => c.key === k);
    return { key: k, band: found ? Math.round(Number(found.band)) : null, comment: found ? String(found.comment || "") : "" };
  });
  // Server tự tính — KHÔNG đọc payload.suggestedOverall của model. Thiếu tiêu chí -> null.
  const suggestedOverall = criteria.some((c) => c.band == null) ? null : overallBand(criteria);

  const actions = normaliseSuggestedActions(payload);
  let unresolvedOut = unresolved;
  if (variant === "writing.task1" && actions.improvedSample) {
    const bad = improvedSampleProblems(actions.improvedSample, essayText, taskText);
    if (bad.length) {
      // Thà không có bản mẫu còn hơn bản mẫu viết lại sai số liệu/nghĩa.
      console.warn("[ai-grade] improvedSample dropped:", bad.join("; "));
      actions.improvedSample = "";
      unresolvedOut += 1;
    }
  }

  return {
    annotations,
    criteria,
    overallFeedback: String(payload.overallFeedback || ""),
    suggestedOverall,
    unresolved: unresolvedOut,
    ...actions,
  };
}

// "Suggested Actions" box — chung cho Writing lẫn Speaking.
function normaliseSuggestedActions(payload) {
  return {
    priorities: Array.isArray(payload.priorities) ? payload.priorities.map((p) => String(p || "").trim()).filter(Boolean).slice(0, 3) : [],
    topicVocabulary: Array.isArray(payload.topicVocabulary)
      ? payload.topicVocabulary
          .map((v) => ({ term: String((v && v.term) || "").trim(), meaning: String((v && v.meaning) || "").trim(), example: String((v && v.example) || "").trim() }))
          .filter((v) => v.term)
          .slice(0, 8)
      : [],
    improvedSample: String(payload.improvedSample || "").trim(),
  };
}

// ---------------- Speaking ----------------
// Không có bài viết để neo -> ghi chú theo mốc giây (atSeconds).

const AI_GRADE_SPEAKING_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "Full transcription of what the student said, verbatim." },
    annotations: { type: "array", items: ANNOTATION_ITEM_SCHEMA },
    notes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          atSeconds: { type: "number", description: "Approx timestamp in the recording this note refers to." },
          category: { type: "string", enum: CATEGORIES },
          criterion: { type: "string", enum: IELTS_CRITERIA },
          comment: { type: "string" },
        },
        required: ["category", "criterion", "comment"],
      },
    },
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: IELTS_CRITERIA },
          band: { type: "integer" },
          comment: { type: "string" },
        },
        required: ["key", "band", "comment"],
      },
    },
    mainIssue: {
      type: "string",
      description: "One sentence, in Vietnamese: the single most useful thing for this student to fix in this answer.",
    },
    overallFeedback: { type: "string" },
    suggestedOverall: { type: "number" },
    priorities: SPEAKING_PRIORITIES_SCHEMA,
    topicVocabulary: SPEAKING_TOPIC_VOCAB_SCHEMA,
    improvedSample: {
      type: "string",
      description:
        "A realistically improved rewrite of what the student said (same ideas, opinions and experiences, same voice), roughly 0.5–1 band higher — not a Band 9 model. " +
        "Short natural spoken sentences. Avoid clichéd filler phrases (e.g. \"double-edged sword\", \"two sides of the same coin\", \"in this day and age\", \"last but not least\").",
    },
  },
  required: ["transcript", "annotations", "notes", "criteria", "mainIssue", "overallFeedback", "priorities", "topicVocabulary", "improvedSample"],
};

const AI_GRADE_SPEAKING_FIELD_SPEC = `Listen to the recording and return JSON with:
- transcript: what the student said, verbatim (English).
- annotations[]: the COMPLETE list of genuine grammar/vocabulary/cohesion/idea errors that anchor to specific words in the transcript.
  - List every genuine error. Do NOT drop an error because it repeats a pattern. For a repeated error, annotate every occurrence; explain the rule fully only on the first, and for later ones set comment to a short phrase like "Cùng lỗi lặp lại — xem giải thích ở lần đầu."
  - Do NOT annotate correct-but-basic language. Only wrong or clearly unnatural English counts as an error.
  - category "idea": action "comment" spanning the WHOLE sentence (full-sentence underline, not word-level).
  - category "grammar"/"vocabulary"/"cohesion": "delete"/"replace"/"insert" on the word/phrase (strikethrough + correction).
  - severity: "minor" / "noticeable" / "major" (see definitions above).
  - criterion: ALWAYS set exactly one of "FC" / "LR" / "GRA" / "PR" — the student view groups corrections under these four headings. Grammar/verb-form/agreement/article/word-order → "GRA". Wrong word, wrong collocation, wrong register, unnatural expression → "LR". Wrong/overused/written-style cohesive device (e.g. spoken "In conclusion") → "FC".
  - Quote text EXACTLY as it appears in the transcript and set occurrence.
- notes[]: ONLY delivery/pronunciation issues that can't be anchored to transcript text — fluency (hesitation, pacing, self-correction, not sustaining speech) and pronunciation/intonation — each with an approximate atSeconds, a category, the Speaking criterion it evidences, and a comment. Only raise what a listener genuinely notices; 2–4 per criterion is plenty. Do not duplicate an annotations[] item here.
- criteria[]: one entry per Speaking criterion (FC, LR, GRA, PR), band 1–9 (whole numbers). comment = 2–4 sentences to the student in the TEACHER'S voice (not examiner boilerplate): what works + the one most important fix with a concrete example and how to practise. Summarise patterns, do not re-list every error. NEVER mention a band number in a comment.
- mainIssue: one sentence — the single most useful thing for this student to fix in this answer.
- overallFeedback: 3–5 sentences to the student synthesising the ROOT patterns and what to prioritise. Do not repeat the individual error list.
- priorities: at most 3 short, concrete action items for next time, ordered by impact — no band numbers. Fewer is fine.
- topicVocabulary: 0–5 entries. Prefer fixing an expression the student actually tried to use. Only add a new word if genuinely useful and within reach. Empty list is fine — never pad.
- improvedSample: a realistic rewrite of what the student said — keep their exact ideas/opinions/experiences and voice, fix the language, aim for ~0.5–1 band higher (not Band 9). Short natural spoken sentences; never invent facts the student didn't mention.
NO CLICHÉS anywhere you produce wording for the student (topicVocabulary, improvedSample, suggested replace/insert text) — avoid tired, overused phrases such as "double-edged sword", "two sides of the same coin", "in this day and age", "needless to say", "last but not least", "in a nutshell", "at the end of the day". A real spoken answer never sounds like a cliché-filled essay.
LANGUAGE:
- annotations[].comment, notes[].comment, criteria[].comment, mainIssue, overallFeedback, priorities[] and topicVocabulary[].meaning: VIETNAMESE. Address the student as "em", the teacher voice as "chị". Never "bạn".
- transcript, insertText/quote in annotations[], topicVocabulary[].example and improvedSample stay in English.`;

function normaliseAiSpeaking(payload, variant = "speaking") {
  const rubric = getRubric(variant);
  const wantKeys = rubric ? rubric.criteria.map((c) => c.key) : ["FC", "LR", "GRA", "PR"];
  const criteria = wantKeys.map((k) => {
    const found = (payload.criteria || []).find((c) => c.key === k);
    return { key: k, band: found ? Math.round(Number(found.band)) : null, comment: found ? String(found.comment || "") : "" };
  });
  const notes = (payload.notes || []).map((n) => ({
    atSeconds: Number.isFinite(Number(n.atSeconds)) ? Math.max(0, Number(n.atSeconds)) : null,
    category: CATEGORIES.includes(n.category) ? n.category : "other",
    criterion: CRITERIA.includes(n.criterion) ? n.criterion : null,
    comment: String(n.comment || ""),
    source: "ai",
  }));
  const transcript = String(payload.transcript || "");
  const resolved = resolveAnnotationsFromQuotes(payload.annotations, transcript);
  const unresolved = resolved.unresolved;
  const annotations = reconcileAnnotations(transcript, resolved.annotations).annotations;
  return {
    transcript,
    annotations,
    speakingNotes: notes,
    criteria,
    mainIssue: String(payload.mainIssue || "").trim(),
    overallFeedback: String(payload.overallFeedback || ""),
    suggestedOverall: overallBand(criteria.filter((c) => c.band != null)),
    unresolved,
    ...normaliseSuggestedActions(payload),
  };
}

// ---------------- TOEIC Speaking & Writing (Phase 8B) ----------------
// Mỗi câu chấm MỘT điểm nguyên 0..maxScore + nhận xét theo khía cạnh của dạng đề (lib/toeicTasks.js).
// Phần IELTS ở trên không đổi; mọi thứ dưới đây chỉ chạy khi rubricVariant là toeic.*.

// Item annotation dùng chung với IELTS, chỉ khác enum criterion = khía cạnh của dạng đề.
function toeicAnnotationItemSchema(aspects) {
  return {
    ...ANNOTATION_ITEM_SCHEMA,
    properties: {
      ...ANNOTATION_ITEM_SCHEMA.properties,
      criterion: { type: "string", enum: aspects.slice(), description: "Which aspect of the task this evidences." },
    },
  };
}

const toeicAspectsSchema = (aspects) => ({
  type: "array",
  items: {
    type: "object",
    properties: {
      key: { type: "string", enum: aspects.slice() },
      comment: { type: "string", description: "1–3 sentences on this aspect, tied to concrete evidence." },
    },
    required: ["key", "comment"],
  },
  description: "One entry per aspect of this task (feedback only; an aspect is not scored separately).",
});

const TOEIC_VOCAB_SCHEMA = {
  ...TOPIC_VOCAB_SCHEMA,
  description: "0–5 useful words/phrases for this topic (meaning in Vietnamese). Empty list is fine — never pad. No tired clichés.",
};

// -> responseSchema cho Gemini. variant = "toeic.w.*" (Writing) hoặc "toeic.s.*" (Speaking).
function toeicGradeSchema(variant) {
  const task = toeicTask(variant);
  if (!task) throw new Error("Unknown TOEIC task: " + variant);
  const speaking = task.skill === "speaking";
  const properties = {
    score: { type: "integer", description: `Whole score from 0 to ${task.maxScore} for this task.` },
    comment: { type: "string", description: "2–4 sentences of overall feedback addressed to the student." },
    aspects: toeicAspectsSchema(task.aspects),
    annotations: { type: "array", items: toeicAnnotationItemSchema(task.aspects) },
    priorities: speaking ? SPEAKING_PRIORITIES_SCHEMA : PRIORITIES_SCHEMA,
    topicVocabulary: TOEIC_VOCAB_SCHEMA,
  };
  const required = ["score", "comment", "aspects", "annotations", "priorities"];
  if (speaking) {
    properties.transcript = { type: "string", description: "Full transcription of what the student said, verbatim. Empty if nothing intelligible." };
    properties.notes = {
      type: "array",
      items: {
        type: "object",
        properties: {
          atSeconds: { type: "number", description: "Approx timestamp in the recording this note refers to." },
          category: { type: "string", enum: CATEGORIES },
          criterion: { type: "string", enum: task.aspects.slice() },
          comment: { type: "string" },
        },
        required: ["category", "criterion", "comment"],
      },
    };
    properties.mainIssue = {
      type: "string",
      description: "One sentence, in Vietnamese: the single most useful thing for this student to fix in this answer.",
    };
    properties.improvedSample = {
      type: "string",
      description: "A realistic improved version of what the student said (same ideas, same voice). Empty for read-aloud tasks.",
    };
    required.push("transcript", "notes", "mainIssue");
  } else {
    properties.improvedSample = {
      type: "string",
      description: "A realistically improved rewrite of the student's own answer (same ideas), about one score point higher — not a perfect model answer.",
    };
    required.push("improvedSample");
  }
  return { type: "object", properties, required };
}

const TOEIC_LANGUAGE_SPEC = `LANGUAGE:
- comment, aspects[].comment, annotations[].comment, priorities[], mainIssue and topicVocabulary[].meaning: VIETNAMESE. Address the student as "em" and the teacher voice as "chị". Never "bạn".
- Never write the score as a number inside any comment — the number lives only in "score".
- quote, insertText, topicVocabulary[].example and improvedSample stay in English. Never translate the student's answer.`;

// Phần "Return JSON with" của prompt hệ thống TOEIC. Quote + occurrence, tối đa MAX_ANNOTATIONS — như IELTS.
function toeicFieldSpec(variant) {
  const task = toeicTask(variant);
  const speaking = task.skill === "speaking";
  const aspectList = task.aspects.map((k) => `${k} (${ASPECT_LABELS[k] || k})`).join(", ");
  const where = speaking ? "transcript" : "student's answer";
  const lines = [
    "Return JSON with:",
    `- score: ONE whole number from 0 to ${task.maxScore}, judged against the score descriptors above. This is the only number you produce.`,
    "- comment: 2–4 sentences to the student: what works, the main thing to fix, how to practise.",
    `- aspects[]: one entry per aspect — ${aspectList} — each with a 1–3 sentence comment tied to concrete evidence. Aspects are feedback, not separate scores.`,
    `- annotations[]: the high-value corrections and comments only (up to ${MAX_ANNOTATIONS}, no minimum — never pad). Quote the text EXACTLY as it appears in the ${where} and set occurrence (1-based). Use action "replace" for wrong wording/grammar (give insertText), "delete" for redundant text, "insert" to add a missing word, "comment" to flag an issue without rewriting. Each carries category + criterion (one of the aspect keys above) + a short comment; severity minor / noticeable / major. Corrections must NOT overlap — use a single "replace" for a span that needs several fixes. Only annotate actual errors, never acceptable-but-basic English.`,
    "- priorities: short, concrete action items for next time, ordered by impact.",
    "- topicVocabulary: 0–5 entries (meaning in Vietnamese, one English example) only if genuinely useful; an empty list is fine.",
  ];
  if (speaking) {
    lines.splice(1, 0, "- transcript: what the student said, verbatim (English). If nothing intelligible was said, return an empty string and score 0.");
    lines.push(
      "- notes[]: ONLY delivery issues that cannot be anchored to transcript text (pronunciation, intonation/stress, fluency/pauses), each with an approximate atSeconds, a category, one aspect key as criterion and a comment. 2–4 per aspect at most; do not duplicate an annotations[] item.",
      "- mainIssue: one sentence — the single most useful thing for this student to fix in this answer.",
      "- improvedSample: a realistic improved version of what the student said (short natural spoken sentences, same ideas). For read-aloud tasks return an empty string."
    );
  } else {
    lines.push("- improvedSample: a realistic rewrite of the student's OWN answer — keep their ideas and voice, fix the language, aim for about one score point higher. Never invent facts they did not write.");
  }
  lines.push(TOEIC_LANGUAGE_SPEC);
  return lines.join("\n");
}

// null nếu hợp lệ; chuỗi lỗi nếu không. Điểm ngoài khoảng / không nguyên là LỖI (không âm thầm kẹp lại).
function validateToeicGrade(payload, variant) {
  const task = toeicTask(variant);
  if (!task) return "unknown TOEIC task " + variant;
  if (!payload || typeof payload !== "object") return "empty AI response";
  const { min, max } = scoreRange(variant);
  if (typeof payload.score !== "number" || !Number.isInteger(payload.score) || payload.score < min || payload.score > max) {
    return `bad score (need a whole number ${min}–${max})`;
  }
  if (typeof payload.comment !== "string" || !payload.comment.trim()) return "missing comment";
  if (!Array.isArray(payload.aspects)) return "aspects missing";
  const seen = new Set();
  for (const a of payload.aspects) {
    if (!a || typeof a !== "object") return "malformed aspect entry";
    if (!task.aspects.includes(a.key)) return `unknown aspect ${a.key}`;
    if (seen.has(a.key)) return `duplicate aspect ${a.key}`;
    seen.add(a.key);
    if (typeof a.comment !== "string") return `bad comment for aspect ${a.key}`;
  }
  if (!Array.isArray(payload.annotations)) return "annotations missing";
  for (const a of payload.annotations) {
    if (!a || typeof a !== "object") return "malformed annotation";
    if (!["delete", "replace", "insert", "comment"].includes(a.action)) return `bad action ${a.action}`;
    if (a.severity && !SEVERITIES.includes(a.severity)) return `bad severity ${a.severity}`;
    if (!task.aspects.includes(a.criterion)) return `bad annotation criterion ${a.criterion}`;
  }
  if (task.skill === "speaking") {
    if (typeof payload.transcript !== "string") return "transcript missing";
    if (payload.notes != null) {
      if (!Array.isArray(payload.notes)) return "notes malformed";
      for (const n of payload.notes) {
        if (!n || typeof n !== "object") return "malformed note";
        if (n.criterion != null && !task.aspects.includes(n.criterion)) return `bad note criterion ${n.criterion}`;
      }
    }
  }
  return null;
}

// RubricGrader chỉ có chỗ ghi chú cho criterion "score" -> nhận xét từng khía cạnh gộp vào đó
// (mỗi khía cạnh một dòng "Nhãn: nhận xét"). overallFeedback = comment tổng.
function aspectsToComment(task, payload) {
  return task.aspects
    .map((k) => {
      const f = (payload.aspects || []).find((a) => a && a.key === k);
      const text = f ? String(f.comment || "").trim() : "";
      return text ? `${ASPECT_LABELS[k] || k}: ${text}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

function normaliseToeicCommon(payload, variant) {
  const task = toeicTask(variant);
  const score = Number(payload.score);
  return {
    criteria: [{ key: "score", band: score, comment: aspectsToComment(task, payload) }],
    overallFeedback: String(payload.comment || "").trim(),
    suggestedOverall: score,
    aspects: (payload.aspects || []).map((a) => ({ key: a.key, comment: String(a.comment || "").trim() })),
    ...normaliseSuggestedActions(payload),
  };
}

// Writing: cùng shape với normaliseAiGrade (persistDraft + RubricGrader.applyDraft đọc được).
function normaliseToeicGrade(payload, essayText, variant) {
  const resolved = resolveAnnotationsFromQuotes(payload.annotations, essayText);
  const annotations = reconcileAnnotations(essayText, capAnnotations(resolved.annotations)).annotations;
  return { annotations, unresolved: resolved.unresolved, ...normaliseToeicCommon(payload, variant) };
}

// Speaking: cùng shape với normaliseAiSpeaking.
function normaliseToeicSpeaking(payload, variant) {
  const transcript = String(payload.transcript || "");
  const resolved = resolveAnnotationsFromQuotes(payload.annotations, transcript);
  const annotations = reconcileAnnotations(transcript, capAnnotations(resolved.annotations)).annotations;
  const speakingNotes = (payload.notes || []).map((n) => ({
    atSeconds: Number.isFinite(Number(n.atSeconds)) ? Math.max(0, Number(n.atSeconds)) : null,
    category: CATEGORIES.includes(n.category) ? n.category : "other",
    criterion: CRITERIA.includes(n.criterion) ? n.criterion : null,
    comment: String(n.comment || ""),
    source: "ai",
  }));
  return {
    transcript,
    annotations,
    speakingNotes,
    mainIssue: String(payload.mainIssue || "").trim(),
    unresolved: resolved.unresolved,
    ...normaliseToeicCommon(payload, variant),
  };
}

// ---------------- General English Writing & Speaking (Phase 12 G5) ----------------
// Thang 10: 4 tiêu chí, mỗi tiêu chí 0–2.5 (bước 0.25), điểm bài = TỔNG do server tính. Chạy khi
// rubricVariant là general.* (isGeneralVariant). IELTS/TOEIC ở trên không đổi.
// Gemini bỏ qua thuộc tính không nằm trong `required` -> mọi trường cần dùng đều phải required.

function generalCriterionLabels(variant) {
  const r = getRubric(variant);
  return r ? r.criteria.map((c) => `${c.key} (${c.label})`).join(", ") : "";
}

const snapGeneralScore = (n) => Math.min(CRITERION_MAX, Math.max(0, Math.round(Number(n) / CRITERION_STEP) * CRITERION_STEP));

const GENERAL_VOCAB_SCHEMA = {
  ...TOPIC_VOCAB_SCHEMA,
  description: "0–5 useful words/phrases for this topic at the student's grade (meaning in Vietnamese). Empty list is fine — never pad. No tired clichés.",
};

// kind: "writing" | "speaking". Mọi trường đều required.
function generalGradeSchema(variant, kind) {
  const keys = criterionKeys(variant);
  if (!isGeneralVariant(variant)) throw new Error("Unknown General rubric: " + variant);
  const speaking = kind === "speaking";
  const annotationItem = {
    ...ANNOTATION_ITEM_SCHEMA,
    properties: {
      ...ANNOTATION_ITEM_SCHEMA.properties,
      criterion: { type: "string", enum: keys.slice(), description: "Which criterion this evidences." },
    },
  };
  const properties = {
    criteria: {
      type: "array",
      items: {
        type: "object",
        properties: {
          key: { type: "string", enum: keys.slice() },
          score: { type: "number", description: `Score for this criterion: 0 to ${CRITERION_MAX} in steps of ${CRITERION_STEP}.` },
          comment: { type: "string", description: "2–3 sentences in Vietnamese tied to concrete evidence." },
        },
        required: ["key", "score", "comment"],
      },
      description: `Exactly one entry for EACH of: ${keys.join(", ")}.`,
    },
    overallFeedback: { type: "string", description: "2–4 sentences of overall feedback to the student, in simple Vietnamese." },
    annotations: { type: "array", items: annotationItem },
    priorities: speaking ? SPEAKING_PRIORITIES_SCHEMA : PRIORITIES_SCHEMA,
    topicVocabulary: GENERAL_VOCAB_SCHEMA,
    improvedSample: {
      type: "string",
      description: speaking
        ? "A realistic improved version of what the student said (same ideas, same voice), at the level expected for the grade."
        : "A realistically improved rewrite of the student's own answer (same ideas), at the level expected for the grade — not a perfect model answer.",
    },
  };
  const required = ["criteria", "overallFeedback", "annotations", "priorities", "topicVocabulary", "improvedSample"];
  if (speaking) {
    properties.transcript = { type: "string", description: "Full transcription of what the student said, verbatim. Empty if nothing intelligible." };
    properties.notes = {
      type: "array",
      items: {
        type: "object",
        properties: {
          atSeconds: { type: "number", description: "Approx timestamp in the recording this note refers to." },
          category: { type: "string", enum: CATEGORIES },
          criterion: { type: "string", enum: keys.slice() },
          comment: { type: "string" },
        },
        required: ["atSeconds", "category", "criterion", "comment"],
      },
    };
    properties.mainIssue = { type: "string", description: "One sentence, in Vietnamese: the single most useful thing for this student to fix in this answer." };
    required.push("transcript", "notes", "mainIssue");
  }
  return { type: "object", properties, required };
}

const GENERAL_LANGUAGE_SPEC = `LANGUAGE:
- criteria[].comment, overallFeedback, annotations[].comment, notes[].comment, priorities[], mainIssue and topicVocabulary[].meaning: simple VIETNAMESE a Vietnamese teenager understands. Short sentences, no linguistic jargon. Address the student as "em" and the teacher voice as "chị". Never "bạn".
- When correcting, quote the English words and show the correct form.
- Never write a score as a number inside any comment — numbers live only in criteria[].score.
- quote, insertText, topicVocabulary[].example, transcript and improvedSample stay in English. Never translate the student's answer.`;

// Phần "Return JSON with" của prompt hệ thống General. Quote + occurrence, tối đa MAX_ANNOTATIONS — như TOEIC.
function generalFieldSpec(variant, kind) {
  const keys = criterionKeys(variant);
  const speaking = kind === "speaking";
  const where = speaking ? "transcript" : "student's answer";
  const lines = [
    "Return JSON with:",
    `- criteria[]: EXACTLY one entry for each of ${generalCriterionLabels(variant)} (no missing, no duplicate). Each has score (0 to ${CRITERION_MAX} in steps of ${CRITERION_STEP}) judged against the descriptors above and the student's grade, and a 2–3 sentence comment tied to concrete evidence. Do NOT add up a total: the server does that.`,
    "- overallFeedback: 2–4 sentences to the student: what works, the main thing to fix, how to practise.",
    `- annotations[]: the high-value corrections and comments only (up to ${MAX_ANNOTATIONS}, no minimum — never pad). Quote the text EXACTLY as it appears in the ${where} and set occurrence (1-based). Use action "replace" for wrong wording/grammar (give insertText), "delete" for redundant text, "insert" to add a missing word, "comment" to flag an issue without rewriting. Each carries category + criterion (one of: ${keys.join(", ")}) + a short comment; severity minor / noticeable / major. Corrections must NOT overlap — use a single "replace" for a span that needs several fixes. Only annotate actual errors, never acceptable-but-basic English. Every correction must keep the student's intended meaning.`,
    "- priorities: short, concrete action items for next time, ordered by impact (at most 3).",
    "- topicVocabulary: 0–5 entries (meaning in Vietnamese, one English example) only if genuinely useful at the student's grade; an empty list is fine.",
  ];
  if (speaking) {
    lines.splice(1, 0, "- transcript: what the student said, verbatim (English). If nothing intelligible was said, return an empty string and give every criterion 0.");
    lines.push(
      "- notes[]: ONLY delivery issues that cannot be anchored to transcript text (pronunciation, stress/intonation, fluency/pauses), each with an approximate atSeconds, a category, one criterion key and a comment. 2–4 per criterion at most; do not duplicate an annotations[] item.",
      "- mainIssue: one sentence — the single most useful thing for this student to fix in this answer.",
      "- improvedSample: a realistic improved version of what the student said (short natural spoken sentences, same ideas), at the level expected for the grade."
    );
  } else {
    lines.push("- improvedSample: a realistic rewrite of the student's OWN answer — keep their ideas and voice, fix the language, at the level expected for the grade. Never invent facts they did not write.");
  }
  lines.push(GENERAL_LANGUAGE_SPEC);
  return lines.join("\n");
}

// null nếu hợp lệ; chuỗi lỗi nếu không. Mỗi tiêu chí của variant phải có ĐÚNG MỘT lần, điểm là số trong 0–2.5.
function validateGeneralGrade(payload, variant, kind) {
  const keys = criterionKeys(variant);
  if (!isGeneralVariant(variant)) return "unknown General rubric " + variant;
  if (!payload || typeof payload !== "object") return "empty AI response";
  if (!Array.isArray(payload.criteria) || !payload.criteria.length) return "criteria missing";
  const seen = new Set();
  for (const c of payload.criteria) {
    if (!c || typeof c !== "object") return "malformed criterion entry";
    if (!keys.includes(c.key)) return `unknown criterion ${c.key}`;
    if (seen.has(c.key)) return `duplicate criterion ${c.key}`;
    seen.add(c.key);
    // Số thật trong khoảng — điểm ngoài thang (vd AI dùng nhầm thang khác) là LỖI, không âm thầm kẹp.
    if (typeof c.score !== "number" || !Number.isFinite(c.score) || c.score < 0 || c.score > CRITERION_MAX) return `bad score for ${c.key}`;
    if (typeof c.comment !== "string" || !c.comment.trim()) return `missing comment for ${c.key}`;
  }
  // Thiếu 1 tiêu chí mà vẫn cộng = điểm tổng sai.
  for (const k of keys) if (!seen.has(k)) return `missing criterion ${k}`;
  if (typeof payload.overallFeedback !== "string" || !payload.overallFeedback.trim()) return "missing overallFeedback";
  if (!Array.isArray(payload.annotations)) return "annotations missing";
  for (const a of payload.annotations) {
    if (!a || typeof a !== "object") return "malformed annotation";
    if (!["delete", "replace", "insert", "comment"].includes(a.action)) return `bad action ${a.action}`;
    if (a.severity && !SEVERITIES.includes(a.severity)) return `bad severity ${a.severity}`;
    if (!keys.includes(a.criterion)) return `bad annotation criterion ${a.criterion}`;
  }
  if (kind === "speaking") {
    if (typeof payload.transcript !== "string") return "transcript missing";
    if (payload.notes != null) {
      if (!Array.isArray(payload.notes)) return "notes malformed";
      for (const n of payload.notes) {
        if (!n || typeof n !== "object") return "malformed note";
        if (n.criterion != null && !keys.includes(n.criterion)) return `bad note criterion ${n.criterion}`;
      }
    }
  }
  return null;
}

function normaliseGeneralCommon(payload, variant) {
  const keys = criterionKeys(variant);
  const criteria = keys.map((k) => {
    const found = (payload.criteria || []).find((c) => c && c.key === k);
    return { key: k, band: found ? snapGeneralScore(found.score) : null, comment: found ? String(found.comment || "").trim() : "" };
  });
  return {
    criteria,
    overallFeedback: String(payload.overallFeedback || "").trim(),
    // Server tự cộng — KHÔNG đọc tổng do model đưa. Thiếu tiêu chí -> null.
    suggestedOverall: overallScore(variant, criteria),
    ...normaliseSuggestedActions(payload),
  };
}

// criterion của annotation chỉ giữ nếu thuộc tiêu chí của variant này.
const onlyKeys = (list, keys) => list.map((a) => ({ ...a, criterion: keys.includes(a.criterion) ? a.criterion : null }));

// Writing: cùng shape với normaliseToeicGrade (persistDraft + RubricGrader.applyDraft đọc được).
function normaliseGeneralGrade(payload, essayText, variant) {
  const keys = criterionKeys(variant);
  const resolved = resolveAnnotationsFromQuotes(payload.annotations, essayText);
  const annotations = reconcileAnnotations(essayText, capAnnotations(onlyKeys(resolved.annotations, keys))).annotations;
  return { annotations, unresolved: resolved.unresolved, ...normaliseGeneralCommon(payload, variant) };
}

// Speaking: cùng shape với normaliseToeicSpeaking.
function normaliseGeneralSpeaking(payload, variant) {
  const keys = criterionKeys(variant);
  const transcript = String(payload.transcript || "");
  const resolved = resolveAnnotationsFromQuotes(payload.annotations, transcript);
  const annotations = reconcileAnnotations(transcript, capAnnotations(onlyKeys(resolved.annotations, keys))).annotations;
  const speakingNotes = (payload.notes || []).map((n) => ({
    atSeconds: Number.isFinite(Number(n.atSeconds)) ? Math.max(0, Number(n.atSeconds)) : null,
    category: CATEGORIES.includes(n.category) ? n.category : "other",
    criterion: keys.includes(n.criterion) ? n.criterion : null,
    comment: String(n.comment || ""),
    source: "ai",
  }));
  return {
    transcript,
    annotations,
    speakingNotes,
    mainIssue: String(payload.mainIssue || "").trim(),
    unresolved: resolved.unresolved,
    ...normaliseGeneralCommon(payload, variant),
  };
}

module.exports = {
  generalGradeSchema,
  generalFieldSpec,
  validateGeneralGrade,
  normaliseGeneralGrade,
  normaliseGeneralSpeaking,
  toeicGradeSchema,
  toeicFieldSpec,
  validateToeicGrade,
  normaliseToeicGrade,
  normaliseToeicSpeaking,
  AI_GRADE_JSON_SCHEMA,
  AI_GRADE_FIELD_SPEC,
  AI_GRADE_SPEAKING_SCHEMA,
  AI_GRADE_SPEAKING_FIELD_SPEC,
  validateAiGrade,
  normaliseAiGrade,
  normaliseAiSpeaking,
};
