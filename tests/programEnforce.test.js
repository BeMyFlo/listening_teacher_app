// Phase 8 bước 2 — logic thuần của "server enforce" (không DB):
// đếm hoàn thành theo kỹ năng của chương trình, parse ?program=, khoá đổi chương trình.
const test = require("node:test");
const assert = require("node:assert/strict");

const { parseProgramParam, PROGRAMS } = require("../lib/curriculum");
const {
  countCategoryItems,
  countUnitItems,
  isScopeComplete,
  lessonSkillsOf,
} = require("../lib/completion");
const { distinctDeadlines } = require("../lib/deadlines");
const { latestDeadline } = require("../lib/student/streak");
const {
  programLockReason,
  isProgramLocked,
  assertProgramChangeable,
  resolveProgramChange,
  referencedClassIds,
  activeProgramsByWorkspace,
} = require("../lib/curriculumServer");

// ---------------------------------------------------------------- completion

const ex = (id) => ({ _id: id });
function makeUnit(program) {
  const u = {
    _id: "u1",
    categories: [
      { key: "grammar", topics: [{ exercises: [ex("g1")] }] },
      { key: "vocabulary", groups: [{ exercises: [ex("v1")] }] },
      { key: "listening", exercises: [ex("l1")] },
      { key: "reading", exercises: [ex("r1")] },
      { key: "writing", prompts: [{ _id: "w1" }, { _id: "w2" }] },
      { key: "speaking", prompts: [{ _id: "s1" }] },
    ],
  };
  if (program !== undefined) u.program = program;
  return u;
}

test("completion: IELTS đếm đủ 6 kỹ năng (4 bài tập + 3 prompt = 7)", () => {
  const u = makeUnit("ielts");
  assert.equal(countUnitItems(u), 7);
  assert.equal(countCategoryItems(u.categories[4], u), 2);
  assert.equal(countCategoryItems(u.categories[4]), 2); // không truyền unit -> như cũ
});

