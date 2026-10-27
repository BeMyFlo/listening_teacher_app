// Module AI soạn bài tập theo dạng đề General English (GDPT 2018).
// Cùng giao diện với lib/ai/grammarLesson.js để pages/api/admin/ai-lesson.js dùng lại.

const { PROGRAMS } = require("../curriculum");
const { GENERAL_LABELS, aiFormatsFor } = require("../generalFormats");
const { toGeneralSection } = require("./generalSections");
const {
  QUESTION_COUNTS,
  EXTRA_QUESTIONS,
  describeStudentLevel,
  levelTier,
  capStr,
  parseLines,
  oneLine,
  sameText,
  CHECK_SYSTEM,
  CHECK_SCHEMA,
  CHECK_HEADER,
  verdictMap,
  reviewProblem,
  choiceProblem,
  acceptedList,
} = require("./common");

const PURPOSE = "generate.exercise";
const GEN_THINKING_BUDGET = 1024;
const S = (v) => String(v == null ? "" : v).trim();

const GENERAL_TIER_GUIDE = {
  foundation:
    "Depth: foundation (grades 6–7, CEFR A1). Use short, simple everyday sentences about student life and basic A1 vocabulary.",
  core:
    "Depth: core (grades 8–9, CEFR A2). Cover main forms and structures tested in regular school exams and the grade 10 entrance exam. Everyday school and teenage contexts with A2 vocabulary.",
  upper:
    "Depth: upper-intermediate (grades 10–12, CEFR A2+–B1). Focus on nuances, contrasts, exceptions, complex sentences, and common traps in the national high school graduation exam (THPT). B1 vocabulary.",
  advanced:
    "Depth: advanced (CEFR B2, advanced or gifted classes / HSG). Subtle meaning differences, less common structures, inversion, and formal register for gifted student competitions. Rich B2 vocabulary.",
};

const GENERAL_EXERCISE_SYSTEM = [
  "You are an experienced English teacher at a lower and upper secondary school in Vietnam (grades 6–12), following the national GDPT 2018 curriculum and standard textbooks such as Global Success.",
  "You write practice questions and exercises for students using a learning app.",
  "The app displays text as PLAIN TEXT with line breaks preserved. Therefore:",
  "- Never use Markdown: no **bold**, no # headings, no backticks, no tables.",
  "- Write underlines strictly as <u>underlined text</u>.",
  "- Write fill-in-the-blank gaps as ____ (four underscores).",
  "- Pitch vocabulary, grammar difficulty, and sentence length appropriately for the stated Vietnamese school grade and CEFR level.",
  "- Prefer everyday, school, cultural, and textbook topics suitable for Vietnamese students.",
  "- Never mention IELTS or TOEIC.",
  "Be 100% accurate: every answer key must be standard, unambiguous English.",
].join("\n");

const systemFor = () => GENERAL_EXERCISE_SYSTEM;

// Tên hướng dẫn chuẩn cho 14 dạng bài
const SECTION_NAME = {
  "g-mcq": "Choose the best option to complete each sentence.",
  "g-comm": "Choose the most suitable response to complete each exchange.",
  "g-verb": "Give the correct form of the verbs in brackets.",
  "g-wform": "Give the correct form of the words in brackets.",
  "g-error": "Choose the underlined part that needs correction.",
  "g-syn": "Choose the word or phrase that is CLOSEST or OPPOSITE in meaning.",
  "g-pron": "Choose the word whose underlined part is pronounced differently from the others.",
  "g-stress": "Choose the word that differs from the other three in the position of primary stress.",
  "g-reorder": "Rearrange the words or phrases to make complete sentences.",
  "g-rewrite": "Rewrite the sentences without changing their meaning, beginning with the given words.",
  "g-combine": "Combine the sentences, using the words given.",
  "g-closest": "Choose the sentence that is closest in meaning to the given sentence.",
  "g-cloze": "Read the passage and choose the correct word for each numbered blank.",
  "g-tf": "Read the passage and decide whether the statements are True or False.",
};

