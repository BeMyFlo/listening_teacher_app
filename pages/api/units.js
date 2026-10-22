const { connectDB } = require("../../lib/db");
const { requireStudent } = require("../../lib/auth");
const { withTenant, tenantFilter } = require("../../lib/tenant");
const Student = require("../../lib/models/Student");
const Unit = require("../../lib/models/Unit");
const Class = require("../../lib/models/Class");
const { resolveDeadline, isSkillLocked } = require("../../lib/deadlines");
const { PROGRAMS, programOf, programFilter } = require("../../lib/curriculum");
const { lessonSkillsOf } = require("../../lib/completion");
const { levelNameFor } = require("../../lib/curriculumServer");
const { publicTaskFields } = require("../../lib/toeicTasks");

const iso = (d) => (d ? new Date(d) : null);
const overdue = (d) => !!d && Date.now() > new Date(d).getTime();

// Mốc hạn sớm nhất còn hiệu lực cho lớp (hạn chung + hạn riêng từng kỹ năng)
// — dùng cho chip ở danh sách bài học.
function earliestDeadline(unit, classId) {
  const cands = [resolveDeadline(unit, classId, null)];
  const visible = lessonSkillsOf(unit); // kỹ năng bị ẩn (TOEIC) không có hạn thật
  (Unit.CATEGORY_KEYS || []).filter((k) => visible.includes(k)).forEach((k) => {
    if (!isSkillLocked(unit, classId, k)) cands.push(resolveDeadline(unit, classId, k));
  });
  const times = cands.filter(Boolean).map((d) => new Date(d).getTime());
  return times.length ? new Date(Math.min(...times)) : null;
}

