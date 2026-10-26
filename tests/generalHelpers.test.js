const test = require("node:test");
const assert = require("node:assert/strict");
const U = require("../lib/underline");
const { normalizeSentence } = require("../lib/sentenceMatch");
const G = require("../lib/generalFormats");

// rng có hạt giống (mulberry32) để test xác định.
function seeded(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test("parseUnderline: h__ea__d → 3 đoạn, giữa gạch chân", () => {
  assert.deepEqual(U.parseUnderline("h__ea__d"), [
    { text: "h", u: false },
    { text: "ea", u: true },
    { text: "d", u: false },
  ]);
});

test("parseUnderline: chỗ trống ____ không phải gạch chân", () => {
  assert.deepEqual(U.parseUnderline("I ____ go"), [{ text: "I ____ go", u: false }]);
  assert.equal(U.hasUnderline("I ____ go to ________ school"), false);
});

test("parseUnderline: rỗng / không phải chuỗi → []", () => {
  assert.deepEqual(U.parseUnderline(""), []);
  assert.deepEqual(U.parseUnderline(null), []);
  assert.deepEqual(U.parseUnderline(42), []);
});

test("parseUnderline: __ không đóng giữ nguyên chữ", () => {
  assert.deepEqual(U.parseUnderline("a __b c"), [{ text: "a __b c", u: false }]);
  assert.equal(U.stripUnderline("a __b c"), "a __b c");
});

test("parseUnderline: không xuống dòng bên trong", () => {
  assert.equal(U.hasUnderline("a __b\nc__ d"), false);
});

test("nhiều phần gạch chân + stripUnderline + underlinedParts", () => {
  const t = "My mother __usually go__ to __the__ market __every__ day __.__";
  assert.deepEqual(U.underlinedParts(t), ["usually go", "the", "every", "."]);
  assert.equal(U.stripUnderline(t), "My mother usually go to the market every day .");
  assert.equal(U.hasUnderline(t), true);
});

test("gạch chân chữ tiếng Việt", () => {
  assert.deepEqual(U.underlinedParts("Tôi __đang học__ bài"), ["đang học"]);
});

test("gạch chân cạnh chỗ trống", () => {
  assert.deepEqual(U.underlinedParts("____ __x__ ____"), ["x"]);
});

test("normalizeSentence: hasn't gone = has not gone", () => {
  assert.equal(normalizeSentence("She hasn't gone."), normalizeSentence("she has not gone"));
});

test("normalizeSentence: I'm / I am, 're, 've, 'll, 'd", () => {
  assert.equal(normalizeSentence("I'm"), normalizeSentence("I am"));
  assert.equal(normalizeSentence("They're here"), "they are here");
  assert.equal(normalizeSentence("We've left"), "we have left");
  assert.equal(normalizeSentence("He'll go"), "he will go");
  assert.equal(normalizeSentence("She'd go"), "she would go");
});

test("normalizeSentence: won't / can't / shan't / can not", () => {
  assert.equal(normalizeSentence("I won't go"), "i will not go");
  assert.equal(normalizeSentence("I can't go"), "i cannot go");
  assert.equal(normalizeSentence("I can not go"), "i cannot go");
  assert.equal(normalizeSentence("I shan't go"), "i shall not go");
  assert.equal(normalizeSentence("They don't know"), "they do not know");
});

test("normalizeSentence: nháy cong, gạch ngang dài", () => {
  assert.equal(normalizeSentence("I’m here"), "i am here");
  assert.equal(normalizeSentence("a – b — c"), "a - b - c");
});

test("normalizeSentence: KHÔNG mở 's", () => {
  assert.equal(normalizeSentence("He's gone"), "he's gone");
  assert.notEqual(normalizeSentence("He's gone"), normalizeSentence("he is gone"));
  assert.equal(normalizeSentence("Tom's book"), "tom's book");
});

test("normalizeSentence: dấu cuối, dấu phẩy, khoảng trắng", () => {
  assert.equal(normalizeSentence("Yes , I do !!!"), "yes, i do");
  assert.equal(normalizeSentence("Yes,I do?!"), "yes, i do");
  assert.equal(normalizeSentence("  a   b  "), "a b");
  assert.equal(normalizeSentence(null), "");
});

test("GENERAL_LABELS: đủ 22 nhãn, đúng ký tự", () => {
  assert.equal(Object.keys(G.GENERAL_LABELS).length, 22);
  assert.equal(G.GENERAL_LABELS.pron, "Pronunciation — odd one out");
  assert.equal(G.GENERAL_LABELS.insert, "Sentence insertion [I]–[IV]");
  assert.equal(G.GENERAL_LABELS.cloze, "Cloze — multiple choice");
});

test("underlineModeOf / isErrorIdFormat", () => {
  assert.equal(G.underlineModeOf("Error identification"), "label");
  assert.equal(G.underlineModeOf("Synonym / Antonym"), "label");
  assert.equal(G.underlineModeOf("Pronunciation — odd one out"), "options");
  assert.equal(G.underlineModeOf("Multiple choice"), null);
  assert.equal(G.underlineModeOf(undefined), null);
  assert.equal(G.isErrorIdFormat("Error identification"), true);
  assert.equal(G.isErrorIdFormat("Synonym / Antonym"), false);
});

test("splitTokens: theo '/' và theo khoảng trắng", () => {
  assert.deepEqual(G.splitTokens("She / always / gets up / early."), ["She", "always", "gets up", "early."]);
  assert.deepEqual(G.splitTokens("She always gets up early."), ["She", "always", "gets", "up", "early."]);
  assert.deepEqual(G.splitTokens("a // b /"), ["a", "b"]);
  assert.deepEqual(G.splitTokens(""), []);
  assert.deepEqual(G.splitTokens(null), []);
});

test("shuffleTokens: rng cố định → khác thứ tự gốc, không sửa input", () => {
  const src = ["She", "always", "gets", "up", "early."];
  const copy = src.slice();
  for (let seed = 1; seed <= 30; seed++) {
    const out = G.shuffleTokens(src, seeded(seed));
    assert.notDeepEqual(out, src);
    assert.deepEqual(out.slice().sort(), src.slice().sort());
  }
  assert.deepEqual(src, copy);
  assert.deepEqual(G.shuffleTokens(src, seeded(7)), G.shuffleTokens(src, seeded(7)));
});

test("shuffleTokens: mảnh giống nhau / rỗng / 1 mảnh không lặp vô hạn", () => {
  assert.deepEqual(G.shuffleTokens(["the", "the"], () => 0.5), ["the", "the"]);
  assert.deepEqual(G.shuffleTokens(["x"]), ["x"]);
  assert.deepEqual(G.shuffleTokens([]), []);
  assert.equal(G.shuffleTokens(["a", "b", "c"], () => 0).length, 3);
});

test("arrangeDistractors: 3 hoán vị khác nhau, khác đáp án, cùng kiểu 'x-y-z'", () => {
  const out = G.arrangeDistractors("b-d-a-c-e", 3, seeded(3));
  assert.equal(out.length, 3);
  assert.equal(new Set(out).size, 3);
  for (const p of out) {
    assert.notEqual(p, "b-d-a-c-e");
    assert.match(p, /^[a-e](-[a-e]){4}$/);
    assert.deepEqual(p.split("-").sort(), ["a", "b", "c", "d", "e"]);
  }
});

test("arrangeDistractors: chấp nhận 'b, d, a' và 'bdace'", () => {
  assert.equal(G.arrangeDistractors("b, d, a", 3, seeded(1)).length, 3);
  for (const p of G.arrangeDistractors("bdace", 3, seeded(2))) assert.match(p, /^[a-e](-[a-e]){4}$/);
});

test("arrangeDistractors: ít hoán vị hơn n → trả hết có thể", () => {
  assert.deepEqual(G.arrangeDistractors("a-b", 3, seeded(1)), ["b-a"]);
  assert.equal(G.arrangeDistractors("b-a-c", 5, seeded(1)).length, 5);
  assert.deepEqual(G.arrangeDistractors("a", 3), []);
});

test("arrangeOptions: 4 lựa chọn, đáp án đúng đúng một lần", () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { options, correctIndex } = G.arrangeOptions("b-d-a-c-e", seeded(seed));
    assert.equal(options.length, 4);
    assert.equal(new Set(options).size, 4);
    assert.equal(options.filter((o) => o === "b-d-a-c-e").length, 1);
    assert.equal(options[correctIndex], "b-d-a-c-e");
  }
  const positions = new Set();
  for (let seed = 1; seed <= 40; seed++) positions.add(G.arrangeOptions("b-d-a-c-e", seeded(seed)).correctIndex);
  assert.ok(positions.size > 1);
});

