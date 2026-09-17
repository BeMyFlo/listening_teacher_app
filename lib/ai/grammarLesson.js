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

const MAX_TOPICS = 3; // ~15s/chủ đề với Flash — giữ dưới giới hạn 60s của function

// Soạn bài cần độ chính xác hơn chấm bài: ưu tiên Flash (không phải Flash
// Lite như chuỗi chấm bài), phần còn lại của chuỗi chấm bài làm dự phòng.
const PREFERRED_MODELS = ["gemini-2.5-flash"];
function lessonModels(gradingChain) {
  return [...PREFERRED_MODELS, ...(gradingChain || []).filter((m) => !PREFERRED_MODELS.includes(m))];
}
const MAX_FIELD = 3000;

const SCHEMA = {
  type: "object",
  properties: {
    topics: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          formula: { type: "string" },
          whenToUse: { type: "string" },
          commonMistakes: { type: "string" },
          examples: { type: "string" },
        },
        required: ["name", "formula", "whenToUse", "commonMistakes", "examples"],
      },
    },
  },
  required: ["topics"],
};

const SYSTEM = [
  "You are an experienced IELTS and English grammar teacher at a language centre in Vietnam.",
  "You write the THEORY section of a grammar lesson that students read inside a learning app before doing exercises.",
  "The app shows every field as PLAIN TEXT with line breaks preserved. Therefore:",
  "- Never use Markdown: no **bold**, no # headings, no backticks, no tables.",
  "- Separate lines with a newline character. Start list items with '- '.",
  "- Keep lines short; one idea per line.",
  "Be accurate: every rule and example must be grammatically correct standard English.",
  "Pitch vocabulary, sentence length and depth to the stated learner level; do not include rules far beyond that level.",
  "Prefer example sentences on everyday and IELTS-style topics (education, work, environment, technology, health, travel).",
].join("\n");

function fieldGuide() {
  return [
    "Fill these fields for each topic:",
    "name: short topic title in English, e.g. 'Present Simple' or 'Second Conditional'.",
    "If a topic compares structures (e.g. 'A vs B'), cover EVERY structure in EVERY field, label which one each line is about, and add a line that contrasts them directly.",
    "formula: the form/structure. One line per pattern, labelled, e.g.",
    "  (+) S + V(s/es) + O",
    "  (−) S + do/does + not + V + O",
    "  (?) Do/Does + S + V + O?",
    "  then 1–3 '- ' lines with key spelling/form notes if useful.",
    "whenToUse: 3–5 '- ' lines, each a use case with a short example after ':'. Add signal words / time expressions on a final line if the tense has them.",
    "commonMistakes: 3–5 lines in the form '✗ wrong sentence → ✓ correct sentence — short reason' (no '- ' prefix). Choose mistakes Vietnamese learners typically make.",
    "  STRICT: the ✗ sentence must be ungrammatical in EVERY context (not merely less natural), the ✓ sentence must be different from it and fully correct, and the reason must name the rule broken.",
    "  Do not list a sentence as wrong if it could be correct in some situation (e.g. present continuous for a temporary job is correct).",
    "Before answering, re-check every rule, every ✗/✓ pair and every example sentence for accuracy; fix or drop anything doubtful.",
    "examples: 5–8 '- ' lines of natural example sentences covering the forms above (affirmative, negative, question).",
  ].join("\n");
}

function buildPrompt({ level, unitName, topics, studentLevel, language, notes }) {
  const lines = [];
  lines.push("Class context:");
  if (level) lines.push(`- Centre course level: ${level}`);
  if (unitName) lines.push(`- Unit / lesson: ${unitName}`);
  lines.push(`- Learners' level: ${describeStudentLevel(studentLevel)}`);
  lines.push(`- ${tierGuide(bandOf(studentLevel))}`);
  lines.push("");
  lines.push(`Write theory for ${topics.length === 1 ? "this grammar topic" : `these ${topics.length} grammar topics, in this order, one entry each`}:`);
  topics.forEach((t, i) => lines.push(`${i + 1}. ${t}`));
  lines.push("");
  lines.push(`Language: ${LANGUAGE[language] || LANGUAGE.vi}`);
  if (notes) {
    lines.push("");
    lines.push(`Extra requests from the teacher (follow them unless they conflict with the rules above): ${notes}`);
  }
  lines.push("");
  lines.push(fieldGuide());
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

function normalizeTopics(data) {
  const list = Array.isArray(data && data.topics) ? data.topics : [];
  return list
    .map((t) => ({
      extId: "",
      name: toPlain(t && t.name).split("\n")[0].slice(0, 120),
      lesson: {
        formula: toPlain(t && t.formula),
        whenToUse: toPlain(t && t.whenToUse),
        commonMistakes: dropBogusMistakes(toPlain(t && t.commonMistakes)),
        examples: toPlain(t && t.examples),
        videoUrl: "",
      },
      exercises: [],
    }))
    .filter((t) => t.name && (t.lesson.formula || t.lesson.whenToUse || t.lesson.examples))
    .slice(0, MAX_TOPICS);
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
  const cap = (v, n) => String(v || "").trim().slice(0, n);
  return {
    input: {
      level: cap(b.level, 60),
      unitName: cap(b.unitName, 160),
      topics: topics.map((t) => t.slice(0, 160)),
      studentLevel: cap(b.studentLevel, 80),
      language: LANGUAGE[b.language] ? b.language : "vi",
      notes: cap(b.notes, 1000),
    },
  };
}

module.exports = { SYSTEM, SCHEMA, buildPrompt, normalizeTopics, parseInput, toPlain, lessonModels, MAX_TOPICS };
