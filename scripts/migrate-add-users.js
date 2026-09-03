// One-off: tạo 1 bản ghi User cho mỗi Teacher/Student chưa có. Chạy:
//   node scripts/migrate-add-users.js
// Idempotent — chạy lại nhiều lần không tạo trùng. (Login cũng tự backfill khi
// tài khoản cũ đăng nhập, script này chỉ để "hâm nóng" hàng loạt.)
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { connectDB } = require("../lib/db");
const User = require("../lib/models/User");
const Teacher = require("../lib/models/Teacher");
const Student = require("../lib/models/Student");

(async () => {
  await connectDB();

  let teachers = 0;
  for (const t of await Teacher.find().lean()) {
    if (await User.exists({ teacherId: t._id })) continue;
    if (await User.exists({ username: t.username })) {
      console.warn(`skip teacher ${t.username}: username already taken by another User`);
      continue;
    }
    await User.create({
      username: t.username,
      passwordHash: t.passwordHash,
      role: "teacher",
      teacherId: t._id,
      name: t.name || "",
      email: t.email || "",
    });
    teachers++;
  }

  let students = 0;
  for (const s of await Student.find().lean()) {
    if (await User.exists({ studentId: s._id })) continue;
    if (await User.exists({ username: s.username })) {
      console.warn(`skip student ${s.username}: username already taken by another User`);
      continue;
    }
    await User.create({
      username: s.username,
      passwordHash: s.passwordHash,
      role: "student",
      studentId: s._id,
      name: s.name || "",
      email: s.email || "",
    });
    students++;
  }

  const byRole = await User.aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]);
  console.log("Users created — teachers:", teachers, "students:", students);
  console.log("User totals:", byRole.map((r) => `${r._id}=${r.n}`).join(" "));
  process.exit(0);
})();
