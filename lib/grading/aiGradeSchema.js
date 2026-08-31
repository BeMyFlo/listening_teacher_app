// Hợp đồng dữ liệu để AI (Gemini) chấm 1 bài Writing — 1 nguồn sự thật duy
// nhất, khớp với annotation model của giáo viên (lib/grading/annotate.js).
//
// AI trả annotation theo QUOTE + occurrence (không phải offset ký tự) vì LLM
// đếm ký tự không chính xác. Server đổi sang offset bằng resolveQuote.

const { resolveQuote, CATEGORIES, CRITERIA, SEVERITIES } = require("./annotate");
const { getRubric, overallBand } = require("./rubric");

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
    criterion: { type: "string", enum: CRITERIA, description: "Which IELTS criterion this evidences." },
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
          key: { type: "string", enum: CRITERIA },
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
- annotations[]: every correction and comment. Use action "replace" for wrong wording/grammar (give insertText), "delete" for redundant text, "insert" to add a missing word (quote = the word it goes after, insertText = " missingword"), "comment" to flag an issue without rewriting. Each carries category + the IELTS criterion it evidences + a short comment.
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

LANGUAGE:
- criteria[].comment: write in ENGLISH (examiner-style band justification).
- annotations[].comment, overallFeedback, priorities[] and topicVocabulary[].meaning: write in VIETNAMESE. Address the student as "em" and refer to the teacher/examiner voice as "chị". Do NOT use "bạn".
- Keep "insertText" (corrected English wording), "quote", topicVocabulary[].example and improvedSample in English — never translate the student's essay.`;

function validateAiGrade(payload, variant) {
  if (!payload || typeof payload !== "object") return "empty AI response";
  if (!Array.isArray(payload.annotations)) return "annotations missing";
  if (!Array.isArray(payload.criteria) || !payload.criteria.length) return "criteria missing";
  const rubric = getRubric(variant);
  const wantKeys = rubric ? rubric.criteria.map((c) => c.key) : CRITERIA;
  for (const c of payload.criteria) {
    if (!wantKeys.includes(c.key)) return `unknown criterion ${c.key}`;
    const b = Number(c.band);
    if (!Number.isFinite(b) || b < 1 || b > 9) return `bad band for ${c.key}`;
  }
  for (const a of payload.annotations) {
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
  for (const a of rawAnnotations || []) {
    let start = 0;
    let end = 0;
    if (a.action === "insert" && !a.quote) {
      start = end = 0;
    } else {
      const r = resolveQuote(text, a.quote || "", Math.max(1, Number(a.occurrence) || 1));
      if (!r) {
        unresolved++;
        continue;
      }
      start = a.action === "insert" ? r.end : r.start;
      end = a.action === "insert" ? r.end : r.end;
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
function normaliseAiGrade(payload, essayText, variant) {
  const { annotations, unresolved } = resolveAnnotationsFromQuotes(payload.annotations, essayText);

  const rubric = getRubric(variant);
  const wantKeys = rubric ? rubric.criteria.map((c) => c.key) : CRITERIA;
  const criteria = wantKeys.map((k) => {
    const found = (payload.criteria || []).find((c) => c.key === k);
    return { key: k, band: found ? Math.round(Number(found.band)) : null, comment: found ? String(found.comment || "") : "" };
  });
  const suggestedOverall = overallBand(criteria.filter((c) => c.band != null));

  return {
    annotations,
    criteria,
    overallFeedback: String(payload.overallFeedback || ""),
    suggestedOverall,
    unresolved,
    ...normaliseSuggestedActions(payload),
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
          criterion: { type: "string", enum: CRITERIA },
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
          key: { type: "string", enum: CRITERIA },
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
  const { annotations, unresolved } = resolveAnnotationsFromQuotes(payload.annotations, transcript);
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

module.exports = {
  AI_GRADE_JSON_SCHEMA,
  AI_GRADE_FIELD_SPEC,
  AI_GRADE_SPEAKING_SCHEMA,
  AI_GRADE_SPEAKING_FIELD_SPEC,
  validateAiGrade,
  normaliseAiGrade,
  normaliseAiSpeaking,
};
