// Rubric Writing / Speaking của chương trình General English (Phase 12 G5), thang 10.
// 4 tiêu chí, mỗi tiêu chí 0–2.5 (bước 0.25), điểm bài = TỔNG 4 tiêu chí.
// Descriptor viết cho học sinh phổ thông lớp 6–12: "đạt kỳ vọng của khối" (A1 lớp 6–7, A2 lớp 8–9,
// B1 lớp 10–12) thì được điểm cao — KHÔNG so với chuẩn IELTS. Chỉ có mức mốc 2.5/2/1.5/1/0.5/0;
// điểm giữa các mốc (vd 1.75) do người chấm tự quyết.
// Không nhét vào rubrics.json để phần IELTS giữ nguyên. CommonJS thuần (dùng chung server + client).

const CRITERION_MAX = 2.5;
const CRITERION_STEP = 0.25;

// Tạo bảng mức từ mảng 6 chuỗi theo thứ tự 2.5, 2, 1.5, 1, 0.5, 0.
function levels(texts) {
  const keys = ["2.5", "2", "1.5", "1", "0.5", "0"];
  const out = {};
  keys.forEach((k, i) => (out[k] = { en: texts[i] }));
  return out;
}

const GENERAL_RUBRICS = {
  "general.writing": {
    label: "Writing (10-point)",
    criteria: [
      {
        key: "CT",
        label: "Content",
        bands: levels([
          "Fully answers the task for the grade. All required points are covered with clear, relevant ideas and enough detail for the level.",
          "Answers the task well. Covers nearly all required points; ideas are relevant, with a little too little or too much detail.",
          "Answers most of the task. One required point is missing or thin, or some ideas are off-topic or very general.",
          "Answers only part of the task. Several required points are missing; ideas are simple, repeated or partly off-topic.",
          "Barely answers the task. Very little relevant content; mostly copied from the question or hard to connect to the topic.",
          "No answer, or nothing relevant to the task.",
        ]),
      },
      {
        key: "OR",
        label: "Organisation",
        bands: levels([
          "Easy to follow from start to finish. Right format for the task (e.g. letter, paragraph), clear paragraphs or order, and linking words used correctly for the grade.",
          "Clear order and format with only small slips. Uses common linking words (and, but, because, first, then, however) mostly correctly.",
          "Mostly in a sensible order, but format or paragraphing is uneven, or linking words are limited or repetitive.",
          "Order is sometimes hard to follow. Little paragraphing, few or wrong linking words; ideas feel like a list of sentences.",
          "Very little order. Ideas jump around and the reader has to guess how they connect.",
          "No organisation at all, or too little written to judge.",
        ]),
      },
      {
        key: "VO",
        label: "Vocabulary",
        bands: levels([
          "Good range of words for the grade and topic, including words from recent lessons. Words are chosen correctly; spelling is almost always right.",
          "Enough words to say what is needed; a few repeated words or small word-choice and spelling mistakes that do not block meaning.",
          "Basic words are used correctly but range is narrow or repeated. Some wrong word choices or spelling mistakes, meaning still clear.",
          "Limited vocabulary below the expected level. Frequent wrong words or spelling mistakes; some meaning is unclear.",
          "Only a few simple words; many wrong words or spelling errors make the text hard to understand.",
          "No usable vocabulary, or text is not English.",
        ]),
      },
      {
        key: "GR",
        label: "Grammar & mechanics",
        bands: levels([
          "Grammar for the grade is used accurately, including the structures taught in the unit. Few mistakes; capital letters and punctuation are almost always correct.",
          "Mostly accurate. Some mistakes (e.g. tense, articles, subject-verb agreement) but they rarely stop the reader understanding.",
          "Simple sentences are mostly correct; longer or newer structures often have mistakes. Some missing capitals or punctuation. Meaning is usually clear.",
          "Frequent grammar mistakes, even in simple sentences. Punctuation is often missing; the reader sometimes has to guess the meaning.",
          "Almost every sentence has mistakes; very few correct sentences, and meaning is often unclear.",
          "No correct sentences, or too little written to judge.",
        ]),
      },
    ],
  },
  "general.speaking": {
    label: "Speaking (10-point)",
    criteria: [
      {
        key: "CT",
        label: "Content",
        bands: levels([
          "Fully answers the question for the grade. Ideas are relevant and developed with reasons or examples suitable for the level.",
          "Answers the question well. Ideas are relevant, with a little too little detail or one small off-topic part.",
          "Answers most of the question. Ideas are relevant but short or general; may miss one part of the task.",
          "Answers only part of the question. Ideas are very simple, repeated or partly off-topic.",
          "Barely answers. A few words or one short sentence related to the topic.",
          "No answer, or nothing relevant to the question.",
        ]),
      },
      {
        key: "FL",
        label: "Fluency",
        bands: levels([
          "Speaks smoothly at a pace suitable for the grade. Short natural pauses; easy to follow without effort.",
          "Mostly smooth. A few pauses or repeated words while finding ideas, but the listener follows easily.",
          "Understandable but with noticeable pauses and restarts. Speaks in short pieces and sometimes loses the thread.",
          "Frequent long pauses. Speaks word by word or in very short phrases; the listener must work to follow.",
          "Very hard to follow because of constant stops; only isolated words or fragments.",
          "No speech, or nothing that can be understood.",
        ]),
      },
      {
        key: "PN",
        label: "Pronunciation",
        bands: levels([
          "Clear and easy to understand. Sounds, word stress and intonation are good for the grade; only small accent features.",
          "Generally clear. A few mispronounced words or wrong stress that do not stop understanding.",
          "Mostly understandable, but several words are mispronounced or stress and intonation are flat, so the listener sometimes needs to listen twice.",
          "Many mispronounced sounds or words; the listener often cannot understand without effort.",
          "Pronunciation makes most of the speech very hard to understand.",
          "No speech, or nothing can be understood.",
        ]),
      },
      {
        key: "LU",
        label: "Language use",
        bands: levels([
          "Uses vocabulary and grammar for the grade accurately, including words and structures from recent lessons. Few mistakes.",
          "Mostly accurate with some mistakes in grammar or word choice that rarely affect meaning.",
          "Simple sentences are mostly correct; longer or newer structures often have mistakes. Meaning is usually clear.",
          "Limited words and frequent grammar mistakes, even in simple sentences; meaning is sometimes unclear.",
          "Only isolated words or memorised phrases; almost every sentence has mistakes.",
          "No usable English.",
        ]),
      },
    ],
  },
};

module.exports = { GENERAL_RUBRICS, CRITERION_MAX, CRITERION_STEP };