// Hướng dẫn chi tiết từng format cho AI
const FORMAT_GUIDE = {
  "g-mcq": [
    "Format: Multiple choice. Provide 4 options (A, B, C, D) in `options`. Exactly ONE option is correct in `answer`.",
    "The prompt `text` must contain '____' where the choice fits.",
  ].join("\n"),

  "g-comm": [
    "Format: Communication exchanges. A short 2-turn dialogue between two people (e.g., 'David: Would you like to go to the cinema tonight? - Mary: ____').",
    "Provide 4 options in `options`, with exactly ONE natural and socially appropriate response in `answer`.",
  ].join("\n"),

  "g-verb": [
    "Format: Verb form. Each sentence tests tense, voice (passive/active), gerund, infinitive, or conditional form.",
    "`hint` must contain the base verb in parentheses, e.g. '(go)' or '(not finish)'.",
    "`text` contains the sentence with '____'. `before` and `after` give the text before and after the blank.",
    "`answer` gives the correct verb form. Include contracted or alternative valid forms in `altAnswers`.",
  ].join("\n"),

  "g-wform": [
    "Format: Word form (derivation). Supply the correct part of speech (noun, adj, adv, verb) derived from the root word.",
    "`hint` gives the root word in parentheses, e.g. '(pollute)' or '(beauty)'.",
    "`text` contains the sentence with '____'. `before` and `after` give the text before and after the blank.",
    "`answer` gives the correct derivative. Add valid alternatives to `altAnswers`.",
  ].join("\n"),

  "g-error": [
    "Format: Error identification. Each sentence MUST have EXACTLY FOUR underlined parts marked with <u>...</u>.",
    "Exactly ONE underlined part contains a grammatical or lexical mistake; the other three MUST be strictly correct.",
    "`answer` MUST be the letter 'A', 'B', 'C', or 'D' corresponding to the 1st, 2nd, 3rd, or 4th underlined part.",
    "`explanation` MUST state which part is wrong, why, and how to correct it.",
  ].join("\n"),

  "g-syn": [
    "Format: Synonym or Antonym. The prompt `text` MUST explicitly state 'CLOSEST in meaning' or 'OPPOSITE in meaning'.",
    "The sentence must contain EXACTLY ONE target word/phrase underlined with <u>...</u>.",
    "Provide 4 options in `options` and exactly ONE correct answer in `answer`.",
  ].join("\n"),

  "g-pron": [
    "Format: Pronunciation odd-one-out. Provide 4 words in `options`. Each word has EXACTLY ONE underlined part with <u>...</u> (e.g. 'c<u>a</u>t', 'm<u>a</u>ke', 'h<u>a</u>te', 'l<u>a</u>te').",
    "The underlined letters must be identical across all 4 words.",
    "Exactly ONE word has a different pronunciation of the underlined part.",
    "`answer` is the odd word.",
    "`ipa` MUST be an array of 4 IPA transcriptions corresponding to the 4 options.",
  ].join("\n"),

  "g-stress": [
    "Format: Word stress. Provide 4 words in `options`. ALL 4 words MUST have the same number of syllables (all 2-syllable words, or all 3-syllable words).",
    "Exactly ONE word has primary stress on a different syllable from the other three.",
    "`answer` is the word with the different stress position.",
    "`ipa` MUST be an array of 4 IPA transcriptions showing stress marks (ˈ) for all 4 options.",
  ].join("\n"),

  "g-reorder": [
    "Format: Sentence building (reorder). Provide 4 to 8 pieces in `pieces`. Pieces can be single words or short phrases.",
    "When arranged in order, the pieces MUST make a grammatically correct sentence in `answer`.",
    "Include any other grammatically correct orders in `altAnswers`.",
  ].join("\n"),

  "g-rewrite": [
    "Format: Sentence transformation. `text` is the original complete sentence.",
    "`start` is the beginning given to the student (e.g. 'Although...').",
    "`answer` is the remaining part of the sentence that the student must write so the meaning matches `text`.",
    "Include other correct completions in `altAnswers`.",
  ].join("\n"),

  "g-combine": [
    "Format: Sentence combination. `text` provides two sentences to combine.",
    "`start` may provide a connector or start word if specified, or empty string.",
    "`answer` is the full combined sentence. Include other valid combinations in `altAnswers`.",
  ].join("\n"),

  "g-closest": [
    "Format: Closest meaning. `text` is the original sentence.",
    "Provide 4 full-sentence options (A, B, C, D) in `options`.",
    "Exactly ONE option conveys the closest meaning to `text` without distortions or omissions.",
    "`answer` is the full text of the best option.",
  ].join("\n"),

  "g-cloze": [
    "Format: Cloze reading passage. Provide a coherent reading passage of 120–180 words in `passage` with 5 numbered blanks marked '(1) ____', '(2) ____', '(3) ____', '(4) ____', '(5) ____'.",
    "Provide exactly 5 questions in `questions`, where question i provides 4 options for blank (i), and exactly ONE option is correct in `answer`.",
  ].join("\n"),

  "g-tf": [
    "Format: Reading True/False. Provide a coherent reading passage of 150–200 words in `passage`.",
    "Provide exactly 5 statements in `questions`. For each statement, `options` is ['True', 'False'] and `answer` is 'True' or 'False'.",
    "Statements must be clearly verifiable strictly based on facts stated in the passage.",
  ].join("\n"),
};

