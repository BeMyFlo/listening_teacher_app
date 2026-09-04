// Sửa index của collection `users`: bỏ index sparse cũ (teacherId_1 / studentId_1)
// rồi để model tạo lại dạng partial. Chạy 1 lần sau khi cập nhật lib/models/User.js.
//   node scripts/fix-user-indexes.js
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.development.local"), override: true });
if (process.argv[2] && process.argv[2].startsWith("mongodb")) process.env.MONGODB_URI = process.argv[2];
const { connectDB } = require("../lib/db");
const User = require("../lib/models/User");

(async () => {
  await connectDB();
  const col = User.collection;
  const before = await col.indexes();
  console.log("Before:", before.map((i) => i.name).join(", "));

  for (const name of ["teacherId_1", "studentId_1"]) {
    try {
      await col.dropIndex(name);
      console.log("dropped", name);
    } catch (e) {
      console.log("skip", name, "-", e.codeName || e.message);
    }
  }

  await User.syncIndexes();
  const after = await col.indexes();
  console.log("After:", after.map((i) => `${i.name}${i.partialFilterExpression ? " (partial)" : ""}`).join(", "));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
