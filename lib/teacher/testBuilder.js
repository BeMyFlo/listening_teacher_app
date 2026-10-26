import { sectionsToEditor, sectionsToPayload, refId } from "./sectionTransforms.js";
import { PROGRAMS, DEFAULT_PROGRAM, programOf } from "../curriculum.js";

export const TEST_SKILLS = [
  { key: "listening", label: "Listening", icon: "headphones", kind: "sections" },
  { key: "reading", label: "Reading", icon: "book-open", kind: "sections" },
  { key: "writing", label: "Writing", icon: "writing", kind: "prompts" },
  { key: "speaking", label: "Speaking", icon: "mic", kind: "prompts" },
];

// ISO/Date -> value cho <input type="datetime-local">
export function toDatetimeLocal(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// Thời lượng mặc định (phút, dạng chuỗi như ô nhập) của đề mới theo chương trình.
// IELTS giữ nguyên như trước Phase 8 (ô trống = "Unlimited"); chỉ chương trình
// khác (TOEIC) mới điền sẵn defaultDurations.
export function defaultDurationsFor(program) {
  const out = {};
  if (!program || program === DEFAULT_PROGRAM) return out;
  const d = (PROGRAMS[program] && PROGRAMS[program].defaultDurations) || {};
  Object.keys(d).forEach((k) => (out[k] = String(d[k])));
  return out;
}

// Kỹ năng hiện trong builder theo chương trình của đề (IELTS = đủ 4, như cũ).
export function testSkillsFor(program) {
  const allowed = PROGRAMS[programOf({ program })].testSkills;
  return TEST_SKILLS.filter((s) => allowed.includes(s.key));
}

export function emptyBuilder(program) {
  const dur = defaultDurationsFor(program);
  return {
    title: "",
    unit: "",
    level: 1,
    // Chương trình của đề: null = chưa chọn / workspace 1 chương trình (server mặc định IELTS).
    program: null,
    classIds: [],
    opensAt: "",
    closesAt: "",
    skills: {
      listening: { instructions: "", durationMinutes: dur.listening || "", sections: [] },
      reading: { instructions: "", durationMinutes: dur.reading || "", sections: [] },
      writing: { instructions: "", durationMinutes: dur.writing || "", prompts: [] },
      speaking: { instructions: "", durationMinutes: dur.speaking || "", prompts: [] },
    },
  };
}

// Field TOEIC S&W của 1 prompt (Phase 8B). Prompt IELTS (taskType rỗng) -> {} : shape cũ.
// Giây giữ dạng chuỗi như các ô nhập khác ("" = dùng mặc định của dạng đề).
export function taskFieldsToBuilder(p) {
  if (!p.taskType) return {};
  const sec = (v) => (v == null ? "" : String(v));
  return {
    taskType: p.taskType,
    requiredWords: Array.isArray(p.requiredWords) ? p.requiredWords.slice() : [],
    audioId: refId(p.audioId),
    audioPlays: p.audioPlays || 1,
    prepSeconds: sec(p.prepSeconds),
    responseSeconds: sec(p.responseSeconds),
  };
}

export function taskFieldsToPayload(p) {
  if (!p.taskType) return {};
  const sec = (v) => (v == null || String(v).trim() === "" ? null : Number(v));
  return {
    taskType: p.taskType,
    requiredWords: p.requiredWords || [],
    audioId: p.audioId || null,
    audioPlays: Number(p.audioPlays) || 1,
    prepSeconds: sec(p.prepSeconds),
    responseSeconds: sec(p.responseSeconds),
  };
}

export function testToBuilder(t) {
  const ts = t.skills || {};
  const qSkill = (raw) => ({
    instructions: (raw && raw.instructions) || "",
    durationMinutes: raw && raw.durationMinutes != null ? String(raw.durationMinutes) : "",
    sections: sectionsToEditor((raw && raw.sections) || []),
  });
  const pSkill = (raw) => ({
    instructions: (raw && raw.instructions) || "",
    durationMinutes: raw && raw.durationMinutes != null ? String(raw.durationMinutes) : "",
    prompts: ((raw && raw.prompts) || []).map((p) => ({
      _id: p._id,
      title: p.title || "",
      instructions: p.instructions || "",
      imageId: refId(p.imageId),
      writingTask: p.writingTask || "task2",
      ...taskFieldsToBuilder(p),
    })),
  });
  return {
    title: t.title || "",
    unit: t.unit || "",
    level: t.level || 1,
    program: t.program || null,
    classIds: (t.classIds || []).map((x) => String(x && x._id ? x._id : x)),
    opensAt: toDatetimeLocal(t.opensAt),
    closesAt: toDatetimeLocal(t.closesAt),
    skills: {
      listening: qSkill(ts.listening),
      reading: qSkill(ts.reading),
      writing: pSkill(ts.writing),
      speaking: pSkill(ts.speaking),
    },
  };
}

export function builderToPayload(b) {
  const dur = (v) => (String(v).trim() === "" ? null : Number(v));
  // Kỹ năng ngoài testSkills của chương trình gửi rỗng (hiện cả IELTS lẫn TOEIC đều có đủ 4
  // kỹ năng; giữ nhánh này cho chương trình sau này có ít kỹ năng hơn).
  const allowed = PROGRAMS[programOf(b)].testSkills;
  const qSkill = (s, key) =>
    allowed.includes(key)
      ? {
          durationMinutes: dur(s.durationMinutes),
          instructions: s.instructions || "",
          sections: sectionsToPayload(s.sections, key),
        }
      : { durationMinutes: null, instructions: "", sections: [] };
  const pSkill = (s, key) =>
    !allowed.includes(key)
      ? { durationMinutes: null, instructions: "", prompts: [] }
      : {
    durationMinutes: dur(s.durationMinutes),
    instructions: s.instructions || "",
    prompts: s.prompts.map((p) => ({
      _id: p._id,
      title: p.title,
      instructions: p.instructions,
      imageId: p.imageId || null,
      writingTask: p.writingTask || "task2",
      ...taskFieldsToPayload(p),
    })),
  };
  return {
    title: b.title.trim(),
    unit: b.unit.trim(),
    level: Number(b.level) || 1,
    classIds: b.classIds || [],
    opensAt: b.opensAt ? new Date(b.opensAt).toISOString() : null,
    closesAt: b.closesAt ? new Date(b.closesAt).toISOString() : null,
    skills: {
      listening: qSkill(b.skills.listening, "listening"),
      reading: qSkill(b.skills.reading, "reading"),
      writing: pSkill(b.skills.writing, "writing"),
      speaking: pSkill(b.skills.speaking, "speaking"),
    },
  };
}

export function skillHasContent(b, key) {
  const s = b.skills[key];
  return key === "listening" || key === "reading" ? s.sections.length > 0 : s.prompts.length > 0;
}
