// Phase 8 bước 6 — điểm ước tính TOEIC (chỉ Mock Test), nhóm câu theo Part, thanh kỹ năng.
const test = require("node:test");
const assert = require("node:assert/strict");

const {
  ANCHORS,
  estimateToeic,
  estimateFromTable,
  SCALE_SOURCE,
  estimateToeicTotal,
  usesToeicScale,
  formatToeicEstimate,
  toeicResultLine,
  formatToeicTotal,
  formatToeicTotalFromSubs,
} = require("../lib/toeicScale");
const { groupFieldsByPart } = require("../lib/partGroups");
const { studentProgramFromUnits, skillBarValue, skillsForProgram } = require("../lib/student/skillBar");

// ---- estimateToeic ----
test("estimateToeic: bảng đơn điệu, mốc đầu/cuối 5 và 495", () => {
  for (const skill of ["listening", "reading"]) {
    const a = ANCHORS[skill];
    assert.deepEqual(a[0], [0, 5]);
    assert.deepEqual(a[a.length - 1], [100, 495]);
    for (let i = 1; i < a.length; i++) {
      assert.ok(a[i][0] > a[i - 1][0] && a[i][1] > a[i - 1][1], `${skill} anchor ${i} phải tăng`);
    }
    let prev = -1;
    for (let c = 0; c <= 100; c++) {
      const s = estimateFromTable(skill, c, 100);
      assert.ok(s >= prev, `${skill} ${c} không được giảm`);
      prev = s;
    }
    assert.equal(estimateFromTable(skill, 0, 100), 5);
    assert.equal(estimateFromTable(skill, 100, 100), 495);
  }
});

test("estimateToeic: total != 100 thì quy theo tỉ lệ round(correct*100/total)", () => {
  // 38/50 -> 76/100
  assert.equal(estimateFromTable("listening", 38, 50), estimateFromTable("listening", 76, 100));
  assert.equal(estimateFromTable("reading", 6, 6), 495);
  assert.equal(estimateFromTable("reading", 0, 6), 5);
  // 1/3 -> 33
  assert.equal(estimateFromTable("listening", 1, 3), estimateFromTable("listening", 33, 100));
  // total khác 100 nhưng cùng tỉ lệ -> cùng điểm
  assert.equal(estimateFromTable("reading", 25, 50), estimateFromTable("reading", 50, 100));
});

test("estimateToeic: làm tròn bội số của 5, kẹp 5-495", () => {
  for (const skill of ["listening", "reading"]) {
    for (let c = 0; c <= 100; c++) {
      const s = estimateFromTable(skill, c, 100);
      assert.equal(s % 5, 0, `${skill} ${c} -> ${s}`);
      assert.ok(s >= 5 && s <= 495);
    }
  }
  // vượt biên được kẹp
  assert.equal(estimateFromTable("listening", 150, 100), 495);
  assert.equal(estimateFromTable("listening", -3, 100), 5);
  assert.equal(estimateFromTable("reading", 60, 50), 495);
});

test("estimateToeic: total 0 / dữ liệu xấu / kỹ năng lạ -> null", () => {
  assert.equal(estimateFromTable("listening", 0, 0), null);
  assert.equal(estimateFromTable("listening", 5, 0), null);
  assert.equal(estimateFromTable("listening", 5, -2), null);
  assert.equal(estimateFromTable("listening", "abc", 10), null);
  assert.equal(estimateFromTable("listening", 3, undefined), null);
  assert.equal(estimateFromTable("writing", 5, 10), null);
  assert.equal(estimateFromTable("constructor", 5, 10), null);
});

test("định dạng hiển thị: luôn có 'estimated' và '≈'", { skip: !SCALE_SOURCE && "chưa có bảng nguồn (SCALE_SOURCE)" }, () => {
  const s = estimateFromTable("listening", 38, 50);
  assert.equal(formatToeicEstimate("listening", 38, 50), `≈ ${s} / 495 (estimated)`);
  assert.equal(toeicResultLine("listening", 38, 50), `38/50 correct · ≈ ${s} / 495 (estimated)`);
  // không quy đổi được -> chỉ còn "x/y correct", không có '≈'
  assert.equal(toeicResultLine("listening", 0, 0), "0/0 correct");
  assert.equal(formatToeicEstimate("listening", 0, 0), "");
});

test("tổng L+R: chỉ khi đủ cả hai kỹ năng", { skip: !SCALE_SOURCE && "chưa có bảng nguồn (SCALE_SOURCE)" }, () => {
  assert.equal(estimateToeicTotal(390, 395), 785);
  assert.equal(estimateToeicTotal(390, null), null);
  assert.equal(estimateToeicTotal(null, 395), null);
  assert.equal(formatToeicTotal(390, 395), "≈ 785 / 990 (estimated)");
  assert.equal(formatToeicTotal(390, null), "");
  assert.equal(formatToeicTotalFromSubs(null, { score: 1, total: 2 }), "");
  const l = { score: 100, total: 100 };
  const r = { score: 100, total: 100 };
  assert.equal(formatToeicTotalFromSubs(l, r), "≈ 990 / 990 (estimated)");
});

