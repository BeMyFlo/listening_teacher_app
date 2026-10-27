// Bộ chuyển đổi câu hỏi General sang section shape server (Phase 12 G3, mục 2.2).
// Dùng chung cho cả luồng AI soạn bài (lib/ai/generalExercise.js) và luồng Import Word (lib/wordImport.js).

const {
  GENERAL_LABELS,
  underlineModeOf,
  splitTokens,
  shuffleTokens,
  arrangeOptions,
  generalQuestionError,
} = require("../generalFormats");
const { underlinedParts } = require("../underline");
const { normalizeSections } = require("../testSections");

const S = (v) => String(v == null ? "" : v).trim();
const sameText = (a, b) => S(a).toLowerCase() === S(b).toLowerCase();

// Chuẩn hoá gạch chân theo format:
// - uMode === target: đổi <u>...</u> thành __...__
// - khác: bóc bỏ thẻ <u> và </u>, giữ chữ bên trong.
function formatUnderline(text, targetMode, uMode) {
  if (!text) return "";
  if (uMode === targetMode) {
    return String(text).replace(/<u>(.*?)<\/u>/gi, "__$1__");
  }
  return String(text).replace(/<\/?u>/gi, "");
}

// Tìm vị trí lựa chọn khớp với đáp án (hỗ trợ cả chữ cái A-D, text có gạch chân hoặc text trần)
function matchOptionAnswer(opts, answer) {
  if (!Array.isArray(opts) || !opts.length) return -1;
  const cleanAns = S(answer).replace(/<\/?u>/gi, "").replace(/__/g, "");
  // 1. So khớp trực tiếp với label của lựa chọn
  let idx = opts.findIndex((o) => sameText(o, answer));
  if (idx >= 0) return idx;
  // 2. So khớp sau khi bỏ gạch chân
  idx = opts.findIndex((o) => sameText(o.replace(/__/g, "").replace(/<\/?u>/gi, ""), cleanAns));
  if (idx >= 0) return idx;
  // 3. Khớp chữ cái A–D
  if (/^[A-D]$/i.test(S(answer))) {
    const letterIdx = S(answer).toUpperCase().charCodeAt(0) - 65;
    if (letterIdx >= 0 && letterIdx < opts.length) return letterIdx;
  }
  return -1;
}

