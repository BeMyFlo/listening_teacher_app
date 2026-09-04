const mongoose = require("mongoose");
const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const { getUsage } = require("../../../lib/cloudinary");
const Student = require("../../../lib/models/Student");
const Submission = require("../../../lib/models/Submission");
const Audio = require("../../../lib/models/Audio");
const Image = require("../../../lib/models/Image");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();
  const db = mongoose.connection.db;

  const dbStats = await db.stats();
  const names = (await db.listCollections().toArray()).map((c) => c.name).filter((n) => !n.startsWith("system."));
  const collections = [];
  for (const name of names) {
    try {
      const s = await db.command({ collStats: name });
      collections.push({
        name,
        count: s.count || 0,
        size: s.size || 0,
        storageSize: s.storageSize || 0,
        totalIndexSize: s.totalIndexSize || 0,
        avgObjSize: s.avgObjSize || 0,
      });
    } catch {
      /* skip collections that can't be stat'd (e.g. views) */
    }
  }
  collections.sort((a, b) => b.size - a.size);

  // Orphan counts (chỉ xem, không xoá ở v1).
  const [studentIds, subStudentIds, audioTotal, imageTotal] = await Promise.all([
    Student.find().select("_id").lean(),
    Submission.distinct("studentId"),
    Audio.estimatedDocumentCount(),
    Image.estimatedDocumentCount(),
  ]);
  const liveStudents = new Set(studentIds.map((s) => String(s._id)));
  const orphanSubmissionStudents = subStudentIds.filter((id) => !id || !liveStudents.has(String(id))).length;
  const orphanSubmissions = orphanSubmissionStudents
    ? await Submission.countDocuments({ studentId: { $nin: studentIds.map((s) => s._id) } })
    : 0;

  const limitMb = Number(process.env.DB_SIZE_LIMIT_MB) || 512;

  return res.status(200).json({
    ok: true,
    db: {
      name: dbStats.db,
      dataSize: dbStats.dataSize,
      storageSize: dbStats.storageSize,
      indexSize: dbStats.indexSize,
      objects: dbStats.objects,
      limitBytes: limitMb * 1024 * 1024,
    },
    collections,
    cloudinary: await getUsage(),
    media: { audio: audioTotal, images: imageTotal },
    orphans: { submissions: orphanSubmissions, fromDeletedStudents: orphanSubmissionStudents },
  });
}

module.exports = requireRole("admin")(handler);

module.exports.default = module.exports;
