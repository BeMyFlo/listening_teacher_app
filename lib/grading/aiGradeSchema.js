// Hợp đồng dữ liệu để AI (Gemini) chấm 1 bài Writing — 1 nguồn sự thật duy
// nhất, khớp với annotation model của giáo viên (lib/grading/annotate.js).
//
// AI trả annotation theo QUOTE + occurrence (không phải offset ký tự) vì LLM
// đếm ký tự không chính xác. Server đổi sang offset bằng resolveQuote.

const { resolveQuote, CATEGORIES, CRITERIA } = require("./annotate");
const { getRubric, overallBand } = require("./rubric");

// responseSchema cho Gemini (tập con OpenAPI).
const AI_GRADE_JSON_SCHEMA = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          quote: { type: "string", description: "Exact substring of the student's essay this refers to. Empty only for a pure insertion." },
          occurrence: { type: "integer", description: "1-based: which occurrence of `quote` in the essay (1 if it appears once)." },
          action: { type: "string", enum: ["delete", "replace", "insert", "comment"] },
          insertText: { type: "string", description: "For replace/insert: the corrected text. For insert, this is added right after `quote` (or at start if quote empty)." },
          category: { type: "string", enum: CATEGORIES },
          criterion: { type: "string", enum: CRITERIA, description: "Which IELTS criterion this evidences." },
          comment: { type: "string", description: "Short explanation for the teacher/student." },
          severity: { type: "string", enum: ["minor", "major"] },
        },
        required: ["quote", "occurrence", "action", "category", "criterion", "comment"],
      },
    },
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
  },
  required: ["annotations", "criteria", "overallFeedback"],
};

const AI_GRADE_FIELD_SPEC = `Return JSON with:
- annotations[]: every correction and comment. Use action "replace" for wrong wording/grammar (give insertText), "delete" for redundant text, "insert" to add a missing word (quote = the word it goes after, insertText = " missingword"), "comment" to flag an issue without rewriting. Each carries category + the IELTS criterion it evidences + a short comment.
- criteria[]: one entry per criterion for this rubric, band 1–9 (whole numbers), with a justification.
- overallFeedback: 2–4 sentences to the student.
Quote text EXACTLY as it appears in the essay (respect original spelling/casing) and set occurrence.

LANGUAGE:
- criteria[].comment: write in ENGLISH (examiner-style band justification).
- annotations[].comment and overallFeedback: write in VIETNAMESE. Address the student as "em" and refer to the teacher/examiner voice as "chị". Do NOT use "bạn".
- Keep "insertText" (corrected English wording) and "quote" in English — never translate the student's essay.`;

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
  }
  return null;
}

// -> { annotations (offset), criteria, overallFeedback, suggestedOverall, unresolved }
function normaliseAiGrade(payload, essayText, variant) {
  const annotations = [];
  let unresolved = 0;
  for (const a of payload.annotations || []) {
    let start = 0;
    let end = 0;
    if (a.action === "insert" && !a.quote) {
      start = end = 0;
    } else {
      const r = resolveQuote(essayText, a.quote || "", Math.max(1, Number(a.occurrence) || 1));
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
      severity: a.severity === "minor" || a.severity === "major" ? a.severity : null,
      source: "ai",
    });
  }

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
  };
}

// ---------------- Speaking ----------------
// Không có bài viết để neo -> ghi chú theo mốc giây (atSeconds).

const AI_GRADE_SPEAKING_SCHEMA = {
  type: "object",
  properties: {
    transcript: { type: "string", description: "Full transcription of what the student said, verbatim." },
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
    overallFeedback: { type: "string" },
    suggestedOverall: { type: "number" },
  },
  required: ["transcript", "notes", "criteria", "overallFeedback"],
};

const AI_GRADE_SPEAKING_FIELD_SPEC = `Listen to the recording and return JSON with:
- transcript: what the student said, verbatim (English).
- notes[]: specific observations (fluency, hesitation, pronunciation, word choice, grammar…), each with an approximate atSeconds, a category, the IELTS Speaking criterion it evidences, and a comment.
- criteria[]: one entry per Speaking criterion (FC, LR, GRA, PR), band 1–9 (whole numbers), with a justification.
- overallFeedback: 2–4 sentences to the student.
LANGUAGE:
- criteria[].comment: ENGLISH (examiner-style).
- notes[].comment and overallFeedback: VIETNAMESE. Address the student as "em", the teacher voice as "chị". Never "bạn".
- transcript stays in English (the student spoke English).`;

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
  return {
    transcript: String(payload.transcript || ""),
    speakingNotes: notes,
    criteria,
    overallFeedback: String(payload.overallFeedback || ""),
    suggestedOverall: overallBand(criteria.filter((c) => c.band != null)),
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
