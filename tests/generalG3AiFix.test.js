const test = require("node:test");
const assert = require("node:assert/strict");

const { toGeneralSection } = require("../lib/ai/generalSections");
const generalExercise = require("../lib/ai/generalExercise");
const { GENERAL_TIER_GUIDE } = require("../lib/ai/grammarLesson");

const conv = (format, questions, opts = {}) =>
  toGeneralSection({ format, name: "x", questions }, { subject: "grammar", strict: true, ...opts });

// 1. Check prompt per format
test("buildCheckPrompt: fill shows the whole gapped sentence and keys", () => {
  const q = { format: "g-verb", before: "She", after: "to school every day.", hint: "(go)", answer: "goes", altAnswers: ["is going"] };
  const p = generalExercise.buildCheckPrompt([q], { format: "g-verb" });
  assert.match(p, /1\. \[fill\] She \(go\) ___ to school every day\.\s+Key: goes \/ is going/);
});

test("buildCheckPrompt: fill falls back to text with ___", () => {
  const q = { format: "g-wform", text: "The ____ is bad.", hint: "(pollute)", answer: "pollution", altAnswers: [] };
  const p = generalExercise.buildCheckPrompt([q], { format: "g-wform" });
  assert.match(p, /The ___ is bad\. \(pollute\)/);
});

test("buildCheckPrompt: rewrite includes original, start and continuation key", () => {
  const q = { format: "g-rewrite", text: "I started learning English in 2015.", start: "I have", answer: "learned English since 2015." };
  const p = generalExercise.buildCheckPrompt([q], { format: "g-rewrite" });
  assert.match(p, /\[sentence transformation\] Original: I started learning English in 2015\./);
  assert.match(p, /Rewrite beginning with: I have/);
  assert.match(p, /Key \(continuation after the given beginning\): learned English since 2015\./);
});

test("buildCheckPrompt: combine, error labels, pron/stress IPA, plain options", () => {
  const comb = { format: "g-combine", text: "He is tired. He works.", start: "", answer: "He works although he is tired." };
  assert.match(generalExercise.buildCheckPrompt([comb], { format: "g-combine" }), /\[sentence combination\] Sentences: He is tired\. He works\.\s+Begin with \/ use: -\s+Key:/);

  const err = { format: "g-error", text: "She <u>go</u> to <u>school</u> <u>every</u> <u>day</u>.", answer: "A" };
  const pe = generalExercise.buildCheckPrompt([err], { format: "g-error" });
  assert.match(pe, /\[error identification\] She \(A\)\[go\] to \(B\)\[school\] \(C\)\[every\] \(D\)\[day\]\./);
  assert.match(pe, /Options: A \| B \| C \| D\s+Key: A/);

  const pron = { format: "g-pron", text: "", options: ["c<u>a</u>t", "m<u>a</u>ke"], answer: "c<u>a</u>t", ipa: ["kæt", "meɪk"] };
  const pp = generalExercise.buildCheckPrompt([pron], { format: "g-pron" });
  assert.match(pp, /pronounced differently/);
  assert.match(pp, /Options: cat \| make/);
  assert.match(pp, /IPA: kæt \| meɪk/);
  assert.match(pp, /copy options in 'acceptable' exactly/);
  assert.doesNotMatch(pp, /<u>/);

  const st = { format: "g-stress", text: "", options: ["a", "b"], answer: "a", ipa: ["ˈa", "bˈ"] };
  assert.match(generalExercise.buildCheckPrompt([st], { format: "g-stress" }), /word stress/);

  const syn = { format: "g-syn", text: "CLOSEST in meaning: He is <u>happy</u>.", options: ["glad", "sad"], answer: "glad" };
  assert.match(generalExercise.buildCheckPrompt([syn], { format: "g-syn" }), /CLOSEST in meaning: He is happy\./);
});

test("normalizeTopic keeps raw ipa array", () => {
  const t = generalExercise.normalizeTopic(
    { questions: [{ text: "", options: ["a", "b"], answer: "a", ipa: ["x", "y"] }] },
    {},
    "g-pron"
  );
  assert.deepEqual(t.questions[0].ipa, ["x", "y"]);
});

// 2. checkQuestions
test("checkQuestions: pron options with <u> pass when checker returns plain words", () => {
  const q = { format: "g-pron", text: "", options: ["c<u>a</u>t", "m<u>a</u>ke", "h<u>a</u>te", "l<u>a</u>te"], answer: "c<u>a</u>t" };
  const { kept, removed } = generalExercise.checkQuestions([q], {
    items: [{ n: 1, keyIsCorrect: true, acceptable: ["cat"] }],
  });
  assert.equal(removed.length, 0);
  assert.equal(kept.length, 1);
});

test("checkQuestions: g-error kept when checker accepts only the key letter; dropped otherwise", () => {
  const q = { format: "g-error", text: "She <u>go</u> to <u>school</u> <u>every</u> <u>day</u>.", answer: "A", options: [] };
  let r = generalExercise.checkQuestions([q], { items: [{ n: 1, keyIsCorrect: true, acceptable: ["A"] }] });
  assert.equal(r.kept.length, 1);
  r = generalExercise.checkQuestions([q], { items: [{ n: 1, keyIsCorrect: true, acceptable: ["A", "C"] }] });
  assert.equal(r.kept.length, 0);
  assert.match(r.removed[0].reason, /more than one option/);
  r = generalExercise.checkQuestions([q], { items: [{ n: 1, keyIsCorrect: true, acceptable: ["B"] }] });
  assert.equal(r.kept.length, 0);
});

