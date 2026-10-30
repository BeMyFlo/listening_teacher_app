// Phase 12 G4 bước 2: lọc menu theo chương trình, đổi phần của builder / import Word thành mục ngân hàng,
// sửa nhãn nhiều mục (tenant). Hàm thuần + route với model giả.
const test = require("node:test");
const assert = require("node:assert/strict");

const { NAV, visibleNavGroups } = require("../lib/nav");
const { PROGRAMS } = require("../lib/curriculum");
const { GENERAL_LABELS } = require("../lib/generalFormats");
const { PASSAGE_PLACEHOLDER } = require("../lib/generalTemplates");
const { emptyField, emptySection } = require("../lib/teacher/sectionTransforms");
const {
  sectionBankInfo,
  sectionToBankItems,
  importedSectionsToBankItems,
  formatKeyOf,
  chunkItems,
  offsetItemError,
} = require("../lib/teacher/sectionToBankItems");
const { buildItem } = require("../lib/questionBank");

// ---------------------------------------------------------------- menu

const hrefs = (groups) => groups.map((g) => g.items.map((i) => i.href));
const BANK_HREF = "/teacher/question-bank";

test("menu: chỉ IELTS / TOEIC thấy đúng menu cũ (không có Question Bank)", () => {
  const today = [
    ["/teacher/overview"],
    ["/teacher/lessons", "/teacher/tests"],
    ["/teacher/audio", "/teacher/images"],
    [
      "/teacher/grading",
      "/teacher/classes",
      "/teacher/students",
      "/teacher/settings",
      "/teacher/settings/workspace",
      "/teacher/tickets",
    ],
  ];
  for (const programs of [["ielts"], ["toeic"], ["ielts", "toeic"], [], undefined, null]) {
    assert.deepEqual(hrefs(visibleNavGroups(NAV.teacher.groups, programs)), today, JSON.stringify(programs));
  }
});

test("menu: có General thì Question Bank hiện trong nhóm LIBRARY, sau Image Library", () => {
  for (const programs of [["general"], ["ielts", "general"], ["general", "toeic"]]) {
    const groups = visibleNavGroups(NAV.teacher.groups, programs);
    const lib = groups.find((g) => g.label === "LIBRARY");
    assert.deepEqual(lib.items.map((i) => i.href), ["/teacher/audio", "/teacher/images", BANK_HREF]);
  }
});

test("menu: cờ `requires` đọc từ registry; admin / student không bị đổi; không sửa NAV gốc", () => {
  const item = NAV.teacher.groups.flatMap((g) => g.items).find((i) => i.href === BANK_HREF);
  assert.equal(item.requires, "questionBank");
  assert.equal(PROGRAMS.general[item.requires], true);
  // Tên chương trình lạ / "constructor" không làm mục hiện.
  assert.ok(!hrefs(visibleNavGroups(NAV.teacher.groups, ["nope", "constructor"])).flat().includes(BANK_HREF));
  for (const role of ["admin", "student"]) {
    const all = NAV[role].groups.flatMap((g) => g.items);
    assert.ok(all.every((i) => !i.requires), role);
    assert.deepEqual(hrefs(visibleNavGroups(NAV[role].groups, ["ielts"])), hrefs(NAV[role].groups));
  }
  visibleNavGroups(NAV.teacher.groups, ["ielts"]);
  assert.ok(NAV.teacher.groups.flatMap((g) => g.items).some((i) => i.href === BANK_HREF));
});

// ---------------------------------------------------------------- phần -> mục ngân hàng

function mcq(id, over = {}) {
  return {
    ...emptyField(id),
    kind: "mcq",
    formatLabel: GENERAL_LABELS.mcq,
    label: "She ___ to school every day " + id + ".",
    options: [
      { id: "a", text: "go" },
      { id: "b", text: "goes" },
    ],
    correctOptionIds: ["b"],
    ...over,
  };
}
const cloze = (id, over = {}) => mcq(id, { formatLabel: GENERAL_LABELS.cloze, label: "", ...over });
const section = (fields, over = {}) => ({ ...emptySection(), fields, ...over });
const L = { level: 10, textbook: "Global Success 10", unitLabel: "Unit 3" };