test("usesToeicScale đọc registry, IELTS không dùng", () => {
  assert.equal(usesToeicScale("toeic"), true);
  assert.equal(usesToeicScale("ielts"), false);
  assert.equal(usesToeicScale(undefined), false);
  assert.equal(usesToeicScale("zzz"), false);
});

// ---- groupFieldsByPart ----
test("groupFieldsByPart: gom các câu liền nhau cùng formatLabel", () => {
  const f = (id, formatLabel) => ({ id, formatLabel });
  const g = groupFieldsByPart([
    f(101, "Part 5 — Incomplete Sentences"),
    f(102, "Part 5 — Incomplete Sentences"),
    f(103, "Part 6 — Text Completion"),
    f(104, "Part 5 — Incomplete Sentences"), // bị Part 6 chen giữa -> nhóm riêng
  ]);
  assert.equal(g.length, 3);
  assert.deepEqual(g.map((x) => x.label), [
    "Part 5 — Incomplete Sentences",
    "Part 6 — Text Completion",
    "Part 5 — Incomplete Sentences",
  ]);
  assert.deepEqual(g[0].fields.map((x) => x.id), [101, 102]);
  assert.deepEqual(g[2].fields.map((x) => x.id), [104]);
});

test("groupFieldsByPart: câu không nhãn gom vào nhóm label rỗng; rỗng / null an toàn", () => {
  const g = groupFieldsByPart([{ id: 1 }, { id: 2, formatLabel: "" }, { id: 3, formatLabel: "  " }, { id: 4, formatLabel: "Part 1 — Photographs" }]);
  assert.equal(g.length, 2);
  assert.equal(g[0].label, "");
  assert.deepEqual(g[0].fields.map((x) => x.id), [1, 2, 3]);
  assert.equal(g[1].label, "Part 1 — Photographs");
  assert.deepEqual(groupFieldsByPart([]), []);
  assert.deepEqual(groupFieldsByPart(null), []);
  assert.deepEqual(groupFieldsByPart(undefined), []);
});

test("groupFieldsByPart: giữ nguyên thứ tự và tham chiếu câu hỏi", () => {
  const a = { id: 5, formatLabel: "X" };
  const b = { id: 6, formatLabel: "X" };
  const g = groupFieldsByPart([a, b]);
  assert.equal(g[0].fields[0], a);
  assert.equal(g[0].fields[1], b);
});

// ---- thanh kỹ năng dashboard ----
test("skillBarValue: TOEIC chỉ hiện %, IELTS giữ Band cho Writing/Speaking", () => {
  assert.equal(skillBarValue({ key: "writing", pct: 61, band: 5.5 }, "ielts"), "Band 5.5");
  assert.equal(skillBarValue({ key: "grammar", pct: 72 }, "ielts"), "72%");
  assert.equal(skillBarValue({ key: "writing", pct: 61, band: 5.5 }, "toeic"), "61%");
  assert.equal(skillBarValue({ key: "grammar", pct: 72 }, "toeic"), "72%");
  // chương trình thiếu / lạ -> IELTS (hành vi cũ)
  assert.equal(skillBarValue({ key: "speaking", pct: 50, band: 4.5 }, undefined), "Band 4.5");
  assert.equal(skillBarValue({ key: "speaking", pct: 50, band: 4.5 }, "zzz"), "Band 4.5");
  assert.equal(skillBarValue({ key: "grammar", pct: 0 }, "ielts"), "0%");
});

test("skillsForProgram + studentProgramFromUnits", () => {
  const skills = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"].map((key) => ({ key, pct: 50 }));
  assert.equal(skillsForProgram(skills, "ielts").length, 6);
  assert.deepEqual(skillsForProgram(skills, "toeic").map((s) => s.key), ["grammar", "vocabulary", "listening", "reading"]);
  assert.equal(skillsForProgram(null, "toeic").length, 0);

  assert.equal(studentProgramFromUnits([]), "ielts");
  assert.equal(studentProgramFromUnits(null), "ielts");
  assert.equal(studentProgramFromUnits([{ id: 1 }]), "ielts");
  assert.equal(studentProgramFromUnits([{ id: 1, program: "toeic" }, { id: 2, program: "toeic" }]), "toeic");
});

test("estimateToeic: tắt (null) khi chưa có bảng nguồn SCALE_SOURCE", () => {
  if (SCALE_SOURCE) return;
  assert.equal(estimateToeic("listening", 38, 50), null);
});
