// Phase 12 G2 bước 2 — khuôn đề, kiểm câu dở, chặn publish ở server, fieldRangeLabel/partBreakdown.
const test = require("node:test");
const assert = require("node:assert/strict");

const { PROGRAMS } = require("../lib/curriculum");
const { GENERAL_LABELS } = require("../lib/generalFormats");
const {
  PASSAGE_PLACEHOLDER,
  TEMPLATES,
  templatesFor,
  resolveTemplate,
  incompleteQuestions,
} = require("../lib/generalTemplates");
const { fieldRangeLabel, partBreakdown } = require("../lib/partGroups");
const TestModel = require("../lib/models/Test");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

// ---------------------------------------------------------------- registry

test("registry: 4 key G2 chỉ bật cho General", () => {
  for (const k of ["ielts", "toeic"]) {
    assert.deepEqual(PROGRAMS[k].testTemplates, []);
    assert.equal(PROGRAMS[k].publishCheck, false);
    assert.equal(PROGRAMS[k].sectionRanges, false);
    assert.equal(PROGRAMS[k].partResults, false);
  }
  assert.deepEqual(PROGRAMS.general.testTemplates, ["thpt", "hcm10", "school"]);
  assert.equal(PROGRAMS.general.publishCheck, true);
  assert.equal(PROGRAMS.general.sectionRanges, true);
  assert.equal(PROGRAMS.general.partResults, true);
});

// ---------------------------------------------------------------- khuôn

const keyOfLabel = (label) => Object.keys(GENERAL_LABELS).find((k) => GENERAL_LABELS[k] === label);

test("khuôn: templatesFor theo registry", () => {
  assert.deepEqual(templatesFor("general").map((t) => t.key), ["thpt", "hcm10", "school"]);
  assert.deepEqual(templatesFor("ielts"), []);
  assert.deepEqual(templatesFor("toeic"), []);
  assert.deepEqual(templatesFor("nope"), []);
});

test("khuôn: mọi format key tồn tại trong GENERAL_LABELS", () => {
  for (const t of Object.values(TEMPLATES)) {
    for (const sk of Object.values(t.skills)) {
      for (const p of sk.parts) {
        for (const q of p.questions) {
          assert.ok(q.format.startsWith("g-"), q.format);
          assert.ok(GENERAL_LABELS[q.format.slice(2)], `${t.key}: ${q.format} not in GENERAL_LABELS`);
          assert.ok(Number.isInteger(q.count) && q.count > 0);
        }
      }
    }
  }
});

test("khuôn: THPT và HCM đúng 40 câu, thời lượng, phần có đoạn văn", () => {
  const thpt = resolveTemplate("thpt").template;
  assert.equal(thpt.totalQuestions, 40);
  assert.equal(thpt.skills.reading.durationMinutes, 50);
  assert.equal(thpt.skills.listening, undefined);
  assert.deepEqual(thpt.skills.reading.parts.map((p) => p.passage), [true, true, false, true, true, true]);
  assert.equal(thpt.skills.reading.parts[0].name, "Part 1 — Notice");

  const hcm = resolveTemplate("hcm10").template;
  assert.equal(hcm.totalQuestions, 40);
  assert.equal(hcm.skills.reading.durationMinutes, 90);
  assert.deepEqual(hcm.skills.reading.parts.map((p) => p.passage), [false, false, true, true, false, true, false]);
  assert.deepEqual(hcm.skills.reading.parts[0].questions, [
    { format: "g-pron", count: 2 },
    { format: "g-stress", count: 2 },
  ]);
});

test("khuôn: school có listening tuỳ chọn (includeListening)", () => {
  const without = resolveTemplate("school").template;
  assert.equal(without.skills.listening, undefined);
  assert.equal(without.totalQuestions, 28);
  const withL = resolveTemplate("school", { includeListening: true }).template;
  assert.equal(withL.skills.listening.durationMinutes, 15);
  assert.equal(withL.skills.reading.durationMinutes, 45);
  assert.equal(withL.totalQuestions, 38);
  // includeListening với khuôn không có listening -> bỏ qua.
  assert.equal(resolveTemplate("thpt", { includeListening: true }).template.skills.listening, undefined);
});

