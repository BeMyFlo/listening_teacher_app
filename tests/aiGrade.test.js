const test = require("node:test");
const assert = require("node:assert/strict");
const { overallBand } = require("../lib/grading/rubric");
const { validateAiGrade, normaliseAiGrade } = require("../lib/grading/aiGradeSchema");
const { buildSegments, applyAnnotations, normalizeAnnotation } = require("../lib/grading/annotate");
const { preservesMeaning, guardAnnotations, inventedNumbers, improvedSampleProblems } = require("../lib/grading/meaningGuard");

const V = "writing.task1";
const crit = (ta, cc, lr, gra) => [
  { key: "TA", band: ta, comment: "c" },
  { key: "CC", band: cc, comment: "c" },
  { key: "LR", band: lr, comment: "c" },
  { key: "GRA", band: gra, comment: "c" },
];
const bands = (a) => crit(...a).map((c) => ({ band: c.band }));

const ESSAY = `The pie chart illustrates the frequency of pupils reading and speaking English beyond the classroom in Japanese university.

Overall, it is apparent that most students almost never use English in their everyday life, while only a minority use it almost everyday in both skills.

It can be seen that over a half of learners who never practice English out of class. Specifically, 57% of Japanese undergraduates almost never spoke English, while the figure of those who never read English was slightly lower, at 54%. Meanwhile, Only a minority enhanced their languages skills of both almost everyday, 7% for reading and 5% for speaking.

Regarding to the remain of frequency levels, there is a roughly similar of students read and speak English once a weak or less stand at approximate one-fifth, at 21% and 20%, respectively. In addition, the shares of students who use English twice a week or more were exactly similar in both categories, at 18%.`;

const ann = (quote, insertText, extra = {}) => ({
  quote, occurrence: 1, action: insertText == null ? "comment" : "replace", insertText, category: "grammar", criterion: "GRA", comment: "x", severity: "minor", ...extra,
});

const payload = (over = {}) => ({
  annotations: [
    ann("in Japanese university", "at Japanese universities"),
    ann("the figure of those", "the figure for those", { category: "vocabulary", criterion: "LR" }),
    ann("Regarding to", "Regarding"),
    ann("once a weak", "once a week", { category: "spelling", criterion: "LR" }),
    ann("approximate", "approximately"),
    ann("were exactly similar", "were identical", { category: "vocabulary", criterion: "LR" }),
    ann("over a half of learners who never practice English out of class.", "over half of learners never practise English out of class.", { severity: "major" }),
  ],
  criteria: crit(6, 6, 5, 5),
  overallFeedback: "ok",
  suggestedOverall: 6, // model's wrong claim
  priorities: ["a", "b", "c"],
  topicVocabulary: [{ term: "t", meaning: "m", example: "e" }],
  improvedSample: "Most students almost never use English outside class: 57% almost never speak it, while the figure for reading is slightly lower, at 54%. Only a minority use it almost every day, at 7% and 5%.",
  ...over,
});

test("overall: 6,6,5,5 -> 5.5 (not the model's 6)", () => {
  assert.equal(overallBand(crit(6, 6, 5, 5)), 5.5);
  const d = normaliseAiGrade(payload(), ESSAY, V);
  assert.equal(d.suggestedOverall, 5.5);
});

test("IELTS rounding across combinations", () => {
  const cases = [
    [[5, 5, 5, 5], 5], [[6, 6, 6, 7], 6.5], [[6, 6, 7, 7], 6.5], [[6, 7, 7, 7], 7],
    [[5, 5, 5, 6], 5.5], [[5, 5, 6, 6], 5.5], [[5, 6, 6, 6], 6], [[4, 4, 5, 5], 4.5],
    [[9, 9, 9, 8], 9], [[1, 1, 1, 2], 1.5], [[7, 6, 6, 6], 6.5], [[6, 5, 5, 5], 5.5],
  ];
  for (const [b, want] of cases) assert.equal(overallBand(bands(b)), want, b.join(","));
});

test("model suggestedOverall is ignored whatever it says", () => {
  for (const v of [9, 0, null, "7", undefined]) {
    assert.equal(normaliseAiGrade(payload({ suggestedOverall: v }), ESSAY, V).suggestedOverall, 5.5);
  }
});

test("response contract: same fields as before; annotation shape unchanged", () => {
  const d = normaliseAiGrade(payload(), ESSAY, V);
  assert.deepEqual(Object.keys(d).sort(), ["annotations", "criteria", "improvedSample", "overallFeedback", "priorities", "suggestedOverall", "topicVocabulary", "unresolved"].sort());
  assert.deepEqual(d.criteria.map((c) => c.key), ["TA", "CC", "LR", "GRA"]);
  assert.deepEqual(Object.keys(d.criteria[0]).sort(), ["band", "comment", "key"]);
  assert.deepEqual(Object.keys(d.annotations[0]).sort(), ["action", "category", "comment", "criterion", "end", "id", "insertText", "quote", "severity", "source", "start"]);
  assert.equal(d.unresolved, 0);
});

