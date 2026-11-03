import { emptySection, emptyField, newOptionId, nextFieldId } from "./sectionTransforms.js";
import { questionFormatsFor } from "./questionFormats.js";
import { noteTextToDoc, docToNoteText } from "../tiptap/noteConvert.js";

// So tên dạng bài không phân biệt dấu / hoa thường / khoảng trắng — file cũ ghi
// "Multiple Choice (1 dap an)", builder ghi "Multiple Choice (1 đáp án)".
function foldName(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

// Cột Audio của tab Bài nghe -> audio trong kho: khớp theo tên (như hiện trong ô
// "Select audio track", có hoặc không kèm "Unit · "), hoặc link / id audio.
// Không tìm thấy -> null (Section để trống audio, màn xem trước báo cho giáo viên).
export function findAudio(ref, audios = []) {
  const r = String(ref || "").trim();
  if (!r) return null;
  const k = foldName(r);
  return (
    audios.find((a) => a._id === r || a.cloudinaryUrl === r) ||
    audios.find((a) => foldName(a.title) === k || foldName((a.unit ? a.unit + " · " : "") + a.title) === k) ||
    null
  );
}

// 1 dòng file -> 1 dòng trong khung ghi chú: "___" đầu tiên thành ô trống của câu,
// không có "___" thì ô trống nằm cuối dòng.
function noteLine(label, id) {
  const text = String(label || "").trim();
  return /_{2,}/.test(text) ? text.replace(/_{2,}/, `[[${id}]]`) : `${text} [[${id}]]`.trim();
}

// Chuyển "importSections" (từ API import) sang sections dạng editor +
// dựng matchBank, giải matchingAnswerId, gộp default của emptyField.
// opts.audios: kho audio (media.audio) — gắn audio cho Section theo cột Audio.
// opts.subject / opts.program: để khớp cột Dạng bài với danh sách dạng của
// builder — gán formatLabel, và các câu Completion (Form/Note/Table/...) liền
// nhau cùng dạng được ghép thành 1 khung ghi chú như khi tạo tay.
export function toEditorSections(importSections, existing = [], opts = {}) {
  const formats = questionFormatsFor(opts.subject, opts.program) || [];
  const findFormat = (name) => (name ? formats.find((f) => foldName(f.label) === foldName(name)) : null);
  let id = nextFieldId(existing);
  return (importSections || []).map((s) => {
    const matchBank = (s.matchBankTexts || []).map((text) => ({ id: newOptionId(), text }));
    const blocks = []; // [{ label, lines: [], lastIndex }]
    const fields = (s.fields || []).map((f, fi) => {
      const base = emptyField(id);
      const field = { ...base, ...f, id: base.id };
      // Câu "chọn 2 trong 5" (21-22) chiếm nhiều số: giữ khoảng số, câu sau nối tiếp.
      if (f.idEnd && f.idEnd > f.id) field.idEnd = base.id + (f.idEnd - f.id);
      id = (field.idEnd || field.id) + 1;
      if (f.kind === "matching" || f.kind === "labelling") {
        const be = matchBank.find(
          (b) => b.text.toLowerCase() === String(f.matchingBankText || "").toLowerCase()
        );
        field.matchingAnswerId = be ? be.id : "";
      }
      const fmt = findFormat(f.formatName);
      if (fmt) {
        field.formatLabel = fmt.label;
        if (fmt.noteMode && field.kind === "fill") {
          // Chỉ nối vào khung trước nếu câu ngay trên cũng cùng dạng này.
          let block = blocks[blocks.length - 1];
          if (!block || block.label !== fmt.label || block.lastIndex !== fi - 1) {
            block = { label: fmt.label, lines: [] };
            blocks.push(block);
          }
          block.lines.push(noteLine(field.label, field.id));
          block.lastIndex = fi;
          field.label = ""; // câu tạo tay trong khung ghi chú cũng để trống đề — chữ nằm trong khung
        }
      }
      delete field.matchingBankText;
      delete field._bankOptions;
      delete field.formatName;
      return field;
    });
    const sec = emptySection();
    sec.name = s.name || "";
    sec.passageText = s.passageText || "";
    sec.transcript = s.transcript || "";
    const audio = findAudio(s.audioRef, opts.audios);
    if (audio) sec.audioId = audio._id;
    sec.matchBank = matchBank;
    sec.fields = fields;
    if (blocks.length) {
      sec.noteMode = true;
      sec.noteBlocks = blocks.map((b) => {
        const noteDoc = noteTextToDoc(b.lines.join("\n"));
        return { noteDoc, noteText: docToNoteText(noteDoc) };
      });
    }
    return sec;
  });
}
