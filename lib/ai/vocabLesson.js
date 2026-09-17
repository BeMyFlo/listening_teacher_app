// Soạn nhóm từ vựng bằng AI (Gemini): bảng từ (các cột giáo viên tick) +
// bài tập, đúng khung `group` của Vocabulary (lib/models/schemas/lessonSchema.js,
// components/teacher/VocabWordTable.js). Mỗi nhóm 1 lần gọi, sau đó 1 lượt
// kiểm tra đáp án riêng — cùng quy trình với grammarLesson.js.

const {
  MAX_TOPICS,
  QUESTION_COUNTS,
  EXTRA_QUESTIONS,
  bandOf,
  tierOf,
  describeStudentLevel,
  toPlain,
  oneLine,
  sameText,
  capStr,
  parseLines,
  CHECK_HEADER,
  verdictMap,
  choiceProblem,
  pickBalanced,
} = require("./common");

// Cột của bảng từ. `word` luôn có; các cột còn lại giáo viên tick.
const WORD_COLUMNS = ["partOfSpeech", "ipa", "meaning", "definitionEn", "example", "collocation", "synonyms"];
const ALL_WORD_KEYS = ["word", ...WORD_COLUMNS];
const PARTS = ["words", "exercises"];
const WORD_COUNTS = [8, 10, 12];
// context: chọn từ điền vào câu · meaning: chọn nghĩa đúng · bank: điền từ trong khung
const EXERCISE_TYPES = ["context", "meaning", "bank"];
const MAX_EXISTING = 300;
// Để mặc định, model nghĩ ~8k token cho 1 nhóm từ, mất ~45s/lần — cộng lượt
// kiểm tra là vượt 60s (đã đo). Bảng từ chủ yếu là kiến thức có sẵn, không
// cần nghĩ nhiều; đáp án bài tập vẫn được lượt kiểm tra soát lại.
const GEN_THINKING_BUDGET = 1024;

const TIER_GUIDE = {
  foundation:
    "Word choice: high-frequency everyday words (A1–A2), mostly concrete nouns, verbs and adjectives. Example sentences are short and simple.",
  core: "Word choice: useful B1 topic words and common collocations for IELTS Speaking Part 1–2. Example sentences are clear everyday or simple IELTS-style sentences.",
  upper:
    "Word choice: B2–C1 topic vocabulary, strong collocations and paraphrases useful for IELTS Writing Task 2 and Speaking Part 3. Avoid very basic words the learners already know. Example sentences are academic and IELTS-style.",
  advanced:
    "Word choice: precise C1–C2 and academic vocabulary, nuanced near-synonyms and register differences that lift Lexical Resource to band 7–8. Example sentences are sophisticated, IELTS Task 2-style.",
};

const LANGUAGE = {
  vi: "The 'meaning' column is a short Vietnamese translation. Options of 'meaning' questions are short Vietnamese meanings. Explanations are in Vietnamese.",
  bilingual:
    "The 'meaning' column is a short Vietnamese translation. Options of 'meaning' questions are short Vietnamese meanings. Explanations are in English followed by a short Vietnamese translation after ' — '.",
  en: "The 'meaning' column is a short, simple English paraphrase (no Vietnamese). Options of 'meaning' questions are short English definitions. Explanations are in simple English.",
};

const SYSTEM = [
  "You are an experienced IELTS teacher at a language centre in Vietnam who writes vocabulary lessons.",
  "You write a topic word list and practice questions that students use inside a learning app.",
  "Every text field is shown as PLAIN TEXT: never use Markdown (no **bold**, no # headings, no backticks).",
  "Be accurate: every meaning, definition, IPA transcription, example and answer key must be correct.",
  "Pitch word choice and sentence difficulty to the stated learner level.",
].join("\n");

const COLUMN_GUIDE = {
  partOfSpeech: "partOfSpeech: one of noun, verb, adjective, adverb, phrase (lowercase).",
  ipa: "ipa: British English IPA between slashes, e.g. /ˌsʌs.teɪˈnæb.əl/. Be exact; leave empty if unsure.",
  meaning: "meaning: short meaning following the Language rule below (a few words, not a sentence).",
  definitionEn: "definitionEn: a short learner-dictionary definition in simple English (at most 15 words).",
  example: "example: ONE natural sentence (at most 20 words) using the word exactly as written, on this topic.",
  collocation:
    "collocation: 2–3 common collocations separated by ', '. Each one must contain the FULL word exactly as written — for 'renewable energy' write 'invest in renewable energy', never 'develop energy'.",
  synonyms:
    "synonyms: 1–3 words or phrases with the SAME meaning in this sense, separated by ', '. Related ideas, causes or examples are not synonyms. Leave empty if there is no true synonym.",
};

