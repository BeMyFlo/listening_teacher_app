const test = require("node:test");
const assert = require("node:assert/strict");
const {
  collectSource,
  hashSource,
  sourceHashOf,
  reviewState,
  sanitizeVocabReview,
  MAX_WORDS,
} = require("../lib/vocabReviewSource");
const { parseInput, wordInSource, checkedContext, normalizeResult } = require("../lib/ai/vocabReview");

const PASSAGE = "Governments must mitigate the effects of climate change.\n\nRenewable   energy is\ta  key part of the solution.";

const readingCat = (over = {}) => ({
  key: "reading",
  exercises: [
    {
      sections: [
        {
          passageText: PASSAGE,
          transcript: "SHOULD NOT APPEAR",
          noteText: "Climate [[1]] summary",
          matchOptions: [{ value: "A", label: "Paragraph A" }],
          fields: [
            {
              type: "fill",
              label: "What must governments do?",
              pre: "They must",
              post: "emissions",
              options: [],
              answers: ["reduce"],
            },
            {
              type: "choice",
              label: "Energy is irrelevant",
              options: [
                { value: "true", label: "True" },
                { value: "false", label: "False" },
                { value: "x", label: "Partially accurate" },
              ],
              answers: ["false"],
            },
          ],
        },
      ],
    },
  ],
  ...over,
});

const listeningCat = () => ({
  key: "listening",
  exercises: [
    {
      sections: [
        {
          passageText: "IGNORED READING TEXT",
          transcript: "Welcome to the campus tour. The library opens at nine.",
          noteBlocks: [{ noteText: "Library opens at [[2]]" }, { noteText: "Gym fee: [[3]]" }],
          noteText: "MERGED COPY SHOULD NOT REPEAT",
          fields: [
            { type: "fill", label: "Opening time", pre: "", post: "", options: [], answers: ["nine o'clock", "9"] },
            { type: "choice", label: "Where is the gym?", options: [{ value: "a", label: "Basement" }], answers: ["a"] },
          ],
        },
      ],
    },
  ],
});

// ---- collectSource ----
test("collectSource reading: passage, notes, questions and options; not transcript or fill answers", () => {
  const src = collectSource(readingCat());
  assert.ok(src.includes("Governments must mitigate"));
  assert.ok(src.includes("Climate ___ summary"), "[[n]] blanks become ___");
  assert.ok(src.includes("What must governments do?"));
  assert.ok(src.includes("They must emissions"));
  assert.ok(src.includes("Paragraph A"));
  assert.ok(src.includes("Partially accurate"));
  assert.ok(!src.includes("SHOULD NOT APPEAR"));
  assert.ok(!src.includes("reduce"), "reading does not use fill answers");
  assert.ok(!/\bTrue\b/.test(src), "True/False options are noise");
});

test("collectSource listening: transcript, notes, fill answers; not passageText", () => {
  const src = collectSource(listeningCat());
  assert.ok(src.includes("The library opens at nine."));
  assert.ok(src.includes("nine o'clock; 9"));
  assert.ok(src.includes("Library opens at ___"));
  assert.ok(src.includes("Gym fee: ___"));
  assert.ok(src.includes("Basement"));
  assert.ok(!src.includes("IGNORED READING TEXT"));
  assert.equal(src.split("MERGED COPY").length, 1, "noteBlocks win over the merged noteText");
});

test("collectSource: empty category gives empty text and tolerates junk input", () => {
  assert.equal(collectSource({ key: "reading", exercises: [] }), "");
  assert.equal(collectSource({ key: "reading" }), "");
  assert.equal(collectSource(null), "");
  assert.equal(collectSource({ key: "reading", exercises: [null, { sections: [null, {}] }] }), "");
});

test("collectSource max: keeps the passage first, then fills with the rest", () => {
  const long = "word ".repeat(200).trim();
  const cat = { key: "reading", exercises: [{ sections: [{ passageText: long, fields: [{ type: "fill", label: "QUESTION TEXT", answers: [] }] }] }] };
  const cut = collectSource(cat, { max: 100 });
  assert.ok(cut.length <= 100);
  assert.ok(cut.startsWith("word word"));
  assert.ok(!cut.includes("QUESTION TEXT"), "passage uses the whole budget");
  const roomy = collectSource(cat, { max: 5000 });
  assert.ok(roomy.includes("QUESTION TEXT"));
});

