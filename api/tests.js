const { connectDB } = require("../lib/db");
const { requireStudent } = require("../lib/auth");
const Student = require("../lib/models/Student");
const Test = require("../lib/models/Test");

// Strips answer keys before the test is sent to a student's browser. The
// match-options bank isn't secret — only which option is correct is.
function toPublicTest(test) {
  return {
    id: test._id,
    subject: test.subject,
    title: test.title,
    unit: test.unit,
    instructions: test.instructions,
    durationMinutes: test.durationMinutes || null,
    sections: (test.sections || []).map((s) => ({
      name: s.name,
      audioUrl: s.audioId && s.audioId.cloudinaryUrl,
      passageText: s.passageText || "",
      imageUrl: s.imageId && s.imageId.cloudinaryUrl,
      matchOptions: s.matchOptions || [],
      fields: (s.fields || []).map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        pre: f.pre,
        post: f.post,
        options: f.options,
        selectCount: f.selectCount || 1,
        score: f.score || 1
      }))
    }))
  };
}

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  // Always read the real level from DB, never trust the JWT claim — the
  // teacher may change a student's level after the token was issued.
  const student = await Student.findById(req.auth.studentId);
  if (!student) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  const { id } = req.query;

  if (id) {
    let test;
    try {
      test = await Test.findOne({ _id: id, status: "published", level: student.level })
        .populate("sections.audioId", "cloudinaryUrl")
        .populate("sections.imageId", "cloudinaryUrl");
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }
    if (!test) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }
    // Outside active schedule window -> return 404
    const now = new Date();
    if ((test.opensAt && test.opensAt > now) || (test.closesAt && test.closesAt < now)) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }
    return res.status(200).json({ ok: true, test: toPublicTest(test) });
  }

  const now = new Date();
  const filter = {
    status: "published",
    level: student.level,
    // Chỉ hiện bài đang trong cửa sổ: chưa đặt mốc = luôn mở.
    $and: [
      { $or: [{ opensAt: null }, { opensAt: { $lte: now } }] },
      { $or: [{ closesAt: null }, { closesAt: { $gte: now } }] }
    ]
  };
  if (req.query.subject === "listening" || req.query.subject === "reading") {
    filter.subject = req.query.subject;
  }
  const tests = await Test.find(filter).sort({ createdAt: -1 }).lean();

  const rows = tests.map((t) => ({
    id: t._id,
    subject: t.subject,
    title: t.title,
    unit: t.unit,
    totalQuestions: (t.sections || []).reduce((n, s) => n + (s.fields || []).length, 0)
  }));

  return res.status(200).json({ ok: true, rows });
}

module.exports = requireStudent(handler);
