const { connectDB } = require("../../lib/db");
const { requireStudent } = require("../../lib/auth");
const Student = require("../../lib/models/Student");
const Test = require("../../lib/models/Test");
const Class = require("../../lib/models/Class");

function toPublicQuestionSkill(skill) {
  skill = skill || {};
  return {
    durationMinutes: skill.durationMinutes || null,
    instructions: skill.instructions || "",
    sections: (skill.sections || []).map((s) => ({
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
    }))
  };
}

// Đề bài Writing/Speaking không có gì "bí mật" cần giấu (khác câu hỏi tự
// chấm, không có đáp án đúng để lộ) — trả nguyên nội dung.
function toPublicPromptSkill(skill) {
  skill = skill || {};
  return {
    durationMinutes: skill.durationMinutes || null,
    instructions: skill.instructions || "",
    prompts: (skill.prompts || []).map((p) => ({
      id: p._id,
      title: p.title,
      instructions: p.instructions,
      imageUrl: p.imageId && p.imageId.cloudinaryUrl
    }))
  };
}

function toPublicTest(test) {
  return {
    id: test._id,
    title: test.title,
    unit: test.unit,
    opensAt: test.opensAt,
    closesAt: test.closesAt,
    skills: {
      listening: toPublicQuestionSkill(test.skills.listening),
      reading: toPublicQuestionSkill(test.skills.reading),
      writing: toPublicPromptSkill(test.skills.writing),
      speaking: toPublicPromptSkill(test.skills.speaking)
    }
  };
}

// 1 lệnh .populate(mảng) duy nhất — chain nhiều .populate().populate()...
// hoạt động trên Query nhưng VỠ trên 1 Document đã resolve (Mongoose 8:
// Document#populate() trả về Promise, không phải chính nó, nên .populate()
// thứ 2 gọi trên 1 Promise sẽ ném TypeError và crash cả process nếu không
// ai bắt được).
function populateSkillMedia(queryOrDoc) {
  return queryOrDoc.populate([
    { path: "skills.listening.sections.audioId", select: "cloudinaryUrl" },
    { path: "skills.listening.sections.imageId", select: "cloudinaryUrl" },
    { path: "skills.reading.sections.imageId", select: "cloudinaryUrl" },
    { path: "skills.writing.prompts.imageId", select: "cloudinaryUrl" },
    { path: "skills.speaking.prompts.imageId", select: "cloudinaryUrl" }
  ]);
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
  const now = new Date();

  const cls = student.classId ? await Class.findById(student.classId) : null;
  if (!cls) {
    if (id) return res.status(404).json({ ok: false, error: "Mock test not found" });
    return res.status(200).json({ ok: true, rows: [] });
  }
  const level = cls.level;

  const classFilter = {
    $or: [
      { classIds: { $exists: false } },
      { classIds: { $size: 0 } },
      { classIds: cls._id },
    ],
  };

  if (id) {
    let test;
    try {
      test = await Test.findOne({ _id: id, status: "published", level, ...classFilter });
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }
    if (!test) {
      return res.status(404).json({ ok: false, error: "Mock test not found" });
    }

    const locked = !!(test.opensAt && test.opensAt > now);
    if (locked) {
      // Chưa tới ngày mở — chỉ trả metadata để hiện thẻ "khoá", không lộ nội
      // dung câu hỏi/đề bài.
      return res.status(200).json({
        ok: true,
        locked: true,
        test: { id: test._id, title: test.title, unit: test.unit, opensAt: test.opensAt, closesAt: test.closesAt }
      });
    }

    await populateSkillMedia(test);
    return res.status(200).json({ ok: true, locked: false, test: toPublicTest(test) });
  }

  const tests = await Test.find({ status: "published", level, ...classFilter }).sort({ createdAt: -1 }).lean();

  const skillMeta = (skill, key) => {
    skill = skill || {};
    const isQuestionSkill = key === "listening" || key === "reading";
    const count = isQuestionSkill
      ? (skill.sections || []).reduce((n, s) => n + (s.fields || []).length, 0)
      : (skill.prompts || []).length;
    return { present: count > 0, count };
  };

  const rows = tests.map((t) => ({
    id: t._id,
    title: t.title,
    unit: t.unit,
    opensAt: t.opensAt,
    closesAt: t.closesAt,
    locked: !!(t.opensAt && new Date(t.opensAt) > now),
    closed: !!(t.closesAt && new Date(t.closesAt) < now),
    skills: {
      listening: skillMeta(t.skills && t.skills.listening, "listening"),
      reading: skillMeta(t.skills && t.skills.reading, "reading"),
      writing: skillMeta(t.skills && t.skills.writing, "writing"),
      speaking: skillMeta(t.skills && t.skills.speaking, "speaking")
    }
  }));

  return res.status(200).json({ ok: true, rows });
}

module.exports = requireStudent(handler);

module.exports.default = module.exports;
