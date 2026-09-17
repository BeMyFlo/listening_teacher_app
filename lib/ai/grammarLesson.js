// Soạn phần lý thuyết Grammar bằng AI (Gemini): giáo viên nhập bối cảnh lớp
// + chủ đề -> trả về đúng khung `topic.lesson` mà học sinh xem ở
// components/student/GrammarTopicView.js. Các ô lý thuyết hiển thị dạng text
// thuần (white-space: pre-line) nên AI phải trả text thuần, không markdown.

const PROFICIENCY = {
  beginner: "Beginner (CEFR A1–A2, IELTS band 3.0–4.0)",
  elementary: "Pre-intermediate (CEFR A2–B1, IELTS band 4.0–5.0)",
  intermediate: "Intermediate (CEFR B1–B2, IELTS band 5.0–6.0)",
  upper: "Upper-intermediate (CEFR B2–C1, IELTS band 6.0–7.0+)",
};

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

function buildPrompt({ level, unitName, topics, proficiency, language, notes }) {
  const lines = [];
  lines.push("Class context:");
  if (level) lines.push(`- Centre course level: ${level}`);
  if (unitName) lines.push(`- Unit / lesson: ${unitName}`);
  lines.push(`- Learners: ${PROFICIENCY[proficiency] || PROFICIENCY.elementary}`);
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
      proficiency: PROFICIENCY[b.proficiency] ? b.proficiency : "elementary",
      language: LANGUAGE[b.language] ? b.language : "vi",
      notes: cap(b.notes, 1000),
    },
  };
}

module.exports = { SYSTEM, SCHEMA, buildPrompt, normalizeTopics, parseInput, toPlain, lessonModels, MAX_TOPICS };
