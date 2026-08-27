import { emptySection, emptyField, newOptionId, nextFieldId } from "./sectionTransforms";

// Chuyển "importSections" (từ API import) sang sections dạng editor +
// dựng matchBank, giải matchingAnswerId, gộp default của emptyField.
export function toEditorSections(importSections, existing = []) {
  let id = nextFieldId(existing);
  return (importSections || []).map((s) => {
    const matchBank = (s.matchBankTexts || []).map((text) => ({ id: newOptionId(), text }));
    const fields = (s.fields || []).map((f) => {
      const base = emptyField(id++);
      const field = { ...base, ...f, id: base.id };
      if (f.kind === "matching" || f.kind === "labelling") {
        const be = matchBank.find(
          (b) => b.text.toLowerCase() === String(f.matchingBankText || "").toLowerCase()
        );
        field.matchingAnswerId = be ? be.id : "";
      }
      delete field.matchingBankText;
      delete field._bankOptions;
      return field;
    });
    const sec = emptySection();
    sec.name = s.name || "";
    sec.passageText = s.passageText || "";
    sec.matchBank = matchBank;
    sec.fields = fields;
    return sec;
  });
}