test("completion: Unit cũ thiếu program tính như IELTS", () => {
  const u = makeUnit(undefined);
  assert.equal(countUnitItems(u), 7);
  assert.deepEqual(lessonSkillsOf(u), ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"]);
});

// Từ 8B cả IELTS lẫn TOEIC đều có đủ 6 kỹ năng, nên các test về "kỹ năng bị ẩn" giả lập
// một chương trình ẩn Writing/Speaking bằng cách tạm sửa registry (luôn khôi phục).
function withHiddenWritingSpeaking(fn) {
  const saved = PROGRAMS.toeic.lessonSkills;
  PROGRAMS.toeic.lessonSkills = saved.filter((k) => k !== "writing" && k !== "speaking");
  try {
    return fn();
  } finally {
    PROGRAMS.toeic.lessonSkills = saved;
  }
}

test("completion: Unit TOEIC (8B) đếm đủ 6 kỹ năng như IELTS", () => {
  const u = makeUnit("toeic");
  assert.equal(countUnitItems(u), 7);
  assert.equal(countCategoryItems(u.categories[4], u), 2);
  assert.equal(countCategoryItems(u.categories[5], u), 1);
});

test("completion: kỹ năng ẩn của chương trình không được đếm", () => withHiddenWritingSpeaking(() => {
  const u = makeUnit("toeic");
  assert.equal(countUnitItems(u), 4);
  assert.equal(countCategoryItems(u.categories[4], u), 0); // writing bị ẩn
  assert.equal(countCategoryItems(u.categories[5], u), 0); // speaking bị ẩn
  assert.equal(countCategoryItems(u.categories[2], u), 1); // listening vẫn đếm
}));

test("isScopeComplete: TOEIC cần cả prompt Writing/Speaking mới xong Unit (8B)", () => {
  const u = makeUnit("toeic");
  const four = [
    { kind: "exercise", exerciseId: "g1", categoryKey: "grammar" },
    { kind: "exercise", exerciseId: "v1", categoryKey: "vocabulary" },
    { kind: "exercise", exerciseId: "l1", categoryKey: "listening" },
    { kind: "exercise", exerciseId: "r1", categoryKey: "reading" },
  ];
  assert.equal(isScopeComplete(u, null, four), false);
  assert.equal(isScopeComplete(u, "writing", []), false);
});

test("isScopeComplete: kỹ năng ẩn - làm xong các kỹ năng còn lại là xong cả Unit (dù còn prompt ẩn)", () => withHiddenWritingSpeaking(() => {
  const u = makeUnit("toeic");
  const subs = [
    { kind: "exercise", exerciseId: "g1", categoryKey: "grammar" },
    { kind: "exercise", exerciseId: "v1", categoryKey: "vocabulary" },
    { kind: "exercise", exerciseId: "l1", categoryKey: "listening" },
    { kind: "exercise", exerciseId: "r1", categoryKey: "reading" },
  ];
  assert.equal(isScopeComplete(u, null, subs), true);
  // Cùng dữ liệu với Unit IELTS thì chưa xong (còn 3 prompt).
  assert.equal(isScopeComplete(makeUnit("ielts"), null, subs), false);
}));

test("isScopeComplete: bài nộp thuộc kỹ năng ẩn không cộng vào tiến độ", () => withHiddenWritingSpeaking(() => {
  const u = makeUnit("toeic");
  const subs = [
    { kind: "exercise", exerciseId: "g1", categoryKey: "grammar" },
    { kind: "writing", promptId: "w1", categoryKey: "writing" },
    { kind: "writing", promptId: "w2", categoryKey: "writing" },
    { kind: "speaking", promptId: "s1", categoryKey: "speaking" },
  ];
  // 4 bài nộp nhưng chỉ 1 thuộc kỹ năng hiện -> chưa đủ 4.
  assert.equal(isScopeComplete(u, null, subs), false);
}));

test("isScopeComplete: phạm vi 1 kỹ năng ẩn luôn xong (total = 0)", () => withHiddenWritingSpeaking(() => {
  const u = makeUnit("toeic");
  assert.equal(isScopeComplete(u, "writing", []), true);
  assert.equal(isScopeComplete(u, "speaking", []), true);
  assert.equal(isScopeComplete(u, "listening", []), false);
  assert.equal(isScopeComplete(u, "listening", [{ kind: "exercise", exerciseId: "l1", categoryKey: "listening" }]), true);
}));

test("isScopeComplete: IELTS không đổi (phạm vi writing vẫn cần nộp prompt)", () => {
  const u = makeUnit("ielts");
  assert.equal(isScopeComplete(u, "writing", []), false);
  const subs = [
    { kind: "writing", promptId: "w1", categoryKey: "writing" },
    { kind: "writing", promptId: "w2", categoryKey: "writing" },
  ];
  assert.equal(isScopeComplete(u, "writing", subs), true);
});

test("distinctDeadlines: bỏ mốc hạn của kỹ năng ẩn, IELTS giữ nguyên", () => withHiddenWritingSpeaking(() => {
  const due = new Date("2030-01-01T00:00:00Z");
  const dls = [
    { classId: "c1", categoryKey: null, dueAt: due },
    { classId: "c1", categoryKey: "listening", dueAt: due },
    { classId: "c1", categoryKey: "writing", dueAt: due },
  ];
  const toeic = distinctDeadlines({ program: "toeic", deadlines: dls }, "c1");
  assert.deepEqual(toeic.map((d) => d.categoryKey), [null, "listening"]);
  const ielts = distinctDeadlines({ program: "ielts", deadlines: dls }, "c1");
  assert.deepEqual(ielts.map((d) => d.categoryKey), [null, "listening", "writing"]);
  const legacy = distinctDeadlines({ deadlines: dls }, "c1");
  assert.equal(legacy.length, 3);
}));

test("distinctDeadlines: TOEIC (8B) giữ mốc hạn Writing", () => {
  const due = new Date("2030-01-01T00:00:00Z");
  const dls = [{ classId: "c1", categoryKey: "writing", dueAt: due }];
  assert.deepEqual(distinctDeadlines({ program: "toeic", deadlines: dls }, "c1").map((d) => d.categoryKey), ["writing"]);
});

test("streak.latestDeadline: hạn kỹ năng ẩn không được tính", () => withHiddenWritingSpeaking(() => {
  const early = new Date("2030-01-01T00:00:00Z");
  const late = new Date("2030-06-01T00:00:00Z");
  const dls = [
    { classId: "c1", categoryKey: null, dueAt: early },
    { classId: "c1", categoryKey: "writing", dueAt: late },
  ];
  assert.equal(latestDeadline({ program: "toeic", deadlines: dls }, "c1"), +early);
  assert.equal(latestDeadline({ program: "ielts", deadlines: dls }, "c1"), +late);
}));

test("streak.latestDeadline: TOEIC (8B) tính hạn Writing", () => {
  const early = new Date("2030-01-01T00:00:00Z");
  const late = new Date("2030-06-01T00:00:00Z");
  const dls = [
    { classId: "c1", categoryKey: null, dueAt: early },
    { classId: "c1", categoryKey: "writing", dueAt: late },
  ];
  assert.equal(latestDeadline({ program: "toeic", deadlines: dls }, "c1"), +late);
});

// ----------------------------------------------------------- parseProgramParam

test("parseProgramParam: trống / all / thiếu = không lọc", () => {
  for (const v of [undefined, null, "", "  ", "all"]) {
    assert.deepEqual(parseProgramParam(v), { program: null }, String(v));
  }
});

test("parseProgramParam: program hợp lệ", () => {
  assert.deepEqual(parseProgramParam("ielts"), { program: "ielts" });
  assert.deepEqual(parseProgramParam("toeic"), { program: "toeic" });
  assert.deepEqual(parseProgramParam("general"), { program: "general" });
});

test("parseProgramParam: sai -> error (route trả 400)", () => {
  for (const v of ["abc", "IELTS", "All", "constructor", ["ielts", "toeic"], ["ielts"]]) {
    const r = parseProgramParam(v);
    assert.equal(r.program, null);
    assert.ok(r.error, String(v));
  }
});

// ------------------------------------------------------------------ lock helper

const WS = { workspaceId: "ws1", role: "owner" };

// Model giả: exists(filter) ghi lại filter và trả theo hàm `hit`.
function fakeExists(hit, calls) {
  return {
    async exists(filter) {
      calls.push(filter);
      return hit(filter) ? { _id: "x" } : null;
    },
  };
}
function stubs({ unitHit = () => false, testHit = () => false, subHit = () => false } = {}) {
  const calls = { Unit: [], Test: [], Submission: [] };
  return {
    calls,
    models: {
      Unit: fakeExists(unitHit, calls.Unit),
      Test: fakeExists(testHit, calls.Test),
      Submission: fakeExists(subHit, calls.Submission),
    },
  };
}

test("lock lớp: có Unit nhắc tới lớp -> khoá; truy vấn tenant-scoped và đủ 3 chỗ tham chiếu", async () => {
  const s = stubs({ unitHit: () => true });
  const reason = await programLockReason(WS, "class", { _id: "c1" }, s.models);
  assert.match(reason, /already has lessons or tests assigned/);
  const f = s.calls.Unit[0];
  assert.equal(f.workspaceId, "ws1");
  assert.deepEqual(f.$or, [{ classIds: "c1" }, { "deadlines.classId": "c1" }, { "skillLocks.classId": "c1" }]);
});

test("lock lớp: chỉ Test nhắc tới lớp -> vẫn khoá", async () => {
  const s = stubs({ testHit: () => true });
  assert.ok(await isProgramLocked(WS, "class", { _id: "c1" }, s.models));
  assert.equal(s.calls.Test[0].workspaceId, "ws1");
  assert.equal(s.calls.Test[0].classIds, "c1");
});

test("lock lớp: không ai nhắc tới -> đổi được", async () => {
  const s = stubs();
  assert.equal(await programLockReason(WS, "class", { _id: "c1" }, s.models), null);
  assert.equal(await isProgramLocked(WS, "class", { _id: "c1" }, s.models), false);
});

test("lock unit: có classIds / deadlines / skillLocks -> khoá, không cần hỏi DB", async () => {
  for (const doc of [
    { _id: "u1", classIds: ["c1"] },
    { _id: "u1", deadlines: [{ classId: "c1" }] },
    { _id: "u1", skillLocks: [{ classId: "c1", categoryKey: "writing" }] },
  ]) {
    const s = stubs();
    assert.ok(await programLockReason(WS, "unit", doc, s.models));
    assert.equal(s.calls.Submission.length, 0);
  }
});

test("lock unit: đã có bài nộp -> khoá (tra Submission.unitId trong workspace)", async () => {
  const s = stubs({ subHit: () => true });
  const reason = await programLockReason(WS, "unit", { _id: "u1", classIds: [], deadlines: [], skillLocks: [] }, s.models);
  assert.match(reason, /assigned to a class or has submissions/);
  assert.equal(s.calls.Submission[0].workspaceId, "ws1");
  assert.equal(s.calls.Submission[0].unitId, "u1");
});

test("lock test: tra Submission.testId; sạch -> đổi được", async () => {
  const hit = stubs({ subHit: () => true });
  assert.ok(await programLockReason(WS, "test", { _id: "t1", classIds: [] }, hit.models));
  assert.equal(hit.calls.Submission[0].testId, "t1");

  const clean = stubs();
  assert.equal(await programLockReason(WS, "test", { _id: "t1", classIds: [] }, clean.models), null);
  assert.ok(await programLockReason(WS, "test", { _id: "t1", classIds: ["c1"] }, clean.models));
});

test("assertProgramChangeable: ném lỗi 409 khi khoá, im lặng khi sạch", async () => {
  await assert.rejects(
    assertProgramChangeable(WS, "unit", { _id: "u1", classIds: ["c1"] }, stubs().models),
    (e) => e.statusCode === 409 && /can't be changed/.test(e.message)
  );
  await assertProgramChangeable(WS, "unit", { _id: "u1", classIds: [] }, stubs().models);
});

test("lock: kind lạ bị từ chối", async () => {
  await assert.rejects(programLockReason(WS, "student", { _id: "x" }, stubs().models));
});

// ------------------------------------------------------- resolveProgramChange

test("resolveProgramChange: không gửi program hoặc gửi lại đúng program cũ -> không phải đổi, không hỏi DB", async () => {
  const s = stubs({ unitHit: () => true, subHit: () => true });
  const cls = { _id: "c1", program: "toeic" };
  assert.deepEqual(await resolveProgramChange(WS, "class", cls, undefined, s.models), { changed: false });
  assert.deepEqual(await resolveProgramChange(WS, "class", cls, null, s.models), { changed: false });
  assert.deepEqual(await resolveProgramChange(WS, "class", cls, "toeic", s.models), { changed: false });
  // Doc cũ thiếu field = IELTS -> gửi "ielts" cũng không phải đổi (dù đang bị khoá).
  assert.deepEqual(await resolveProgramChange(WS, "class", { _id: "c2" }, "ielts", s.models), { changed: false });
  assert.equal(s.calls.Unit.length + s.calls.Test.length + s.calls.Submission.length, 0);
});

test("resolveProgramChange: program lạ -> 400", async () => {
  const r = await resolveProgramChange(WS, "class", { _id: "c1" }, "abc", stubs().models);
  assert.equal(r.status, 400);
  assert.equal(r.changed, false);
});

test("resolveProgramChange: đổi thật khi bị khoá -> 409 kèm lý do; sạch -> changed", async () => {
  const locked = await resolveProgramChange(WS, "class", { _id: "c1", program: "ielts" }, "toeic", stubs({ unitHit: () => true }).models);
  assert.equal(locked.status, 409);
  assert.match(locked.error, /already has lessons or tests assigned/);
  assert.equal(locked.changed, false);

  const ok = await resolveProgramChange(WS, "class", { _id: "c1", program: "ielts" }, "toeic", stubs().models);
  assert.deepEqual(ok, { changed: true });

  const unitWithSub = await resolveProgramChange(
    WS, "unit", { _id: "u1", classIds: [] }, "toeic", stubs({ subHit: () => true }).models
  );
  assert.equal(unitWithSub.status, 409);
});

// ---------------------------------------------- referencedClassIds / theo workspace

test("referencedClassIds: gom lớp từ classIds, deadlines, skillLocks của Unit và classIds của Test", async () => {
  const filters = [];
  const find = (rows) => ({
    find(filter) {
      filters.push(filter);
      return { select: () => ({ lean: async () => rows }) };
    },
  });
  const set = await referencedClassIds(WS, {
    Unit: find([
      { classIds: ["a"], deadlines: [{ classId: "b" }], skillLocks: [{ classId: "c" }] },
      { classIds: [] },
    ]),
    Test: find([{ classIds: ["d"] }, {}]),
  });
  assert.deepEqual([...set].sort(), ["a", "b", "c", "d"]);
  for (const f of filters) assert.equal(f.workspaceId, "ws1");
});

test("activeProgramsByWorkspace: gom (workspace, program) từ 3 collection, null = ielts", async () => {
  const agg = (rows) => ({ aggregate: async () => rows });
  const r = await activeProgramsByWorkspace([
    agg([{ _id: { w: "w1", p: "toeic" } }, { _id: { w: "w2", p: null } }]),
    agg([{ _id: { w: "w1", p: null } }]),
    agg([]),
  ]);
  assert.deepEqual(r, { w1: ["ielts", "toeic"], w2: ["ielts"] });
});

// ----------------------------------------- Phase 12 G0: levelAllowed ở route admin

const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const ClassModel = require("../lib/models/Class");
const UnitModel = require("../lib/models/Unit");
const TestModel = require("../lib/models/Test");
const SubmissionModel = require("../lib/models/Submission");
const AuditLog = require("../lib/models/AuditLog");
const classesRoute = require("../pages/api/admin/classes");
const unitsRoute = require("../pages/api/admin/units");
const testsRoute = require("../pages/api/admin/tests");

async function callAdminRoute(route, { method, query = {}, body = {}, docs = {} }) {
  const prevSecret = process.env.JWT_SECRET;
  const prevConn = global._mongooseConn.conn;
  process.env.JWT_SECRET = "test-secret-g0";
  global._mongooseConn.conn = {};

  const orig = {
    wmFindOne: WorkspaceMember.findOne,
    wsFindById: Workspace.findById,
    cCreate: ClassModel.create,
    cFindOne: ClassModel.findOne,
    uCreate: UnitModel.create,
    uFindOne: UnitModel.findOne,
    uExists: UnitModel.exists,
    tCreate: TestModel.create,
    tFindOne: TestModel.findOne,
    tExists: TestModel.exists,
    sExists: SubmissionModel.exists,
    aCreate: AuditLog.create,
  };

  WorkspaceMember.findOne = () => ({ select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "owner" }) }) });
  Workspace.findById = () => ({ select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }) });
  ClassModel.create = async (d) => ({ _id: "c-new", ...d });
  ClassModel.findOne = async () => docs.cls || null;
  UnitModel.create = async (d) => ({ _id: "u-new", ...d });
  UnitModel.findOne = async () => docs.unit || null;
  UnitModel.exists = async () => null;
  TestModel.create = async (d) => ({ _id: "t-new", ...d });
  TestModel.findOne = async () => docs.test || null;
  TestModel.exists = async () => null;
  SubmissionModel.exists = async () => null;
  AuditLog.create = async () => ({});
  clearTenantCache();

  const token = signUserToken({ _id: "u1", role: "teacher", name: "T" });
  const req = {
    method,
    query,
    body,
    headers: { authorization: "Bearer " + token },
    url: "/api/admin/test",
  };
  let statusCode = 200;
  let payload = null;
  const res = {
    statusCode: 200,
    setHeader() {},
    status(c) {
      statusCode = c;
      this.statusCode = c;
      return this;
    },
    json(p) {
      payload = p;
      return this;
    },
  };

  try {
    await route(req, res);
    return { status: statusCode, body: payload };
  } finally {
    WorkspaceMember.findOne = orig.wmFindOne;
    Workspace.findById = orig.wsFindById;
    ClassModel.create = orig.cCreate;
    ClassModel.findOne = orig.cFindOne;
    UnitModel.create = orig.uCreate;
    UnitModel.findOne = orig.uFindOne;
    UnitModel.exists = orig.uExists;
    TestModel.create = orig.tCreate;
    TestModel.findOne = orig.tFindOne;
    TestModel.exists = orig.tExists;
    SubmissionModel.exists = orig.sExists;
    AuditLog.create = orig.aCreate;
    clearTenantCache();
    global._mongooseConn.conn = prevConn;
    if (prevSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prevSecret;
  }
}

