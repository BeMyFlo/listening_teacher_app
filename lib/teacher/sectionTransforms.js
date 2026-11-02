// Chuyển đổi giữa dạng "editor" (kind-based, giáo viên chỉ tick/chọn) và
// shape API {type, options, answers, selectCount}. Port từ
// public/legacy/assets/teacher.js (fieldToServer / fieldFromServer /
// sectionsToEditor / sectionsPayloadFrom).

import { GENERAL_LABELS } from "../generalFormats.js";
import { letterOptions } from "../letterQuestion.js";

export const QUESTION_KIND_LABELS = {
  fill: "Fill in the blank",
  mcq: "Multiple choice (one or more)",
  tfng: "True / False / Not Given",
  ynng: "Yes / No / Not Given",
  matching: "Matching (uses answer bank)",
  labelling: "Label a diagram / map",
  reorder: "Sentence building (reorder words)",
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

// Phần dùng chung khi gán dạng bài cho câu (thêm mới lẫn đổi Type): kind / formatLabel / matchMode.
// "letter" lưu như câu mcq. Hàm thuần, sửa trực tiếp `field`.
export function applyFormatBasics(field, fmt) {
  field.kind = fmt.kind === "letter" ? "mcq" : fmt.kind;
  field.formatLabel = fmt.label || "";
  field.matchMode = fmt.matchMode || "";
  if (fmt.kind === "reorder") field.matchMode = "sentence";
  return field;
}

// Gán dạng bài cho câu MỚI (emptyField): phần chung + tokens/lựa chọn dựng sẵn.
// Giống hệt addQuestionWithFormat cũ của SectionsEditor (noteMode / needsBank vẫn do section xử lý).
// Đổi Type của câu đã có (changeFormat) có logic "giữ lựa chọn cũ" riêng nên chỉ dùng applyFormatBasics.
export function applyFormat(field, fmt) {
  applyFormatBasics(field, fmt);
  if (fmt.kind === "reorder") field.tokens = [];
  if (fmt.kind === "tfng") field.options = tfngOptions();
  if (fmt.kind === "ynng") field.options = ynngOptions();
  if (fmt.kind === "letter") field.options = letterOptions(fmt.letterOptions).map((o) => ({ id: o.value, text: o.label }));
  if (fmt.presetOptions) field.options = fmt.presetOptions.map((text) => ({ id: newOptionId(), text }));
  return field;
}

export function emptySection() {
  return { name: "", audioId: "", passageText: "", transcript: "", imageId: "", matchBank: [], noteMode: false, noteBlocks: [], noteText: "", noteDoc: null, fields: [] };
}

export function emptyField(id) {
  return {
    id,
    idEnd: null,
    formatLabel: "",
    label: "",
    imageId: "", // ảnh riêng của câu (Phase 8, 5.4)
    kind: "fill",
    matchMode: "",
    tokens: [],
    pre: "",
    post: "",
    hint: "",
    explanation: "",
    score: 1,
    answersText: "",
    options: [],
    correctOptionIds: [],
    matchingAnswerId: "",
    selectCount: 1,
    pinX: null,
    pinY: null,
    topic: "", // nhãn ngân hàng câu hỏi (G4)
    difficulty: "",
  };
}

// `start`: số câu đầu tiên khi chưa có câu nào (mặc định 1). Mock Test TOEIC
// Reading gợi ý 101 để đánh số như đề thật (Phase 8, C9).
export function nextFieldId(sectionsArr, start = 1) {
  // Câu gộp nhiều số (idEnd) chiếm hết dải id..idEnd — số kế tiếp phải tính
  // theo idEnd (nếu có), không thì trùng số với chính câu gộp đó.
  const ids = sectionsArr.flatMap((s) =>
    s.fields.map((f) => Math.max(Number(f.id) || 0, Number(f.idEnd) || 0))
  );
  return ids.length ? Math.max(...ids) + 1 : start;
}

// ---------- editor -> API ----------
export function fieldToServer(f) {
  const base = {
    id: Number(f.id),
    idEnd: f.idEnd ? Number(f.idEnd) : null,
    formatLabel: f.formatLabel || "",
    label: f.label,
    // Chỉ gửi khi có ảnh -> payload câu không ảnh (mọi bài IELTS cũ) giữ nguyên.
    ...(f.imageId ? { imageId: f.imageId } : {}),
    // Chỉ gửi khi khác mặc định -> payload câu IELTS/TOEIC giữ nguyên như trước G1.
    ...(f.kind === "fill" && f.matchMode === "sentence" ? { matchMode: "sentence" } : {}),
    // Nhãn ngân hàng (G4): chỉ gửi khi có giá trị -> payload IELTS giữ nguyên.
    ...(f.topic ? { topic: f.topic } : {}),
    ...(f.difficulty ? { difficulty: f.difficulty } : {}),
    hint: f.hint || "",
    explanation: f.explanation || "",
    score: Math.max(1, Number(f.score) || 1),
  };
  if (f.kind === "reorder") {
    return {
      ...base,
      type: "fill",
      matchMode: "sentence",
      tokens: Array.isArray(f.tokens) ? f.tokens : [],
      pre: "",
      post: "",
      selectCount: 1,
      options: [],
      // Giáo viên hay gõ câu đúng kèm dấu "/" ngăn mảnh ("She / always / gets up") — bỏ "/" khỏi đáp án,
      // không thì câu học sinh ghép (nối bằng khoảng trắng) không bao giờ khớp.
      answers: String(f.answersText || "")
        .split(/\n/)
        .map((a) => a.replace(/\s*\/\s*/g, " ").replace(/\s+/g, " ").trim())
        .filter(Boolean),
    };
  }
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
    transcript: subject === "listening" ? sec.transcript || "" : "",
    imageId: sec.imageId || null,
    matchOptions: (sec.matchBank || [])
      .filter((b) => (b.text || "").trim())
      .map((b) => ({ value: b.id, label: b.text.trim() })),
    labelPoints: (sec.fields || [])
      .filter((f) => f.kind === "labelling" && f.pinX != null && f.pinY != null)
      .map((f) => ({ fieldId: Number(f.id), x: f.pinX, y: f.pinY })),
    // Chỉ gửi note* khi bật "Note completion layout" — tắt đi thì section
    // quay lại render kiểu hàng-riêng bình thường dù nội dung chưa xoá hẳn.
    // noteBlocks là nguồn chính (mỗi khối 1 khung soạn riêng); server gộp lại
    // thành noteDoc/noteText để chấm điểm + hiển thị học sinh. noteDoc/noteText
    // gửi kèm chỉ dùng cho section soạn kiểu cũ (chưa có khối nào).
    noteBlocks: sec.noteMode ? sec.noteBlocks || [] : [],
    noteText: sec.noteMode ? sec.noteText || "" : "",
    noteDoc: sec.noteMode && sec.noteDoc && sec.noteDoc.content ? sec.noteDoc : null,
    fields: sec.fields.map(fieldToServer),
  }));
}

