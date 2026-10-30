// Phase 12 G4 bước 5 — thống kê % đúng theo chủ điểm.
const test = require("node:test");
const assert = require("node:assert/strict");

const { aggregateByTopic, topicStatsForTest, topicStatsForUnit } = require("../lib/teacher/topicStats");
const { buildTestOverview } = require("../lib/teacher/testSubmissions");
const { buildUnitOverview } = require("../lib/teacher/unitSubmissions");
const { topicLabel } = require("../lib/generalTopics");

const sec = (fields) => [{ name: "S", fields }];
const F = (id, topic, difficulty) => ({ id, type: "fill", label: "Q" + id, answers: ["x"], ...(topic ? { topic } : {}), ...(difficulty ? { difficulty } : {}) });
const sub = (o) => ({ studentId: "s1", submittedAt: "2026-01-01T00:00:00Z", ...o });
const det = (...pairs) => pairs.map(([id, correct, partial]) => ({ id, correct, ...(partial ? { partial: true } : {}) }));

test("tổng hợp theo chủ điểm, yếu nhất lên đầu, bỏ câu không có chủ điểm", () => {
  const list = [{ key: "skill:reading", sections: sec([F(1, "gr-passive"), F(2, "gr-passive"), F(3, "vo-idioms"), F(4)]) }];
  const subs = [sub({ kind: "test", testSkill: "reading", detail: det([1, true], [2, true], [3, false], [4, false]) })];
  const r = aggregateByTopic(list, subs);
  assert.deepEqual(r.map((x) => x.topic), ["vo-idioms", "gr-passive"]);
  assert.equal(r[0].pct, 0);
  assert.equal(r[1].pct, 100);
  assert.equal(r[1].questions, 2);
  assert.equal(r[1].label, topicLabel("gr-passive"));
});

test("chỉ lần nộp mới nhất của mỗi học sinh; partial tính là sai", () => {
  const list = [{ key: "ex:e1", sections: sec([F(1, "t"), F(2, "t")]) }];
  const subs = [
    sub({ kind: "exercise", exerciseId: "e1", submittedAt: "2026-01-01T00:00:00Z", detail: det([1, false], [2, false]) }),
    sub({ kind: "exercise", exerciseId: "e1", submittedAt: "2026-01-02T00:00:00Z", detail: det([1, true], [2, true, true]) }),
    sub({ studentId: "s2", kind: "exercise", exerciseId: "e1", detail: det([1, true], [2, true]) }),
  ];
  const [t] = aggregateByTopic(list, subs);
  assert.equal(t.attempts, 4);
  assert.equal(t.correct, 3);
  assert.equal(t.pct, 75);
});

test("id câu không lẫn giữa skill / exercise", () => {
  const list = [
    { key: "skill:listening", sections: sec([F(1, "a")]) },
    { key: "skill:reading", sections: sec([F(1, "b")]) },
  ];
  const subs = [
    sub({ kind: "test", testSkill: "listening", detail: det([1, true]) }),
    sub({ kind: "test", testSkill: "reading", detail: det([1, false]) }),
  ];
  const r = Object.fromEntries(aggregateByTopic(list, subs).map((x) => [x.topic, x.pct]));
  assert.deepEqual(r, { a: 100, b: 0 });
});

test("độ khó: difficultyBreakdown khi câu có difficulty", () => {
  const list = [{ key: "ex:e1", sections: sec([F(1, "t", "nb"), F(2, "t", "vd")]) }];
  const [t] = aggregateByTopic(list, [sub({ kind: "exercise", exerciseId: "e1", detail: det([1, true], [2, false]) })]);
  assert.equal(t.difficultyBreakdown.length, 2);
});

test("không có nhãn chủ điểm -> rỗng / null", () => {
  assert.deepEqual(aggregateByTopic([{ key: "ex:e1", sections: sec([F(1)]) }], []), []);
  const g = { program: "general", skills: { reading: { sections: sec([F(1)]) } } };
  assert.equal(topicStatsForTest(g, []), null);
});

test("IELTS/TOEIC: không trả topicStats dù câu có topic", () => {
  for (const program of ["ielts", "toeic"]) {
    const t = { program, skills: { reading: { sections: sec([F(1, "gr-passive")]) } } };
    const u = { program, categories: [{ key: "grammar", exercises: [{ _id: "e1", sections: sec([F(1, "gr-passive")]) }] }] };
    assert.equal(topicStatsForTest(t, []), null);
    assert.equal(topicStatsForUnit(u, []), null);
  }
  const g = { program: "general", skills: { reading: { sections: sec([F(1, "gr-passive")]) } } };
  assert.equal(topicStatsForTest(g, []).length, 1);
});

test("unit General: duyệt exercises trong topics/groups", () => {
  const u = { program: "general", categories: [{ key: "grammar", topics: [{ exercises: [{ _id: "e9", sections: sec([F(1, "gr-modals")]) }] }] }] };
  const r = topicStatsForUnit(u, [sub({ kind: "exercise", exerciseId: "e9", detail: det([1, true]) })]);
  assert.equal(r[0].pct, 100);
});

test("buildTestOverview / buildUnitOverview giữ nguyên dạng mảng (không thêm key)", () => {
  assert.ok(Array.isArray(buildTestOverview({ test: { skills: {} }, submissions: [], students: [], classById: {} })));
  assert.ok(Array.isArray(buildUnitOverview({ unit: { categories: [] }, submissions: [], students: [], classById: {} })));
});

test("API học sinh không nhận topicStats", () => {
  const fs = require("node:fs");
  const path = require("node:path");
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));
  const files = walk(path.join(__dirname, "..", "pages", "api")).filter((f) => f.endsWith(".js"));
  const users = files.filter((f) => fs.readFileSync(f, "utf8").includes("topicStats")).map((f) => path.relative(path.join(__dirname, "..", "pages", "api"), f).split(path.sep).join("/"));
  assert.deepEqual(users.sort(), ["admin/test-submissions.js", "admin/unit-submissions.js"]);
});