// Chuyển 1 nhóm câu hỏi trung gian (GQ) thành 1 section hoàn chỉnh.
// Trả về { section, flags, warnings, removed }.
function toGeneralSection(
  { format, name, passage, questions },
  { subject, startId = 1, strict = true, si } = {}
) {
  const rawKey = String(format || "").replace(/^g-/, "");
  const formatLabel = GENERAL_LABELS[rawKey] || "";
  const uMode = underlineModeOf(formatLabel);

  const section = {
    name: String(name || "").trim(),
    passageText: subject === "reading" ? String(passage || "") : "",
    fields: [],
  };

  const flags = [];
  const warnings = [];
  const removed = [];

  const rawQuestions = Array.isArray(questions) ? questions : [];
  let currentId = Number(startId) || 1;

  for (let qIdx = 0; qIdx < rawQuestions.length; qIdx++) {
    const q = rawQuestions[qIdx];
    if (!q) continue;

    const qNum = q.number != null ? q.number : qIdx + 1;
    let field = null;
    let fieldFlag = q.flag || "";
    let dropReason = null;

    const baseField = {
      id: currentId,
      formatLabel,
      explanation: S(q.explanation),
      score: 1,
      selectCount: 1,
      options: [],
      answers: [],
      pre: "",
      post: "",
      hint: "",
    };

    // 1. Phân loại theo format
    if (
      format === "g-mcq" ||
      format === "g-comm" ||
      format === "g-closest" ||
      format === "g-stress" ||
      format === "g-cloze"
    ) {
      let label = formatUnderline(q.text || "", "label", uMode).replace(/_{4,}/g, "___");
      const opts = (Array.isArray(q.options) ? q.options : []).map((o) =>
        formatUnderline(o, "options", uMode).trim()
      );
      const options = opts.map((opt, i) => ({
        value: `ai${currentId}_${i + 1}`,
        label: opt,
      }));

      // Tìm vị trí đáp án đúng
      const matchIdx = matchOptionAnswer(opts, q.answer);

      if (opts.length < 2) {
        dropReason = `Choice question has ${opts.length} option(s), expected at least 2.`;
      } else if (matchIdx < 0) {
        dropReason = `Answer "${q.answer}" does not match any option.`;
      }

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
      };
    } else if (format === "g-tf") {
      let label = formatUnderline(q.text || "", "label", uMode).replace(/_{4,}/g, "___");
      const options = [
        { value: `ai${currentId}_1`, label: "True" },
        { value: `ai${currentId}_2`, label: "False" },
      ];
      let val = null;
      if (sameText(q.answer, "true") || sameText(q.answer, "t")) val = `ai${currentId}_1`;
      else if (sameText(q.answer, "false") || sameText(q.answer, "f")) val = `ai${currentId}_2`;
      else dropReason = `Invalid True/False answer: "${q.answer}".`;

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: val ? [val] : [],
      };
    } else if (format === "g-tfng") {
      let label = formatUnderline(q.text || "", "label", uMode).replace(/_{4,}/g, "___");
      const options = [
        { value: "true", label: "True" },
        { value: "false", label: "False" },
        { value: "ng", label: "Not Given" },
      ];
      let val = null;
      if (sameText(q.answer, "true") || sameText(q.answer, "t")) val = "true";
      else if (sameText(q.answer, "false") || sameText(q.answer, "f")) val = "false";
      else if (sameText(q.answer, "ng") || sameText(q.answer, "not given")) val = "ng";
      else dropReason = `Invalid True/False/Not Given answer: "${q.answer}".`;

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: val ? [val] : [],
      };
    } else if (format === "g-insert") {
      let label = formatUnderline(q.text || "", "label", uMode).replace(/_{4,}/g, "___");
      const preset = ["[I]", "[II]", "[III]", "[IV]"];
      const options = preset.map((p, i) => ({ value: `ai${currentId}_${i + 1}`, label: p }));
      let matchIdx = preset.findIndex(
        (p) => sameText(p, q.answer) || sameText(p.replace(/[[\]]/g, ""), S(q.answer).replace(/[[\]]/g, ""))
      );
      if (matchIdx < 0 && /^[1-4]$/.test(S(q.answer))) matchIdx = Number(q.answer) - 1;
      if (matchIdx < 0) dropReason = `Invalid sentence insertion key: "${q.answer}".`;

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
      };
    } else if (format === "g-pron") {
      let label = q.text ? formatUnderline(q.text, "label", uMode) : "";
      const opts = (Array.isArray(q.options) ? q.options : []).map((o) =>
        formatUnderline(o, "options", uMode).trim()
      );
      const options = opts.map((opt, i) => ({
        value: `ai${currentId}_${i + 1}`,
        label: opt,
      }));

      // Match answer
      const matchIdx = matchOptionAnswer(opts, q.answer);

      if (opts.length < 2) {
        dropReason = `Pronunciation question requires options, found ${opts.length}.`;
      } else if (matchIdx < 0) {
        dropReason = `Answer "${q.answer}" does not match any pronunciation option.`;
      }

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
      };
    } else if (format === "g-error") {
      let label = formatUnderline(q.text || "", "label", uMode);
      const parts = underlinedParts(label);
      let letters = ["A", "B", "C", "D"].slice(0, Math.max(2, Math.min(parts.length, 4)));

      if (parts.length < 2 || parts.length > 4) {
        dropReason = `Error identification requires 2 to 4 underlined parts, found ${parts.length}.`;
      }

      const options = letters.map((l, i) => ({
        value: `ai${currentId}_${i + 1}`,
        label: l,
      }));

      let matchIdx = -1;
      const ansUpper = S(q.answer).toUpperCase();
      if (/^[A-D]$/.test(ansUpper)) {
        matchIdx = letters.indexOf(ansUpper);
      } else {
        // Có thể gửi nguyên văn từ sai trong gạch chân
        matchIdx = parts.findIndex((p) => sameText(p, q.answer));
      }

      if (matchIdx < 0 && !dropReason) {
        dropReason = `Error identification answer "${q.answer}" does not match any underlined part.`;
      }

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
      };
    } else if (format === "g-syn") {
      let label = formatUnderline(q.text || "", "label", uMode);
      const parts = underlinedParts(label);
      if (parts.length !== 1) {
        dropReason = `Synonym / Antonym question requires exactly 1 underlined part, found ${parts.length}.`;
      }

      const opts = (Array.isArray(q.options) ? q.options : []).map((o) =>
        formatUnderline(o, "options", uMode).trim()
      );
      const options = opts.map((opt, i) => ({
        value: `ai${currentId}_${i + 1}`,
        label: opt,
      }));

      const matchIdx = matchOptionAnswer(opts, q.answer);
      if (opts.length < 2) {
        dropReason = `Synonym / Antonym question requires at least 2 options.`;
      } else if (matchIdx < 0 && !dropReason) {
        dropReason = `Answer "${q.answer}" does not match any option.`;
      }

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
      };
    } else if (format === "g-arrange") {
      let label = formatUnderline(q.text || "", "label", uMode);
      let opts = [];
      let matchIdx = -1;

      if (Array.isArray(q.options) && q.options.length === 4) {
        opts = q.options.map((o) => S(o));
        matchIdx = opts.findIndex((o) => sameText(o, q.answer));
      } else if (q.answer) {
        const generated = arrangeOptions(q.answer);
        opts = generated.options;
        matchIdx = generated.correctIndex;
      }

      if (opts.length !== 4 || matchIdx < 0) {
        dropReason = `Arrange sentences question could not build 4 options for "${q.answer}".`;
      }

      const options = opts.map((opt, i) => ({
        value: `ai${currentId}_${i + 1}`,
        label: opt,
      }));

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
      };
    } else if (
      format === "g-verb" ||
      format === "g-wform" ||
      format === "g-gap" ||
      format === "g-rq" ||
      format === "g-phrase" ||
      format === "g-combine" ||
      format === "g-ocloze"
    ) {
      const label = formatUnderline(q.before || q.text || "", "label", uMode);
      const post = formatUnderline(q.after || "", "label", uMode);
      const hint = S(q.hint);
      const allAnswers = [...new Set([q.answer, ...(Array.isArray(q.altAnswers) ? q.altAnswers : [])])]
        .map((a) => S(a))
        .filter(Boolean);

      if (!allAnswers.length) {
        dropReason = `Fill-in-the-blank question has no answers.`;
      }

      field = {
        ...baseField,
        type: "fill",
        matchMode: "sentence",
        label,
        post,
        hint,
        answers: allAnswers.slice(0, 6),
      };
    } else if (format === "g-rewrite") {
      const label = formatUnderline(q.text || q.before || "", "label", uMode);
      const post = formatUnderline(q.after || "", "label", uMode);
      const pre = S(q.start);
      const hint = S(q.hint);
      const allAnswers = [...new Set([q.answer, ...(Array.isArray(q.altAnswers) ? q.altAnswers : [])])]
        .map((a) => S(a))
        .filter(Boolean);

      if (!allAnswers.length) {
        dropReason = `Sentence rewrite question has no answers.`;
      }

      field = {
        ...baseField,
        type: "fill",
        matchMode: "sentence",
        pre,
        label,
        post,
        hint,
        answers: allAnswers.slice(0, 6),
      };
    } else if (format === "g-reorder") {
      const pieces =
        Array.isArray(q.pieces) && q.pieces.length
          ? q.pieces.map((p) => S(p)).filter(Boolean)
          : splitTokens(q.text);
      const tokens = shuffleTokens(pieces);
      const allAnswers = [...new Set([q.answer, ...(Array.isArray(q.altAnswers) ? q.altAnswers : [])])]
        .map((a) => S(a).replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean);

      if (tokens.length < 2) {
        dropReason = `Sentence building (reorder) requires at least 2 pieces, found ${tokens.length}.`;
      } else if (!allAnswers.length) {
        dropReason = `Sentence building (reorder) question has no answers.`;
      }

      field = {
        ...baseField,
        type: "fill",
        matchMode: "sentence",
        label: "",
        tokens,
        answers: allAnswers,
      };
    } else if (format === "g-sign") {
      let label = formatUnderline(q.text || "", "label", uMode);
      const opts = (Array.isArray(q.options) ? q.options : []).map((o) =>
        formatUnderline(o, "options", uMode).trim()
      );
      const options = opts.map((opt, i) => ({
        value: `ai${currentId}_${i + 1}`,
        label: opt,
      }));
      const matchIdx = matchOptionAnswer(opts, q.answer);
      if (opts.length < 2 || matchIdx < 0) {
        dropReason = `Sign question requires at least 2 options and a matching answer.`;
      }

      field = {
        ...baseField,
        type: "choice",
        label,
        options,
        answers: matchIdx >= 0 ? [`ai${currentId}_${matchIdx + 1}`] : [],
        imageId: q.imageId || "",
      };
    } else {
      // Fallback cho format không xác định
      dropReason = `Unsupported question format: ${format}`;
    }

    // 2. Kiểm tra lỗi qua generalQuestionError
    if (field && !dropReason) {
      const err = generalQuestionError(field);
      if (err) dropReason = err;
    }

    // 3. Xử lý câu lỗi theo chế độ strict
    if (dropReason) {
      if (strict) {
        removed.push({
          number: qNum,
          text: q.text || q.before || "",
          reason: dropReason,
        });
        continue; // Bỏ câu, không tăng currentId
      } else {
        // Luồng Word: giữ câu và tô vàng cờ cảnh báo
        if (!fieldFlag) fieldFlag = dropReason;
        warnings.push(`Question ${qNum}: ${dropReason}`);
      }
    }

    if (field) {
      const fi = section.fields.length;
      section.fields.push(field);
      currentId += 1;

      if (fieldFlag) {
        flags.push({
          ...(si != null ? { si } : {}),
          fi,
          reason: fieldFlag,
        });
      }
    }
  }

  // Chạy normalizeSections để bảo đảm tính đúng đắn và trật tự tokens không lộ đáp án
  const normalized = normalizeSections([section])[0];
  section.fields = normalized ? normalized.fields : section.fields;

  return { section, flags, warnings, removed };
}

module.exports = {
  toGeneralSection,
  formatUnderline,
};