const TYPE_LABEL = {
  context: 'choose the word for the gap (type "context")',
  meaning: 'choose the meaning (type "meaning")',
  bank: 'complete the sentence with a word from the box (type "bank")',
};

function exerciseGuide({ questionCount, exerciseTypes }, band) {
  const optCount = band != null && band >= 6 ? 4 : 3;
  const lines = [
    `exercises: exactly ${questionCount + EXTRA_QUESTIONS} questions that practise the words in YOUR list, using only these types: ${exerciseTypes.map((t) => TYPE_LABEL[t]).join(", ")}${exerciseTypes.length > 1 ? " — mix them roughly evenly" : ""}.`,
    "  Use each list word at most once as a correct answer. Do not reuse the 'example' sentences.",
    "  explanation: one short line saying why the answer is right, following the Language rule.",
  ];
  if (exerciseTypes.includes("context")) {
    lines.push(
      `  context: 'sentence' is one sentence with exactly one gap written as ___, grammatical with the answer exactly as written (no plural or tense change needed). 'options' has ${optCount} words from your list with the same part of speech; 'answer' is copied exactly from options. Only the answer may fit — every other option must be clearly wrong in that sentence. 'word' is empty.`
    );
  }
  if (exerciseTypes.includes("meaning")) {
    lines.push(
      `  meaning: 'word' is a list word; 'sentence' is a sentence containing that word exactly as written (no gap). 'options' has ${optCount} short meanings; 'answer' is copied exactly from options and is the only meaning that fits the word in that sentence.`
    );
  }
  if (exerciseTypes.includes("bank")) {
    lines.push(
      "  bank: 'sentence' is one sentence with exactly one gap ___ that is filled by a list word EXACTLY as written in the list (same form, no -s/-ed/-ing added). 'answer' is that word. All bank questions share one box made of their answers, so every sentence must fit ONLY its own answer and none of the other bank answers. 'options' is empty, 'word' is empty."
    );
  }
  return lines;
}

function buildSchema({ parts, columns }) {
  // Bài tập phải dựa trên danh sách từ, nên luôn xin danh sách (ít nhất cột word)
  // kể cả khi giáo viên không tick "Word list" — khi đó chỉ không thêm vào nhóm.
  const wordProps = { word: { type: "string" } };
  const wordReq = ["word"];
  for (const c of WORD_COLUMNS) {
    if (parts.includes("words") && columns.includes(c)) {
      wordProps[c] = { type: "string" };
      wordReq.push(c);
    }
  }
  const properties = {
    name: { type: "string" },
    words: { type: "array", items: { type: "object", properties: wordProps, required: wordReq } },
  };
  const required = ["name", "words"];
  if (parts.includes("exercises")) {
    properties.exercises = {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: EXERCISE_TYPES },
          sentence: { type: "string" },
          word: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          explanation: { type: "string" },
        },
        required: ["type", "sentence", "answer", "explanation"],
      },
    };
    required.push("exercises");
  }
  return { type: "object", properties, required };
}