// Chuẩn hoá input của giáo viên
function parseInput(body) {
  const b = body || {};

  const subject = String(b.subject || "").toLowerCase().trim();
  if (!["grammar", "vocabulary", "reading"].includes(subject)) {
    return { error: "Invalid subject: must be grammar, vocabulary, or reading." };
  }

  const program = String(b.program || "").toLowerCase().trim() || "general";
  if (!PROGRAMS[program] || !PROGRAMS[program].aiExercise) {
    return { error: "AI exercise generator is only available for General English." };
  }

  const focus = capStr(b.focus, 300);
  if (!focus) {
    return { error: "Enter a focus for the exercise (e.g. grammar point or vocabulary topic)." };
  }

  const rawFormats = b.formats || b.topics;
  const candidateList = Array.isArray(rawFormats)
    ? rawFormats
    : typeof rawFormats === "string"
    ? parseLines(rawFormats)
    : [];

  const allowedFormats = new Set(aiFormatsFor(subject));
  const selectedFormats = [...new Set(candidateList.filter((f) => allowedFormats.has(f)))];

  if (!selectedFormats.length || selectedFormats.length > 3) {
    return { error: "Choose 1 to 3 question types." };
  }

  const qc = Number(b.questionCount);
  const questionCount = QUESTION_COUNTS.includes(qc) ? qc : 8;

  return {
    input: {
      subject,
      program,
      focus,
      topics: selectedFormats, // topics = danh sách format key để route ai-lesson gọi song song
      parts: ["exercises"],
      questionCount,
      level: capStr(b.level, 60),
      studentLevel: capStr(b.studentLevel, 80),
      unitName: capStr(b.unitName, 160),
      textbook: capStr(b.textbook, 80),
      language: b.language === "en" ? "en" : "vi",
      notes: capStr(b.notes, 1000),
    },
  };
}

// Log context cho AI log
const logContext = (input) => ({
  subject: input.subject,
  focus: input.focus,
  questionTypes: input.topics,
  questionCount: input.questionCount,
  ...(input.textbook ? { textbook: input.textbook } : {}),
});

// JSON Schema cho lượt gọi Gemini
function buildSchema() {
  return {
    type: "object",
    properties: {
      passage: { type: "string" },
      questions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            before: { type: "string" },
            after: { type: "string" },
            hint: { type: "string" },
            start: { type: "string" },
            options: { type: "array", items: { type: "string" } },
            answer: { type: "string" },
            altAnswers: { type: "array", items: { type: "string" } },
            pieces: { type: "array", items: { type: "string" } },
            explanation: { type: "string" },
            ipa: { type: "array", items: { type: "string" } },
          },
          required: ["text", "answer"],
        },
      },
    },
    required: ["questions"],
  };
}

