const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    label: { type: String, default: "" },
    type: { type: String, enum: ["fill", "choice"], default: "fill" },
    pre: { type: String, default: "" },
    post: { type: String, default: "" },
    options: [{ value: String, label: String }],
    // >1 turns single-select (radio) into a checkbox group graded as an
    // exact-set match — covers IELTS "choose TWO/THREE answers" questions.
    selectCount: { type: Number, default: 1 },
    answers: { type: [String], default: [] }
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    // Listening sections carry audio; Reading sections carry passage text
    // and/or an image (diagram/map labelling). Required-ness is enforced
    // conditionally in the API based on Test.subject, not here.
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    passageText: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    // Shared option bank a "choice" field can fall back to when it has no
    // options of its own — this is what makes matching-style questions
    // (headings/features/information/sentence-endings) work as plain MC.
    matchOptions: [{ value: String, label: String }],
    fields: { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

const TestSchema = new mongoose.Schema(
  {
    subject: { type: String, enum: ["listening", "reading"], default: "listening" },
    title: { type: String, required: true },
    unit: { type: String, default: "" },
    instructions: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    sections: { type: [SectionSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Test || mongoose.model("Test", TestSchema);