function buildPrompt(input, topic) {
  const { level, unitName, topics, studentLevel, language, notes, parts, columns, wordCount, existingWords } = input;
  const band = bandOf(studentLevel);
  const lines = ["Class context:"];
  if (level) lines.push(`- Centre course level: ${level}`);
  if (unitName) lines.push(`- Unit / lesson: ${unitName}`);
  lines.push(`- Learners' level: ${describeStudentLevel(studentLevel)}`);
  lines.push(`- ${TIER_GUIDE[tierOf(band)]}`);
  const others = topics.filter((t) => t !== topic);
  if (others.length) lines.push(`- Other word groups in this lesson (written separately, don't overlap): ${others.join("; ")}`);
  if (existingWords.length) lines.push(`- Words already taught in this unit — do NOT include them: ${existingWords.join(", ")}`);
  lines.push("");
  lines.push(`Vocabulary topic: ${topic}`);
  lines.push("");
  lines.push(`Language: ${LANGUAGE[language] || LANGUAGE.vi}`);
  if (notes) {
    lines.push("");
    lines.push(`Extra requests from the teacher (follow them unless they conflict with the rules above): ${notes}`);
  }
  lines.push("");
  lines.push("Fill these fields:");
  lines.push("name: short group name in English, e.g. 'Environment' or 'Education & Careers'.");
  lines.push(`words: exactly ${wordCount} different words or short phrases for this topic — mostly single words, with a few useful 2–3 word phrases — each with:`);
  lines.push("  word: the headword as students should learn it (lowercase unless a proper noun).");
  if (parts.includes("words")) for (const c of WORD_COLUMNS) if (columns.includes(c)) lines.push(`  ${COLUMN_GUIDE[c]}`);
  if (parts.includes("exercises")) lines.push(...exerciseGuide(input, band));
  lines.push("Before answering, re-check every meaning, IPA, example and answer key; fix or drop anything doubtful.");
  return lines.join("\n");
}

// ---- Bảng từ ----
// Collocation phải chứa đúng từ đang học ("ecological footprint" không được
// kèm "carbon footprint"). Từ đơn thì chấp nhận dạng biến đổi (mitigate ->
// "mitigating risk") nên chỉ so phần gốc.
function keepCollocations(text, word) {
  const w = word.toLowerCase();
  const stem = /\s/.test(w) ? w : w.slice(0, Math.max(4, w.length - 3));
  return text
    .split(/\s*[,;]\s*/)
    .filter((c) => c && c.toLowerCase().includes(stem))
    .join(", ");
}

function normalizeWords(raw, { wordCount, columns, existingWords }) {
  const taken = new Set(existingWords.map((w) => w.toLowerCase()));
  const out = [];
  for (const w of Array.isArray(raw) ? raw : []) {
    const word = oneLine(w && w.word).slice(0, 80);
    if (!word || taken.has(word.toLowerCase())) continue;
    taken.add(word.toLowerCase());
    const row = { word };
    for (const c of WORD_COLUMNS) row[c] = columns.includes(c) ? oneLine(w[c]).slice(0, 400) : "";
    if (row.collocation) row.collocation = keepCollocations(row.collocation, word);
    out.push(row);
    if (out.length >= wordCount) break;
  }
  return out;
}

// ---- Bài tập ----
const GAP = /_{2,}/;
const hasOneGap = (s) => (s.match(/_{2,}/g) || []).length === 1;
// Chuẩn hoá câu có chỗ trống: mọi cụm ___ thành đúng "___".
const gapText = (s) => toPlain(s).replace(/\s*\n\s*/g, " ").replace(/_{2,}/g, "___").trim();

function parseQuestions(raw, { exerciseTypes }) {
  const out = [];
  const seen = new Set();
  for (const q of Array.isArray(raw) ? raw : []) {
    if (!q || !exerciseTypes.includes(q.type)) continue;
    const answer = oneLine(q.answer);
    const explanation = oneLine(q.explanation).slice(0, 500);
    if (!answer) continue;
    if (q.type === "meaning") {
      const word = oneLine(q.word);
      const sentence = oneLine(q.sentence);
      if (!word || !sentence || !sentence.toLowerCase().includes(word.toLowerCase())) continue;
      const opts = [...new Set((q.options || []).map(oneLine).filter(Boolean))].slice(0, 5);
      const correct = opts.filter((o) => sameText(o, answer));
      const key = `meaning|${word}|${sentence}`.toLowerCase();
      if (opts.length < 2 || correct.length !== 1 || seen.has(key)) continue;
      seen.add(key);
      out.push({ type: "meaning", word, sentence, opts, answer: correct[0], explanation });
      continue;
    }
    const sentence = gapText(q.sentence);
    if (!hasOneGap(sentence) || !GAP.test(sentence)) continue;
    const key = `gap|${sentence}`.toLowerCase();
    if (seen.has(key)) continue;
    if (q.type === "context") {
      const opts = [...new Set((q.options || []).map(oneLine).filter(Boolean))].slice(0, 5);
      const correct = opts.filter((o) => sameText(o, answer));
      if (opts.length < 2 || correct.length !== 1) continue;
      seen.add(key);
      out.push({ type: "context", sentence, opts, answer: correct[0], explanation });
    } else {
      seen.add(key);
      out.push({ type: "bank", sentence, opts: [], answer, explanation });
    }
  }
  return out;
}

