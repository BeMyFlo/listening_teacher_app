const mongoose = require("mongoose");

// 1 buổi điểm danh của 1 lớp. "number" = số thứ tự buổi (Buổi 1, Buổi 2…), tự
// tăng theo lớp. "date" lưu chuỗi "YYYY-MM-DD" cho khỏi lệch múi giờ.
//
//   status:  present  — có mặt
//            late     — đi trễ
//            excused  — vắng có phép
//            absent   — vắng không phép
const STATUSES = ["present", "late", "excused", "absent"];

//   homework:  done — nộp đủ, đúng hạn      missing — không nộp gì
//              partial — thiếu / nộp trễ    none    — buổi này không có bài tập
// homeworkAuto=true: đang dùng giá trị tự suy (xem lib/attendanceHomework.js);
// giáo viên chỉnh tay -> lưu homeworkAuto=false, không bị auto đè nữa.
const HW_STATUSES = ["done", "partial", "missing", "none"];

const AttendanceRecordSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student", required: true },
    status: { type: String, enum: STATUSES, default: "present" },
    note: { type: String, default: "" },
    homework: { type: String, enum: HW_STATUSES, default: "none" },
    homeworkAuto: { type: Boolean, default: true },
  },
  { _id: false }
);

const AttendanceSessionSchema = new mongoose.Schema(
  {
    classId: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true, index: true },
    number: { type: Number, required: true },
    date: { type: String, required: true }, // "YYYY-MM-DD"
    note: { type: String, default: "" },
    records: { type: [AttendanceRecordSchema], default: [] },
    takenBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
  },
  { timestamps: true }
);

AttendanceSessionSchema.index({ classId: 1, number: 1 });
AttendanceSessionSchema.statics.STATUSES = STATUSES;
AttendanceSessionSchema.statics.HW_STATUSES = HW_STATUSES;

module.exports =
  mongoose.models.AttendanceSession || mongoose.model("AttendanceSession", AttendanceSessionSchema);
