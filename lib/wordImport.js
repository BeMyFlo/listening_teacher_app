// Module tách đề và chuyển đổi câu hỏi Word sang Section General (Phase 12 G3, mục 4.3).
// CommonJS thuần, an toàn, không gọi trực tiếp DB hay Gemini.

const { GENERAL_LABELS, underlineModeOf } = require("./generalFormats");
const { toGeneralSection } = require("./ai/generalSections");

const S = (v) => String(v == null ? "" : v).trim();
const sameText = (a, b) => S(a).toLowerCase() === S(b).toLowerCase();

// Dòng tiêu đề khối đáp án: ngắn (<= 40 ký tự), đứng riêng một dòng
// vd "ĐÁP ÁN", "Answer key:", "--- ĐÁP ÁN ---", "ĐÁP ÁN ĐỀ 1", "KEY (Đề A)".
// Không khớp "Answer the questions…", "Answer:", "Key words".
const KEY_HEAD_RE = /^(?:ĐÁP ÁN|DAP AN|ANSWER KEYS?|ANSWERS|KEYS?)\s*:?(?:\s*[-–:]?\s*(?:\(\s*[^)]{1,12}\)|(?:ĐỀ|DE|TEST)\s*[\w.]{1,4}|CHI TI[ẾE]T))?\s*:?$/iu;
function isKeyHeading(line) {
  const t = String(line || "").trim();
  if (!t || t.length > 40) return false;
  const core = t.replace(/^[\s\-–—*_=#~]+|[\s\-–—*_=#~]+$/g, "");
  return KEY_HEAD_RE.test(core);
}

// Tiêu đề phần: PART/SECTION/PHẦN, số La Mã I-IV, hoặc A-E kèm chữ IN HOA (vd "A. PHONETICS")
function isHeadingLine(line) {
  if (!line || !line.trim()) return false;
  if (/^\s*(?:(?:PART|SECTION|PHẦN)\s+[\dIVX]+|[IVX]{1,4}\s*[.)\-]\s+)/i.test(line)) return true;
  if (/^\s*[A-E]\s*[.)]\s+[\p{Lu}\p{M}]{3,}/u.test(line)) return true;
  return false;
}

// Regex phát hiện câu hỏi
const QUESTION_RE = /^\s*(?:(?:Question|Câu)\s*\d+|\d{1,2}\s*[.)]\s)/i;

const CHUNK_LIMIT = 8000;
const MAX_CHUNKS = 6;
const TOO_LONG_MSG = "This file is too long — split it into smaller files (about 40 questions each)";

// Cắt một phần đề quá dài (> 8000 ký tự) theo câu, lặp lại hướng dẫn + đoạn văn
function splitLongPart(partText) {
  const lines = partText.split("\n");
  let firstQIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (QUESTION_RE.test(lines[i])) {
      firstQIdx = i;
      break;
    }
  }

  // Nếu không thấy câu hỏi, cắt theo dòng
  if (firstQIdx === -1) {
    const res = [];
    let cur = "";
    for (const l of lines) {
      if (cur && (cur.length + 1 + l.length) > CHUNK_LIMIT) {
        res.push(cur.trim());
        cur = l;
      } else {
        cur = cur ? cur + "\n" + l : l;
      }
    }
    if (cur.trim()) res.push(cur.trim());
    return res;
  }

  const prefix = lines.slice(0, firstQIdx).join("\n").trim();
  const qGroups = [];
  let curQ = [];

  for (let i = firstQIdx; i < lines.length; i++) {
    const l = lines[i];
    if (QUESTION_RE.test(l) && curQ.length > 0) {
      qGroups.push(curQ.join("\n").trim());
      curQ = [l];
    } else {
      curQ.push(l);
    }
  }
  if (curQ.length > 0) {
    qGroups.push(curQ.join("\n").trim());
  }

  const subChunks = [];
  let currentGroupText = "";

  for (const qText of qGroups) {
    const candidate = currentGroupText
      ? currentGroupText + "\n\n" + qText
      : (prefix ? prefix + "\n\n" + qText : qText);

    if (candidate.length > CHUNK_LIMIT && currentGroupText) {
      subChunks.push(currentGroupText.trim());
      currentGroupText = prefix ? prefix + "\n\n" + qText : qText;
    } else {
      currentGroupText = candidate;
    }
  }
  if (currentGroupText.trim()) {
    subChunks.push(currentGroupText.trim());
  }

  return subChunks;
}