test("khối ngữ pháp không đoạn văn: mỗi câu tick là 1 mục lẻ, đánh số lại từ 1", () => {
  const sec = section([mcq(5), mcq(6), mcq(7)]);
  const r = sectionToBankItems(sec, { ...L, subject: "grammar", ticked: [0, 2], topic: "gr-passive", difficulty: "th" });
  assert.equal(r.items.length, 2);
  assert.equal(r.questionCount, 2);
  assert.deepEqual(r.skipped, []);
  for (const it of r.items) {
    assert.equal(it.kind, "single");
    assert.equal(it.format, "g-mcq");
    assert.equal(it.level, 10);
    assert.equal(it.unitLabel, "Unit 3");
    assert.equal(it.topic, "gr-passive");
    assert.equal(it.difficulty, "th");
    assert.equal(it.fields.length, 1);
    assert.equal(it.fields[0].id, 1);
    assert.deepEqual(it.fields[0].answers, ["b"]);
  }
  assert.deepEqual(r.names, ["Question 5", "Question 7"]);
  // mục sinh ra qua được buildItem của server
  for (const it of r.items) assert.equal(buildItem(it, "general").error, undefined);
});

test("nhãn riêng của câu làm mặc định khi hộp thoại để trống", () => {
  const sec = section([mcq(1, { topic: "gr-modals", difficulty: "vd" })]);
  const r = sectionToBankItems(sec, { ...L, subject: "grammar" });
  assert.equal(r.items[0].topic, "gr-modals");
  assert.equal(r.items[0].difficulty, "vd");
  const over = sectionToBankItems(sec, { ...L, subject: "grammar", topic: "gr-passive" });
  assert.equal(over.items[0].topic, "gr-passive");
});

test("phần reading có đoạn văn thật nhưng dạng bài không cần nó: lẻ, trừ khi giáo viên chọn giữ đoạn văn", () => {
  const sec = section([mcq(1), mcq(2)], { passageText: "Mark the letter A, B, C or D to indicate the correct answer." });
  const info = sectionBankInfo(sec, "reading");
  assert.equal(info.hasMedia, true);
  assert.equal(info.needsPassage, false);
  const singles = sectionToBankItems(sec, { ...L, subject: "reading" });
  assert.deepEqual(singles.items.map((i) => i.kind), ["single", "single"]);
  assert.ok(singles.items.every((i) => !("passageText" in i)));

  const group = sectionToBankItems(sec, { ...L, subject: "reading", keepPassage: true });
  assert.equal(group.items.length, 1);
  assert.equal(group.items[0].kind, "group");
  assert.equal(group.items[0].passageText, sec.passageText);
  assert.deepEqual(group.items[0].fields.map((f) => f.id), [1, 2]); // giữ số câu gốc trong nhóm
});

test("dạng cloze cần đoạn văn: tự lưu thành 1 nhóm (không cần tick), giữ số câu để khớp chỗ trống", () => {
  const sec = section([cloze(21), cloze(22), cloze(23)], { passageText: "He (21) ___ home and (22) ___ ..." });
  const r = sectionToBankItems(sec, { ...L, subject: "reading" });
  assert.equal(r.items.length, 1);
  assert.equal(r.items[0].kind, "group");
  assert.equal(r.items[0].format, "g-cloze");
  assert.deepEqual(r.items[0].fields.map((f) => f.id), [21, 22, 23]);
  assert.equal(r.questionCount, 3);
  assert.equal(buildItem(r.items[0], "general").error, undefined);
});

test("chữ giữ chỗ 'Paste the passage here.' không phải đoạn văn thật: cloze không lưu được, câu thường lưu lẻ", () => {
  const ph = section([cloze(1), cloze(2)], { passageText: PASSAGE_PLACEHOLDER });
  assert.equal(sectionBankInfo(ph, "reading").hasMedia, false);
  const r = sectionToBankItems(ph, { ...L, subject: "reading" });
  assert.equal(r.items.length, 0);
  assert.equal(r.skipped.length, 2);
  assert.match(r.skipped[0].reason, /passage/);

  const plain = section([mcq(1)], { passageText: PASSAGE_PLACEHOLDER });
  const r2 = sectionToBankItems(plain, { ...L, subject: "reading", keepPassage: true });
  assert.equal(r2.items.length, 1);
  assert.equal(r2.items[0].kind, "single");
  assert.ok(!JSON.stringify(r2.items[0]).includes(PASSAGE_PLACEHOLDER));
});

