// Phase 12 G4 bước 3: ma trận -> kế hoạch bốc, đổ câu ngân hàng vào khung, đánh số lại + viết lại chỗ trống, Swap.
// Toàn hàm thuần (không DB / mạng).
const test = require("node:test");
const assert = require("node:assert/strict");

const { buildSkeleton } = require("../lib/teacher/templateSkeleton");
const { GENERAL_ALL_FORMATS } = require("../lib/teacher/questionFormats");
const { PASSAGE_PLACEHOLDER } = require("../lib/generalTemplates");
const { emptyField, applyFormat, fieldToServer, sectionsToPayload } = require("../lib/teacher/sectionTransforms");
const {
  buildFillPlan,
  planToPickRows,
  fillSkeletonFromBank,
  describeFill,
  rewriteBlanks,
  collectBankItemIds,
  swapInSections,
  pickSwapCandidate,
  swapPickBody,
  cellError,
} = require("../lib/teacher/fillFromBank");

// ---------------------------------------------------------------- dữ liệu mẫu

const WFORM = GENERAL_ALL_FORMATS.find((f) => f.key === "g-wform");
const CLOZE = GENERAL_ALL_FORMATS.find((f) => f.key === "g-cloze");

// Khuôn nhỏ: P1 (3 câu word form), P2 (đoạn văn, 3 câu cloze), P3 (2 câu word form).
const BASE = {
  skills: {
    reading: {
      durationMinutes: 30,
      parts: [
        { name: "P1", instruction: "i1", passage: false, questions: [{ format: "g-wform", count: 3 }] },
        { name: "P2", instruction: "i2", passage: true, questions: [{ format: "g-cloze", count: 3 }] },
        { name: "P3", instruction: "i3", passage: false, questions: [{ format: "g-wform", count: 2 }] },
      ],
    },
  },
};
const resolvedOf = (base) => ({ skills: base.skills });
const skeleton = () => buildSkeleton(resolvedOf(BASE));

let seq = 0;
const oid = () => String(++seq).padStart(24, "0");

// Câu server thật (qua fieldToServer) để kiểm đúng đường chuyển đổi.
function srvWform(id, extra = {}) {
  const f = applyFormat(emptyField(id), WFORM);
  f.label = "She is very " + id;
  f.answersText = "careful";
  Object.assign(f, extra);
  return fieldToServer(f);
}
function srvCloze(id, extra = {}) {
  const f = applyFormat(emptyField(id), CLOZE);
  f.options = ["a", "b", "c", "d"].map((t, i) => ({ id: "o" + id + i, text: t }));
  f.correctOptionIds = ["o" + id + "0"];
  Object.assign(f, extra);
  return fieldToServer(f);
}
function single(extra = {}) {
  return { _id: oid(), kind: "single", format: "g-wform", topic: "", difficulty: "", questionCount: 1, fields: [srvWform(1)], ...extra };
}
function group(ids, passage, extra = {}) {
  return {
    _id: oid(),
    kind: "group",
    format: "g-cloze",
    topic: "",
    difficulty: "",
    passageText: passage,
    questionCount: ids.length,
    fields: ids.map((i) => srvCloze(i)),
    ...extra,
  };
}
const singles = (n) => Array.from({ length: n }, () => single());
const planOf = (matrix) => buildFillPlan(BASE, {}, ["reading"], matrix);

// ---------------------------------------------------------------- kế hoạch từ ma trận

test("plan: mặc định mọi ô ở Any, phần đoạn văn là 1 hàng với tổng số câu", () => {
  const { rows, errors } = planOf({});
  assert.deepEqual(errors, []);
  assert.deepEqual(
    rows.map((r) => [r.part, r.format, r.difficulty, r.count, r.passage]),
    [[0, "g-wform", "", 3, false], [1, "g-cloze", "", 3, true], [2, "g-wform", "", 2, false]]
  );
  assert.deepEqual(planToPickRows(rows)[1], { format: "g-cloze", difficulty: "", count: 3 });
});

