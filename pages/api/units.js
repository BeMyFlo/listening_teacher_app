const { connectDB } = require("../../lib/db");
const { requireStudent } = require("../../lib/auth");
const Student = require("../../lib/models/Student");
const Unit = require("../../lib/models/Unit");
const Class = require("../../lib/models/Class");

// Strips answer keys before a unit is sent to a student's browser — same
// rule as toPublicTest in api/tests.js (kept local on purpose).
// Hạn nộp của Unit cho 1 lớp (Unit.deadlines). null nếu lớp không có hạn.
function deadlineForClass(unit, classId) {
  const dl = (unit.deadlines || []).find((d) => String(d.classId) === String(classId));
  return dl && dl.dueAt ? dl.dueAt : null;
}

function toPublicUnit(unit, cls) {
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

  const publicExercise = (ex) => ({
    id: ex._id,
    title: ex.title,
    totalQuestions: (ex.sections || []).reduce((n, s) => n + (s.fields || []).length, 0),
    sections: publicSections(ex.sections),
  });

  const dueAt = deadlineForClass(unit, cls && cls._id);

  return {
    id: unit._id,
    name: unit.name,
    level: unit.level,
    dueAt,
    isOverdue: !!dueAt && Date.now() > new Date(dueAt).getTime(),
    categories: (unit.categories || []).map((c) => ({
      key: c.key,
      theory: {
        html: (c.theory && c.theory.html) || "",
        audioUrl: c.theory && c.theory.audioId && c.theory.audioId.cloudinaryUrl,
        imageUrl: c.theory && c.theory.imageId && c.theory.imageId.cloudinaryUrl
      },
      exercises: (c.exercises || []).map(publicExercise),
      prompts: (c.prompts || []).map((p) => ({
        id: p._id,
        title: p.title,
        instructions: p.instructions,
        imageUrl: p.imageId && p.imageId.cloudinaryUrl
      })),
      // Grammar: chủ điểm (lý thuyết + bài tập). Vocab: nhóm từ (flashcard).
      topics: (c.topics || []).map((t) => ({
        id: t._id,
        name: t.name,
        lesson: {
          formula: (t.lesson && t.lesson.formula) || "",
          whenToUse: (t.lesson && t.lesson.whenToUse) || "",
          commonMistakes: (t.lesson && t.lesson.commonMistakes) || "",
          examples: (t.lesson && t.lesson.examples) || "",
          videoUrl: (t.lesson && t.lesson.videoUrl) || "",
        },
        exercises: (t.exercises || []).map(publicExercise),
      })),
      groups: (c.groups || []).map((g) => ({
        id: g._id,
        name: g.name,
        words: (g.words || []).map((w) => ({ ...(w.toObject ? w.toObject() : w) })),
        exercises: (g.exercises || []).map(publicExercise),
      })),
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

  // Level của học sinh = level của Lớp. Chưa xếp lớp -> chưa có nội dung.
  const cls = student.classId ? await Class.findById(student.classId) : null;
  if (!cls) {
    if (id) return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    return res.status(200).json({ ok: true, rows: [] });
  }
  const level = cls.level;

  // Unit "chưa gán lớp" (thiếu field / rỗng) = mọi HS đúng level đều thấy;
  // ngoài ra HS thấy Unit gán cho đúng lớp mình.
  const classFilter = {
    $or: [
      { classIds: { $exists: false } },
      { classIds: { $size: 0 } },
      { classIds: cls._id },
    ],
  };

  if (id) {
    let unit;
    try {
      unit = await Unit.findOne({ _id: id, status: "published", level, ...classFilter })
        .populate("categories.theory.audioId", "cloudinaryUrl")
        .populate("categories.theory.imageId", "cloudinaryUrl")
        .populate("categories.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.exercises.sections.imageId", "cloudinaryUrl")
        .populate("categories.prompts.imageId", "cloudinaryUrl")
        .populate("categories.topics.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.topics.exercises.sections.imageId", "cloudinaryUrl")
        .populate("categories.groups.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.groups.exercises.sections.imageId", "cloudinaryUrl");
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    return res.status(200).json({ ok: true, unit: toPublicUnit(unit, cls) });
  }

  const units = await Unit.find({ status: "published", level, ...classFilter })
    .sort({ level: 1, order: 1 })
    .lean();

  // Tóm tắt từng category (không lộ đáp án/nội dung câu hỏi) — đủ để trang
  // danh sách Lessons hiện badge kỹ năng + số lượng + tính % hoàn thành mà
  // không cần tải chi tiết từng Unit.
  const rows = units.map((u) => {
    const dueAt = deadlineForClass(u, cls._id);
    return {
      id: u._id,
      name: u.name,
      order: u.order,
      createdAt: u.createdAt,
      dueAt,
      isOverdue: !!dueAt && Date.now() > new Date(dueAt).getTime(),
      categories: (u.categories || []).map((c) => {
        const topicEx = (c.topics || []).reduce((n, t) => n + (t.exercises || []).length, 0);
        const groupEx = (c.groups || []).reduce((n, g) => n + (g.exercises || []).length, 0);
        return {
          key: c.key,
          hasContent: !!(
            (c.theory && c.theory.html && c.theory.html.trim()) ||
            (c.exercises || []).length ||
            (c.prompts || []).length ||
            (c.topics || []).length ||
            (c.groups || []).length
          ),
          itemCount: (c.exercises || []).length + (c.prompts || []).length + topicEx + groupEx,
        };
      }),
    };
  });
  return res.status(200).json({ ok: true, rows });
}

module.exports = requireStudent(handler);

module.exports.default = module.exports;
