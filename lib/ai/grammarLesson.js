// Soạn phần lý thuyết Grammar bằng AI (Gemini): giáo viên nhập bối cảnh lớp
// + chủ đề -> trả về đúng khung `topic.lesson` mà học sinh xem ở
// components/student/GrammarTopicView.js. Các ô lý thuyết hiển thị dạng text
// thuần (white-space: pre-line) nên AI phải trả text thuần, không markdown.

// Trình độ học sinh do giáo viên gõ tự do (vd "6.5", "Band 5.5", "B2") —
// không ép vào vài mốc cố định vì mỗi lớp nhắm 1 band khác nhau.
const DEFAULT_STUDENT_LEVEL = "IELTS band 4.0–5.0 (pre-intermediate)";

// Chỉ ghi "band 6.5" thì model vẫn viết bài y như lớp cơ bản (đã test) —
// phải nói rõ ở mức đó cần viết sâu tới đâu. Lấy band từ số gõ vào (khoảng
// "5.0–5.5" thì lấy số lớn) hoặc quy đổi từ CEFR.
const CEFR_BAND = { A1: 2.5, A2: 3.5, B1: 5, B2: 6, C1: 7, C2: 8 };

function bandOf(raw) {
  const s = String(raw || "");
  // Số dính sau chữ cái (chữ "2" trong "B2") không phải band.
  const nums = (s.match(/(?<![A-Za-z])\d(?:[.,]\d)?/g) || [])
    .map((n) => Number(n.replace(",", ".")))
    .filter((n) => n >= 1 && n <= 9);
  if (nums.length) return Math.max(...nums);
  const cefr = (s.toUpperCase().match(/\b[ABC][12]\b/g) || []).map((c) => CEFR_BAND[c]);
  return cefr.length ? Math.max(...cefr) : null;
}

function tierGuide(band) {
  if (band == null || band <= 4)
    return "Depth: foundation. Explain the basic forms step by step, use very short everyday sentences and simple A1–A2 words. Skip rare exceptions.";
  if (band <= 5.5)
    return "Depth: core. Cover the main forms and uses plus the most common exceptions. Examples use everyday and simple IELTS topics with B1 vocabulary.";
  if (band <= 6.5)
    return "Depth: upper-intermediate. Assume the basic forms are already known — keep Form brief and spend most of the content on nuances, contrasts, exceptions (e.g. stative verbs with a dynamic meaning) and how the structure is used in IELTS Writing and Speaking. Examples are academic, IELTS-style sentences with B2–C1 vocabulary and some complex sentences; avoid trivial examples like 'The sun rises in the east'.";
  return "Depth: advanced. Focus on subtle meaning differences, less common uses, stylistic/register choices and the errors that keep candidates below band 7–8. Examples are sophisticated, academic IELTS Task 2-style sentences with C1–C2 vocabulary.";
}

function describeStudentLevel(raw) {
  const s = String(raw || "").trim();
  if (!s) return DEFAULT_STUDENT_LEVEL;
  // Chỉ gõ số (vd "6.5") -> hiểu là IELTS band.
  if (/^\d(?:[.,]\d)?$/.test(s)) return `IELTS band ${s.replace(",", ".")}`;
  return s;
}

const LANGUAGE = {
  vi: "Write the explanations (Form notes, When to use, Common mistakes) in Vietnamese so young Vietnamese learners understand easily. Grammar terms may be given in English with a Vietnamese gloss, e.g. 'chủ ngữ (subject)'. ALL example sentences stay in English, each followed by its Vietnamese meaning in parentheses.",
  bilingual: "Write each explanation line in English followed by a short Vietnamese translation on the same line after ' — '. Example sentences are in English with the Vietnamese meaning in parentheses.",
  en: "Write everything in clear, simple English suited to the learners' level. Do not use Vietnamese.",
};

// Mỗi chủ đề là 1 lần gọi AI riêng, chạy song song (~15–25s/lần kể cả bài
// tập) — tổng thời gian không phụ thuộc số chủ đề, giữ dưới giới hạn 60s.
const MAX_TOPICS = 3;

