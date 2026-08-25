// One-off backfill: adds level:1 to legacy Student/Test documents that were
// created before the level field existed. Run manually with:
//   node scripts/migrate-add-level.js
// NOT a Vercel serverless function (scripts/ is outside /api).
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { connectDB } = require("../lib/db");
const Student = require("../lib/models/Student");
const Test = require("../lib/models/Test");

(async () => {
  await connectDB();
  const s = await Student.updateMany({ level: { $exists: false } }, { $set: { level: 1 } });
  const t = await Test.updateMany({ level: { $exists: false } }, { $set: { level: 1 } });
  console.log("Students backfilled:", s.modifiedCount);
  console.log("Tests backfilled:", t.modifiedCount);
  process.exit(0);
})();