test("đoạn văn chỉ được giữ ở kỹ năng reading (subject khác bỏ qua passageText)", () => {
  const sec = section([cloze(1)], { passageText: "Some real passage here." });
  assert.equal(sectionBankInfo(sec, "grammar").hasMedia, false);
  assert.equal(sectionToBankItems(sec, { ...L, subject: "grammar" }).items.length, 0);
});

test("ảnh của phần được giữ trong nhóm; câu lẻ không mang ảnh của phần", () => {
  const sec = section([mcq(1)], { imageId: "img1" });
  const g = sectionToBankItems(sec, { ...L, subject: "reading", keepPassage: true });
  assert.equal(g.items[0].kind, "group");
  assert.equal(g.items[0].imageId, "img1");
  const s = sectionToBankItems(sec, { ...L, subject: "reading" });
  assert.equal(s.items[0].kind, "single");
  assert.ok(!("imageId" in s.items[0]));
});

test("câu dở không bị bỏ lặng lẽ: có lý do; câu không có dạng bài, matching cũng được giải thích", () => {
  const noAnswer = mcq(2, { correctOptionIds: [] });
  const emptyOpt = mcq(3, { options: [{ id: "a", text: "go" }, { id: "b", text: "" }] });
  const noType = mcq(4, { formatLabel: "" });
  const match = { ...emptyField(5), kind: "matching", formatLabel: GENERAL_LABELS.mcq };
  const sec = section([mcq(1), noAnswer, emptyOpt, noType, match]);
  const r = sectionToBankItems(sec, { ...L, subject: "grammar" });
  assert.equal(r.items.length, 1);
  assert.equal(r.questionCount, 1);
  assert.deepEqual(r.skipped.map((s) => s.id), [2, 3, 4, 5]);
  assert.match(r.skipped[0].reason, /no correct answer/);
  assert.match(r.skipped[1].reason, /option is empty/);
  assert.match(r.skipped[2].reason, /no question type/);
  assert.match(r.skipped[3].reason, /matching/);
  // câu bỏ không tick thì không báo
  const only = sectionToBankItems(sec, { ...L, subject: "grammar", ticked: [0] });
  assert.deepEqual(only.skipped, []);
});

test("nhóm có 1 câu dở: câu dở bị bỏ kèm lý do, phần còn lại vẫn thành nhóm", () => {
  const sec = section([cloze(1), cloze(2, { correctOptionIds: [] })], { passageText: "A real passage with (1) and (2)." });
  const r = sectionToBankItems(sec, { ...L, subject: "reading" });
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.items[0].fields.map((f) => f.id), [1]);
  assert.deepEqual(r.skipped.map((s) => s.id), [2]);
});

test("không sửa section đầu vào (builder không đổi)", () => {
  const sec = section([mcq(1), mcq(2)], { passageText: "Real passage" });
  const before = JSON.stringify(sec);
  sectionToBankItems(sec, { ...L, subject: "reading", keepPassage: true });
  importedSectionsToBankItems([sec], L);
  assert.equal(JSON.stringify(sec), before);
});

test("nhóm quá 60 câu tách thành nhiều nhóm cùng đoạn văn", () => {
  const fields = Array.from({ length: 61 }, (_, i) => cloze(i + 1));
  const r = sectionToBankItems(section(fields, { passageText: "Long passage" }), { ...L, subject: "reading" });
  assert.deepEqual(r.items.map((i) => i.fields.length), [60, 1]);
  assert.ok(r.items.every((i) => i.passageText === "Long passage"));
});

test("formatKeyOf: nhãn dạng bài -> key g-*, lạ -> rỗng", () => {
  assert.equal(formatKeyOf("Word form"), "g-wform");
  assert.equal(formatKeyOf("Multiple choice"), "g-mcq");
  assert.equal(formatKeyOf("Nope"), "");
  assert.equal(formatKeyOf(""), "");
});

// ---------------------------------------------------------------- import Word