test("resolveTemplate: áp số câu, bỏ phần 0 câu, chặn số sai", () => {
  const r = resolveTemplate("thpt", { counts: { reading: [4, 0, 5] } }).template;
  assert.equal(r.skills.reading.parts.length, 5); // phần 2 bị bỏ
  assert.equal(r.skills.reading.parts[0].questions[0].count, 4);
  assert.equal(r.totalQuestions, 4 + 5 + 5 + 8 + 10);
  // mảng theo từng dạng cho phần trộn dạng
  const m = resolveTemplate("hcm10", { counts: { reading: [[1, 3]] } }).template;
  assert.deepEqual(m.skills.reading.parts[0].questions, [
    { format: "g-pron", count: 1 },
    { format: "g-stress", count: 3 },
  ]);

  for (const bad of [-1, 61, 1.5, "5", NaN]) {
    assert.ok(resolveTemplate("thpt", { counts: { reading: [bad] } }).error, String(bad));
  }
  // số đơn cho phần trộn dạng -> lỗi
  assert.ok(resolveTemplate("hcm10", { counts: { reading: [4] } }).error);
  // tổng 0 câu / > 100 câu / khuôn lạ
  assert.ok(resolveTemplate("thpt", { counts: { reading: [0, 0, 0, 0, 0, 0] } }).error);
  assert.ok(resolveTemplate("thpt", { counts: { reading: [60, 60] } }).error);
  assert.ok(resolveTemplate("nope").error);
  assert.ok(resolveTemplate("__proto__").error);
});

test("resolveTemplate: không sửa dữ liệu gốc", () => {
  resolveTemplate("thpt", { counts: { reading: [1, 1, 1, 1, 1, 1] } });
  assert.equal(TEMPLATES.thpt.skills.reading.parts[0].questions[0].count, 6);
});

// ---------------------------------------------------------------- incompleteQuestions

function choice(id, over = {}) {
  return {
    id, idEnd: null, formatLabel: GENERAL_LABELS.mcq, label: "Pick one", type: "choice", matchMode: "", tokens: [],
    options: [{ value: "a", label: "A1" }, { value: "b", label: "B1" }], answers: ["a"], score: 1, ...over,
  };
}
function fill(id, over = {}) {
  return {
    id, idEnd: null, formatLabel: GENERAL_LABELS.wform, label: "He is (happy)", type: "fill", matchMode: "sentence",
    tokens: [], options: [], answers: ["happy"], score: 1, ...over,
  };
}
const readingSkills = (sections) => ({ listening: { sections: [] }, reading: { sections } });
const sec = (fields, over = {}) => ({ name: "Part", passageText: "", imageId: undefined, fields, ...over });

test("incompleteQuestions: câu đủ -> rỗng; skills rỗng/undefined an toàn", () => {
  assert.deepEqual(incompleteQuestions(readingSkills([sec([choice(1), fill(2)])])), []);
  assert.deepEqual(incompleteQuestions(undefined), []);
  assert.deepEqual(incompleteQuestions({}), []);
});

test("incompleteQuestions: từng lý do một ca", () => {
  const reasons = (fields, over) => incompleteQuestions(readingSkills([sec(fields, over)])).map((x) => [x.fieldId, x.reason]);
  assert.deepEqual(reasons([choice(1, { answers: [] })]), [[1, "no correct answer"]]);
  assert.deepEqual(reasons([choice(1, { options: [{ value: "a", label: "A1" }, { value: "b", label: " " }] })]), [[1, "an option is empty"]]);
  assert.deepEqual(reasons([fill(1, { answers: ["", "  "] })]), [[1, "no correct answer"]]);
  assert.deepEqual(reasons([fill(1, { label: "  " })]), [[1, "the question text is empty"]]);
  const reorder = (over) => fill(1, { formatLabel: GENERAL_LABELS.reorder, label: "Put in order", tokens: ["a", "b", "c"], answers: ["a b c"], ...over });
  assert.deepEqual(reasons([reorder({})]), []);
  assert.deepEqual(reasons([reorder({ tokens: ["a"] })]), [[1, "needs at least 2 pieces"]]);
  assert.deepEqual(reasons([reorder({ tokens: [] })]), [[1, "needs at least 2 pieces"]]);
  assert.deepEqual(reasons([reorder({ answers: [] })]), [[1, "no correct answer"]]);
});