test("annotations anchor to real essay text and render via buildSegments", () => {
  const d = normaliseAiGrade(payload(), ESSAY, V);
  for (const a of d.annotations) {
    assert.equal(ESSAY.slice(a.start, a.end), a.quote);
    assert.equal(a.source, "ai");
  }
  const segs = buildSegments(ESSAY, d.annotations);
  assert.equal(segs.filter((s) => s.kind !== "ins").map((s) => s.text).join(""), ESSAY); // original text intact
  assert.ok(applyAnnotations(ESSAY, d.annotations).includes("once a week"));
});

test("legacy persisted annotations (no severity) still normalise", () => {
  const old = { start: 0, end: 3, quote: "The", action: "replace", insertText: "A", category: "grammar", criterion: "GRA", comment: "", source: "ai" };
  const n = normalizeAnnotation(old, ESSAY);
  assert.equal(n.severity, null);
  assert.equal(buildSegments(ESSAY, [old])[0].kind, "del");
});

test("meaning guard: 'almost never' must not become 'never'", () => {
  assert.equal(preservesMeaning("57% of Japanese undergraduates almost never spoke English", "57% of Japanese undergraduates never spoke English"), false);
  const d = normaliseAiGrade(payload({ annotations: [ann("almost never spoke English", "never spoke English")] }), ESSAY, V);
  assert.equal(d.annotations.length, 1);
  assert.equal(d.annotations[0].action, "comment");
  assert.equal(d.annotations[0].insertText, "");
});

test("meaning guard: figures, direction and magnitude are protected; real fixes pass", () => {
  assert.equal(preservesMeaning("at 54%", "at 45%"), false);
  assert.equal(preservesMeaning("slightly lower", "lower"), false);
  assert.equal(preservesMeaning("over a half", "under a half"), false);
  assert.equal(preservesMeaning("rose to 20%", "fell to 20%"), false);
  assert.equal(preservesMeaning("approximate", "approximately"), true);
  assert.equal(preservesMeaning("once a weak", "once a week"), true);
  assert.equal(preservesMeaning("were exactly similar", "were identical"), true);
  assert.equal(preservesMeaning("at 21% and 20%, respectively", "at 21% and 20%, respectively"), true);
  assert.equal(preservesMeaning("Regarding to", "Regarding"), true);
  assert.equal(preservesMeaning("over a half of learners who never practice", "over half of learners who never practise"), true);
});

test("meaning guard only touches replace", () => {
  const { annotations, demoted } = guardAnnotations([{ action: "comment", quote: "54%", insertText: "" }, { action: "replace", quote: "54%", insertText: "45%" }]);
  assert.equal(demoted, 1);
  assert.equal(annotations[0].action, "comment");
  assert.equal(annotations[1].action, "comment");
});

test("inventedNumbers flags figures absent from essay/task", () => {
  assert.deepEqual(inventedNumbers("57% and 99%", ESSAY, ""), ["99"]);
  assert.deepEqual(inventedNumbers("57% and 99%", ESSAY, "year 99"), []);
});

test("validation accepts good payload, rejects invalid ones", () => {
  assert.equal(validateAiGrade(payload(), V), null);
  const bad = (o) => validateAiGrade(payload(o), V);
  assert.match(bad({ criteria: crit(6, 6, 5, null) }), /bad band for GRA/);
  assert.match(bad({ criteria: crit(6, 6, "5", 5) }), /bad band for LR/);
  assert.match(bad({ criteria: crit(6, 6, 5, 10) }), /bad band/);
  assert.match(bad({ criteria: crit(6, 6, 5, 0) }), /bad band/);
  assert.match(bad({ criteria: crit(6, 6, 5.5, 5) }), /bad band/);
  assert.match(bad({ criteria: crit(6, 6, 5, 5).slice(0, 3) }), /missing criterion GRA/);
  assert.match(bad({ criteria: [...crit(6, 6, 5, 5), { key: "TA", band: 7, comment: "c" }] }), /duplicate/);
  assert.match(bad({ criteria: [...crit(6, 6, 5, 5).slice(0, 3), { key: "TR", band: 5, comment: "c" }] }), /unknown criterion TR/);
  assert.match(bad({ criteria: [null] }), /malformed/);
  assert.match(bad({ criteria: [{ key: "TA", band: 6, comment: "" }, ...crit(6, 6, 5, 5).slice(1)] }), /missing comment/);
  assert.match(bad({ annotations: [null] }), /malformed annotation/);
  assert.match(bad({ annotations: [{ action: "explode" }] }), /bad action/);
  assert.match(validateAiGrade(null, V), /empty/);
  assert.match(validateAiGrade({ criteria: crit(6, 6, 5, 5) }, V), /annotations missing/);
});

