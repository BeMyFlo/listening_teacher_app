const mongoose = require("mongoose");

const AudioSchema = new mongoose.Schema({
  title: { type: String, required: true },
  unit: { type: String, default: "" },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Audio || mongoose.model("Audio", AudioSchema);
