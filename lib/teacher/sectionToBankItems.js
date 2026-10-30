// Đổi phần (section) của builder / import Word thành mục ngân hàng câu hỏi — Phase 12 G4 bước 2.
// Hàm thuần, không React / DB; KHÔNG sửa section đầu vào. Luật "câu dở" dùng đúng incompleteQuestions của server
// nên câu bị từ chối ở đây cũng là câu server sẽ từ chối.
import { GENERAL_LABELS } from "../generalFormats.js";
import { PASSAGE_PLACEHOLDER, MAX_PER_PART, incompleteQuestions, isTemplateInstruction } from "../generalTemplates.js";
import { fieldToServer } from "./sectionTransforms.js";

// Dạng bài mà câu hỏi nằm trong đoạn văn -> phải lưu thành nhóm (kèm đoạn văn), không tách lẻ được.
const PASSAGE_FORMATS = new Set(["cloze", "ocloze", "tf", "tfng", "rq"].map((k) => GENERAL_LABELS[k]));
const PASSAGE_EMPTY = "the passage is still empty";

// Nhãn dạng bài ("Word form") -> key "g-wform"; không khớp -> "".
export function formatKeyOf(label) {
  for (const k of Object.keys(GENERAL_LABELS)) if (GENERAL_LABELS[k] === label) return "g-" + k;
  return "";
}

// Thông tin media của 1 phần: đoạn văn thật (không phải chữ giữ chỗ), ảnh, có dạng cần đoạn văn không.
// Dòng hướng dẫn của khuôn (phần không có đoạn văn) trông như đoạn văn -> chỉ thành nhóm khi dạng bài cần
// đoạn văn hoặc giáo viên chủ động giữ (keepPassage), nên ở đây chỉ báo "có thể giữ".
export function sectionBankInfo(sec, subject) {
  const raw = subject === "reading" ? String((sec && sec.passageText) || "").trim() : "";
  const imageId = sec && sec.imageId ? String(sec.imageId) : "";
  const fields = (sec && sec.fields) || [];
  const needsPassage = fields.some((f) => PASSAGE_FORMATS.has(f.formatLabel));
  // Dòng hướng dẫn của khuôn (khớp đúng chữ trong TEMPLATES) không phải đoạn văn. Không dùng luật "ngắn" ở đây
  // để không làm mất đoạn văn ngắn thật của giáo viên (import Word, đoạn không có chỗ trống).
  const isInstr = isTemplateInstruction(raw);
  const passage = raw === PASSAGE_PLACEHOLDER || isInstr ? "" : raw;
  return {
    passage,
    imageId,
    hasMedia: !!(passage || imageId),
    needsPassage,
  };
}

const num = (f) => Number(f.id);

// Lý do câu (shape server) còn dở, hoặc "". Chạy trong 1 phần giả có đúng đoạn văn/ảnh sẽ đi cùng mục.
function unfinishedReason(server, passage, imageId) {
  const list = incompleteQuestions({ reading: { sections: [{ passageText: passage, imageId: imageId || undefined, fields: [server] }] } });
  return list.map((x) => x.reason).filter((r, i, a) => a.indexOf(r) === i).join("; ");
}