// Xây dựng prompt cho 1 format key
function buildPrompt(input, formatKey) {
  const { level, textbook, unitName, focus, studentLevel, questionCount, language, notes } = input;
  const isPassage = ["g-cloze", "g-tf"].includes(formatKey);
  const count = isPassage ? 5 : questionCount + EXTRA_QUESTIONS;

  const lines = [];
  lines.push("Class context:");
  lines.push(`- Grade: ${level || 8}`);
  if (textbook) lines.push(`- Textbook: ${textbook}`);
  if (unitName) lines.push(`- Unit: ${unitName}`);
  lines.push(`- Focus: ${focus}`);
  lines.push(`- Learners' level: ${describeStudentLevel(studentLevel, "general", level)}`);
  lines.push(`- ${GENERAL_TIER_GUIDE[levelTier(studentLevel, "general", level)]}`);
  lines.push("");

  lines.push(`Question format: ${formatKey} (${GENERAL_LABELS[formatKey.replace(/^g-/, "")] || formatKey})`);
  lines.push(`Section title/instruction: ${SECTION_NAME[formatKey] || ""}`);
  lines.push("");

  lines.push("FORMAT SPECIFICATIONS:");
  lines.push(FORMAT_GUIDE[formatKey] || "Follow standard Vietnamese secondary English test format.");
  lines.push("");

  lines.push(`Number of questions required: exactly ${count} questions.`);
  lines.push(
    language === "en"
      ? "Explanations language: English."
      : "Explanations language: Vietnamese (keep all grammar terms and example sentences in English)."
  );

  if (notes) {
    lines.push("");
    lines.push(`Teacher notes / extra requests: ${notes}`);
  }

  lines.push("");
  lines.push("CRITICAL QUALITY RULES:");
  lines.push("1. Strict accuracy: answer key must be unequivocally correct.");
  lines.push("2. Follow underline convention: write <u>word</u> for underlines.");
  lines.push("3. Blank placeholder: write '____' (four underscores) for gaps.");
  lines.push("4. Every question must have an explanation justifying the answer.");

  return lines.join("\n");
}

// Chuẩn hoá kết quả thô từ AI
function normalizeTopic(data, input, formatKey) {
  const d = data || {};
  const rawQuestions = Array.isArray(d.questions) ? d.questions : [];
  if (!rawQuestions.length) return null;

  const questions = rawQuestions.map((q) => {
    let explanation = S(q.explanation);
    if (Array.isArray(q.ipa) && q.ipa.length) {
      const ipaStr = q.ipa.join(" | ");
      if (!explanation.includes(ipaStr)) {
        explanation = explanation ? `${explanation} (IPA: ${ipaStr})` : `IPA: ${ipaStr}`;
      }
    }
    return {
      format: formatKey,
      text: S(q.text),
      before: S(q.before),
      after: S(q.after),
      hint: S(q.hint),
      start: S(q.start),
      options: Array.isArray(q.options) ? q.options.map((o) => S(o)).filter(Boolean) : [],
      answer: S(q.answer),
      altAnswers: Array.isArray(q.altAnswers) ? q.altAnswers.map((a) => S(a)).filter(Boolean) : [],
      pieces: Array.isArray(q.pieces) ? q.pieces.map((p) => S(p)).filter(Boolean) : [],
      explanation,
    };
  });

  return {
    name: SECTION_NAME[formatKey] || "Practice exercise",
    format: formatKey,
    passage: S(d.passage),
    questions,
  };
}