test("import Word: phần có đoạn văn -> 1 nhóm, phần khác -> câu lẻ, subject reading nên giữ đoạn văn", () => {
  const sections = [
    section([mcq(1), mcq(2)]),
    section([mcq(3), mcq(4)], { passageText: "A short text about school." }),
  ];
  const r = importedSectionsToBankItems(sections, { ...L, difficulty: "nb" });
  assert.deepEqual(r.items.map((i) => i.kind), ["single", "single", "group"]);
  assert.equal(r.items[2].passageText, "A short text about school.");
  assert.equal(r.items[2].difficulty, "nb");
  assert.equal(r.questionCount, 4);
  assert.equal(r.names[2], "Part 2, passage group, questions 3-4");
});

test("import Word: câu có cờ vàng (aiFlag) hoặc chưa có đáp án không được lưu, và được liệt kê", () => {
  const sections = [
    section([mcq(1), mcq(2, { aiFlag: "Answer not found" }), mcq(3, { correctOptionIds: [] }), mcq(4, { aiFlag: "Image could not be uploaded" })]),
    section([mcq(5, { aiFlag: "Check this" })], { passageText: "Passage" }),
  ];
  const r = importedSectionsToBankItems(sections, L);
  assert.equal(r.items.length, 1);
  assert.equal(r.questionCount, 1);
  assert.deepEqual(r.skipped.map((s) => [s.section, s.id]), [[0, 2], [0, 3], [0, 4], [1, 5]]);
  assert.match(r.skipped[0].reason, /needs checking \(Answer not found\)/);
  assert.match(r.skipped[1].reason, /no correct answer/);
  assert.match(r.skipped[2].reason, /Image could not be uploaded/);
});

test("lượt gửi: chia 100 mục / lần và cộng số thứ tự vào lời nhắn lỗi của server", () => {
  assert.deepEqual(chunkItems(Array.from({ length: 250 }, (_, i) => i)).map((c) => c.length), [100, 100, 50]);
  assert.equal(offsetItemError("Item 3: Choose a valid grade.", 200), "Item 203: Choose a valid grade.");
  assert.equal(offsetItemError("Invalid", 5), "Invalid");
});

// ---------------------------------------------------------------- sửa nhãn nhiều mục (tenant)

const QuestionItem = require("../lib/models/QuestionItem");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const AuditLog = require("../lib/models/AuditLog");
const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

const idOf = (v) => String(v);
function matchesFilter(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    if (cond && typeof cond === "object" && "$in" in cond) return cond.$in.map(idOf).includes(idOf(doc[k]));
    return idOf(doc[k]) === idOf(cond);
  });
}

async function withBulkFakes(fn) {
  const hex = (n) => String(n).padStart(24, "0");
  const store = [
    { _id: hex(1), workspaceId: "ws1", program: "general", topic: "", difficulty: "nb", unitLabel: "U1", textbook: "T", level: 10, fields: [{ id: 1 }] },
    { _id: hex(2), workspaceId: "ws1", program: "general", topic: "", difficulty: "nb", unitLabel: "U1", textbook: "T", level: 10, fields: [{ id: 1 }] },
    { _id: hex(3), workspaceId: "ws2", program: "general", topic: "", difficulty: "nb", unitLabel: "U2", textbook: "T", level: 10, fields: [{ id: 1 }] },
  ];
  const orig = { updateMany: QuestionItem.updateMany, wm: WorkspaceMember.findOne, wsf: Workspace.findById, audit: AuditLog.create };
  const calls = [];
  QuestionItem.updateMany = async (filter, upd) => {
    calls.push({ filter, upd });
    let n = 0;
    for (const d of store) if (matchesFilter(d, filter)) { Object.assign(d, upd.$set); n++; }
    return { matchedCount: n, modifiedCount: n };
  };
  const members = { uA: "ws1", uB: "ws2" };
  WorkspaceMember.findOne = (q) => ({ select: () => ({ lean: async () => ({ workspaceId: members[String(q.userId)], role: "teacher" }) }) });
  Workspace.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id, status: "active", settings: {} }) }) });
  AuditLog.create = async () => {};
  process.env.JWT_SECRET = "test-secret-g4-ui";
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};
  clearTenantCache();
  const route = require("../pages/api/admin/question-bank");
  const put = async (userId, body) => {
    const token = signUserToken({ _id: userId, role: "teacher", name: "T" });
    let statusCode = 200;
    let payload = null;
    const res = { setHeader() {}, status(c) { statusCode = c; return this; }, json(p) { payload = p; return this; } };
    await route({ method: "PUT", query: {}, body, headers: { authorization: "Bearer " + token }, url: "/api/admin/question-bank" }, res);
    return { status: statusCode, body: payload };
  };
  try {
    await fn({ put, store, calls, hex });
  } finally {
    QuestionItem.updateMany = orig.updateMany;
    WorkspaceMember.findOne = orig.wm;
    Workspace.findById = orig.wsf;
    AuditLog.create = orig.audit;
    clearTenantCache();
  }
}

