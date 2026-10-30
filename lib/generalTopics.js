// Chủ điểm + mức độ của ngân hàng câu hỏi General (Phase 12 G4, D2/D3). CommonJS thuần, không DB.
// Khoá ổn định (lưu DB), nhãn tiếng Anh cho giáo viên. Chủ điểm gõ tự do vẫn được: lưu nguyên chuỗi.

const GENERAL_TOPICS = [
  {
    group: "grammar",
    label: "Grammar",
    topics: [
      { key: "gr-present-tenses", label: "Present simple & continuous" },
      { key: "gr-past-tenses", label: "Past simple & continuous" },
      { key: "gr-present-perfect", label: "Present perfect (simple & continuous)" },
      { key: "gr-past-perfect", label: "Past perfect" },
      { key: "gr-future-forms", label: "Future forms" },
      { key: "gr-tense-mixed", label: "Mixed tenses" },
      { key: "gr-sva", label: "Subject-verb agreement" },
      { key: "gr-conditionals", label: "Conditionals (types 0-3, mixed)" },
      { key: "gr-wish", label: "Wish & if only" },
      { key: "gr-passive", label: "Passive voice" },
      { key: "gr-causative", label: "Causative (have/get something done)" },
      { key: "gr-reported-speech", label: "Reported speech" },
      { key: "gr-relative-clauses", label: "Relative clauses" },
      { key: "gr-comparisons", label: "Comparisons" },
      { key: "gr-modals", label: "Modal verbs" },
      { key: "gr-gerund-infinitive", label: "Gerunds & infinitives" },
      { key: "gr-participles", label: "Participle clauses" },
      { key: "gr-articles", label: "Articles & determiners" },
      { key: "gr-quantifiers", label: "Quantifiers" },
      { key: "gr-pronouns", label: "Pronouns & possessives" },
      { key: "gr-prepositions", label: "Prepositions" },
      { key: "gr-conjunctions", label: "Conjunctions & linking words" },
      { key: "gr-adverb-clauses", label: "Adverbial clauses" },
      { key: "gr-question-tags", label: "Questions & question tags" },
      { key: "gr-inversion", label: "Inversion & emphasis" },
      { key: "gr-subjunctive", label: "Subjunctive & it's time" },
      { key: "gr-word-order", label: "Word order & adjective order" },
      { key: "gr-sentence-transformation", label: "Sentence transformation" },
    ],
  },
  {
    group: "vocabulary",
    label: "Vocabulary",
    topics: [
      { key: "vo-word-form", label: "Word formation" },
      { key: "vo-phrasal-verbs", label: "Phrasal verbs" },
      { key: "vo-collocations", label: "Collocations" },
      { key: "vo-idioms", label: "Idioms" },
      { key: "vo-synonyms", label: "Synonyms" },
      { key: "vo-antonyms", label: "Antonyms" },
      { key: "vo-confusing-words", label: "Confusing words" },
      { key: "vo-prepositions", label: "Dependent prepositions" },
      { key: "vo-pronunciation", label: "Pronunciation" },
      { key: "vo-stress", label: "Word stress" },
      { key: "vo-family", label: "Family & relationships" },
      { key: "vo-school", label: "School & education" },
      { key: "vo-daily-life", label: "Daily life & hobbies" },
      { key: "vo-health", label: "Health & lifestyle" },
      { key: "vo-environment", label: "Environment" },
      { key: "vo-technology", label: "Technology & media" },
      { key: "vo-travel", label: "Travel & tourism" },
      { key: "vo-culture", label: "Culture & traditions" },
      { key: "vo-city", label: "City & community" },
      { key: "vo-jobs", label: "Jobs & careers" },
    ],
  },
  {
    group: "skills",
    label: "Skills",
    topics: [
      { key: "sk-communication", label: "Communication functions" },
      { key: "sk-signs", label: "Signs & notices" },
      { key: "sk-read-main-idea", label: "Reading: main idea" },
      { key: "sk-read-detail", label: "Reading: detail" },
      { key: "sk-read-inference", label: "Reading: inference" },
      { key: "sk-read-reference", label: "Reading: reference" },
      { key: "sk-read-vocab-context", label: "Reading: vocabulary in context" },
      { key: "sk-read-tf", label: "Reading: true / false" },
      { key: "sk-cloze", label: "Cloze text" },
      { key: "sk-arrange", label: "Arranging sentences / text" },
      { key: "sk-insert-sentence", label: "Sentence insertion" },
      { key: "sk-listen-gist", label: "Listening: gist" },
      { key: "sk-listen-detail", label: "Listening: detail" },
      { key: "sk-error-id", label: "Error identification" },
    ],
  },
];

// Mức độ (D3): khoá lưu DB, nhãn tiếng Anh kèm viết tắt tiếng Việt quen thuộc.
const DIFFICULTIES = [
  { key: "nb", short: "NB", label: "Recognition (NB)" },
  { key: "th", short: "TH", label: "Comprehension (TH)" },
  { key: "vd", short: "VD", label: "Application (VD)" },
  { key: "vdc", short: "VDC", label: "High application (VDC)" },
];

const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

const TOPIC_LABELS = {};
for (const g of GENERAL_TOPICS) for (const t of g.topics) TOPIC_LABELS[t.key] = t.label;

const DIFFICULTY_LABELS = {};
for (const d of DIFFICULTIES) DIFFICULTY_LABELS[d.key] = d.label;

function isDifficulty(k) {
  return typeof k === "string" && has(DIFFICULTY_LABELS, k);
}

function difficultyLabel(k) {
  return isDifficulty(k) ? DIFFICULTY_LABELS[k] : "";
}

function isTopicKey(k) {
  return typeof k === "string" && has(TOPIC_LABELS, k);
}

// Nhãn của chủ điểm: khoá có sẵn -> nhãn; chủ điểm gõ tự do -> chính chuỗi đó.
function topicLabel(k) {
  if (k == null) return "";
  const s = String(k).trim();
  return has(TOPIC_LABELS, s) ? TOPIC_LABELS[s] : s;
}

module.exports = { GENERAL_TOPICS, DIFFICULTIES, TOPIC_LABELS, isDifficulty, difficultyLabel, isTopicKey, topicLabel };