test("POST tạo lớp / unit / test: general level 7 -> OK; level 3 -> 400; ielts level 3 -> OK", async () => {
  // Class
  const cOk = await callAdminRoute(classesRoute, {
    method: "POST",
    body: { name: "7A", program: "general", level: 7 },
  });
  assert.equal(cOk.status, 201);
  assert.equal(cOk.body.class.program, "general");
  assert.equal(cOk.body.class.level, 7);

  const cBad = await callAdminRoute(classesRoute, {
    method: "POST",
    body: { name: "3A", program: "general", level: 3 },
  });
  assert.equal(cBad.status, 400);
  assert.equal(cBad.body.error, "Choose a grade from 6 to 12.");

  const cIelts = await callAdminRoute(classesRoute, {
    method: "POST",
    body: { name: "IELTS 3", program: "ielts", level: 3 },
  });
  assert.equal(cIelts.status, 201);
  assert.equal(cIelts.body.class.level, 3);

  const cIeltsBad = await callAdminRoute(classesRoute, {
    method: "POST",
    body: { name: "IELTS 0", program: "ielts", level: 0 },
  });
  assert.equal(cIeltsBad.status, 400);
  assert.equal(cIeltsBad.body.error, "Please select a valid level");

  // Unit
  const uOk = await callAdminRoute(unitsRoute, {
    method: "POST",
    body: { name: "Unit 1", program: "general", level: 7 },
  });
  assert.equal(uOk.status, 201);
  assert.equal(uOk.body.unit.program, "general");
  assert.equal(uOk.body.unit.level, 7);

  const uBad = await callAdminRoute(unitsRoute, {
    method: "POST",
    body: { name: "Unit 1", program: "general", level: 3 },
  });
  assert.equal(uBad.status, 400);
  assert.equal(uBad.body.error, "Choose a grade from 6 to 12.");

  const uIelts = await callAdminRoute(unitsRoute, {
    method: "POST",
    body: { name: "Unit 1", program: "ielts", level: 3 },
  });
  assert.equal(uIelts.status, 201);

  // Test
  const tOk = await callAdminRoute(testsRoute, {
    method: "POST",
    body: { title: "Midterm 7", program: "general", level: 7 },
  });
  assert.equal(tOk.status, 201);
  assert.equal(tOk.body.test.program, "general");
  assert.equal(tOk.body.test.level, 7);

  const tBad = await callAdminRoute(testsRoute, {
    method: "POST",
    body: { title: "Midterm 3", program: "general", level: 3 },
  });
  assert.equal(tBad.status, 400);
  assert.equal(tBad.body.error, "Choose a grade from 6 to 12.");

  const tIelts = await callAdminRoute(testsRoute, {
    method: "POST",
    body: { title: "Mock 3", program: "ielts", level: 3 },
  });
  assert.equal(tIelts.status, 201);
});