// ---- hash ----
test("hashSource is stable, whitespace-insensitive and content-sensitive", () => {
  const a = sourceHashOf(readingCat());
  assert.equal(a, sourceHashOf(readingCat()));
  assert.match(a, /^[a-z0-9]+-[a-z0-9]+$/);
  assert.equal(hashSource("a  b\n c"), hashSource("a b c"));
  assert.equal(hashSource("it’s"), hashSource("it's"), "curly quotes normalise");
  const changed = readingCat();
  changed.exercises[0].sections[0].passageText += " Extra sentence.";
  assert.notEqual(a, sourceHashOf(changed));
  assert.equal(hashSource(""), "");
  assert.equal(hashSource("  \n "), "");
});

test("reviewState: none / empty / stale / fresh", () => {
  const cat = readingCat();
  assert.equal(reviewState({ key: "reading", exercises: [] }).state, "none");
  assert.equal(reviewState({ ...cat, key: "writing" }).state, "none");
  assert.equal(reviewState(cat).state, "empty");
  const hash = sourceHashOf(cat);
  const words = [{ word: "mitigate" }];
  assert.equal(reviewState({ ...cat, vocabReview: { words, sourceHash: hash } }).state, "fresh");
  assert.equal(reviewState({ ...cat, vocabReview: { words, sourceHash: "old" } }).state, "stale");
  assert.equal(reviewState({ ...cat, vocabReview: { words, sourceHash: "" } }).state, "stale");
});

// ---- sanitizeVocabReview ----
test("sanitizeVocabReview: only reading/listening keep data", () => {
  const raw = { enabled: true, words: [{ word: "x" }], sourceHash: "h" };
  for (const key of ["grammar", "vocabulary", "writing", "speaking", "bogus"]) {
    assert.deepEqual(sanitizeVocabReview(key, raw), { enabled: false, words: [], sourceHash: "" });
  }
  assert.equal(sanitizeVocabReview("reading", raw).enabled, true);
  assert.equal(sanitizeVocabReview("listening", raw).words.length, 1);
});

test("sanitizeVocabReview: trims, caps lengths, drops empty and duplicate words", () => {
  const out = sanitizeVocabReview("reading", {
    enabled: "yes",
    sourceHash: "  abc  ",
    words: [
      { word: "  Mitigate ", meaning: "  giảm nhẹ ", context: "x".repeat(900), ipa: "y".repeat(900) },
      { word: "mitigate", meaning: "dup differing case" },
      { word: "   " },
      null,
      "junk",
      { word: "w".repeat(200) },
      { meaning: "no word" },
    ],
  });
  assert.equal(out.enabled, false, "enabled must be literally true");
  assert.equal(out.sourceHash, "abc");
  assert.equal(out.words.length, 2);
  assert.equal(out.words[0].word, "Mitigate");
  assert.equal(out.words[0].meaning, "giảm nhẹ");
  assert.equal(out.words[0].context.length, 500);
  assert.equal(out.words[0].ipa.length, 400);
  assert.equal(out.words[1].word.length, 80);
  assert.equal(out.words[1].context, "");
});

test("sanitizeVocabReview: caps at 60 words and survives garbage", () => {
  const words = Array.from({ length: 100 }, (_, i) => ({ word: "w" + i }));
  assert.equal(sanitizeVocabReview("listening", { words }).words.length, MAX_WORDS);
  assert.equal(MAX_WORDS, 60);
  assert.deepEqual(sanitizeVocabReview("reading", undefined), { enabled: false, words: [], sourceHash: "" });
  assert.deepEqual(sanitizeVocabReview("reading", { words: "nope" }).words, []);
});