test("Task 2 rubric needs TR, not TA", () => {
  const t2 = payload({ criteria: [{ key: "TR", band: 6, comment: "c" }, ...crit(6, 6, 5, 5).slice(1)] });
  assert.equal(validateAiGrade(t2, "writing.task2"), null);
  assert.match(validateAiGrade(payload(), "writing.task2"), /unknown criterion TA/);
});

test("missing task/chart info: grading still normalises without taskText", () => {
  const d = normaliseAiGrade(payload(), ESSAY, V);
  assert.equal(d.suggestedOverall, 5.5);
});

test("unresolvable quote is dropped, not crashing", () => {
  const d = normaliseAiGrade(payload({ annotations: [ann("text that is not in the essay", "x")] }), ESSAY, V);
  assert.equal(d.annotations.length, 0);
  assert.equal(d.unresolved, 1);
});

const mk = (n) => Array.from({ length: n }, (_, i) => ann("the", "The", { occurrence: 1, severity: "minor" }));

test("annotation count: no minimum, capped at 12 keeping the important ones", () => {
  assert.equal(normaliseAiGrade(payload({ annotations: [] }), ESSAY, V).annotations.length, 0);
  assert.equal(normaliseAiGrade(payload({ annotations: [ann("once a weak", "once a week")] }), ESSAY, V).annotations.length, 1);
  const words = ["Overall", "Specifically", "Meanwhile", "Regarding", "In addition", "Cinema", "Egypt", "Japan", "Brazil", "Canada", "Japanese", "Looking", "Online", "once a weak"];
  const many = words.map((w) => ann(w, w + "!", { severity: "minor", category: "vocabulary", criterion: "LR" }));
  many.push(ann("57% of Japanese undergraduates almost never spoke English", null, { action: "comment", category: "idea", criterion: "TA", severity: "major" }));
  const d = normaliseAiGrade(payload({ annotations: many }), ESSAY, V);
  assert.ok(d.annotations.length <= 12);
  assert.ok(d.annotations.some((a) => a.category === "idea")); // idea error survives the cap
});

test("improvedSample guard: qualifiers, absolutes, new figures, reversals", () => {
  const essay = "Most students almost never speak English, 57%. The figure for reading was slightly lower, at 54%. Japan was higher than Canada at 62% and 55%.";
  assert.deepEqual(improvedSampleProblems("Most students almost never speak English, 57%. The figure for reading was slightly lower, at 54%. Japan was higher than Canada at 62% and 55%.", essay), []);
  assert.ok(improvedSampleProblems("All students almost never speak English, 57%. Reading was slightly lower, at 54%.", essay).length); // most -> all
  assert.ok(improvedSampleProblems("Most students never speak English, 57%. Reading was slightly lower, at 54%.", essay).length); // almost never -> never
  assert.ok(improvedSampleProblems("Most students almost never speak English, 57%. Reading was lower, at 54%.", essay).length); // slightly dropped
  assert.ok(improvedSampleProblems("Most students almost never speak English, 57%. Reading was slightly lower, at 54%. Canada was higher than Japan at 55% and 62%.", essay).length); // reversal
  assert.ok(improvedSampleProblems("Most students almost never speak English, 57%. Reading was slightly lower, at 54%. About 30% did sport.", essay).length); // new figure
});

test("a distorted improvedSample is dropped, not shown", () => {
  const d = normaliseAiGrade(payload({ improvedSample: "57% of undergraduates never spoke English, 54% for reading." }), ESSAY, V);
  assert.equal(d.improvedSample, "");
  assert.equal(d.unresolved, 1);
  assert.equal(normaliseAiGrade(payload(), ESSAY, V).improvedSample.length > 0, true);
});

test("meaning guard: most->all, approximate->exact, reversal in annotations", () => {
  assert.equal(preservesMeaning("most students", "all students"), false);
  assert.equal(preservesMeaning("more than half", "all"), false);
  assert.equal(preservesMeaning("approximately 20%", "20%"), false);
  assert.equal(preservesMeaning("Japan was higher than Canada", "Canada was higher than Japan"), false);
  assert.equal(preservesMeaning("Japan was higher than Canada", "Japan was higher than Canada."), true);
});

test("prompt carries the calibration rules (GRA pattern, no quota, no over-correction)", () => {
  const p = require("../lib/grading/prompts/writingSystem");
  assert.match(p, /understandable is NOT sufficient evidence/);
  assert.match(p, /UP TO 12/);
  assert.match(p, /NO minimum/);
  assert.match(p, /acceptable but basic -> do NOT annotate/);
  assert.match(p, /why is it not one band lower/);
  assert.match(p, /almost" must never become "always"/);
  assert.doesNotMatch(p, /6–12/);
});