// Mỗi đáp án chỉ dùng 1 lần trong ngân hàng từ.
function dedupeBankAnswers(questions) {
  const used = new Set();
  return questions.filter((q) => {
    if (q.type !== "bank") return true;
    const k = q.answer.toLowerCase();
    if (used.has(k)) return false;
    used.add(k);
    return true;
  });
}

// Khung từ của dạng "bank": đáp án của mọi câu bank + tối đa 2 từ nhiễu lấy
// từ danh sách. Khung này được tính TRƯỚC lượt kiểm tra và giữ nguyên sau đó
// (kể cả khi câu bị loại) — giám khảo đã soát từng câu với đúng khung này.
function bankFor(questions, wordList) {
  const answers = questions.filter((q) => q.type === "bank").map((q) => q.answer);
  if (!answers.length) return [];
  const extra = wordList
    .map((w) => w.word)
    .filter((w) => !answers.some((a) => sameText(a, w)) && !/\s/.test(w))
    .slice(0, 2);
  return [...answers, ...extra].sort((a, b) => a.localeCompare(b));
}

const questionText = (q) =>
  q.type === "meaning" ? `What does "${q.word}" mean in this sentence? ${q.sentence}` : q.sentence;

function buildCheckPrompt(questions, draft) {
  const lines = [...CHECK_HEADER];
  if (draft && draft.bank && draft.bank.length) {
    lines.splice(0, 0, `Word box shared by all [word box] items: ${draft.bank.join(" | ")}`, "");
  }
  questions.forEach((q, i) => {
    const n = i + 1;
    if (q.type === "context") {
      lines.push(`${n}. [choose the word] ${q.sentence}  Options: ${q.opts.join(" | ")}  Key: ${q.answer}`);
    } else if (q.type === "meaning") {
      lines.push(`${n}. [choose the meaning] ${questionText(q)}  Options: ${q.opts.join(" | ")}  Key: ${q.answer}`);
    } else {
      lines.push(
        `${n}. [word box] ${q.sentence}  Options: every word in the word box (the word goes in unchanged)  Key: ${q.answer}`
      );
    }
  });
  return lines.join("\n");
}

// Mọi dạng đều là chọn 1 đáp án: giữ khi đáp án là lựa chọn duy nhất đúng.
// Dạng bank: các lựa chọn chính là cả khung từ.
function checkQuestions(questions, verdict, draft) {
  const byN = verdictMap(verdict);
  const bank = (draft && draft.bank) || [];
  const kept = [];
  const removed = [];
  questions.forEach((q, i) => {
    const problem = choiceProblem(q.type === "bank" ? { ...q, opts: bank } : q, byN.get(i + 1));
    if (problem) removed.push({ text: questionText(q), reason: problem });
    else kept.push(q);
  });
  return { kept, removed };
}

const SECTION_NAME = {
  context: "Choose the word that best completes each sentence.",
  meaning: "Choose the correct meaning of the word in quotation marks.",
  bank: "Complete the sentences with words from the box.",
};

// Câu hỏi -> section theo shape server (giống bài import từ file). Dạng bank
// dùng "Shared answer bank" của section (matchOptions) — trong editor là câu
// Matching, học sinh chọn từ trong khung.
function toSections(questions, bank) {
  let id = 0;
  const sections = [];
  for (const type of EXERCISE_TYPES) {
    const qs = questions.filter((q) => q.type === type);
    if (!qs.length) continue;
    if (type === "bank") {
      const box = bank.map((w, i) => ({ value: `aibank_${i + 1}`, label: w }));
      sections.push({
        name: SECTION_NAME.bank,
        matchOptions: box,
        fields: qs.map((q) => {
          id += 1;
          const hit = box.find((b) => sameText(b.label, q.answer));
          return {
            id,
            type: "choice",
            label: q.sentence,
            pre: "",
            post: "",
            hint: "",
            explanation: q.explanation,
            score: 1,
            selectCount: 1,
            options: [],
            answers: hit ? [hit.value] : [],
          };
        }),
      });
      continue;
    }
    sections.push({
      name: SECTION_NAME[type],
      fields: qs.map((q) => {
        id += 1;
        return {
          id,
          type: "choice",
          label: questionText(q),
          pre: "",
          post: "",
          hint: "",
          explanation: q.explanation,
          score: 1,
          selectCount: 1,
          options: q.opts.map((o, i) => ({ value: `ai${id}_${i + 1}`, label: o })),
          answers: [`ai${id}_${q.opts.indexOf(q.answer) + 1}`],
        };
      }),
    });
  }
  return sections;
}