// ---------- API -> editor ----------
function refId(v) {
  return (v && typeof v === "object" ? v._id || v.id : v) || "";
}

export function fieldFromServer(f, s) {
  const type = f.type || "fill";
  const score = f.score || 1;
  const matchMode = f.matchMode === "sentence" ? "sentence" : "";
  const tokens = Array.isArray(f.tokens) ? f.tokens : [];
  if (type === "fill") {
    // Khung đề mới có câu "Reorder" chưa có mảnh nào: nhận ra qua nhãn dạng bài để mở lại vẫn là kind reorder.
    const isReorder = tokens.length > 0 || f.formatLabel === GENERAL_LABELS.reorder;
    return {
      id: f.id,
      idEnd: f.idEnd || null,
      formatLabel: f.formatLabel || "",
      label: f.label || "",
      imageId: refId(f.imageId),
      kind: isReorder ? "reorder" : "fill",
      matchMode,
      tokens,
      pre: f.pre || "",
      post: f.post || "",
      hint: f.hint || "",
      explanation: f.explanation || "",
      score,
      answersText: (f.answers || []).join("\n"),
      options: [],
      correctOptionIds: [],
      matchingAnswerId: "",
      selectCount: 1,
      pinX: null,
      pinY: null,
      topic: f.topic || "",
      difficulty: f.difficulty || "",
    };
  }
  const opts = f.options || [];
  if (opts.length === 0) {
    const lp = ((s && s.labelPoints) || []).find((p) => String(p.fieldId) === String(f.id));
    return {
      id: f.id,
      idEnd: f.idEnd || null,
      formatLabel: f.formatLabel || "",
      label: f.label || "",
      imageId: refId(f.imageId),
      matchMode,
      tokens,
      kind: lp ? "labelling" : "matching",
      pre: "",
      post: "",
      hint: f.hint || "",
      explanation: f.explanation || "",
      score,
      answersText: "",
      options: [],
      correctOptionIds: [],
      matchingAnswerId: (f.answers || [])[0] || "",
      selectCount: f.selectCount || 1,
      pinX: lp ? lp.x : null,
      pinY: lp ? lp.y : null,
      topic: f.topic || "",
      difficulty: f.difficulty || "",
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
    idEnd: f.idEnd || null,
    formatLabel: f.formatLabel || "",
    label: f.label || "",
    imageId: refId(f.imageId),
    matchMode,
    tokens,
    kind,
    pre: "",
    post: "",
    hint: f.hint || "",
    explanation: f.explanation || "",
    score,
    answersText: "",
    options: opts.map((o) => ({ id: o.value, text: o.label })),
    correctOptionIds: f.answers || [],
    matchingAnswerId: "",
    selectCount: f.selectCount || 1,
    pinX: null,
    pinY: null,
    topic: f.topic || "",
    difficulty: f.difficulty || "",
  };
}

export function sectionsToEditor(serverSections) {
  return (serverSections || []).map((s) => ({
    name: s.name || "",
    audioId: refId(s.audioId),
    passageText: s.passageText || "",
    transcript: s.transcript || "",
    imageId: refId(s.imageId),
    matchBank: (s.matchOptions || []).map((o) => ({ id: o.value, text: o.label })),
    noteMode: !!(
      (s.noteBlocks && s.noteBlocks.length) ||
      (s.noteDoc && s.noteDoc.content && s.noteDoc.content.length) ||
      (s.noteText && s.noteText.trim())
    ),
    noteBlocks: Array.isArray(s.noteBlocks) ? s.noteBlocks : [],
    noteText: s.noteText || "",
    noteDoc: s.noteDoc && s.noteDoc.content ? s.noteDoc : null,
    fields: (s.fields || []).map((f) => fieldFromServer(f, s)),
  }));
}

// Gán imageId cho section và câu theo imageLinks và imageMap.
// Nếu ref nằm trong failedImageRefs: gắn cờ "Image could not be uploaded".
// Hàm thuần: không sửa mảng đầu vào.
export function applyImageLinks(sections, imageLinks = [], imageMap = {}, failedImageRefs = new Set()) {
  const failedSet = failedImageRefs instanceof Set ? failedImageRefs : new Set(failedImageRefs || []);
  const map = imageMap || {};
  return (sections || []).map((sec, si) => {
    const nextSec = { ...sec, fields: (sec.fields || []).map((f) => ({ ...f })) };
    const secLink = (imageLinks || []).find((l) => l.si === si && l.fi == null);
    if (secLink && map[secLink.ref]) {
      nextSec.imageId = String(map[secLink.ref]);
    }
    nextSec.fields.forEach((f, fi) => {
      const qLink = (imageLinks || []).find((l) => l.si === si && l.fi === fi);
      if (qLink) {
        if (failedSet.has(qLink.ref)) {
          f.aiFlag = f.aiFlag ? `${f.aiFlag}; Image could not be uploaded` : "Image could not be uploaded";
        } else if (map[qLink.ref]) {
          f.imageId = String(map[qLink.ref]);
        }
      }
    });
    return nextSec;
  });
}

// Helper nội bộ: chuyển server sections sang editor, bỏ section rỗng,
// đánh số tiếp từ curId và gán aiFlag theo flagFor(si, fi). Trả về { sections, nextId }.
function numberAndFlag(serverSections, curId, flagFor) {
  const valid = sectionsToEditor(serverSections || []).filter((s) => s.fields && s.fields.length > 0);
  valid.forEach((sec, si) => {
    sec.fields.forEach((f, fi) => {
      f.id = curId++;
      const flag = flagFor(si, fi);
      if (flag) f.aiFlag = flag;
    });
  });
  return { sections: valid, nextId: curId };
}

// Thêm section do AI soạn (topics có exerciseSections, flags [{fi, reason}], check.verified):
// đánh số tiếp từ nextFieldId, gán cờ vàng theo index câu, hoặc "Not verified" nếu check.verified === false.
// Hàm thuần: không sửa mảng đầu vào.
export function appendAiSections(sections, topics, firstId = 1) {
  let curId = nextFieldId(sections, firstId);
  const added = [];
  for (const topic of topics || []) {
    const tFlags = topic.flags || [];
    const res = numberAndFlag(topic.exerciseSections, curId, (_si, fi) => {
      const flagObj = tFlags.find((fl) => fl.fi === fi);
      if (flagObj) return flagObj.reason;
      if (topic.check && topic.check.verified === false) return "Not verified — check every answer";
      return "";
    });
    curId = res.nextId;
    added.push(...res.sections);
  }
  return [...sections, ...added];
}

// Thêm section import từ Word vào cuối danh sách:
// đánh số tiếp từ nextFieldId, gán cờ vàng theo flags [{si, fi, reason}],
// rồi gán imageId theo imageLinks/imageMap (cờ "Image could not be uploaded" nếu ref lỗi).
// Hàm thuần: không sửa mảng đầu vào.
export function appendImportedSections(
  sections,
  serverSections,
  { flags = [], imageLinks = [], imageMap = {}, failedImageRefs = new Set(), firstId = 1 } = {}
) {
  const res = numberAndFlag(serverSections, nextFieldId(sections, firstId), (si, fi) => {
    const flagObj = (flags || []).find((fl) => (fl.si == null || fl.si === si) && fl.fi === fi);
    return flagObj ? flagObj.reason : "";
  });
  const linked = applyImageLinks(res.sections, imageLinks, imageMap, failedImageRefs);
  return [...sections, ...linked];
}

export { refId };