// ---- AI input + source-fidelity filter ----
test("parseInput: skill and exercises are validated", () => {
  assert.match(parseInput({ skill: "writing", exercises: readingCat().exercises }).error, /only available/);
  assert.match(parseInput({ skill: "reading", exercises: [] }).error, /No exercises to read vocabulary from/);
  assert.match(parseInput({ skill: "reading", exercises: [{ sections: [{}] }] }).error, /No exercises/);
  const ok = parseInput({ skill: "reading", exercises: readingCat().exercises, wordCount: 7, language: "xx", columns: ["ipa", "bogus"] });
  assert.ok(ok.input);
  assert.equal(ok.input.wordCount, 15, "unknown count falls back to default");
  assert.equal(ok.input.language, "vi");
  assert.deepEqual(ok.input.columns, ["ipa"]);
  assert.ok(ok.input.source.includes("mitigate"));
});

test("wordInSource: exact, inflected, phrases; rejects absent words", () => {
  const src = "Governments must mitigate the risks. Prices are mitigating factors, and people take the new risk into account.";
  assert.ok(wordInSource("mitigate", src));
  assert.ok(wordInSource("Mitigating", src));
  assert.ok(wordInSource("risk", src));
  assert.ok(wordInSource("take into account", src), "ordered tokens with a short gap");
  assert.ok(wordInSource("factor", src));
  assert.ok(!wordInSource("sustainable", src));
  assert.ok(!wordInSource("account take", src), "order matters");
  assert.ok(!wordInSource("", src));
  assert.ok(!wordInSource("gov", src), "not a stem of a longer word's start");
});

test("checkedContext: substring of the source ignoring whitespace, quotes and case", () => {
  const src = "Renewable   energy\nis a key part.  It’s the future.";
  assert.equal(checkedContext("Renewable energy is a key part.", src), "Renewable energy is a key part.");
  assert.equal(checkedContext("it's the future.", src), "it's the future.");
  assert.equal(checkedContext("Renewable energy is a minor part.", src), "");
  assert.equal(checkedContext("", src), "");
});

test("normalizeResult: drops invented words, clears invented context, respects columns and existing words", () => {
  const input = {
    source: "Governments must mitigate the effects of climate change. Renewable energy is a key part of the solution.",
    wordCount: 10,
    columns: ["meaning", "collocation"],
    existingWords: ["solution"],
  };
  const data = {
    words: [
      {
        word: "mitigate",
        context: "Governments must mitigate the effects of climate change.",
        meaning: "giảm nhẹ",
        ipa: "/x/",
        collocation: "mitigate the effects, reduce emissions",
      },
      { word: "sustainability", context: "Sustainability matters.", meaning: "bền vững" },
      { word: "renewable energy", context: "Renewable energy is a key BIG part of the solution.", meaning: "năng lượng tái tạo" },
      { word: "Mitigate", context: "", meaning: "duplicate" },
      { word: "solution", context: "", meaning: "already in the list" },
      { word: "climate", context: "Climate change is real.", meaning: "khí hậu" },
    ],
  };
  const { words, removed } = normalizeResult(data, input);
  assert.deepEqual(removed, ["sustainability"]);
  assert.deepEqual(words.map((w) => w.word), ["mitigate", "renewable energy", "climate"]);
  assert.equal(words[0].context, "Governments must mitigate the effects of climate change.");
  assert.equal(words[1].context, "", "paraphrased context is cleared, word kept");
  assert.equal(words[2].context, "", "context not found in the source is cleared");
  assert.equal(words[0].ipa, "", "unticked column is emptied");
  assert.equal(words[0].collocation, "mitigate the effects", "collocation must contain the word");
});

test("normalizeResult: cuts to wordCount and tolerates a malformed AI response", () => {
  const source = Array.from({ length: 30 }, (_, i) => "alpha" + String.fromCharCode(97 + (i % 26)) + i).join(" ");
  const words = source.split(" ").map((w) => ({ word: w, context: "", meaning: "m" }));
  const out = normalizeResult({ words }, { source, wordCount: 10, columns: ["meaning"], existingWords: [] });
  assert.equal(out.words.length, 10);
  assert.deepEqual(normalizeResult(null, { source, wordCount: 10, columns: [], existingWords: [] }), { words: [], removed: [] });
  assert.deepEqual(normalizeResult({ words: "x" }, { source, wordCount: 10, columns: [], existingWords: [] }).words, []);
});