// Xây dựng prompt cho lượt giám khảo (AI #2)
function buildCheckPrompt(questions, topic) {
  const lines = [
    "Judge each exercise item below carefully. Be strict: an answer is only valid if native speakers agree.",
    ...CHECK_HEADER,
  ];

  if (topic && topic.passage) {
    lines.push("Reading Passage:");
    lines.push(topic.passage);
    lines.push("");
  }

  questions.forEach((q, i) => {
    const num = i + 1;
    const isChoice = Array.isArray(q.options) && q.options.length > 0;
    const isReorder = Array.isArray(q.pieces) && q.pieces.length > 0;

    if (isChoice) {
      lines.push(`${num}. [choice] ${q.text || q.before || ""} Options: ${q.options.join(" | ")} Key: ${q.answer}`);
    } else if (isReorder) {
      lines.push(`${num}. [reorder] Using ALL these pieces: ${q.pieces.join(" / ")} Key: ${q.answer}`);
    } else {
      lines.push(`${num}. [fill] ${q.before || q.text || ""} (hint: ${q.hint || ""}) Key: ${q.answer}`);
    }
  });

  return lines.join("\n");
}

// Giám khảo kiểm tra và loại câu lỗi
function checkQuestions(questions, check) {
  const byN = verdictMap(check);
  const kept = [];
  const removed = [];

  questions.forEach((q, i) => {
    const it = byN.get(i + 1);
    const isChoice = Array.isArray(q.options) && q.options.length > 0;
    const isReorder = Array.isArray(q.pieces) && q.pieces.length > 0;

    if (isChoice) {
      const qWithOpts = { ...q, opts: q.options };
      const problem = choiceProblem(qWithOpts, it);
      if (problem) {
        return removed.push({ text: q.text || q.before || "", reason: problem });
      }
      return kept.push(q);
    }

    if (isReorder) {
      if (!it || !it.keyIsCorrect) {
        return removed.push({
          text: q.text || (q.pieces || []).join(" / "),
          reason: it ? it.note || "key judged wrong" : "not reviewed",
        });
      }
      const alt = [...(q.altAnswers || [])];
      acceptedList(it).forEach((a) => {
        if (!sameText(a, q.answer) && !alt.some((x) => sameText(x, a))) {
          alt.push(a);
        }
      });
      return kept.push({ ...q, altAnswers: alt.slice(0, 5) });
    }

    // Fill / sentence transformation / combination
    const problem = reviewProblem(it);
    if (problem) {
      return removed.push({ text: q.text || q.before || "", reason: problem });
    }
    const alt = [...(q.altAnswers || [])];
    acceptedList(it).forEach((a) => {
      if (!sameText(a, q.answer) && !alt.some((x) => sameText(x, a))) {
        alt.push(a);
      }
    });
    return kept.push({ ...q, altAnswers: alt.slice(0, 5) });
  });

  return { kept, removed };
}

// Cắt câu và chuyển sang section shape của server
function finalizeTopic(topic, questions, input) {
  const isPassage = ["g-cloze", "g-tf"].includes(topic.format);
  const targetCount = isPassage ? 5 : input.questionCount || 8;
  const sliced = (questions || []).slice(0, targetCount);

  const { section, flags: convertedFlags } = toGeneralSection(
    {
      format: topic.format,
      name: topic.name,
      passage: topic.passage,
      questions: sliced,
    },
    {
      subject: input.subject,
      startId: 1,
      strict: true,
    }
  );

  const flags = [...convertedFlags];

  // Phát âm / trọng âm luôn có cờ vàng để giáo viên soát lại (D2)
  if (topic.format === "g-pron" || topic.format === "g-stress") {
    for (let fi = 0; fi < section.fields.length; fi++) {
      if (!flags.some((f) => f.fi === fi && f.reason.includes("Pronunciation/stress"))) {
        flags.push({ fi, reason: "Pronunciation/stress — please double-check" });
      }
    }
  }

  return {
    name: topic.name,
    format: topic.format,
    exerciseSections: [section],
    flags,
  };
}

module.exports = {
  PURPOSE,
  GEN_THINKING_BUDGET,
  SECTION_NAME,
  FORMAT_GUIDE,
  GENERAL_EXERCISE_SYSTEM,
  systemFor,
  parseInput,
  logContext,
  buildSchema,
  buildPrompt,
  normalizeTopic,
  buildCheckPrompt,
  checkQuestions,
  finalizeTopic,
};
