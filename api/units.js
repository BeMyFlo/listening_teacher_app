const { connectDB } = require("../lib/db");
const { requireStudent } = require("../lib/auth");
const Student = require("../lib/models/Student");
const Unit = require("../lib/models/Unit");

// Strips answer keys before a unit is sent to a student's browser — same
// rule as toPublicTest in api/tests.js (kept local on purpose).
function toPublicUnit(unit) {
  const publicSections = (sections) =>
    (sections || []).map((s) => ({
      name: s.name,
      audioUrl: s.audioId && s.audioId.cloudinaryUrl,
      passageText: s.passageText || "",
      imageUrl: s.imageId && s.imageId.cloudinaryUrl,
      matchOptions: s.matchOptions || [],
      labelPoints: s.labelPoints || [],
      fields: (s.fields || []).map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        pre: f.pre,
        post: f.post,
        hint: f.hint || "",
        options: f.options,
        selectCount: f.selectCount || 1,
        score: f.score || 1
      }))
    }));

  return {
    id: unit._id,
    name: unit.name,
    level: unit.level,
    categories: (unit.categories || []).map((c) => ({
      key: c.key,
      theory: {
        html: (c.theory && c.theory.html) || "",
        audioUrl: c.theory && c.theory.audioId && c.theory.audioId.cloudinaryUrl,
        imageUrl: c.theory && c.theory.imageId && c.theory.imageId.cloudinaryUrl
      },
      exercises: (c.exercises || []).map((ex) => ({
        id: ex._id,
        title: ex.title,
        totalQuestions: (ex.sections || []).reduce((n, s) => n + (s.fields || []).length, 0),
        sections: publicSections(ex.sections)
      })),
      prompts: (c.prompts || []).map((p) => ({
        id: p._id,
        title: p.title,
        instructions: p.instructions,
        imageUrl: p.imageId && p.imageId.cloudinaryUrl
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

  // Real level always comes from DB, never from the JWT claim.
  const student = await Student.findById(req.auth.studentId);
  if (!student) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  const { id } = req.query;

  if (id) {
    let unit;
    try {
      unit = await Unit.findOne({ _id: id, status: "published", level: student.level })
        .populate("categories.theory.audioId", "cloudinaryUrl")
        .populate("categories.theory.imageId", "cloudinaryUrl")
        .populate("categories.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.exercises.sections.imageId", "cloudinaryUrl")
        .populate("categories.prompts.imageId", "cloudinaryUrl");
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    return res.status(200).json({ ok: true, unit: toPublicUnit(unit) });
  }

  const units = await Unit.find({ status: "published", level: student.level })
    .sort({ level: 1, order: 1 })
    .lean();

  const rows = units.map((u) => ({ id: u._id, name: u.name, order: u.order }));
  return res.status(200).json({ ok: true, rows });
}

module.exports = requireStudent(handler);
