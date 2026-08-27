const mongoose = require("mongoose");

// Một Lớp = nhóm học sinh học cùng nhau, chung 1 level. Level là của Lớp:
// khi gán học sinh vào lớp, Student.level được đồng bộ = Class.level (giữ
// level trên Student làm khóa lọc nội dung cho api/units.js & api/tests.js).
const ClassSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    level: { type: Number, required: true, min: 1 },
  },
  { timestamps: true }
);

module.exports = mongoose.models.Class || mongoose.model("Class", ClassSchema);
