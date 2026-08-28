const mongoose = require("mongoose");

// Metadata phòng chat của 1 lớp (1 lớp = 1 phòng). Tạo lười khi có tin đầu
// tiên. Danh sách phòng của user vẫn suy từ Class + lớp của user, phòng chưa
// có tin vẫn hiện (rỗng).
const ConversationSchema = new mongoose.Schema({
  classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true, unique: true },
  lastMessageAt: { type: Date },
  lastMessagePreview: { type: String, default: "" },
});

module.exports = mongoose.models.Conversation || mongoose.model("Conversation", ConversationSchema);
