const mongoose = require("mongoose");
const { SectionSchema } = require("./questionSchema");

// Bài tập dùng chung cho topic grammar / group vocab — cùng engine câu hỏi
// với Exercise trong category.
const TopicExerciseSchema = new mongoose.Schema(
  { title: { type: String, default: "" }, sections: { type: [SectionSchema], default: [] } },
  { timestamps: true }
);

// 1 chủ điểm ngữ pháp: lý thuyết có cấu trúc + bài tập của riêng nó.
const GrammarTopicSchema = new mongoose.Schema({
  extId: { type: String, default: "" }, // Grammar_ID trong file — để re-import ghi đè
  name: { type: String, default: "" },
  lesson: {
    formula: { type: String, default: "" },
    whenToUse: { type: String, default: "" },
    commonMistakes: { type: String, default: "" },
    examples: { type: String, default: "" },
    videoUrl: { type: String, default: "" }, // chỉ YouTube
  },
  exercises: { type: [TopicExerciseSchema], default: [] },
});

const VocabWordSchema = new mongoose.Schema(
  {
    word: { type: String, default: "" },
    partOfSpeech: { type: String, default: "" },
    ipa: { type: String, default: "" },
    meaning: { type: String, default: "" },
    definitionEn: { type: String, default: "" },
    example: { type: String, default: "" },
    collocation: { type: String, default: "" },
    synonyms: { type: String, default: "" },
  },
  { _id: false }
);

// 1 nhóm từ vựng: danh sách từ (flashcard) + bài tập.
const VocabGroupSchema = new mongoose.Schema({
  extId: { type: String, default: "" }, // Unit_ID trong file
  name: { type: String, default: "" },
  words: { type: [VocabWordSchema], default: [] },
  exercises: { type: [TopicExerciseSchema], default: [] },
});

module.exports = { GrammarTopicSchema, VocabGroupSchema, VocabWordSchema };