// Strips answer keys before a unit is sent to a student's browser — same
// rule as toPublicTest in api/tests.js (kept local on purpose).
function toPublicUnit(unit, cls, levelName) {
  const publicSections = (sections) =>
    (sections || []).map((s) => ({
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
    }));

  const publicExercise = (ex) => ({
    id: ex._id,
    title: ex.title,
    totalQuestions: (ex.sections || []).reduce((n, s) => n + (s.fields || []).length, 0),
    sections: publicSections(ex.sections),
  });

  // Chỉ reading/listening mới có Vocab Review (sanitizeVocabReview đảm bảo skill
  // khác luôn enabled=false). Không gửi sourceHash/enabled — học sinh không cần.
  const reviewFor = (c) => {
    const vr = c.vocabReview;
    if (!vr || !vr.enabled || !(vr.words || []).length) return null;
    return { words: vr.words.map((w) => ({ ...(w.toObject ? w.toObject() : w) })) };
  };

  const lessonSkills = PROGRAMS[programOf(unit)].lessonSkills;
  const cid = cls && cls._id;
  const unitDue = resolveDeadline(unit, cid, null);

  return {
    id: unit._id,
    name: unit.name,
    level: unit.level,
    levelName: levelName || "",
    program: programOf(unit),
    // Hạn chung cả Unit (cho banner ở đầu trang).
    dueAt: iso(unitDue),
    isOverdue: overdue(unitDue),
    // Hạn sớm nhất bất kỳ (cho chip "Due in N days").
    nextDueAt: iso(earliestDeadline(unit, cid)),
    // Chỉ gửi category thuộc kỹ năng của chương trình (vd TOEIC 8A không có
    // writing/speaking) — lọc ở server, không chỉ ẩn ở client. IELTS: đủ 6 key
    // nên giữ nguyên toàn bộ.
    categories: (unit.categories || []).filter((c) => lessonSkills.includes(c.key)).map((c) => {
      // Kỹ năng bị khóa cho lớp này: trả về rỗng để KHÔNG lộ nội dung, chỉ
      // giữ cờ locked để client hiện tab có ổ khóa.
      if (isSkillLocked(unit, cid, c.key)) {
        return {
          key: c.key,
          locked: true,
          dueAt: null,
          isOverdue: false,
          theory: { html: "", doc: null, resourceUrl: "", resourceLabel: "" },
          exercises: [],
          prompts: [],
          topics: [],
          groups: [],
          vocabReview: null,
        };
      }
      const catDue = resolveDeadline(unit, cid, c.key);
      return {
      key: c.key,
      locked: false,
      // Hạn áp cho kỹ năng này (riêng nếu có, không thì = hạn chung Unit).
      dueAt: iso(catDue),
      isOverdue: overdue(catDue),
      theory: {
        html: (c.theory && c.theory.html) || "",
        doc: (c.theory && c.theory.doc) || null,
        audioUrl: c.theory && c.theory.audioId && c.theory.audioId.cloudinaryUrl,
        imageUrl: c.theory && c.theory.imageId && c.theory.imageId.cloudinaryUrl,
        resourceUrl: (c.theory && c.theory.resourceUrl) || "",
        resourceLabel: (c.theory && c.theory.resourceLabel) || ""
      },
      exercises: (c.exercises || []).map(publicExercise),
      // Vocab Review chỉ gửi khi giáo viên bật + có từ. Khoá "Finish all exercises
      // to unlock" tính ở client (danh sách từ không nhạy cảm như đáp án).
      vocabReview: reviewFor(c),
      prompts: (c.prompts || []).map((p) => ({
        id: p._id,
        title: p.title,
        instructions: p.instructions,
        imageUrl: p.imageId && p.imageId.cloudinaryUrl,
        ...publicTaskFields(p)
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
      };
    })
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

  // classIds rỗng/không có = CHƯA giao cho lớp nào (không phải "giao cho tất
  // cả") — giáo viên phải tick rõ lớp thì học sinh lớp đó mới thấy Unit.
  const classFilter = { classIds: cls._id };
  // Học sinh chỉ thấy nội dung đúng chương trình của lớp mình (doc cũ thiếu
  // field tính là IELTS — xem programFilter).
  const progFilter = programFilter(programOf(cls));

  if (id) {
    let unit;
    try {
      unit = await Unit.findOne(tenantFilter(req.ws, { _id: id, status: "published", level, ...classFilter, ...progFilter }))
        .populate("categories.theory.audioId", "cloudinaryUrl")
        .populate("categories.theory.imageId", "cloudinaryUrl")
        .populate("categories.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.exercises.sections.imageId", "cloudinaryUrl")
        .populate("categories.prompts.imageId", "cloudinaryUrl")
        .populate("categories.prompts.audioId", "cloudinaryUrl")
        .populate("categories.topics.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.topics.exercises.sections.imageId", "cloudinaryUrl")
        .populate("categories.groups.exercises.sections.audioId", "cloudinaryUrl")
        .populate("categories.groups.exercises.sections.imageId", "cloudinaryUrl")
        .populate("categories.exercises.sections.fields.imageId", "cloudinaryUrl")
        .populate("categories.topics.exercises.sections.fields.imageId", "cloudinaryUrl")
        .populate("categories.groups.exercises.sections.fields.imageId", "cloudinaryUrl");
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    if (!unit) {
      return res.status(404).json({ ok: false, error: "Lesson unit not found" });
    }
    return res.status(200).json({ ok: true, unit: toPublicUnit(unit, cls, await levelNameFor(req.ws, programOf(unit), unit.level)) });
  }

  const units = await Unit.find(tenantFilter(req.ws, { status: "published", level, ...classFilter, ...progFilter }))
    .sort({ level: 1, order: 1 })
    .lean();

  // Tóm tắt từng category (không lộ đáp án/nội dung câu hỏi) — đủ để trang
  // danh sách Lessons hiện badge kỹ năng + số lượng + tính % hoàn thành mà
  // không cần tải chi tiết từng Unit.
  // Mọi Unit trong danh sách cùng level + cùng chương trình của lớp -> 1 tên cho cả danh sách.
  const levelName = await levelNameFor(req.ws, programOf(cls), level);
  const rows = units.map((u) => {
    const dueAt = earliestDeadline(u, cls._id);
    const rowSkills = PROGRAMS[programOf(u)].lessonSkills;
    return {
      id: u._id,
      name: u.name,
      level: u.level,
      levelName,
      order: u.order,
      createdAt: u.createdAt,
      dueAt: iso(dueAt),
      isOverdue: overdue(dueAt),
      program: programOf(u),
      categories: (u.categories || []).filter((c) => rowSkills.includes(c.key)).map((c) => {
        if (isSkillLocked(u, cls._id, c.key)) {
          return { key: c.key, locked: true, hasContent: false, itemCount: 0 };
        }
        const topicEx = (c.topics || []).reduce((n, t) => n + (t.exercises || []).length, 0);
        const groupEx = (c.groups || []).reduce((n, g) => n + (g.exercises || []).length, 0);
        return {
          key: c.key,
          locked: false,
          hasContent: !!(
            (c.theory && c.theory.html && c.theory.html.trim()) ||
            (c.theory && c.theory.resourceUrl && c.theory.resourceUrl.trim()) ||
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

module.exports = requireStudent(withTenant(handler));

module.exports.default = module.exports;