test("incompleteQuestions: pron/stress/cloze không cần label", () => {
  for (const key of ["pron", "stress", "cloze"]) {
    const f = choice(1, { formatLabel: GENERAL_LABELS[key], label: "" });
    assert.deepEqual(incompleteQuestions(readingSkills([sec([f], { passageText: "Passage" })])), [], key);
  }
  // dạng khác (g-mcq) label rỗng -> dở
  assert.equal(incompleteQuestions(readingSkills([sec([choice(1, { label: "" })])]))[0].reason, "the question text is empty");
});

test("incompleteQuestions: đoạn văn giữ chỗ chỉ báo 1 lần ở câu đầu của phần", () => {
  const cloze = (id) => choice(id, { formatLabel: GENERAL_LABELS.cloze, label: "" });
  const s1 = sec([cloze(1), cloze(2), cloze(3)], { passageText: ` ${PASSAGE_PLACEHOLDER} ` });
  const s2 = sec([cloze(4)], { passageText: "Real passage" });
  const out = incompleteQuestions(readingSkills([s1, s2]));
  assert.deepEqual(out, [{ skill: "reading", fieldId: 1, reason: "the passage is still empty" }]);
  // đoạn văn rỗng + có cloze + không có ảnh -> dở; có ảnh -> ổn
  assert.equal(incompleteQuestions(readingSkills([sec([cloze(1)])])).length, 1);
  assert.equal(incompleteQuestions(readingSkills([sec([cloze(1)], { imageId: "img1" })])).length, 0);
  // đoạn văn rỗng nhưng không có cloze -> không tự báo
  assert.equal(incompleteQuestions(readingSkills([sec([choice(1)])])).length, 0);
});

test("incompleteQuestions: câu vừa dở đoạn văn vừa dở đáp án -> 2 mục, đúng thứ tự câu", () => {
  const s = sec([choice(1, { answers: [] }), choice(2, { label: "" })], { passageText: PASSAGE_PLACEHOLDER });
  const out = incompleteQuestions({ listening: { sections: [sec([fill(9, { answers: [] })])] }, reading: { sections: [s] } });
  assert.deepEqual(out.map((x) => [x.skill, x.fieldId]), [["listening", 9], ["reading", 1], ["reading", 1], ["reading", 2]]);
});

test("incompleteQuestions: chạy được trên Mongoose document", () => {
  const doc = new TestModel({
    workspaceId: "507f1f77bcf86cd799439011",
    title: "T",
    level: 9,
    program: "general",
    skills: {
      reading: {
        sections: [{
          name: "P1",
          passageText: PASSAGE_PLACEHOLDER,
          fields: [
            { id: 1, type: "choice", formatLabel: GENERAL_LABELS.mcq, label: "Q", options: [{ value: "a", label: "A" }], answers: [] },
            { id: 2, type: "fill", formatLabel: GENERAL_LABELS.reorder, label: "Q", tokens: ["x"], answers: ["x y"] },
          ],
        }],
      },
    },
  });
  const out = incompleteQuestions(doc.skills);
  assert.deepEqual(out.map((x) => [x.fieldId, x.reason]), [
    [1, "the passage is still empty"],
    [1, "no correct answer"],
    [2, "needs at least 2 pieces"],
  ]);
});

// ---------------------------------------------------------------- fieldRangeLabel / partBreakdown

test("fieldRangeLabel: 1 câu, dải câu, idEnd, rỗng", () => {
  assert.equal(fieldRangeLabel([{ id: 5 }]), "Question 5");
  assert.equal(fieldRangeLabel([{ id: 1 }, { id: 2 }, { id: 4 }]), "Questions 1–4");
  assert.equal(fieldRangeLabel([{ id: 21, idEnd: 22 }]), "Questions 21–22");
  assert.equal(fieldRangeLabel([{ id: 3 }, { id: 4, idEnd: 6 }]), "Questions 3–6");
  assert.equal(fieldRangeLabel([{ id: 7, idEnd: 7 }]), "Question 7");
  assert.equal(fieldRangeLabel([]), "");
  assert.equal(fieldRangeLabel(undefined), "");
});

