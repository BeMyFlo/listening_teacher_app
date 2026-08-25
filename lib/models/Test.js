const mongoose = require("mongoose");
const { SectionSchema } = require("./schemas/questionSchema");

const TestSchema = new mongoose.Schema(
  {
    subject: { type: String, enum: ["listening", "reading"], default: "listening" },
    title: { type: String, required: true },
    unit: { type: String, default: "" },
    level: { type: Number, required: true, min: 1 },
    instructions: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    // Phase 4 — lịch thi: các field optional, null/rỗng = không giới hạn.
    publishAt: { type: Date, default: null },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
    sections: { type: [SectionSchema], default: [] }
  },
  { timestamps: true }
);

module.exports = mongoose.models.Test || mongoose.model("Test", TestSchema);