// Kết quả lượt soạn -> nhóm nháp. `questions` chưa kiểm tra; API chạy
// checkQuestions rồi finalizeTopic.
function normalizeTopic(data, input, requested) {
  const d = data || {};
  const wordList = normalizeWords(d.words, input);
  const questions = input.parts.includes("exercises") ? dedupeBankAnswers(parseQuestions(d.exercises, input)) : [];
  const showWords = input.parts.includes("words");
  if ((!showWords || !wordList.length) && !questions.length) return null;
  const name = oneLine(d.name).slice(0, 120) || requested;
  return { extId: "", name, words: showWords ? wordList : [], bank: bankFor(questions, wordList), questions };
}

function finalizeTopic(draft, questions, input) {
  const { questions: _q, bank, ...rest } = draft;
  const picked = pickBalanced(questions, input.questionCount, input.exerciseTypes);
  return { ...rest, exerciseSections: toSections(picked, bank) };
}

function parseInput(body) {
  const b = body || {};
  const topics = parseLines(b.topics);
  if (!topics.length) return { error: "Enter at least one vocabulary topic." };
  if (topics.length > MAX_TOPICS) return { error: `Up to ${MAX_TOPICS} topics at a time.` };
  const parts = Array.isArray(b.parts) ? PARTS.filter((p) => b.parts.includes(p)) : PARTS.slice();
  if (!parts.length) return { error: "Tick at least one part to generate." };
  const columns = Array.isArray(b.columns) ? WORD_COLUMNS.filter((c) => b.columns.includes(c)) : WORD_COLUMNS.slice();
  const exerciseTypes = Array.isArray(b.exerciseTypes)
    ? EXERCISE_TYPES.filter((t) => b.exerciseTypes.includes(t))
    : EXERCISE_TYPES.slice();
  if (parts.includes("exercises") && !exerciseTypes.length) return { error: "Tick at least one exercise type." };
  const wc = Number(b.wordCount);
  const qc = Number(b.questionCount);
  const existingWords = [
    ...new Set((Array.isArray(b.existingWords) ? b.existingWords : []).map((w) => capStr(w, 60)).filter(Boolean)),
  ].slice(0, MAX_EXISTING);
  return {
    input: {
      level: capStr(b.level, 60),
      unitName: capStr(b.unitName, 160),
      topics,
      studentLevel: capStr(b.studentLevel, 80),
      language: LANGUAGE[b.language] ? b.language : "vi",
      notes: capStr(b.notes, 1000),
      parts,
      columns,
      wordCount: WORD_COUNTS.includes(wc) ? wc : 10,
      exerciseTypes,
      questionCount: QUESTION_COUNTS.includes(qc) ? qc : 8,
      existingWords,
    },
  };
}

const logContext = (input) => ({
  parts: input.parts,
  wordCount: input.wordCount,
  ...(input.parts.includes("words") ? { columns: input.columns } : {}),
  ...(input.parts.includes("exercises")
    ? { questionCount: input.questionCount, exerciseTypes: input.exerciseTypes }
    : {}),
});

module.exports = {
  PURPOSE: "generate.vocab",
  GEN_THINKING_BUDGET,
  logContext,
  SYSTEM,
  PARTS,
  WORD_COLUMNS,
  ALL_WORD_KEYS,
  EXERCISE_TYPES,
  WORD_COUNTS,
  buildSchema,
  buildPrompt,
  parseInput,
  normalizeTopic,
  finalizeTopic,
  parseQuestions,
  buildCheckPrompt,
  checkQuestions,
  toSections,
};