// Soạn bài cần độ chính xác hơn chấm bài: ưu tiên Flash (không phải Flash
// Lite như chuỗi chấm bài), phần còn lại của chuỗi chấm bài làm dự phòng.
const PREFERRED_MODELS = ["gemini-2.5-flash"];
function lessonModels(gradingChain) {
  return [...PREFERRED_MODELS, ...(gradingChain || []).filter((m) => !PREFERRED_MODELS.includes(m))];
}
const MAX_FIELD = 3000;

// Các phần giáo viên tick để AI soạn. Link video YouTube cố ý KHÔNG có ở đây:
// AI hay bịa ra link không tồn tại.
const THEORY_PARTS = ["formula", "whenToUse", "commonMistakes", "examples"];
const PARTS = [...THEORY_PARTS, "exercises"];
const EXERCISE_TYPES = ["mcq", "fill"];
// 2 lượt AI (soạn + kiểm tra) × tối đa 3 chủ đề phải xong trong 60s.
const QUESTION_COUNTS = [5, 8, 10];

const SYSTEM = [
  "You are an experienced IELTS and English grammar teacher at a language centre in Vietnam.",
  "You write grammar lesson content (theory and practice questions) that students use inside a learning app.",
  "The app shows every text field as PLAIN TEXT with line breaks preserved. Therefore:",
  "- Never use Markdown: no **bold**, no # headings, no backticks, no tables.",
  "- Separate lines with a newline character. Start list items with '- '.",
  "- Keep lines short; one idea per line.",
  "Be accurate: every rule, example and answer key must be correct standard English.",
  "Pitch vocabulary, sentence length and depth to the stated learner level; do not include rules far beyond that level.",
  "Prefer sentences on everyday and IELTS-style topics (education, work, environment, technology, health, travel).",
].join("\n");

const THEORY_GUIDE = {
  formula: [
    "formula: the form/structure. One line per pattern, labelled, e.g.",
    "  (+) S + V(s/es) + O",
    "  (−) S + do/does + not + V + O",
    "  (?) Do/Does + S + V + O?",
    "  then 1–3 '- ' lines with key spelling/form notes if useful.",
  ],
  whenToUse: [
    "whenToUse: 3–5 '- ' lines, each a use case with a short example after ':'. Add signal words / time expressions on a final line if the structure has them.",
  ],
  commonMistakes: [
    "commonMistakes: 3–5 lines in the form '✗ wrong sentence → ✓ correct sentence — short reason' (no '- ' prefix). Choose mistakes Vietnamese learners typically make.",
    "  STRICT: the ✗ sentence must be ungrammatical in EVERY context (not merely less natural), the ✓ sentence must be different from it and fully correct, and the reason must name the rule broken.",
    "  Do not list a sentence as wrong if it could be correct in some situation (e.g. present continuous for a temporary job is correct).",
  ],
  examples: ["examples: 5–8 '- ' lines of natural example sentences covering the forms above (affirmative, negative, question)."],
};

const TYPE_LABEL = { mcq: "multiple choice (type \"mcq\")", fill: "gap fill (type \"fill\")" };

// Sinh dư vài câu: bước kiểm tra đáp án (checkQuestions) sẽ loại những câu
// sai/mơ hồ, sau đó mới cắt về đúng số câu giáo viên chọn.
const EXTRA_QUESTIONS = 3;

