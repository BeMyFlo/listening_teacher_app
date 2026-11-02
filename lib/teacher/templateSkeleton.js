// Dựng "khung đề" (shape editor) từ khuôn đã resolve — Phase 12 G2, mục 2.3.
// Hàm thuần, không React / DB. Khung chỉ nằm trong state của builder tới khi giáo viên bấm Save.
import { PASSAGE_PLACEHOLDER } from "../generalTemplates.js";
import { GENERAL_ALL_FORMATS } from "./questionFormats.js";
import { emptyField, emptySection, applyFormat, newOptionId } from "./sectionTransforms.js";

// Câu chọn đáp án chưa có lựa chọn dựng sẵn -> 4 ô A–D trống (D9). Dạng "Arrange" cũng nhận 4 ô trống:
// câu choice không có lựa chọn thì server từ chối lưu nháp; nút "Generate options" sẽ ghi đè các ô này.
// Dạng có lựa chọn cố định (True/False, [I]–[IV]) và Error identification (tự dựng từ chỗ gạch chân) giữ nguyên.
function needsBlankOptions(fmt, field) {
  return field.kind === "mcq" && !(field.options || []).length && !fmt.presetOptions && !fmt.errorLetters;
}

// resolved = resolveTemplate(...).template. Trả { skills: { listening?, reading? }, durations }.
// skills[k] = { sections }; id câu chạy 1..N liền qua mọi phần của TỪNG kỹ năng.
export function buildSkeleton(resolved) {
  const skills = {};
  const durations = {};
  for (const [skillKey, def] of Object.entries((resolved && resolved.skills) || {})) {
    let nextId = 1;
    const sections = def.parts.map((part) => {
      const sec = emptySection();
      sec.name = part.name;
      // Luật server: section reading phải có passageText hoặc ảnh, kể cả phần không có đoạn văn (Phonetics...).
      // Phần có đoạn văn -> chữ giữ chỗ (chặn publish tới khi thay); phần không có -> dòng hướng dẫn của phần
      // (đúng thứ đề giấy in trên đầu phần), để lưu nháp được mà không cần nới luật.
      if (skillKey === "reading") sec.passageText = part.passage ? PASSAGE_PLACEHOLDER : part.instruction;
      for (const q of part.questions) {
        const fmt = GENERAL_ALL_FORMATS.find((f) => f.key === q.format);
        if (!fmt) throw new Error("Unknown question format: " + q.format);
        for (let i = 0; i < q.count; i++) {
          const field = applyFormat(emptyField(nextId++), fmt);
          if (needsBlankOptions(fmt, field)) {
            field.options = [0, 1, 2, 3].map(() => ({ id: newOptionId(), text: "" }));
          }
          sec.fields.push(field);
        }
      }
      return sec;
    });
    skills[skillKey] = { sections };
    durations[skillKey] = String(def.durationMinutes);
  }
  return { skills, durations };
}

// Danh sách câu dở (từ incompleteQuestions) -> chữ cho giáo viên: tối đa `max` dòng
// "Question 7 — no correct answer" + "and N more". Một câu có nhiều lý do gộp 1 dòng.
// Có cả listening lẫn reading thì thêm tên kỹ năng ở đầu dòng (id mỗi kỹ năng đều bắt đầu từ 1).
export function describeIncomplete(list, max = 10) {
  const byQ = new Map();
  for (const it of list || []) {
    const k = it.skill + ":" + it.fieldId;
    if (!byQ.has(k)) byQ.set(k, { skill: it.skill, fieldId: it.fieldId, reasons: [] });
    const e = byQ.get(k);
    if (!e.reasons.includes(it.reason)) e.reasons.push(it.reason);
  }
  const items = [...byQ.values()];
  const multiSkill = new Set(items.map((i) => i.skill)).size > 1;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const lines = items.slice(0, max).map(
    (i) => `${multiSkill ? cap(i.skill) + " " : ""}Question ${i.fieldId} — ${i.reasons.join("; ")}`
  );
  if (items.length > max) lines.push(`and ${items.length - max} more`);
  return { total: items.length, lines, first: items[0] || null };
}
