const mongoose = require("mongoose");

// Shared question engine schema — used by both Test.sections and the
// exercises inside Lesson Units, so grading logic stays identical.
const FieldSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    label: { type: String, default: "" },
    type: { type: String, enum: ["fill", "choice"], default: "fill" },
    pre: { type: String, default: "" },
    post: { type: String, default: "" },
    options: [{ value: String, label: String }],
    selectCount: { type: Number, default: 1 },
    // Point weight for this question — most questions are worth 1 point,
    // but a teacher can weight harder items higher; grading sums weights
    // instead of a flat question count.
    score: { type: Number, default: 1 },
    answers: { type: [String], default: [] }
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    passageText: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    matchOptions: [{ value: String, label: String }],
    fields: { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

module.exports = { FieldSchema, SectionSchema };