function exerciseGuide({ questionCount, exerciseTypes }, band) {
  const optCount = band != null && band >= 6 ? 4 : 3;
  const lines = [
    `exercises: exactly ${questionCount + EXTRA_QUESTIONS} practice questions that test THIS topic, using only these types: ${exerciseTypes.map((t) => TYPE_LABEL[t]).join(", ")}${exerciseTypes.length > 1 ? " — mix them roughly evenly" : ""}.`,
    "  Every question is ONE English sentence with ONE gap. Put the text before the gap in 'before' and the text after it in 'after' (either may be empty). Never write ___ inside before/after, and never repeat in before/after any word that belongs in the gap.",
    "  Add enough context (time expressions, a second clause) that exactly ONE answer is correct.",
    "  Do not reuse sentences from the theory. Vary subjects and situations.",
    "  explanation: one short line saying why the answer is right, in the explanation language.",
  ];
  if (exerciseTypes.includes("mcq")) {
    lines.push(
      `  mcq: 'options' has ${optCount} short choices that fill the gap; 'answer' is copied EXACTLY from options. Exactly one option is correct in every context — every distractor must be ungrammatical in that sentence, not merely less natural or less common. If a native speaker could accept a distractor (e.g. 'some' vs 'any' in a question or offer), replace it. 'baseWord' is empty.`
    );
  }
  if (exerciseTypes.includes("fill")) {
    lines.push(
      "  fill: 'baseWord' is what students must put into the right form, written in base form — a verb, noun or adjective, e.g. 'go', 'child', 'not / like'. Never use an auxiliary on its own (do, does, be, have) as baseWord. For negatives and questions put the whole missing verb phrase in the gap: before 'She', baseWord 'not / like', after 'spicy food.', answer \"doesn't like\".",
      "  'answer' is the correct form for the gap (e.g. 'goes', 'children'). 'altAnswers' must list EVERY other fully correct answer — contractions (\"doesn't like\" / 'does not like') and other correct structures (e.g. 'are going to buy' as well as 'are buying' for a fixed future plan). If too many answers would be correct, rewrite the sentence so the context allows only one structure. 'options' is empty.",
      "  At most 2 fill questions may have an answer identical to baseWord (e.g. an uncountable noun that does not change); the rest must require a real change."
    );
  }
  return lines;
}

function buildSchema({ parts }) {
  const properties = { name: { type: "string" } };
  const required = ["name"];
  for (const k of THEORY_PARTS) {
    if (parts.includes(k)) {
      properties[k] = { type: "string" };
      required.push(k);
    }
  }
  if (parts.includes("exercises")) {
    properties.exercises = {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: EXERCISE_TYPES },
          before: { type: "string" },
          after: { type: "string" },
          baseWord: { type: "string" },
          options: { type: "array", items: { type: "string" } },
          answer: { type: "string" },
          altAnswers: { type: "array", items: { type: "string" } },
          explanation: { type: "string" },
        },
        required: ["type", "before", "after", "answer", "explanation"],
      },
    };
    required.push("exercises");
  }
  return { type: "object", properties, required };
}

// 1 lần gọi = 1 chủ đề. `topic` là chủ đề cần viết; các chủ đề còn lại trong
// cùng lượt chỉ để AI tránh viết trùng nội dung.
function buildPrompt(input, topic) {
  const { level, unitName, topics, studentLevel, language, notes, parts } = input;
  const band = bandOf(studentLevel);
  const lines = [];
  lines.push("Class context:");
  if (level) lines.push(`- Centre course level: ${level}`);
  if (unitName) lines.push(`- Unit / lesson: ${unitName}`);
  lines.push(`- Learners' level: ${describeStudentLevel(studentLevel)}`);
  lines.push(`- ${tierGuide(band)}`);
  const others = topics.filter((t) => t !== topic);
  if (others.length) lines.push(`- Other topics in this lesson (covered separately, don't repeat them): ${others.join("; ")}`);
  lines.push("");
  lines.push(`Grammar topic: ${topic}`);
  lines.push("");
  lines.push(`Language: ${LANGUAGE[language] || LANGUAGE.vi}`);
  if (notes) {
    lines.push("");
    lines.push(`Extra requests from the teacher (follow them unless they conflict with the rules above): ${notes}`);
  }
  lines.push("");
  lines.push("Fill these fields:");
  lines.push("name: short topic title in English, e.g. 'Present Simple' or 'Second Conditional'.");
  lines.push("If the topic compares structures (e.g. 'A vs B'), cover EVERY structure in EVERY field, label which one each line is about, and add a line that contrasts them directly.");
  for (const k of THEORY_PARTS) if (parts.includes(k)) lines.push(...THEORY_GUIDE[k]);
  if (parts.includes("exercises")) lines.push(...exerciseGuide(input, band));
  lines.push("Before answering, re-check every rule, example and answer key for accuracy; fix or drop anything doubtful.");
  return lines.join("\n");
}

