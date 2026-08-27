import { sectionsToEditor, sectionsToPayload, refId } from "./sectionTransforms";

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

export function emptyBuilder() {
  return {
    title: "",
    unit: "",
    level: 1,
    classIds: [],
    opensAt: "",
    closesAt: "",
    skills: {
      listening: { instructions: "", durationMinutes: "", sections: [] },
      reading: { instructions: "", durationMinutes: "", sections: [] },
      writing: { instructions: "", durationMinutes: "", prompts: [] },
      speaking: { instructions: "", durationMinutes: "", prompts: [] },
    },
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
    })),
  });
  return {
    title: t.title || "",
    unit: t.unit || "",
    level: t.level || 1,
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
  const qSkill = (s, key) => ({
    durationMinutes: dur(s.durationMinutes),
    instructions: s.instructions || "",
    sections: sectionsToPayload(s.sections, key),
  });
  const pSkill = (s) => ({
    durationMinutes: dur(s.durationMinutes),
    instructions: s.instructions || "",
    prompts: s.prompts.map((p) => ({
      _id: p._id,
      title: p.title,
      instructions: p.instructions,
      imageId: p.imageId || null,
      writingTask: p.writingTask || "task2",
    })),
  });
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
      writing: pSkill(b.skills.writing),
      speaking: pSkill(b.skills.speaking),
    },
  };
}

export function skillHasContent(b, key) {
  const s = b.skills[key];
  return key === "listening" || key === "reading" ? s.sections.length > 0 : s.prompts.length > 0;
}
