const mongoose = require("mongoose");

const SubmissionSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
  studentName: { type: String, required: true },
  testId: { type: mongoose.Schema.Types.ObjectId, ref: "Test", required: true },
  testTitle: { type: String, default: "" },
  answers: { type: mongoose.Schema.Types.Mixed, default: {} },
  score: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  replayCount: { type: Number, default: 0 },
  submittedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Submission || mongoose.model("Submission", SubmissionSchema);