// Chia text tài liệu Word thành các khúc phù hợp để gửi Gemini
function splitForAi(text) {
  const full = String(text || "").trim();
  if (!full) {
    return { chunks: [], keyText: "" };
  }

  // 1. Tách khối đáp án ở 40% cuối
  let keyText = "";
  let bodyText = full;
  const threshold = Math.floor(full.length * 0.6);

  // Tìm vị trí đáp án bằng cách duyệt từng dòng
  const lines = full.split("\n");
  let charCount = 0;
  let keyLineIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (charCount >= threshold && isKeyHeading(line)) {
      keyLineIdx = i;
      break;
    }
    charCount += line.length + 1; // tính cả ký tự newline
  }

  if (keyLineIdx >= 0) {
    keyText = lines.slice(keyLineIdx).join("\n").slice(0, 6000).trim();
    bodyText = lines.slice(0, keyLineIdx).join("\n").trim();
  }

  // 2. Tách phần đề theo tiêu đề phần
  const bodyLines = bodyText.split("\n");
  const parts = [];
  let curPartLines = [];

  for (const l of bodyLines) {
    if (isHeadingLine(l) && curPartLines.length > 0) {
      parts.push(curPartLines.join("\n").trim());
      curPartLines = [l];
    } else {
      curPartLines.push(l);
    }
  }
  if (curPartLines.length > 0) {
    parts.push(curPartLines.join("\n").trim());
  }

  // 3. Gom các phần liền nhau thành khúc <= CHUNK_LIMIT (8000 ký tự)
  const chunks = [];
  let currentChunk = "";

  for (const part of parts) {
    if (part.length > CHUNK_LIMIT) {
      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
        currentChunk = "";
      }
      const subChunks = splitLongPart(part);
      for (const sc of subChunks) {
        if (sc.length > CHUNK_LIMIT) {
          chunks.push(sc);
        } else if (currentChunk && (currentChunk.length + 2 + sc.length) > CHUNK_LIMIT) {
          chunks.push(currentChunk.trim());
          currentChunk = sc;
        } else {
          currentChunk = currentChunk ? currentChunk + "\n\n" + sc : sc;
        }
      }
    } else {
      if (currentChunk && (currentChunk.length + 2 + part.length) > CHUNK_LIMIT) {
        chunks.push(currentChunk.trim());
        currentChunk = part;
      } else {
        currentChunk = currentChunk ? currentChunk + "\n\n" + part : part;
      }
    }
  }
  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  if (chunks.length > MAX_CHUNKS) {
    return {
      chunks: [],
      keyText,
      error: TOO_LONG_MSG,
    };
  }

  return { chunks, keyText };
}

// Tạo bảng nhận diện format lấy trực tiếp từ GENERAL_LABELS
const FORMAT_DESCRIPTIONS = {
  mcq: "Multiple choice question with 4 options (A, B, C, D)",
  pron: "Pronunciation odd-one-out comparing underlined sound in options",
  stress: "Word stress pattern identification",
  comm: "Everyday conversational exchange or response",
  error: "Error identification with 2 to 4 underlined parts in sentence",
  syn: "Synonym or antonym (closest or opposite meaning) of underlined word",
  sign: "Sign, notice, or picture interpretation",
  verb: "Verb tense / form fill-in-the-blank with base verb in brackets",
  wform: "Word formation fill-in-the-blank with root word in brackets",
  cloze: "Cloze passage with multiple-choice blanks",
  ocloze: "Open cloze passage (fill in the blanks without given options)",
  tf: "True or False statements based on a reading passage",
  tfng: "True / False / Not Given statements based on a reading passage",
  rq: "Reading comprehension questions with full sentence answers",
  insert: "Sentence insertion into passage at [I], [II], [III], or [IV]",
  arrange: "Rearrange scrambled sentences into a coherent dialogue or paragraph",
  reorder: "Sentence building (reorder scrambled word pieces into a full sentence)",
  rewrite: "Sentence transformation starting with given words",
  combine: "Sentence combination connecting two sentences",
  closest: "Choose sentence closest in meaning to the given sentence",
  phrase: "Guided phrase writing / sentence completion",
  gap: "General gap fill / fill in the blank",
};

function formatClassificationTable() {
  const lines = Object.entries(GENERAL_LABELS).map(([k, label]) => {
    const desc = FORMAT_DESCRIPTIONS[k] || label;
    return `- "g-${k}": ${label} — ${desc}`;
  });
  lines.push('- "writing": Essay, paragraph writing, or long open-ended composition');
  lines.push('- "other": Any other question format not covered above');
  return lines.join("\n");
}

