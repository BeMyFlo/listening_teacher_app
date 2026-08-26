// Nhập câu hỏi hàng loạt từ file CSV (giáo viên tải lên, dùng chung cho cả
// Test builder và Unit exercise builder). Tự viết parser CSV thay vì dùng
// thư viện ngoài (vd "xlsx") vì thư viện đó đang có lỗ hổng bảo mật chưa vá
// (prototype pollution + ReDoS) — rủi ro thật vì đây là chỗ nhận file từ
// người dùng. CSV là định dạng text đơn giản, tự parse an toàn hơn nhiều.

const REQUIRED_HEADERS = ["section", "question", "type"];
const KNOWN_TYPES = ["fill", "mcq", "tfng", "ynng", "matching", "labelling"];

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

// Đọc file CSV "nội dung" (đoạn văn Reading / track info Listening — xuất
// thẳng từ tab "Doan van" / "Bai nghe" của 2 sheet mẫu giáo viên) thành
// Map<Passage_ID hoặc Track_ID, {title, passageText}>. Đọc theo TÊN cột chứ
// không theo vị trí, và bỏ qua mọi cột lạ (Chu_de, Ghi_chu, Section 1-4,
// Link_audio, Transcript...) — các cột này không có chỗ lưu trong schema
// hiện tại, chỉ mang tính tham khảo cho giáo viên.
function parseContentCsv(rows) {
  const map = new Map();
  if (!rows.length) return map;

  const header = rows[0].map(normalizeHeader);
  const idIdx = header.findIndex((h) => h === "passage_id" || h === "track_id");
  if (idIdx === -1) return map;
  const titleIdx = header.findIndex((h) => h === "tieu_de" || h === "title");
  // Header thật là "Noi_dung (danh dau [A][B][C]...)" — match theo tiền tố
  // để không phụ thuộc phần chú thích trong ngoặc.
  const contentIdx = header.findIndex((h) => h.startsWith("noi_dung"));

  for (let r = 1; r < rows.length; r++) {
    const raw = rows[r];
    const id = String(raw[idIdx] || "").trim();
    if (!id) continue;
    map.set(id, {
      title: titleIdx !== -1 ? String(raw[titleIdx] || "").trim() : "",
      passageText: contentIdx !== -1 ? String(raw[contentIdx] || "").trim() : ""
    });
  }
  return map;
}

// Bảng ánh xạ "Dang_bai" thật từ 2 sheet mẫu (IELTS_Reading_Sheet.xlsx,
// IELTS_Listening_Sheet.xlsx — đọc trực tiếp từ dropdown "Huong dan" của
// từng file, không dịch lại sang tiếng Anh) sang "kind" phía editor. Giữ
// nguyên chuỗi gốc tiếng Việt pha Anh vì đó là giá trị thật teacher sẽ xuất
// ra CSV — không phải bản diễn giải.
function classifyQuestionType(typeRaw) {
  if (typeRaw === "fill" || typeRaw === "fillintheblank") return "fill";
  if (typeRaw === "mcq" || typeRaw.includes("multiplechoice")) return "mcq";
  if (typeRaw === "tfng" || typeRaw.includes("truefalse")) return "tfng";
  if (typeRaw === "ynng" || typeRaw.includes("yesno")) return "ynng";
  // "Summary Completion (khong co danh sach tu)" -> fill;
  // "Summary Completion (co danh sach tu)" -> matching (word bank = shared
  // answer bank); "Summary Completion" trơn (Listening, không có hậu tố) ->
  // fill, vì trong sheet Listening dạng này luôn là gõ tay, không có word
  // bank. Check "khong..." trước vì nó chứa "codanhsachtu" như substring.
  if (typeRaw.includes("summarycompletion")) {
    if (typeRaw.includes("khongcodanhsachtu")) return "fill";
    if (typeRaw.includes("codanhsachtu")) return "matching";
    return "fill";
  }
  // Phải check trước "completion" chung vì "Diagram Label Completion" cũng
  // chứa "completion".
  if (typeRaw.includes("labelling") || typeRaw.includes("diagramlabel")) return "labelling";
  if (typeRaw === "matching" || typeRaw === "match" || typeRaw.includes("matching")) return "matching";
  if (typeRaw.includes("completion") || typeRaw.includes("shortanswer")) return "fill";
  return null;
}