test("generalQuestionError / findGeneralSectionError: kiểm tra client chặn lưu", () => {
  // 1. reorder thiếu đáp án
  assert.match(
    G.generalQuestionError({ id: 1, kind: "reorder", tokens: ["a", "b"], answersText: "" }),
    /Question 1: .*at least 1 correct answer/
  );
  // 2. reorder thiếu mảnh (< 2)
  assert.match(
    G.generalQuestionError({ id: 2, kind: "reorder", tokens: ["a"], answersText: "a" }),
    /Question 2: .*at least 2 pieces/
  );
  // 3. reorder hợp lệ
  assert.equal(
    G.generalQuestionError({ id: 3, kind: "reorder", tokens: ["b", "a"], answersText: "a b" }),
    null
  );
  // 4. Error identification thiếu gạch chân (< 2)
  assert.match(
    G.generalQuestionError({
      id: 4,
      formatLabel: "Error identification",
      label: "She __goes__ to school",
      options: [{ id: "a" }],
    }),
    /Question 4: .*requires 2 to 4/
  );
  // 5. Error identification thừa gạch chân (> 4)
  assert.match(
    G.generalQuestionError({
      id: 5,
      formatLabel: "Error identification",
      label: "__a__ __b__ __c__ __d__ __e__",
      options: [{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }],
    }),
    /Question 5: .*requires 2 to 4/
  );
  // 6. Error identification sai số lượng options
  assert.match(
    G.generalQuestionError({
      id: 6,
      formatLabel: "Error identification",
      label: "My mother __usually go__ to __the__ market",
      options: [{ id: "A" }],
    }),
    /Question 6: .*requires exactly 2/
  );
  // 7. Error identification hợp lệ
  assert.equal(
    G.generalQuestionError({
      id: 7,
      formatLabel: "Error identification",
      label: "My mother __usually go__ to __the__ market",
      options: [{ id: "A" }, { id: "B" }],
    }),
    null
  );
  // 8. Dạng khác không lỗi
  assert.equal(G.generalQuestionError({ id: 8, kind: "mcq", label: "What?", options: [] }), null);

  // findGeneralSectionError
  const sections = [
    {
      fields: [
        { id: 10, kind: "fill", label: "ok", answersText: "ans" },
        { id: 11, kind: "reorder", tokens: [], answersText: "hello world" },
      ],
    },
  ];
  const err = G.findGeneralSectionError(sections);
  assert.equal(err.fieldId, 11);
  assert.match(err.message, /Question 11/);
});