const ALL_WORD_FORMATS = [
  ...Object.keys(GENERAL_LABELS).map((k) => `g-${k}`),
  "writing",
  "other",
];

const WORD_IMPORT_SYSTEM = `You convert a Vietnamese secondary-school English test (extracted from Word) into structured questions. Copy text exactly; do not rewrite, translate, fix or invent questions.

Formatting conventions:
- <u>...</u> denotes underlined letters or words. Preserve <u>...</u> exactly in your output (in label, options, or before/after as appropriate).
- ____ (3 or more underscores) denotes a blank to fill in.
- [IMGn] denotes an image placeholder (e.g. [IMG1], [IMG2]). Set imageRef: "IMGn" on the question and remove [IMGn] from the question text.
- <mark>...</mark> denotes colored or highlighted text in the source document, which often indicates the correct answer. Strip <mark> tags and consider it as the answer if appropriate.

Question format classification:
Map each section to one of the following format keys based on the section's instructions and question structure:
${formatClassificationTable()}

Rules for extracting questions:
- Strip option prefix labels like "A.", "B.", "C.", "D." from options (options should only contain the choice text).
- If an Answer key is provided below, locate the answer by question number and set answerSource: "document".
- If the answer is highlighted in the text (<mark>...</mark>), use it as the answer and set answerSource: "document".
- If no answer is provided in the document, solve the question yourself and set answerSource: "ai".
- If you are unsure how to read or format a question, set confidence: "low" and provide a short note.
- For reading sections (cloze, reading comprehension, true/false), put the reading text in section.passage.
- Every question MUST have "answer": take it from the answer key by section (part) + question number, or from <mark>, or solve it yourself with answerSource "ai". Numbering may restart at 1 in each part, so match the answer key by part + number. For multiple choice, "answer" is the option text (or its letter). Use empty strings / empty arrays for fields that do not apply, never omit them.
- For fill-in-the-blank questions (verb, wform, gap): fill BOTH "before" and "after" around the blank, or leave both empty and keep the full sentence with ____ in "text". Put root words in "hint" (e.g. "(go)").
- For pronunciation/stress questions: put nothing but the four words in "options" and leave "text" empty.
- For sentence transformation (rewrite): put the given start words in "start".
- For sentence building (reorder): put the words or pieces in "pieces".`;

function buildWordPrompt(chunk, keyText, ctx = {}) {
  let p = "";
  if (ctx.subject) {
    p += `Subject context: ${ctx.subject}\n\n`;
  }
  if (keyText && keyText.trim()) {
    p += `--- ANSWER KEY (from document) ---\n${keyText.trim()}\n--- END ANSWER KEY ---\n\n`;
  }
  p += `--- TEST DOCUMENT CHUNK ---\n${chunk.trim()}\n--- END TEST DOCUMENT CHUNK ---\n\n`;
  p += "Extract all sections and questions from the test document chunk above according to the schema.";
  return p;
}

const WORD_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          instruction: { type: "string" },
          format: { type: "string", enum: ALL_WORD_FORMATS },
          passage: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "integer" },
                text: { type: "string" },
                before: { type: "string" },
                after: { type: "string" },
                hint: { type: "string" },
                start: { type: "string" },
                options: { type: "array", items: { type: "string" } },
                answer: { type: "string" },
                altAnswers: { type: "array", items: { type: "string" } },
                pieces: { type: "array", items: { type: "string" } },
                imageRef: { type: "string" },
                answerSource: { type: "string", enum: ["document", "ai"] },
                confidence: { type: "string", enum: ["high", "low"] },
                note: { type: "string" },
              },
              // Gemini bỏ qua thuộc tính không bắt buộc -> bắt buộc các trường chính (rỗng nếu không áp dụng).
              required: ["number", "text", "options", "answer", "altAnswers", "answerSource", "confidence"],
            },
          },
        },
        required: ["instruction", "format", "passage", "questions"],
      },
    },
  },
  required: ["sections"],
};

// Kiểm tra đáp án có khớp lựa chọn nào không (hỗ trợ A-D, text có gạch chân hoặc text trần)
function matchOption(opts, answer) {
  if (!Array.isArray(opts) || !opts.length) return false;
  const cleanAns = S(answer).replace(/<\/?u>/gi, "").replace(/__/g, "");
  // 1. So khớp chữ cái A-D
  if (/^[A-D]$/i.test(S(answer))) {
    const idx = S(answer).toUpperCase().charCodeAt(0) - 65;
    return idx >= 0 && idx < opts.length;
  }
  // 2. So khớp trực tiếp hoặc sau khi bóc gạch chân
  return opts.some((o) => {
    if (sameText(o, answer)) return true;
    const cleanO = S(o).replace(/<\/?u>/gi, "").replace(/__/g, "");
    return sameText(cleanO, cleanAns);
  });
}