test("partBreakdown: đúng/sai theo phần, câu thiếu detail = sai, trọng số", () => {
  const sections = [
    { name: "Part 1", fields: [{ id: 1, score: 1 }, { id: 2, score: 1 }, { id: 3, score: 1 }] },
    { name: "", fields: [{ id: 4, idEnd: 5, score: 2 }] },
    { name: "Empty", fields: [] },
  ];
  const detail = {
    1: { correct: true, earned: 1 },
    2: { correct: false, earned: 0 },
    // 3 thiếu detail -> sai
    4: { correct: false, earned: 1 }, // đúng 1 phần
  };
  assert.deepEqual(partBreakdown(sections, detail), [
    { name: "Part 1", range: "Questions 1–3", correct: 1, total: 3, score: 1, maxScore: 3 },
    { name: "Part 2", range: "Questions 4–5", correct: 0, total: 1, score: 1, maxScore: 2 },
  ]);
  assert.deepEqual(partBreakdown(undefined, undefined), []);
});

// ---------------------------------------------------------------- server: pages/api/admin/tests.js

test("pages/api/admin/tests.js: templateKey + chặn publish đề General dở", async () => {
  const route = require("../pages/api/admin/tests");
  process.env.JWT_SECRET = "test-secret-g2-tests";
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};

  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;
  const origCreate = TestModel.create;
  const origFindOne = TestModel.findOne;
  WorkspaceMember.findOne = () => ({ select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }) });
  Workspace.findById = () => ({ select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }) });
  clearTenantCache();

  let created = null;
  TestModel.create = async (doc) => {
    created = doc;
    return { _id: "t-new", ...doc };
  };

  async function call({ method, query = {}, body = {}, doc = null }) {
    TestModel.findOne = async () => doc;
    const token = signUserToken({ _id: "u1", role: "teacher", name: "Teacher One" });
    const req = { method, query, body, headers: { authorization: "Bearer " + token }, url: "/api/admin/tests", ws: { workspaceId: "ws1" } };
    let status = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) { status = c; return this; },
      json(p) { payload = p; return this; },
    };
    await route(req, res);
    return { status, body: payload };
  }

  const emptySkill = (extra) => ({ durationMinutes: null, instructions: "", ...extra });
  const mkDoc = (program, reading) => {
    const d = {
      _id: "t1", workspaceId: "ws1", program, level: program === "general" ? 9 : 3, status: "draft",
      classIds: ["c1"], title: "T",
      skills: {
        listening: emptySkill({ sections: [] }),
        reading: emptySkill({ sections: reading }),
        writing: emptySkill({ prompts: [] }),
        speaking: emptySkill({ prompts: [] }),
      },
      markModified() {},
      async save() { return this; },
      toJSON() { return { ...this }; },
    };
    return d;
  };
  const unfinishedReading = [sec([choice(7, { answers: [] })], { name: "P1", passageText: "A passage" })];
  const finishedReading = [sec([choice(7)], { name: "P1", passageText: "A passage" })];

  try {
    // POST: templateKey hợp lệ -> lưu; lạ -> bỏ; IELTS gửi key General -> bỏ
    const readingBody = { sections: [{ name: "P1", passageText: "x", fields: [] }] };
    let r = await call({ method: "POST", body: { title: "T", level: 9, program: "general", templateKey: "thpt", skills: { reading: readingBody } } });
    assert.equal(r.status, 201);
    assert.equal(created.templateKey, "thpt");

    created = null;
    r = await call({ method: "POST", body: { title: "T", level: 9, program: "general", templateKey: "weird", skills: { reading: readingBody } } });
    assert.equal(r.status, 201);
    assert.ok(!("templateKey" in created));

    created = null;
    r = await call({ method: "POST", body: { title: "T", level: 3, program: "ielts", templateKey: "thpt", skills: { reading: readingBody } } });
    assert.equal(r.status, 201);
    assert.ok(!("templateKey" in created), "IELTS giữ payload cũ");

    // PUT không sửa được templateKey
    const keep = mkDoc("general", finishedReading);
    keep.templateKey = "thpt";
    r = await call({ method: "PUT", query: { id: "t1" }, body: { title: "T2", templateKey: "hcm10" }, doc: keep });
    assert.equal(r.status, 200);
    assert.equal(keep.templateKey, "thpt");

    // PUT publish General dở -> 400 kèm số câu; nháp không bị chặn
    const gen = mkDoc("general", unfinishedReading);
    r = await call({ method: "PUT", query: { id: "t1" }, body: { status: "published" }, doc: gen });
    assert.equal(r.status, 400);
    assert.equal(r.body.error, "Question 7 is not finished: no correct answer");
    assert.equal(gen.status, "draft");

    r = await call({ method: "PUT", query: { id: "t1" }, body: { status: "draft", title: "T3" }, doc: gen });
    assert.equal(r.status, 200);

    // Cùng request gửi skills mới: kiểm skills hiệu lực (mới, đã đủ) -> qua
    const gen2 = mkDoc("general", unfinishedReading);
    const fixedBody = {
      sections: [{
        name: "P1", passageText: "A passage",
        fields: [{ id: 7, type: "choice", formatLabel: GENERAL_LABELS.mcq, label: "Q", options: [{ value: "a", label: "A" }], answers: ["a"] }],
      }],
    };
    r = await call({ method: "PUT", query: { id: "t1" }, body: { status: "published", skills: { reading: fixedBody } }, doc: gen2 });
    assert.equal(r.status, 200);
    assert.equal(gen2.status, "published");

    // Ngược lại: DB đang đủ nhưng request gửi skills dở -> chặn
    const gen3 = mkDoc("general", finishedReading);
    const brokenBody = { sections: [{ ...fixedBody.sections[0], fields: [{ ...fixedBody.sections[0].fields[0], answers: [] }] }] };
    r = await call({ method: "PUT", query: { id: "t1" }, body: { status: "published", skills: { reading: brokenBody } }, doc: gen3 });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /^Question 7 is not finished/);
    assert.equal(gen3.status, "draft");

    // General đầy đủ -> publish được
    const ok = mkDoc("general", finishedReading);
    r = await call({ method: "PUT", query: { id: "t1" }, body: { status: "published" }, doc: ok });
    assert.equal(r.status, 200);
    assert.equal(ok.status, "published");

    // IELTS có câu thiếu đáp án vẫn publish như cũ
    const ielts = mkDoc("ielts", unfinishedReading);
    r = await call({ method: "PUT", query: { id: "t1" }, body: { status: "published" }, doc: ielts });
    assert.equal(r.status, 200);
    assert.equal(ielts.status, "published");
  } finally {
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    TestModel.create = origCreate;
    TestModel.findOne = origFindOne;
    clearTenantCache();
  }
});

test("incompleteQuestions: các dạng không có label vẫn coi là xong", () => {
  const { incompleteQuestions } = require("../lib/generalTemplates");
  const { GENERAL_LABELS: L } = require("../lib/generalFormats");
  const fill = (extra) => ({ id: 1, type: "fill", label: "", answers: ["x"], ...extra });
  const check = (f) => incompleteQuestions({ reading: { sections: [{ passageText: "A real passage.", fields: [f] }] } });
  assert.deepEqual(check(fill({ formatLabel: L.reorder, tokens: ["a", "b"] })), []);
  assert.deepEqual(check(fill({ formatLabel: L.ocloze })), []);
  assert.deepEqual(check(fill({ formatLabel: L.verb, post: "to school every day." })), []);
  assert.deepEqual(check(fill({ formatLabel: L.rewrite, pre: "I have" })), []);
  const sign = { id: 1, type: "choice", label: "", formatLabel: L.sign, options: [{ value: "a", label: "A" }], answers: ["a"] };
  assert.deepEqual(check({ ...sign, imageId: "abc" }), []);
  assert.equal(check(sign)[0].reason, "the question text is empty");
  assert.equal(check(fill({ formatLabel: L.verb }))[0].reason, "the question text is empty");
});
