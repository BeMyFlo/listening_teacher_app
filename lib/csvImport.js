// Nhập câu hỏi hàng loạt từ file CSV (giáo viên tải lên, dùng chung cho cả
// Test builder và Unit exercise builder). Tự viết parser CSV thay vì dùng
// thư viện ngoài (vd "xlsx") vì thư viện đó đang có lỗ hổng bảo mật chưa vá
// (prototype pollution + ReDoS) — rủi ro thật vì đây là chỗ nhận file từ
// người dùng. CSV là định dạng text đơn giản, tự parse an toàn hơn nhiều.

const REQUIRED_HEADERS = ["section", "question", "type"];
const KNOWN_TYPES = ["fill", "mcq", "tfng", "matching"];

// Parser CSV tối giản nhưng đúng chuẩn: hỗ trợ field trong dấu ngoặc kép
// (chứa dấu phẩy/xuống dòng), dấu ngoặc kép lặp đôi ("") để escape.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  const clean = String(text || "").replace(/^﻿/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => String(c || "").trim() !== ""));
}

function normalizeHeader(h) {
  return String(h || "").trim().toLowerCase();
}

function splitList(text) {
  return String(text || "")
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Chuyển các dòng CSV (đã parse) thành {sections, warnings} — sections ở
// đây đã đúng shape editor phía client (kind-based), sẵn sàng đưa thẳng
// vào builder để giáo viên xem/sửa trước khi Lưu (không ghi DB ở bước này).
function rowsToSections(rows) {
  const warnings = [];
  if (!rows.length) return { sections: [], warnings: ["The file is empty."] };

  const header = rows[0].map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length) {
    return { sections: [], warnings: [`Missing required column(s): ${missing.join(", ")}. Please use the sample template.`] };
  }

  const col = {};
  header.forEach((h, i) => (col[h] = i));
  const optionCols = [1, 2, 3, 4, 5].map((n) => col["option " + n]).filter((i) => i != null);

  const sectionsByName = new Map();
  const order = [];
  let nextId = 1;

  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r];
    const get = (key) => (col[key] != null ? String(raw[col[key]] || "").trim() : "");
    const sectionName = get("section") || "Section 1";
    const question = get("question");
    const typeRaw = get("type").toLowerCase().replace(/[^a-z]/g, "");
    const scoreRaw = get("score");

    if (!question) {
      warnings.push(`Row ${r + 1}: skipped — no question text.`);
      continue;
    }

    let kind = null;
    if (typeRaw === "fill" || typeRaw === "fillintheblank") kind = "fill";
    else if (typeRaw === "mcq" || typeRaw === "multiplechoice") kind = "mcq";
    else if (typeRaw === "tfng" || typeRaw.includes("truefalse")) kind = "tfng";
    else if (typeRaw === "matching" || typeRaw === "match") kind = "matching";
    if (!kind) {
      warnings.push(`Row ${r + 1}: unknown Type "${get("type")}" — skipped. Use one of: Fill, MCQ, TFNG, Matching.`);
      continue;
    }

    const correctRaw = get("correct answer");
    const score = Math.max(1, Number(scoreRaw) || 1);
    const field = {
      id: nextId++,
      label: question,
      kind,
      pre: "",
      post: "",
      score,
      answersText: "",
      options: [],
      correctOptionIds: [],
      matchingAnswerId: ""
    };

    if (kind === "fill") {
      const answers = splitList(correctRaw);
      if (!answers.length) warnings.push(`Row ${r + 1} ("${question}"): no correct answer given.`);
      field.answersText = answers.join("\n");
    } else if (kind === "mcq") {
      const optionTexts = optionCols.map((i) => String(raw[i] || "").trim()).filter(Boolean);
      if (optionTexts.length < 2) {
        warnings.push(`Row ${r + 1} ("${question}"): needs at least 2 options — skipped.`);
        continue;
      }
      const correctTexts = splitList(correctRaw).map((s) => s.toLowerCase());
      field.options = optionTexts.map((text, i) => ({ id: "o" + field.id + "_" + i, text }));
      field.correctOptionIds = field.options.filter((o) => correctTexts.includes(o.text.toLowerCase())).map((o) => o.id);
      if (!field.correctOptionIds.length) {
        warnings.push(`Row ${r + 1} ("${question}"): Correct Answer text didn't match any option — please pick manually after import.`);
      }
    } else if (kind === "tfng") {
      const norm = correctRaw.toLowerCase().replace(/[^a-z]/g, "");
      const map = { true: "true", false: "false", notgiven: "ng", ng: "ng" };
      const ansId = map[norm];
      field.options = [
        { id: "true", text: "True" },
        { id: "false", text: "False" },
        { id: "ng", text: "Not Given" }
      ];
      if (ansId) field.correctOptionIds = [ansId];
      else warnings.push(`Row ${r + 1} ("${question}"): Correct Answer should be True, False, or Not Given — please pick manually after import.`);
    } else if (kind === "matching") {
      if (!correctRaw) {
        warnings.push(`Row ${r + 1} ("${question}"): no Correct Answer given for matching bank — please pick manually after import.`);
      }
      field.matchingBankText = correctRaw;
    }

    if (!sectionsByName.has(sectionName)) {
      sectionsByName.set(sectionName, { name: sectionName, fields: [], matchBankTexts: [] });
      order.push(sectionName);
    }
    const sec = sectionsByName.get(sectionName);
    sec.fields.push(field);
    if (kind === "matching" && field.matchingBankText && !sec.matchBankTexts.includes(field.matchingBankText)) {
      sec.matchBankTexts.push(field.matchingBankText);
    }
  }

  const sections = order.map((name) => sectionsByName.get(name));
  return { sections, warnings };
}

module.exports = { parseCsv, rowsToSections, KNOWN_TYPES };