// 3. finalizeTopic cuts after conversion
test("finalizeTopic: keeps questionCount when converter drops one of the first N", () => {
  const good = (n) => ({ text: `Q${n} ____`, options: ["a", "b", "c", "d"], answer: "a" });
  const bad = { text: "bad ____", options: ["a", "b", "c", "d"], answer: "zzz" };
  const questions = [good(1), bad, good(3), good(4)];
  const res = generalExercise.finalizeTopic({ name: "n", format: "g-mcq" }, questions, { subject: "grammar", questionCount: 3 });
  const fields = res.exerciseSections[0].fields;
  assert.equal(fields.length, 3);
  assert.deepEqual(fields.map((f) => f.id), [1, 2, 3]);
});

test("finalizeTopic: flags beyond the cut are dropped", () => {
  const qs = [1, 2, 3].map((n) => ({ text: "", options: ["c<u>a</u>t", "m<u>a</u>ke", "h<u>a</u>te", "l<u>a</u>te"], answer: "c<u>a</u>t" }));
  const res = generalExercise.finalizeTopic({ name: "n", format: "g-pron" }, qs, { subject: "vocabulary", questionCount: 2 });
  assert.ok(res.flags.every((f) => f.fi < 2));
  assert.equal(res.flags.length, 2);
});

// 4. fill split and hint
test("fill formats: split text at first blank when before/after empty; hint gets parentheses", () => {
  const { section } = conv("g-verb", [{ text: "She ____ to school every day.", hint: "go", answer: "goes" }]);
  const f = section.fields[0];
  assert.equal(f.label, "She");
  assert.equal(f.post, "to school every day.");
  assert.equal(f.hint, "(go)");
  const r2 = conv("g-wform", [{ text: "The ____ is bad.", hint: "(pollute)", answer: "pollution" }]);
  assert.equal(r2.section.fields[0].hint, "(pollute)");
  assert.equal(r2.section.fields[0].label, "The");
});

// 5. combine behaves like rewrite
test("g-combine: pre = start, answers are the continuation", () => {
  const { section } = conv("g-combine", [
    { text: "He is tired. He works.", start: "Although he is tired,", answer: "he works." },
  ]);
  const f = section.fields[0];
  assert.equal(f.pre, "Although he is tired,");
  assert.equal(f.label, "He is tired. He works.");
  assert.deepEqual(f.answers, ["he works."]);
  assert.match(generalExercise.FORMAT_GUIDE["g-combine"], /continuation AFTER `start`/);
});

// 6. reorder verification
test("g-reorder: pieces must form the answer; mismatch dropped (strict) / flagged (non-strict)", () => {
  const ok = conv("g-reorder", [{ pieces: ["She", "always", "smiles."], answer: "She always smiles." }]);
  assert.equal(ok.section.fields.length, 1);

  const bad = { pieces: ["She", "always", "smiles."], answer: "She never smiles." };
  const strict = conv("g-reorder", [bad]);
  assert.equal(strict.section.fields.length, 0);
  assert.match(strict.removed[0].reason, /Pieces do not form the answer sentence/);

  const loose = conv("g-reorder", [bad], { strict: false });
  assert.equal(loose.section.fields.length, 1);
  assert.equal(loose.flags.length, 1);
});

test("g-reorder: answers capped to 6", () => {
  const alts = ["a b", "b a", "a  b", "A b", "B a", "a, b", "b, a"];
  const { section } = conv("g-reorder", [{ pieces: ["a", "b"], answer: "a b", altAnswers: alts }]);
  assert.ok(section.fields[0].answers.length <= 6);
});

// 7. tier guide reuse and Grade line
test("generalExercise reuses GENERAL_TIER_GUIDE; Grade line only when level set", () => {
  const base = { subject: "grammar", focus: "x", questionCount: 5, language: "en" };
  assert.doesNotMatch(generalExercise.buildPrompt({ ...base }, "g-mcq"), /- Grade:/);
  assert.match(generalExercise.buildPrompt({ ...base, level: "9" }, "g-mcq"), /- Grade: 9/);
  assert.ok(GENERAL_TIER_GUIDE.core);
});

// 8. underscore + underline
test("g-error / g-syn: leftover ____ does not break the underlined parts", () => {
  const err = conv("g-error", [
    { text: "____ <u>happy</u> people <u>is</u> <u>very</u> <u>kind</u>.", answer: "B" },
  ]);
  assert.equal(err.removed.length, 0, JSON.stringify(err.removed));
  assert.equal(err.section.fields.length, 1);
  assert.match(err.section.fields[0].label, /^… __happy__ people __is__ __very__ __kind__\.$/);

  const syn = conv("g-syn", [
    { text: "CLOSEST: ____ <u>happy</u>", options: ["glad", "sad"], answer: "glad" },
  ]);
  assert.equal(syn.removed.length, 0, JSON.stringify(syn.removed));
  assert.match(syn.section.fields[0].label, /… __happy__/);
});