test("PUT nhiều mục: đặt nhãn cho mục của mình, không đụng mục của workspace khác", () =>
  withBulkFakes(async ({ put, store, calls, hex }) => {
    const r = await put("uA", { ids: [hex(1), hex(2), hex(3)], set: { topic: "gr-passive", difficulty: "vd" } });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.updated, 2); // mục ws2 không khớp
    assert.equal(store[0].topic, "gr-passive");
    assert.equal(store[1].difficulty, "vd");
    assert.equal(store[2].topic, ""); // B nguyên vẹn
    assert.equal(store[2].difficulty, "nb");
    assert.equal(calls[0].filter.workspaceId, "ws1"); // luôn có bộ lọc workspace
  }));

test("PUT nhiều mục: B không sửa được mục của A", () =>
  withBulkFakes(async ({ put, store, hex }) => {
    const r = await put("uB", { ids: [hex(1), hex(2)], set: { topic: "hacked", unitLabel: "X" } });
    assert.equal(r.status, 200);
    assert.equal(r.body.updated, 0);
    assert.equal(store[0].topic, "");
    assert.equal(store[1].unitLabel, "U1");
  }));

test("PUT nhiều mục: chỉ 4 nhãn được đặt; nội dung / workspace / level không nhận; kiểm giá trị", () =>
  withBulkFakes(async ({ put, store, hex }) => {
    const r = await put("uA", {
      ids: [hex(1)],
      set: { topic: "  " + "t".repeat(200), textbook: "Book", level: 6, workspaceId: "ws2", fields: [], kind: "group" },
    });
    assert.equal(r.status, 200);
    assert.equal(store[0].topic.length, 80);
    assert.equal(store[0].textbook, "Book");
    assert.equal(store[0].level, 10);
    assert.equal(store[0].workspaceId, "ws1");
    assert.deepEqual(store[0].fields, [{ id: 1 }]);
    assert.ok(!("kind" in store[0]));

    assert.equal((await put("uA", { ids: [hex(1)], set: { difficulty: "extreme" } })).status, 400);
    assert.equal((await put("uA", { ids: [hex(1)], set: { level: 6 } })).status, 400); // không có nhãn hợp lệ
    assert.equal((await put("uA", { ids: [hex(1)] })).status, 400);
    assert.equal((await put("uA", { ids: ["nope", { $ne: 1 }], set: { topic: "x" } })).status, 400); // id sai bị lọc hết
    // xoá nhãn bằng chuỗi rỗng
    assert.equal((await put("uA", { ids: [hex(1)], set: { difficulty: "" } })).status, 200);
    assert.equal(store[0].difficulty, "");
  }));

test("dòng hướng dẫn của khuôn không thành nhóm / đoạn văn thật", () => {
  const instr = "Choose the best option to complete each sentence.";
  const sec = section([mcq(1), mcq(2)], { passageText: instr });
  assert.equal(sectionBankInfo(sec, "reading").passage, "");
  assert.equal(sectionBankInfo(sec, "reading").hasMedia, false);
  const r = sectionToBankItems(sec, { ...L, subject: "reading", keepPassage: true });
  assert.ok(r.items.every((it) => it.kind === "single" && !it.passageText));
  // đoạn có chỗ trống đánh số vẫn là đoạn văn thật
  const real = section([cloze(1)], { passageText: "He (1) to school." });
  assert.equal(sectionBankInfo(real, "reading").passage, "He (1) to school.");
});