test("plan: chia theo mức độ, tổng phải bằng số câu của dạng", () => {
  const ok = planOf({ "reading:0:0": { any: "1", nb: "1", th: "1", vd: "", vdc: "" } });
  assert.deepEqual(ok.errors, []);
  assert.deepEqual(ok.rows.filter((r) => r.part === 0).map((r) => [r.difficulty, r.count]), [["", 1], ["nb", 1], ["th", 1]]);

  const bad = planOf({ "reading:0:0": { any: "1", nb: "1", th: "", vd: "", vdc: "" } });
  assert.equal(bad.errors.length, 1);
  assert.match(bad.errors[0], /P1/);
  assert.match(bad.errors[0], /add up to 2/);
  assert.match(cellError({ any: "x" }, 3), /whole numbers/);
  assert.equal(cellError({ any: "3" }, 3), "");
});

test("plan: phần 0 câu bị bỏ thì chỉ số phần khớp khung đã resolve", () => {
  const rows = buildFillPlan(BASE, { reading: [[0], [3], [2]] }, ["reading"], {}).rows;
  assert.deepEqual(rows.map((r) => [r.name, r.part]), [["P2", 0], ["P3", 1]]);
  const { resolveTemplate } = require("../lib/generalTemplates");
  assert.ok(resolveTemplate); // chỉ số khớp buildSkeleton: P1 bị bỏ -> P2 là section 0
});

test("plan: phần đoạn văn nhận mức độ của nhóm từ chuỗi", () => {
  const rows = planOf({ "reading:1:0": "vd" }).rows;
  assert.equal(rows.find((r) => r.passage).difficulty, "vd");
});

// ---------------------------------------------------------------- đổ câu

