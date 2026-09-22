const mongoose = require("mongoose");

const ImageSchema = new mongoose.Schema({
  // Workspace sở hữu document này — xem ghi chú ở lib/models/Class.js.
  workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: "Workspace", index: true },
  title: { type: String, required: true },
  unit: { type: String, default: "" },
  cloudinaryUrl: { type: String, required: true },
  cloudinaryPublicId: { type: String, required: true },
  uploadedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Image || mongoose.model("Image", ImageSchema);
