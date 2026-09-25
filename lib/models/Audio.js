const mongoose = require("mongoose");

const AudioSchema = new mongoose.Schema({
  // Workspace sở hữu document này — xem ghi chú ở lib/models/Class.js.
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", required: true },
  title: { type: String, required: true },
  unit: { type: String, default: "" },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

AudioSchema.index({ workspaceId: 1, uploadedAt: -1 });

module.exports = mongoose.models.Audio || mongoose.model("Audio", AudioSchema);