test("fill đủ: mọi câu có bankItemId, đánh số 1..N, đoạn văn viết lại số chỗ trống", () => {
  const { rows } = planOf({});
  const g = group([21, 22, 23], "Text (21) and (22) then (23).", { imageId: "img1" });
  const res = fillSkeletonFromBank(skeleton(), rows, [singles(3), [g], singles(2)]);
  assert.equal(res.filled, 8);
  assert.equal(res.total, 8);
  assert.deepEqual(res.shortages, []);
  assert.deepEqual(res.flags, []);
  const secs = res.skills.reading.sections;
  assert.deepEqual(secs.flatMap((s) => s.fields.map((f) => f.id)), [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(secs[1].passageText, "Text (4) and (5) then (6).");
  assert.equal(secs[1].imageId, "img1");
  assert.ok(secs.every((s) => s.fields.every((f) => f.bankItemId && !f.aiFlag)));
  assert.equal(secs[0].fields[0].label, "She is very 1");
  assert.deepEqual(describeFill(res), ["8 of 8 filled from the bank."]);
  // không còn khoá tạm
  assert.ok(secs.every((s) => s.fields.every((f) => !("__src" in f) && !("__srcEnd" in f))));
});

test("fill không sửa khung đầu vào", () => {
  const sk = skeleton();
  const before = JSON.stringify(sk);
  fillSkeletonFromBank(sk, planOf({}).rows, [singles(3), [group([1, 2, 3], "(1)(2)(3)")], singles(2)]);
  assert.equal(JSON.stringify(sk), before);
});

test("fill thiếu: câu thiếu để trống, báo shortage và tóm tắt", () => {
  const { rows } = planOf({});
  const res = fillSkeletonFromBank(skeleton(), rows, [singles(2), [group([1, 2, 3], "(1)(2)(3)")], singles(2)]);
  assert.equal(res.filled, 7);
  assert.equal(res.total, 8);
  assert.deepEqual(res.shortages, [{ skill: "reading", partIndex: 0, part: "P1", format: "g-wform", difficulty: "", missing: 1 }]);
  const empty = res.skills.reading.sections[0].fields[2];
  assert.equal(empty.bankItemId, undefined);
  assert.equal(empty.label, ""); // câu trống của khung, publish guard vẫn chặn
  assert.match(describeFill(res)[0], /^7 of 8 filled, 1 missing: P1 — .* ×1\.$/);
});

test("fill: nhóm đặt nguyên, không tách; mục lẻ lọt vào hàng đoạn văn bị bỏ qua", () => {
  const { rows } = planOf({});
  const g = group([10, 11, 12], "(10) (11) (12)");
  const res = fillSkeletonFromBank(skeleton(), rows, [[], [single(), g], []]);
  const f = res.skills.reading.sections[1].fields;
  assert.equal(f.length, 3);
  assert.ok(f.every((x) => x.bankItemId === String(g._id) && x.bankKind === "group"));
  assert.equal(res.skills.reading.sections[1].passageText, "(4) (5) (6)"); // P1 chiếm 1-3 nên nhóm là 4-6
});

test("fill: không có nhóm nào vừa -> giữ chữ giữ chỗ và báo thiếu", () => {
  const { rows } = planOf({});
  const res = fillSkeletonFromBank(skeleton(), rows, [[], [], []]);
  assert.equal(res.skills.reading.sections[1].passageText, PASSAGE_PLACEHOLDER);
  assert.equal(res.shortages.find((s) => s.partIndex === 1).missing, 3);
  assert.equal(res.filled, 0);
});

test("fill: nhóm ít câu hơn chỗ -> phần còn lại để trống; có tick thì phần co lại theo nhóm", () => {
  const { rows } = planOf({});
  const g = () => group([1, 2], "(1) and (2)");
  const keep = fillSkeletonFromBank(skeleton(), rows, [singles(3), [g()], singles(2)]);
  assert.equal(keep.skills.reading.sections[1].fields.length, 3);
  assert.equal(keep.skills.reading.sections[1].fields[2].bankItemId, undefined);
  assert.deepEqual(keep.shortages.map((s) => [s.part, s.missing]), [["P2", 1]]);
  assert.equal(keep.filled, 7);

  const fit = fillSkeletonFromBank(skeleton(), rows, [singles(3), [g()], singles(2)], { allowPartSize: true });
  assert.equal(fit.skills.reading.sections[1].fields.length, 2);
  assert.deepEqual(fit.shortages, []);
  assert.equal(fit.total, 7);
  // P3 đánh số tiếp liền sau nhóm 2 câu
  assert.deepEqual(fit.skills.reading.sections[2].fields.map((f) => f.id), [6, 7]);
});

test("fill: nhóm nhiều câu hơn chỗ -> chỉ khi tick mới đặt, không thì báo thiếu", () => {
  const { rows } = planOf({});
  const big = () => group([1, 2, 3, 4], "(1) (2) (3) (4)");
  const no = fillSkeletonFromBank(skeleton(), rows, [singles(3), [big()], singles(2)]);
  assert.equal(no.skills.reading.sections[1].passageText, PASSAGE_PLACEHOLDER);
  assert.equal(no.skills.reading.sections[1].fields.length, 3);
  assert.equal(no.shortages[0].missing, 3);

  const yes = fillSkeletonFromBank(skeleton(), rows, [singles(3), [big()], singles(2)], { allowPartSize: true });
  assert.equal(yes.skills.reading.sections[1].fields.length, 4);
  assert.equal(yes.total, 9);
  assert.deepEqual(yes.skills.reading.sections[2].fields.map((f) => f.id), [8, 9]);
  assert.equal(yes.skills.reading.sections[1].passageText, "(4) (5) (6) (7)");
});

test("fill: nhiều nhóm được trả về cho 1 phần đoạn văn -> chỉ dùng 1 nhóm lớn nhất vừa chỗ", () => {
  const { rows } = planOf({});
  const small = group([1], "(1)");
  const full = group([1, 2, 3], "(1) (2) (3)");
  const res = fillSkeletonFromBank(skeleton(), rows, [singles(3), [small, full], singles(2)]);
  assert.equal(res.skills.reading.sections[1].fields[0].bankItemId, String(full._id));
  assert.equal(res.filled, 8);
});

test("viết lại chỗ trống: (n), [n], ___n___, n...... đổi theo bản đồ; 'n.' trơn và năm không đụng", () => {
  const map = new Map([[21, 4], [22, 5], [23, 6], [24, 7]]);
  const r = rewriteBlanks("In 2020 (21) a [22] b ___23___ c 24...... d. 21. is a list item, year (1990).", map);
  assert.equal(r.text, "In 2020 (4) a [5] b ___6___ c 7...... d. 21. is a list item, year (1990).");
  assert.deepEqual(r.unmatched, []);
});

test("viết lại chỗ trống: không đổi chuỗi trong chuỗi (21 -> 5 và 5 -> 6 không nối dây)", () => {
  const r = rewriteBlanks("(5) then (21)", new Map([[5, 6], [21, 5]]));
  assert.equal(r.text, "(6) then (5)");
});

test("chỗ trống không khớp câu nào -> báo cờ, không đoán và không đổi", () => {
  const { rows } = planOf({});
  const g = group([21, 22, 23], "(21) (22) (23) and also (99).");
  const res = fillSkeletonFromBank(skeleton(), rows, [singles(3), [g], singles(2)]);
  assert.equal(res.skills.reading.sections[1].passageText, "(4) (5) (6) and also (99).");
  assert.equal(res.flags.length, 1);
  assert.equal(res.flags[0].part, "P2");
  assert.match(res.flags[0].message, /\(99\)/);
  assert.equal(describeFill(res).length, 2);
});

test("nhãn: topic/difficulty của mục chép xuống câu, giá trị sẵn có của câu thắng", () => {
  const { rows } = planOf({});
  const s1 = single({ topic: "t-tense", difficulty: "nb" });
  const s2 = single({ topic: "t-tense", difficulty: "nb", fields: [srvWform(1, { difficulty: "vd", topic: "mine" })] });
  const s3 = single(); // mục không nhãn -> câu không nhãn
  const res = fillSkeletonFromBank(skeleton(), rows, [[s1, s2, s3], [], []]);
  const f = res.skills.reading.sections[0].fields;
  assert.deepEqual([f[0].topic, f[0].difficulty], ["t-tense", "nb"]);
  assert.deepEqual([f[1].topic, f[1].difficulty], ["mine", "vd"]);
  assert.deepEqual([f[2].topic, f[2].difficulty], ["", ""]);
});

test("không trùng: cùng 1 mục xuất hiện ở 2 hàng chỉ vào đề 1 lần", () => {
  const { rows } = planOf({});
  const a = single();
  const res = fillSkeletonFromBank(skeleton(), rows, [[a], [], [a]]);
  assert.equal(res.filled, 1);
  assert.equal(res.skills.reading.sections[2].fields[0].bankItemId, undefined);
  assert.deepEqual(collectBankItemIds(res.skills), [String(a._id)]);
});

test("fill: ma trận theo mức độ -> mỗi hàng nhận câu của hàng đó, đủ số câu", () => {
  const { rows } = planOf({ "reading:0:0": { any: "1", nb: "2", th: "", vd: "", vdc: "" } });
  assert.equal(rows.filter((r) => r.part === 0).length, 2);
  const picked = [[single()], [single(), single()], [group([1, 2, 3], "(1)(2)(3)")], singles(2)];
  const res = fillSkeletonFromBank(skeleton(), rows, picked);
  assert.equal(res.filled, 8);
  assert.deepEqual(res.shortages, []);
});

// ---------------------------------------------------------------- bankItemId không lên server

test("bankItemId / bankFormat / bankKind chỉ ở editor: fieldToServer và payload lưu đều không có", () => {
  const { rows } = planOf({});
  const res = fillSkeletonFromBank(skeleton(), rows, [singles(3), [group([1, 2, 3], "(1)(2)(3)")], singles(2)]);
  const f = res.skills.reading.sections[0].fields[0];
  assert.ok(f.bankItemId);
  const srv = fieldToServer(f);
  for (const k of ["bankItemId", "bankFormat", "bankKind", "__src", "__srcEnd"]) assert.ok(!(k in srv), k);
  const payload = JSON.stringify(sectionsToPayload(res.skills.reading.sections, "reading"));
  assert.ok(!payload.includes("bankItemId") && !payload.includes("bankKind") && !payload.includes("bankFormat"));
});

// ---------------------------------------------------------------- Swap

function filled() {
  const { rows } = planOf({});
  const g = group([21, 22, 23], "Read (21) and (22) and (23).", { topic: "t-x", difficulty: "th" });
  const s = [single({ topic: "t-tense", difficulty: "nb" }), single(), single()];
  const res = fillSkeletonFromBank(skeleton(), rows, [s, [g], singles(2)]);
  return { sections: res.skills.reading.sections, skills: res.skills, g, s };
}

test("swap câu lẻ: thay đúng câu đó, giữ số câu và nhãn, chỉ khác nội dung + bankItemId", () => {
  const { sections } = filled();
  const before = JSON.stringify(sections);
  const repl = single({ topic: "t-tense", difficulty: "nb", fields: [srvWform(1, { label: "NEW" })] });
  const r = swapInSections(sections, 0, 0, repl);
  assert.equal(JSON.stringify(sections), before); // không sửa đầu vào
  const f = r.sections[0].fields;
  assert.equal(f[0].label, "NEW");
  assert.equal(f[0].id, 1);
  assert.equal(f[0].bankItemId, String(repl._id));
  assert.deepEqual([f[0].topic, f[0].difficulty], ["t-tense", "nb"]);
  assert.equal(f[1].label, sections[0].fields[1].label);
  assert.equal(JSON.stringify(r.sections[1]), JSON.stringify(sections[1]));
});

test("swap nhóm: thay cả nhóm cùng cỡ, giữ số câu, viết lại chỗ trống theo số câu cũ", () => {
  const { sections } = filled();
  const repl = group([5, 6, 7], "New (5), (6), [7].", { imageId: "img2" });
  const r = swapInSections(sections, 1, 0, repl);
  const sec = r.sections[1];
  assert.deepEqual(sec.fields.map((f) => f.id), [4, 5, 6]);
  assert.equal(sec.passageText, "New (4), (5), [6].");
  assert.equal(sec.imageId, "img2");
  assert.ok(sec.fields.every((f) => f.bankItemId === String(repl._id)));
  assert.equal(r.sections[0].fields[0].bankItemId, sections[0].fields[0].bankItemId);
});

test("swap nhóm: khác cỡ bị từ chối; mục lẻ không thay nhóm và ngược lại", () => {
  const { sections } = filled();
  assert.match(swapInSections(sections, 1, 0, group([1, 2], "(1)(2)")).error, /exactly 3/);
  assert.ok(swapInSections(sections, 1, 0, single()).error);
  assert.ok(swapInSections(sections, 0, 0, group([1, 2, 3], "x")).error);
  assert.ok(swapInSections(sections, 0, 0, null).error);
});

test("swap: câu không lấy từ ngân hàng -> lỗi; pickSwapCandidate bỏ qua mục không dùng được", () => {
  const { sections } = filled();
  const plain = structuredClone(sections);
  delete plain[0].fields[0].bankItemId;
  assert.ok(swapInSections(plain, 0, 0, single()).error);
  const ok = single();
  assert.equal(pickSwapCandidate([group([1, 2], "x"), ok], sections, 0, 0), ok);
  assert.equal(pickSwapCandidate([group([1, 2], "x")], sections, 0, 0), null);
  assert.equal(pickSwapCandidate([], sections, 0, 0), null);
});

test("swap: thân gửi pick cùng dạng/mức độ/chủ điểm, loại mọi mục đã có trong cả đề, nới được", () => {
  const { sections, skills } = filled();
  const exclude = collectBankItemIds({ ...skills, listening: { sections: [{ fields: [{ bankItemId: "x".repeat(24) }] }] } });
  const body = swapPickBody({ program: "general", level: 12, sections, si: 0, fi: 0, excludeIds: exclude });
  assert.deepEqual(body.rows, [{ format: "g-wform", count: 1, difficulty: "nb", topic: "t-tense" }]);
  assert.equal(body.excludeIds.length, 7); // 6 mục lẻ/nhóm trong reading + 1 listening
  assert.ok(body.excludeIds.includes(sections[0].fields[0].bankItemId));
  const loose = swapPickBody({ program: "general", level: 12, sections, si: 0, fi: 0, excludeIds: exclude, sameDifficulty: false, sameTopic: false });
  assert.deepEqual(loose.rows, [{ format: "g-wform", count: 1 }]);
  const g = swapPickBody({ program: "general", level: 12, sections, si: 1, fi: 1, excludeIds: [] });
  assert.deepEqual(g.rows, [{ format: "g-cloze", count: 3, difficulty: "th", topic: "t-x" }]);
});