// Xử lý và gom kết quả từ các chunk AI thành sections hoàn chỉnh
function buildImport(chunkResults, { subject, images = [], keyText = "" } = {}) {
  const warnings = [];
  const rawSections = [];
  let failedChunks = 0;
  const totalChunks = Array.isArray(chunkResults) ? chunkResults.length : 0;

  // 1. Ghép các section từ các chunk và gộp section bị cắt
  if (Array.isArray(chunkResults)) {
    for (const res of chunkResults) {
      if (!res || res.ok === false) {
        failedChunks++;
        const snip = S(res?.snippet).slice(0, 30);
        warnings.push(`Part starting with “${snip}” could not be read — try again or add it by hand.`);
        continue;
      }

      const sections = res.data?.sections || res.sections || [];
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        const sec = sections[sIdx];
        if (!sec) continue;

        // Kiểm tra gộp section với section trước đó nếu cùng format và instruction
        if (rawSections.length > 0 && sIdx === 0) {
          const prev = rawSections[rawSections.length - 1];
          if (sameText(prev.instruction, sec.instruction) && prev.format === sec.format) {
            prev.questions = [...(prev.questions || []), ...(sec.questions || [])];
            if (!prev.passage && sec.passage) {
              prev.passage = sec.passage;
            }
            continue;
          }
        }

        rawSections.push({
          instruction: S(sec.instruction),
          format: S(sec.format),
          passage: S(sec.passage),
          questions: Array.isArray(sec.questions) ? [...sec.questions] : [],
        });
      }
    }
  }

  // 1b. Dọn markup còn sót: bỏ <mark> (giữ chữ bên trong) và marker [IMGn] trong passage/instruction/câu hỏi
  const stripMark = (v) => (typeof v === "string" ? v.replace(/<\/?mark>/gi, "") : v);
  const stripMarkDeep = (v) => (Array.isArray(v) ? v.map(stripMark) : stripMark(v));
  const removeImg = (v, bag) => (typeof v === "string"
    ? v.replace(/\s*\[IMG(\d+)\]/gi, (_, n) => { bag.push(n); return ""; }).trim()
    : v);
  const orphanImgs = [];
  const TEXT_KEYS = ["text", "before", "after", "hint", "start", "options", "answer", "altAnswers", "pieces", "note"];
  for (const sec of rawSections) {
    sec.instruction = removeImg(stripMark(sec.instruction), orphanImgs);
    sec.passage = removeImg(stripMark(sec.passage), orphanImgs);
    sec.questions = sec.questions.map((q) => {
      if (!q || typeof q !== "object") return q;
      const c = { ...q };
      for (const k of TEXT_KEYS) if (c[k] != null) c[k] = stripMarkDeep(c[k]);
      // Marker gắn với câu (có imageRef) chỉ bỏ khỏi chữ, không cảnh báo
      for (const k of ["text", "before", "after"]) {
        if (typeof c[k] === "string") c[k] = removeImg(c[k], c.imageRef ? [] : orphanImgs);
      }
      return c;
    });
  }
  for (const n of new Set(orphanImgs)) {
    warnings.push(`Image ${n} is inside a passage or instruction — add it by hand.`);
  }

  // 2. Xử lý trùng số câu: chỉ trong cùng một section đã gộp (ranh giới khúc có thể lặp câu),
  // và chỉ khi cả số lẫn nội dung câu giống nhau. Nhiều đề đánh số lại từ 1 ở mỗi phần nên giữ nguyên.
  const qSig = (q) => [q.text, q.before, ...(Array.isArray(q.options) ? q.options : [])]
    .map((x) => S(x).toLowerCase()).join("\u0001");
  for (const sec of rawSections) {
    const seen = new Set();
    const filteredQuestions = [];
    for (const q of sec.questions) {
      if (q && q.number != null) {
        const key = q.number + "\u0002" + qSig(q);
        if (seen.has(key)) {
          warnings.push(`Duplicate question number ${q.number} — kept first occurrence`);
          continue;
        }
        seen.add(key);
      }
      filteredQuestions.push(q);
    }
    sec.questions = filteredQuestions;
  }

  // 3. Xử lý format writing và other
  const keptSections = [];
  for (const sec of rawSections) {
    if (sec.format === "writing") {
      const qCount = sec.questions.length;
      warnings.push(`Writing tasks are not imported yet (${qCount} question${qCount === 1 ? "" : "s"} skipped)`);
      continue;
    }

    if (sec.format === "other") {
      const withAns = [];
      let withoutAnsCount = 0;
      for (const q of sec.questions) {
        if (q && S(q.answer)) {
          withAns.push(q);
        } else {
          withoutAnsCount++;
        }
      }

      if (withoutAnsCount > 0) {
        warnings.push(`Unrecognized question type without answer skipped (${withoutAnsCount} question${withoutAnsCount === 1 ? "" : "s"})`);
      }
      if (withAns.length > 0) {
        warnings.push(`Unrecognized question type converted to gap fill (${withAns.length} question${withAns.length === 1 ? "" : "s"})`);
        sec.format = "g-gap";
        sec.questions = withAns;
        keptSections.push(sec);
      }
      continue;
    }

    if (sec.questions.length > 0) {
      keptSections.push(sec);
    }
  }

  // 4. Cảnh báo passage ngoài reading
  if (subject !== "reading") {
    const hasPassage = keptSections.some((s) => s.passage && s.passage.trim());
    if (hasPassage) {
      warnings.push("Passages are only kept in Reading / Mock Test");
    }
  }

  // 5. Kiểm tra và gắn cờ vàng (flag) cho từng câu
  const imageRefs = new Set((images || []).map((img) => img.ref));
  const isChoiceFormat = (fmt) => [
    "g-mcq", "g-comm", "g-closest", "g-pron", "g-stress",
    "g-cloze", "g-tf", "g-sign", "g-syn",
  ].includes(fmt);

  for (const sec of keptSections) {
    for (const q of sec.questions) {
      if (!q) continue;
      const flags = [];

      if (q.answerSource === "ai") {
        flags.push("Answer suggested by AI — not found in the file");
      }
      if (q.confidence === "low") {
        flags.push(q.note ? `AI was unsure how to read this question: ${q.note}` : "AI was unsure how to read this question");
      }
      if (sec.format === "g-pron" || sec.format === "g-stress") {
        flags.push("Pronunciation/stress — please double-check");
      }
      if (q.imageRef && !imageRefs.has(q.imageRef)) {
        flags.push("Image not found in the file");
      }

      // Kiểm tra câu trắc nghiệm có đáp án không khớp lựa chọn
      if (isChoiceFormat(sec.format) && Array.isArray(q.options) && q.options.length > 0 && q.answer) {
        if (!matchOption(q.options, q.answer)) {
          q.answer = ""; // để trống đáp án
          flags.push("Answer does not match any option — choose the correct one");
        }
      }

      if (flags.length > 0) {
        q.flag = flags.join("; ");
      }
    }
  }

  // 6. Chuyển sang Section shape bằng toGeneralSection
  const finalSections = [];
  const allFlags = [];
  const imageLinks = [];
  let currentStartId = 1;

  for (let sIdx = 0; sIdx < keptSections.length; sIdx++) {
    const sec = keptSections[sIdx];
    const targetSi = finalSections.length;

    const { section, flags: secFlags, warnings: secWarnings } = toGeneralSection(
      {
        format: sec.format,
        name: sec.instruction,
        passage: sec.passage,
        questions: sec.questions,
      },
      {
        subject,
        startId: currentStartId,
        strict: false,
        si: targetSi,
      }
    );

    warnings.push(...secWarnings);

    if (section.fields && section.fields.length > 0) {
      finalSections.push(section);
      allFlags.push(...secFlags.map((f) => ({ ...f, si: targetSi })));
      currentStartId += section.fields.length;

      // Xây dựng imageLinks cho các câu có ảnh
      for (let fIdx = 0; fIdx < sec.questions.length && fIdx < section.fields.length; fIdx++) {
        const q = sec.questions[fIdx];
        if (q && q.imageRef) {
          imageLinks.push({ si: targetSi, fi: fIdx, ref: q.imageRef });
        }
      }
    }
  }

  const totalQuestions = finalSections.reduce((sum, s) => sum + (s.fields ? s.fields.length : 0), 0);
  const stats = {
    chunks: totalChunks,
    failedChunks,
    questions: totalQuestions,
    flagged: allFlags.length,
    answerKeyFound: !!(keyText && String(keyText).trim()),
  };

  return {
    sections: finalSections,
    flags: allFlags,
    imageLinks,
    warnings: [...new Set(warnings)],
    stats,
  };
}

module.exports = {
  splitForAi,
  isKeyHeading,
  WORD_IMPORT_SYSTEM,
  buildWordPrompt,
  WORD_SCHEMA,
  buildImport,
};
