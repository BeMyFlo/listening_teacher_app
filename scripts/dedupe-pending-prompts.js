// Dọn bài lesson writing/speaking bị nộp trùng NHIỀU LẦN trước khi chấm.
// Với mỗi (studentId, promptId): nếu có >1 bài CHƯA CHẤM, không phải resubmit
// (parentSubmissionId rỗng) -> giữ bài mới nhất, xoá phần còn lại.
//   node scripts/dedupe-pending-prompts.js "<MONGODB_URI>"   (bỏ trống = dry-run cảnh báo)
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env.local") });
require("dotenv").config({ path: path.join(__dirname, "..", ".env.development.local"), override: true });
if (process.argv[2] && process.argv[2].startsWith("mongodb")) process.env.MONGODB_URI = process.argv[2];
const APPLY = process.argv.includes("--apply");

const { connectDB } = require("../lib/db");
const Submission = require("../lib/models/Submission");
let deleteAudioFile = async () => {};
try { ({ deleteAudioFile } = require("../lib/cloudinary")); } catch {}

(async () => {
  await connectDB();
  const subs = await Submission.find({
    kind: { $in: ["writing", "speaking"] },
    promptId: { $ne: null },
    gradingStatus: { $ne: "graded" },
    $or: [{ parentSubmissionId: null }, { parentSubmissionId: { $exists: false } }],
  }).sort({ submittedAt: -1 }).lean();

  const groups = new Map();
  for (const s of subs) {
    const k = `${s.studentId}:${s.promptId}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(s);
  }

  let dupGroups = 0, toDelete = 0;
  for (const [k, rows] of groups) {
    if (rows.length < 2) continue;
    dupGroups++;
    const [keep, ...drop] = rows; // rows[0] = mới nhất
    console.log(`${k}: keep ${keep._id} (${new Date(keep.submittedAt).toISOString()}), drop ${drop.length}`);
    for (const d of drop) {
      toDelete++;
      if (APPLY) {
        if (d.kind === "speaking" && d.audioPublicId) { try { await deleteAudioFile(d.audioPublicId); } catch {} }
        await Submission.deleteOne({ _id: d._id });
      }
    }
  }
  console.log(`\n${dupGroups} prompt(s) with duplicates, ${toDelete} submission(s) ${APPLY ? "deleted" : "would be deleted (add --apply)"}`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