// Chuyển các dòng CSV (đã parse) thành {sections, warnings} — sections ở
// đây đã đúng shape editor phía client (kind-based), sẵn sàng đưa thẳng
// vào builder để giáo viên xem/sửa trước khi Lưu (không ghi DB ở bước này).
// `contentMap` (optional, Map<id, {title, passageText}> từ parseContentCsv)
// nối bằng cột "Section" hiện có làm join-key — bỏ qua tham số này thì
// hành vi y hệt trước đây (không đổi output khi không dùng dual-CSV).
function rowsToSections(rows, contentMap) {
  contentMap = contentMap instanceof Map ? contentMap : new Map();
  const warnings = [];
  if (!rows.length) return { sections: [], warnings: ["The file is empty."] };

  const header = rows[0].map(normalizeHeader);
  const missing = REQUIRED_HEADERS.filter((h) => !header.includes(h));
  if (missing.length) {
    return { sections: [], warnings: [`Missing required column(s): ${missing.join(", ")}. Please use the sample template.`] };
  }

  const col = {};
  header.forEach((h, i) => (col[h] = i));
  const optionCols = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => col["option " + n]).filter((i) => i != null);

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

    const kind = classifyQuestionType(typeRaw);
    if (!kind) {
      warnings.push(`Row ${r + 1}: unknown Type "${get("type")}" — skipped. Use one of: Fill, MCQ, TFNG, YNNG, Matching, Labelling.`);
      continue;
    }

    const correctRaw = get("correct answer");
    const score = Math.max(1, Number(scoreRaw) || 1);
    const hint = get("word limit") || get("hint");
    const field = {
      id: nextId++,
      label: question,
      kind,
      pre: "",
      post: "",
      hint,
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
    } else if (kind === "ynng") {
      const norm = correctRaw.toLowerCase().replace(/[^a-z]/g, "");
      const map = { yes: "yes", no: "no", notgiven: "ng", ng: "ng" };
      const ansId = map[norm];
      field.options = [
        { id: "yes", text: "Yes" },
        { id: "no", text: "No" },
        { id: "ng", text: "Not Given" }
      ];
      if (ansId) field.correctOptionIds = [ansId];
      else warnings.push(`Row ${r + 1} ("${question}"): Correct Answer should be Yes, No, or Not Given — please pick manually after import.`);
    } else if (kind === "matching" || kind === "labelling") {
      if (!correctRaw) {
        warnings.push(`Row ${r + 1} ("${question}"): no Correct Answer given for matching bank — please pick manually after import.`);
      }
      field.matchingBankText = correctRaw;
    }

    if (!sectionsByName.has(sectionName)) {
      // Join-key: cột "Section" phải khớp đúng Passage_ID/Track_ID trong
      // content CSV (nếu có). Khớp được thì lấy Tieu_de làm tên hiển thị
      // (không dùng ID thô) và tự điền passageText; không khớp thì báo mềm
      // — chỉ khi thực sự có content file để so (contentMap không rỗng),
      // tránh cảnh báo thừa khi giáo viên chỉ import 1 file như trước nay.
      const content = contentMap.get(sectionName);
      if (!content && contentMap.size) {
        warnings.push(`Row ${r + 1}: no passage text found for section "${sectionName}" — check it matches a Passage_ID in your content file, or attach it manually`);
      }
      sectionsByName.set(sectionName, {
        name: content && content.title ? content.title : sectionName,
        fields: [],
        matchBankTexts: [],
        passageText: content ? content.passageText : ""
      });
      order.push(sectionName);
    }
    const sec = sectionsByName.get(sectionName);
    sec.fields.push(field);
    if ((kind === "matching" || kind === "labelling") && field.matchingBankText && !sec.matchBankTexts.includes(field.matchingBankText)) {
      sec.matchBankTexts.push(field.matchingBankText);
    }
  }

  const sections = order.map((name) => sectionsByName.get(name));
  return { sections, warnings };
}

module.exports = { parseCsv, parseContentCsv, rowsToSections, KNOWN_TYPES };