// sec: section dạng editor. opts: { subject, level, textbook, unitLabel, topic, difficulty, ticked: [chỉ số field],
//   keepPassage, skipFlagged, sourceRef }.
// -> { items: [thân POST], names: [tên từng mục để báo lỗi], skipped: [{ id, reason }], questionCount }
export function sectionToBankItems(sec, opts = {}) {
  const info = sectionBankInfo(sec, opts.subject);
  const fields = (sec && sec.fields) || [];
  const ticked = Array.isArray(opts.ticked) ? new Set(opts.ticked) : null;
  const asGroup = info.hasMedia && (info.needsPassage || !!opts.keepPassage);
  const skipped = [];
  const good = []; // { f, server, format }

  fields.forEach((f, i) => {
    if (ticked && !ticked.has(i)) return;
    const id = num(f);
    if (f.kind === "matching" || f.kind === "labelling") {
      skipped.push({ id, reason: "matching and labelling questions need their shared answer bank, so they cannot be saved on their own" });
      return;
    }
    if (opts.skipFlagged && f.aiFlag) {
      skipped.push({ id, reason: "needs checking (" + f.aiFlag + ")" });
      return;
    }
    const server = fieldToServer(f);
    const reason = unfinishedReason(server, asGroup ? info.passage : "", asGroup ? info.imageId : "");
    if (reason) {
      skipped.push({ id, reason: reason === PASSAGE_EMPTY ? "it needs a passage, but the passage is empty" : reason });
      return;
    }
    const format = formatKeyOf(f.formatLabel);
    if (!format) {
      skipped.push({ id, reason: "it has no question type" });
      return;
    }
    good.push({ f, server, format });
  });

  const base = {
    level: opts.level,
    textbook: opts.textbook || "",
    unitLabel: opts.unitLabel || "",
    ...(opts.sourceRef ? { sourceRef: opts.sourceRef } : {}),
  };
  const items = [];
  const names = [];

  if (asGroup) {
    // Nhóm tối đa MAX_PER_PART câu: phần dài hơn tách thành nhiều nhóm cùng đoạn văn.
    for (let i = 0; i < good.length; i += MAX_PER_PART) {
      const chunk = good.slice(i, i + MAX_PER_PART);
      items.push({
        ...base,
        kind: "group",
        format: chunk[0].format,
        topic: opts.topic || "",
        difficulty: opts.difficulty || "",
        passageText: info.passage,
        ...(info.imageId ? { imageId: info.imageId } : {}),
        fields: chunk.map((g) => g.server),
      });
      names.push("Passage group, question" + (chunk.length > 1 ? "s " + num(chunk[0].f) + "-" + num(chunk[chunk.length - 1].f) : " " + num(chunk[0].f)));
    }
  } else {
    for (const g of good) {
      const s = g.server;
      // Câu lẻ đánh số lại từ 1 (giữ độ rộng của câu gộp idEnd).
      const idEnd = s.idEnd ? 1 + (Number(s.idEnd) - Number(s.id)) : null;
      items.push({
        ...base,
        kind: "single",
        format: g.format,
        topic: opts.topic || s.topic || "",
        difficulty: opts.difficulty || s.difficulty || "",
        fields: [{ ...s, id: 1, idEnd }],
      });
      names.push("Question " + num(g.f));
    }
  }
  return { items, names, skipped, questionCount: good.length };
}

// Import Word: mỗi phần có đoạn văn -> 1 nhóm, còn lại -> câu lẻ. Câu có cờ vàng hoặc chưa có đáp án không lưu.
// sections: dạng editor (qua appendImportedSections, đã có aiFlag + imageId). labels: { level, textbook, unitLabel, difficulty, topic }.
// -> { items, skipped: [{ section, id, reason }], questionCount }
export function importedSectionsToBankItems(sections, labels = {}) {
  const items = [];
  const names = [];
  const skipped = [];
  let questionCount = 0;
  (sections || []).forEach((sec, si) => {
    const r = sectionToBankItems(sec, { ...labels, subject: "reading", keepPassage: true, skipFlagged: true });
    items.push(...r.items);
    r.names.forEach((n) => names.push("Part " + (si + 1) + ", " + n.charAt(0).toLowerCase() + n.slice(1)));
    r.skipped.forEach((s) => skipped.push({ section: si, ...s }));
    questionCount += r.questionCount;
  });
  return { items, names, skipped, questionCount };
}

// Lời nhắn "Item N: ..." của server tính theo mục trong 1 lượt gửi -> cộng `base` để ra số thứ tự trong cả lô.
export function offsetItemError(message, base) {
  return String(message || "").replace(/^Item (\d+):/, (_m, n) => "Item " + (Number(n) + base) + ":");
}

// Chia mảng thành các lượt gửi tối đa `size` mục (server nhận 100 mục / lần).
export function chunkItems(items, size = 100) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