test("PUT đổi program từ ielts level 1 sang general mà không kèm grade 6..12 -> 400; kèm grade 7 -> 200", async () => {
  const clsDoc = () => ({ _id: "c1", name: "C1", level: 1, program: "ielts", async save() {} });
  const cBad = await callAdminRoute(classesRoute, {
    method: "PUT",
    query: { id: "c1" },
    body: { program: "general" },
    docs: { cls: clsDoc() },
  });
  assert.equal(cBad.status, 400);
  assert.equal(cBad.body.error, "Choose a grade from 6 to 12.");

  const cOk = await callAdminRoute(classesRoute, {
    method: "PUT",
    query: { id: "c1" },
    body: { program: "general", level: 7 },
    docs: { cls: clsDoc() },
  });
  assert.equal(cOk.status, 200);
  assert.equal(cOk.body.class.program, "general");
  assert.equal(cOk.body.class.level, 7);

  const unitDoc = () => ({
    _id: "u1",
    name: "U1",
    level: 1,
    program: "ielts",
    status: "draft",
    classIds: [],
    deadlines: [],
    skillLocks: [],
    categories: [],
    async save() {},
  });
  const uBad = await callAdminRoute(unitsRoute, {
    method: "PUT",
    query: { id: "u1" },
    body: { program: "general" },
    docs: { unit: unitDoc() },
  });
  assert.equal(uBad.status, 400);
  assert.equal(uBad.body.error, "Choose a grade from 6 to 12.");

  const testDoc = () => ({
    _id: "t1",
    title: "T1",
    level: 1,
    program: "ielts",
    status: "draft",
    classIds: [],
    skills: {},
    async save() {},
  });
  const tBad = await callAdminRoute(testsRoute, {
    method: "PUT",
    query: { id: "t1" },
    body: { program: "general" },
    docs: { test: testDoc() },
  });
  assert.equal(tBad.status, 400);
  assert.equal(tBad.body.error, "Choose a grade from 6 to 12.");
});
