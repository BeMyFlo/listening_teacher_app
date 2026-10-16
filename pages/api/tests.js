const { connectDB } = require("../../lib/db");
const { requireStudent } = require("../../lib/auth");
const { withTenant, tenantFilter } = require("../../lib/tenant");
const Student = require("../../lib/models/Student");
const Test = require("../../lib/models/Test");
const Class = require("../../lib/models/Class");
const { PROGRAMS, programOf, programFilter } = require("../../lib/curriculum");
const { levelNameFor } = require("../../lib/curriculumServer");

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
      noteText: s.noteText || "",
      noteDoc: s.noteDoc || null,
      fields: (s.fields || []).map((f) => ({
        id: f.id,
        idEnd: f.idEnd || null,
        formatLabel: f.formatLabel || "",
        label: f.label,
        imageUrl: f.imageId && f.imageId.cloudinaryUrl,
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

function toPublicTest(test, levelName) {
  // Kỹ năng ngoài testSkills của chương trình (vd TOEIC 8A: writing/speaking)
  // KHÔNG được gửi nội dung — giữ nguyên shape nhưng rỗng, để client cũ không
  // vỡ. IELTS có đủ 4 kỹ năng nên không đổi gì.
  const allowed = PROGRAMS[programOf(test)].testSkills;
  const pick = (key) => (allowed.includes(key) ? test.skills[key] : undefined);
  return {
    id: test._id,
    title: test.title,
    unit: test.unit,
    level: test.level,
    levelName: levelName || "",
    program: programOf(test),
    opensAt: test.opensAt,
    closesAt: test.closesAt,
    skills: {
      listening: toPublicQuestionSkill(pick("listening")),
      reading: toPublicQuestionSkill(pick("reading")),
      writing: toPublicPromptSkill(pick("writing")),
      speaking: toPublicPromptSkill(pick("speaking"))
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
    { path: "skills.listening.sections.fields.imageId", select: "cloudinaryUrl" },
    { path: "skills.reading.sections.fields.imageId", select: "cloudinaryUrl" },
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

  // classIds rỗng/không có = CHƯA giao cho lớp nào (không phải "giao cho tất
  // cả") — giáo viên phải tick rõ lớp thì học sinh lớp đó mới thấy bài.
  const classFilter = { classIds: cls._id };
  // Học sinh chỉ thấy đề đúng chương trình của lớp mình (doc cũ thiếu field
  // tính là IELTS — xem programFilter).
  const progFilter = programFilter(programOf(cls));

  if (id) {
    let test;
    try {
      test = await Test.findOne(tenantFilter(req.ws, { _id: id, status: "published", level, ...classFilter, ...progFilter }));
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
    return res.status(200).json({ ok: true, locked: false, test: toPublicTest(test, await levelNameFor(req.ws, programOf(test), test.level)) });
  }

  const tests = await Test.find(tenantFilter(req.ws, { status: "published", level, ...classFilter, ...progFilter })).sort({ createdAt: -1 }).lean();

  const skillMeta = (skill, key) => {
    skill = skill || {};
    const isQuestionSkill = key === "listening" || key === "reading";
    const count = isQuestionSkill
      ? (skill.sections || []).reduce((n, s) => n + (s.fields || []).length, 0)
      : (skill.prompts || []).length;
    return { present: count > 0, count };
  };

  // Mọi đề trong danh sách cùng level + cùng chương trình của lớp -> 1 tên cho cả danh sách.
  const levelName = await levelNameFor(req.ws, programOf(cls), level);
  const rows = tests.map((t) => {
    // Kỹ năng ngoài testSkills của chương trình -> báo không có nội dung.
    const allowed = PROGRAMS[programOf(t)].testSkills;
    const meta = (key) => skillMeta(allowed.includes(key) ? t.skills && t.skills[key] : undefined, key);
    return {
      id: t._id,
      title: t.title,
      unit: t.unit,
      level: t.level,
      levelName,
      program: programOf(t),
      opensAt: t.opensAt,
      closesAt: t.closesAt,
      locked: !!(t.opensAt && new Date(t.opensAt) > now),
      closed: !!(t.closesAt && new Date(t.closesAt) < now),
      skills: {
        listening: meta("listening"),
        reading: meta("reading"),
        writing: meta("writing"),
        speaking: meta("speaking")
      }
    };
  });

  return res.status(200).json({ ok: true, rows });
}

module.exports = requireStudent(withTenant(handler));

module.exports.default = module.exports;
