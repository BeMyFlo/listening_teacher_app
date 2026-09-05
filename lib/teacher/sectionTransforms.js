// Chuyển đổi giữa dạng "editor" (kind-based, giáo viên chỉ tick/chọn) và
// shape API {type, options, answers, selectCount}. Port từ
// public/legacy/assets/teacher.js (fieldToServer / fieldFromServer /
// sectionsToEditor / sectionsPayloadFrom).

export const QUESTION_KIND_LABELS = {
  fill: "Fill in the blank",
  mcq: "Multiple choice (one or more)",
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
  matching: "Matching (uses answer bank)",
  labelling: "Label a diagram / map",
};

export const QUESTION_KINDS = Object.keys(QUESTION_KIND_LABELS);

let optSeq = 0;
export function newOptionId() {
  optSeq += 1;
  return "opt" + Date.now().toString(36) + optSeq;
}

export function tfngOptions() {
  return [
    { id: "true", text: "True" },
    { id: "false", text: "False" },
    { id: "ng", text: "Not Given" },
  ];
}
export function ynngOptions() {
  return [
    { id: "yes", text: "Yes" },
    { id: "no", text: "No" },
    { id: "ng", text: "Not Given" },
  ];
}
export function isFixedChoiceShape(options, ids) {
  return options.length === 3 && options.every((o) => ids.includes(o.id));
}

export function emptySection() {
  return { name: "", audioId: "", passageText: "", imageId: "", matchBank: [], noteMode: false, noteText: "", fields: [] };
}

export function emptyField(id) {
  return {
    id,
    label: "",
    kind: "fill",
    pre: "",
    post: "",
    hint: "",
    score: 1,
    answersText: "",
    options: [],
    correctOptionIds: [],
    matchingAnswerId: "",
    selectCount: 1,
    pinX: null,
    pinY: null,
  };
}

export function nextFieldId(sectionsArr) {
  const ids = sectionsArr.flatMap((s) => s.fields.map((f) => Number(f.id) || 0));
  return ids.length ? Math.max(...ids) + 1 : 1;
}

// ---------- editor -> API ----------
function fieldToServer(f) {
  const base = {
    id: Number(f.id),
    label: f.label,
    hint: f.hint || "",
    score: Math.max(1, Number(f.score) || 1),
  };
  if (f.kind === "fill") {
    return {
      ...base,
      type: "fill",
      pre: f.pre,
      post: f.post,
      selectCount: 1,
      options: [],
      // Chỉ tách theo DÒNG (đúng như label "one per line") — không tách theo
      // dấu phẩy nữa, vì nhiều đáp án hợp lệ tự nó có dấu phẩy (VD "$17,000").
      answers: String(f.answersText || "")
        .split(/\n/)
        .map((a) => a.trim())
        .filter(Boolean),
    };
  }
  if (f.kind === "matching" || f.kind === "labelling") {
    return {
      ...base,
      type: "choice",
      pre: "",
      post: "",
      selectCount: 1,
      options: [],
      answers: f.matchingAnswerId ? [f.matchingAnswerId] : [],
    };
  }
  // mcq / tfng / ynng
  const correct = (f.options || []).filter((o) => (f.correctOptionIds || []).includes(o.id));
  return {
    ...base,
    type: "choice",
    pre: "",
    post: "",
    selectCount: Math.max(1, correct.length),
    options: (f.options || []).map((o) => ({ value: o.id, label: o.text })),
    answers: correct.map((o) => o.id),
  };
}

export function sectionsToPayload(sectionsArr, subject) {
  return sectionsArr.map((sec) => ({
    name: sec.name,
    audioId: subject === "listening" ? sec.audioId || null : null,
    passageText: subject === "reading" ? sec.passageText : "",
    imageId: sec.imageId || null,
    matchOptions: (sec.matchBank || [])
      .filter((b) => (b.text || "").trim())
      .map((b) => ({ value: b.id, label: b.text.trim() })),
    labelPoints: (sec.fields || [])
      .filter((f) => f.kind === "labelling" && f.pinX != null && f.pinY != null)
      .map((f) => ({ fieldId: Number(f.id), x: f.pinX, y: f.pinY })),
    // Chỉ gửi noteText khi bật "Note completion layout" — tắt đi thì section
    // quay lại render kiểu hàng-riêng bình thường dù text chưa xoá hẳn.
    noteText: sec.noteMode ? sec.noteText || "" : "",
    fields: sec.fields.map(fieldToServer),
  }));
}

// ---------- API -> editor ----------
function refId(v) {
  return (v && typeof v === "object" ? v._id || v.id : v) || "";
}

function fieldFromServer(f, s) {
  const type = f.type || "fill";
  const score = f.score || 1;
  if (type === "fill") {
    return {
      id: f.id,
      label: f.label || "",
      kind: "fill",
      pre: f.pre || "",
      post: f.post || "",
      hint: f.hint || "",
      score,
      answersText: (f.answers || []).join("\n"),
      options: [],
      correctOptionIds: [],
      matchingAnswerId: "",
      selectCount: 1,
      pinX: null,
      pinY: null,
    };
  }
  const opts = f.options || [];
  if (opts.length === 0) {
    const lp = ((s && s.labelPoints) || []).find((p) => String(p.fieldId) === String(f.id));
    return {
      id: f.id,
      label: f.label || "",
      kind: lp ? "labelling" : "matching",
      pre: "",
      post: "",
      hint: f.hint || "",
      score,
      answersText: "",
      options: [],
      correctOptionIds: [],
      matchingAnswerId: (f.answers || [])[0] || "",
      selectCount: f.selectCount || 1,
      pinX: lp ? lp.x : null,
      pinY: lp ? lp.y : null,
    };
  }
  const valueSet = opts
    .map((o) => String(o.value || "").toLowerCase())
    .sort()
    .join(",");
  const kind =
    opts.length === 3 && valueSet === "false,ng,true"
      ? "tfng"
      : opts.length === 3 && valueSet === "ng,no,yes"
      ? "ynng"
      : "mcq";
  return {
    id: f.id,
    label: f.label || "",
    kind,
    pre: "",
    post: "",
    hint: f.hint || "",
    score,
    answersText: "",
    options: opts.map((o) => ({ id: o.value, text: o.label })),
    correctOptionIds: f.answers || [],
    matchingAnswerId: "",
    selectCount: f.selectCount || 1,
    pinX: null,
    pinY: null,
  };
}

export function sectionsToEditor(serverSections) {
  return (serverSections || []).map((s) => ({
    name: s.name || "",
    audioId: refId(s.audioId),
    passageText: s.passageText || "",
    imageId: refId(s.imageId),
    matchBank: (s.matchOptions || []).map((o) => ({ id: o.value, text: o.label })),
    noteMode: !!(s.noteText && s.noteText.trim()),
    noteText: s.noteText || "",
    fields: (s.fields || []).map((f) => fieldFromServer(f, s)),
  }));
}

export { refId };