// Chặn markdown lọt vào (học sinh sẽ thấy nguyên dấu ** / #) + cắt độ dài.
function toPlain(s) {
  return String(s == null ? "" : s)
    .replace(/\r\n?/g, "\n")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]*)`/g, "$1")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s*[*•]\s+/gm, "- ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_FIELD);
}

// Bỏ các dòng "✗ A → ✓ B" mà A và B thực chất là một câu — AI đôi khi tự
// mâu thuẫn, để lọt vào sẽ dạy sai cho học sinh.
function dropBogusMistakes(text) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9']+/g, " ").trim();
  return text
    .split("\n")
    .filter((line) => {
      const m = line.match(/✗\s*(.+?)\s*→\s*✓\s*(.+?)(?:\s+—\s+|$)/);
      return !m || norm(m[1]) !== norm(m[2]);
    })
    .join("\n")
    .replace(/^- (?=✗)/gm, "");
}

const oneLine = (s) => toPlain(s).replace(/\s*\n\s*/g, " ").replace(/_{2,}/g, "").trim();
const sameText = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();
// "She drinks (coffee) ___ coffee..." — AI chép luôn từ cần điền vào ngay
// sát chỗ trống, câu thành vô nghĩa.
const words = (t) => t.toLowerCase().match(/[a-z']+/g) || [];
function repeatsGapWord(before, after, answer) {
  const a = new Set(words(answer));
  const next = words(after)[0];
  const prev = words(before).slice(-1)[0];
  return (next && a.has(next)) || (prev && a.has(prev));
}
const AUXILIARIES = new Set(["do", "does", "did", "be", "is", "am", "are", "was", "were", "have", "has", "had"]);

// ---- Bài tập: đọc câu AI trả -> kiểm tra đáp án -> cắt số câu -> section ----

// Câu hỏi thô của AI -> danh sách câu hợp lệ. Bỏ câu sai cấu trúc (đáp án
// không nằm trong lựa chọn, thiếu đáp án, dạng không được chọn, trùng...).
function parseQuestions(raw, { exerciseTypes }) {
  const out = [];
  const seen = new Set();
  for (const q of Array.isArray(raw) ? raw : []) {
    if (!q || !exerciseTypes.includes(q.type)) continue;
    const before = oneLine(q.before);
    const after = oneLine(q.after);
    const answer = oneLine(q.answer);
    if (!answer || (!before && !after)) continue;
    const key = `${before}|${after}`.toLowerCase();
    if (seen.has(key)) continue;
    if (q.type === "fill" && repeatsGapWord(before, after, answer)) continue;
    const explanation = oneLine(q.explanation).slice(0, 500);
    if (q.type === "mcq") {
      const opts = [...new Set((q.options || []).map(oneLine).filter(Boolean))].slice(0, 5);
      const correct = opts.filter((o) => sameText(o, answer));
      if (opts.length < 2 || correct.length !== 1) continue;
      seen.add(key);
      out.push({ type: "mcq", before, after, opts, answer: correct[0], explanation });
    } else {
      const base = oneLine(q.baseWord);
      // "They (do) ___ not like..." -> từ gợi ý chính là đáp án, câu vô nghĩa.
      if (AUXILIARIES.has(base.toLowerCase())) continue;
      const answers = [...new Set([answer, ...(q.altAnswers || []).map(oneLine)].filter(Boolean))].slice(0, 5);
      seen.add(key);
      out.push({ type: "fill", before, after, hint: base ? `(${base})` : "", answers, explanation });
    }
  }
  return out;
}

const questionText = (q) =>
  q.type === "mcq"
    ? `${q.before} ___ ${q.after}`.trim()
    : `${q.before} ${q.hint ? q.hint + " " : ""}___ ${q.after}`.replace(/\s+/g, " ").trim();

// ---- Bước kiểm tra: 1 lượt AI thứ hai, đóng vai giám khảo độc lập ----
const CHECK_SYSTEM = [
  "You are a meticulous English grammar examiner reviewing an answer key written by another teacher.",
  "Judge every sentence exactly as written, inserting each candidate into the gap (___).",
  "Be strict: a candidate counts as acceptable if a careful native speaker would accept the completed sentence as grammatical and natural in some reasonable reading of it.",
].join("\n");

const CHECK_SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          n: { type: "integer" },
          keyIsCorrect: { type: "boolean" },
          acceptable: { type: "array", items: { type: "string" } },
          note: { type: "string" },
        },
        required: ["n", "keyIsCorrect", "acceptable"],
      },
    },
  },
  required: ["items"],
};

function buildCheckPrompt(questions) {
  const lines = [
    "Check each item below. For every item return:",
    "- n: the item number",
    "- keyIsCorrect: true only if the completed sentence with the Key is grammatical and natural",
    "- acceptable: for [mcq] every option (copied exactly) that gives an acceptable sentence; for [gap fill] every word/phrase that correctly fills the gap using the word in brackets (include the key if it is correct, plus contractions and other correct structures)",
    "- note: one short line on any problem, else empty",
    "",
  ];
  questions.forEach((q, i) => {
    if (q.type === "mcq") {
      lines.push(`${i + 1}. [mcq] ${questionText(q)}  Options: ${q.opts.join(" | ")}  Key: ${q.answer}`);
    } else {
      lines.push(`${i + 1}. [gap fill] ${questionText(q)}  Key: ${q.answers.join(" / ")}`);
    }
  });
  return lines.join("\n");
}

// Giữ câu được giám khảo xác nhận:
// - trắc nghiệm: đáp án đúng, và là lựa chọn DUY NHẤT chấp nhận được;
// - điền từ: đáp án đúng; các cách viết đúng khác được thêm vào đáp án.
// Câu giám khảo bỏ sót -> bỏ luôn (thà thiếu câu còn hơn sai đáp án).
function checkQuestions(questions, check) {
  const byN = new Map(((check && check.items) || []).map((it) => [Number(it.n), it]));
  const kept = [];
  const removed = [];
  questions.forEach((q, i) => {
    const it = byN.get(i + 1);
    const reason = !it
      ? "not reviewed"
      : !it.keyIsCorrect
      ? `answer key judged wrong${it.note ? `: ${it.note}` : ""}`
      : null;
    if (reason) return removed.push({ text: questionText(q), reason });
    const ok = [...new Set((it.acceptable || []).map(oneLine).filter(Boolean))];
    if (q.type === "mcq") {
      const accepted = q.opts.filter((o) => ok.some((a) => sameText(a, o)));
      if (accepted.length !== 1 || !sameText(accepted[0], q.answer)) {
        return removed.push({
          text: questionText(q),
          reason: `more than one option could be right (${accepted.join(", ") || "none confirmed"})`,
        });
      }
      kept.push(q);
    } else {
      const answers = [...q.answers];
      ok.forEach((a) => {
        if (!answers.some((x) => sameText(x, a))) answers.push(a);
      });
      kept.push({ ...q, answers: answers.slice(0, 6) });
    }
  });
  return { kept, removed };
}

// Cắt về đúng số câu, chia đều 2 dạng (dạng nào thiếu thì dạng kia bù).
function pickQuestions(questions, count) {
  const mcq = questions.filter((q) => q.type === "mcq");
  const fill = questions.filter((q) => q.type === "fill");
  let nMcq = Math.min(mcq.length, Math.ceil(count / 2));
  const nFill = Math.min(fill.length, count - nMcq);
  nMcq = Math.min(mcq.length, count - nFill);
  return [...mcq.slice(0, nMcq), ...fill.slice(0, nFill)];
}

// Danh sách câu -> section theo đúng shape server (giống bài import từ file):
// trắc nghiệm và điền từ thành 2 section có sẵn dòng hướng dẫn, số câu 1..n.
function toSections(questions) {
  let id = 0;
  const sections = [];
  const mcqs = questions.filter((q) => q.type === "mcq");
  const fills = questions.filter((q) => q.type === "fill");
  if (mcqs.length) {
    sections.push({
      name: "Choose the correct answer.",
      fields: mcqs.map((q) => {
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
  if (fills.length) {
    sections.push({
      name: "Complete the sentences with the correct form of the word in brackets.",
      fields: fills.map((q) => {
        id += 1;
        return {
          id,
          type: "fill",
          label: q.before,
          pre: "",
          post: q.after,
          hint: q.hint,
          explanation: q.explanation,
          score: 1,
          selectCount: 1,
          options: [],
          answers: q.answers,
        };
      }),
    });
  }
  return sections;
}

// Kết quả lượt soạn -> topic nháp. Phần không tick để trống. `questions` là
// câu hỏi chưa kiểm tra — API chạy checkQuestions rồi finalizeTopic.
function normalizeTopic(data, input, requested) {
  const d = data || {};
  const pick = (k) => (input.parts.includes(k) ? toPlain(d[k]) : "");
  const lesson = {
    formula: pick("formula"),
    whenToUse: pick("whenToUse"),
    commonMistakes: input.parts.includes("commonMistakes") ? dropBogusMistakes(toPlain(d.commonMistakes)) : "",
    examples: pick("examples"),
    videoUrl: "",
  };
  const questions = input.parts.includes("exercises") ? parseQuestions(d.exercises, input) : [];
  const name = toPlain(d.name).split("\n")[0].slice(0, 120) || requested;
  const hasTheory = THEORY_PARTS.some((k) => lesson[k]);
  if (!hasTheory && !questions.length) return null;
  return { extId: "", name, lesson, questions };
}

// Topic nháp -> kết quả trả cho client. Bài tập ở dạng section của server
// (`exerciseSections`); client chuyển sang shape editor bằng sectionsToEditor,
// y như bài import từ file.
function finalizeTopic(topic, questions, input) {
  const { questions: _drop, ...rest } = topic;
  return { ...rest, exerciseSections: toSections(pickQuestions(questions, input.questionCount)) };
}

// Chuẩn hoá input của giáo viên. Trả { input } hoặc { error }.
function parseInput(body) {
  const b = body || {};
  const topics = String(b.topics || "")
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean);
  if (!topics.length) return { error: "Enter at least one grammar topic." };
  if (topics.length > MAX_TOPICS) return { error: `Up to ${MAX_TOPICS} topics at a time.` };
  const parts = Array.isArray(b.parts) ? PARTS.filter((p) => b.parts.includes(p)) : PARTS.slice();
  if (!parts.length) return { error: "Tick at least one part to generate." };
  const exerciseTypes = Array.isArray(b.exerciseTypes) ? EXERCISE_TYPES.filter((t) => b.exerciseTypes.includes(t)) : EXERCISE_TYPES.slice();
  if (parts.includes("exercises") && !exerciseTypes.length) return { error: "Tick at least one exercise type." };
  const count = Number(b.questionCount);
  const cap = (v, n) => String(v || "").trim().slice(0, n);
  return {
    input: {
      level: cap(b.level, 60),
      unitName: cap(b.unitName, 160),
      topics: [...new Set(topics.map((t) => t.slice(0, 160)))],
      studentLevel: cap(b.studentLevel, 80),
      language: LANGUAGE[b.language] ? b.language : "vi",
      notes: cap(b.notes, 1000),
      parts,
      exerciseTypes,
      questionCount: QUESTION_COUNTS.includes(count) ? count : 8,
    },
  };
}

module.exports = {
  SYSTEM,
  PARTS,
  THEORY_PARTS,
  EXERCISE_TYPES,
  QUESTION_COUNTS,
  buildSchema,
  buildPrompt,
  normalizeTopic,
  finalizeTopic,
  parseQuestions,
  checkQuestions,
  pickQuestions,
  toSections,
  CHECK_SYSTEM,
  CHECK_SCHEMA,
  buildCheckPrompt,
  parseInput,
  toPlain,
  lessonModels,
  MAX_TOPICS,
};
