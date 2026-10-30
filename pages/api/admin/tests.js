const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const Test = require("../../../lib/models/Test");
const Class = require("../../../lib/models/Class");
const { normalizeSections, validateSections, normalizePrompts, validatePrompts } = require("../../../lib/testSections");
const { regradeTestSubmissions } = require("../../../lib/teacher/regrade");
const { isCorrect } = require("../../../lib/grade");
const audit = require("../../../lib/audit");
const { PROGRAMS, DEFAULT_PROGRAM, isProgram, programOf, programFilter, levelAllowed } = require("../../../lib/curriculum");
const { templatesFor, incompleteQuestions } = require("../../../lib/generalTemplates");
const { programLockReason, resolveProgramChange } = require("../../../lib/curriculumServer");

// Lọc classIds hợp lệ: ObjectId có thật, thuộc workspace, đúng level VÀ đúng
// chương trình của Test (lớp cũ thiếu field program tính là IELTS).
async function sanitizeClassIds(ws, raw, level, program) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const found = await Class.find(
    tenantFilter(ws, { _id: { $in: raw.filter(Boolean) }, level, ...programFilter(program) })
  ).select("_id").lean();
  return found.map((c) => c._id);
}

const QUESTION_SKILLS = ["listening", "reading"];
const PROMPT_SKILLS = ["writing", "speaking"];
const ALL_SKILLS = [...QUESTION_SKILLS, ...PROMPT_SKILLS];
const SKILL_LABELS = { listening: "Listening", reading: "Reading", writing: "Writing", speaking: "Speaking" };

// Lịch thi chung cho cả 4 kỹ năng (khoá/mở cả bài cùng lúc, không mỗi kỹ
// năng 1 mốc riêng). Chỉ nhận field nào có mặt trong body; chuỗi rỗng = xoá
// mốc đó. `current` là test hiện tại (khi PUT) để validate cặp
// opensAt/closesAt sau khi merge.
function parseSchedule(body, current) {
  const out = {};
  const readDate = (key) => {
    if (!(key in body)) return undefined;
    const raw = body[key];
    if (raw === null || String(raw).trim() === "") return null;
    const d = new Date(raw);
    return isNaN(d.getTime()) ? { error: "Invalid date time: " + key } : d;
  };

  for (const key of ["opensAt", "closesAt"]) {
    const v = readDate(key);
    if (v && v.error) return v;
    if (v !== undefined) out[key] = v;
  }

  const effectiveOpens = "opensAt" in out ? out.opensAt : current && current.opensAt;
  const effectiveCloses = "closesAt" in out ? out.closesAt : current && current.closesAt;
  if (effectiveOpens && effectiveCloses && effectiveOpens >= effectiveCloses) {
    return { error: "Opening time must be before closing time" };
  }
  return out;
}

// Chuẩn hoá 1 khối skill từ body.skills[key] -> shape lưu DB. Listening/
// Reading dùng sections (câu hỏi tự chấm); Writing/Speaking dùng prompts
// (đề bài, chấm tay).
function normalizeSkill(key, raw) {
  raw = raw || {};
  let durationMinutes = null;
  if (raw.durationMinutes !== undefined && raw.durationMinutes !== null && String(raw.durationMinutes).trim() !== "") {
    const n = Number(raw.durationMinutes);
    if (!Number.isFinite(n) || n <= 0) {
      return { error: `${SKILL_LABELS[key]}: duration must be greater than 0` };
    }
    durationMinutes = n;
  }
  const instructions = String(raw.instructions || "");
  if (QUESTION_SKILLS.includes(key)) {
    return { skill: { durationMinutes, instructions, sections: normalizeSections(raw.sections) } };
  }
  return { skill: { durationMinutes, instructions, prompts: normalizePrompts(raw.prompts) } };
}

function buildSkillsFromBody(body) {
  const skills = {};
  for (const key of ALL_SKILLS) {
    const result = normalizeSkill(key, body.skills && body.skills[key]);
    if (result.error) return { error: result.error };
    skills[key] = result.skill;
  }
  return { skills };
}

async function validateSkill(ws, key, skill, program) {
  return QUESTION_SKILLS.includes(key)
    ? validateSections(ws, key, skill.sections)
    : validatePrompts(ws, skill.prompts, { program, skill: key });
}

async function validateAllSkills(ws, skills, program) {
  for (const key of ALL_SKILLS) {
    const error = await validateSkill(ws, key, skills[key], program);
    if (error) return `${SKILL_LABELS[key]}: ${error}`;
  }
  return null;
}

function skillHasContent(skill, key) {
  return QUESTION_SKILLS.includes(key) ? skill.sections.length > 0 : skill.prompts.length > 0;
}

// 1 lệnh .populate(mảng) duy nhất — xem giải thích trong api/tests.js
// (chain nhiều .populate() vỡ trên 1 Document đã resolve ở Mongoose 8).
function populateSkillMedia(queryOrDoc) {
  return queryOrDoc.populate([
    { path: "skills.listening.sections.audioId", select: "title unit cloudinaryUrl" },
    { path: "skills.listening.sections.imageId", select: "title unit cloudinaryUrl" },
    { path: "skills.reading.sections.imageId", select: "title unit cloudinaryUrl" },
    { path: "skills.writing.prompts.imageId", select: "title unit cloudinaryUrl" },
    { path: "skills.speaking.prompts.imageId", select: "title unit cloudinaryUrl" },
    { path: "skills.speaking.prompts.audioId", select: "title unit cloudinaryUrl" }
  ]);
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
    const rows = await populateSkillMedia(Test.find(tenantFilter(req.ws)).sort({ updatedAt: -1 })).lean();
    // lean() không áp default của schema -> doc cũ thiếu program phải được điền IELTS.
    return res.status(200).json({ ok: true, rows: rows.map((r) => ({ ...r, program: programOf(r) })) });
  }

  // Duyệt thêm đáp án đúng cho câu fill và chấm lại bài nộp của Test skill.
  if (req.method === "POST" && req.query.action === "accept-answer") {
    const test = await assertOwned(req.ws, Test, id, { message: "Mock test not found" });
    const { skill, fieldId, answer } = req.body || {};
    if (!QUESTION_SKILLS.includes(skill)) {
      return res.status(400).json({ ok: false, error: "Invalid skill" });
    }
    const skillBlock = test.skills && test.skills[skill];
    if (!skillBlock) {
      return res.status(404).json({ ok: false, error: "Skill not found" });
    }
    let targetField = null;
    for (const sec of skillBlock.sections || []) {
      const f = (sec.fields || []).find((f) => Number(f.id) === Number(fieldId));
      if (f) { targetField = f; break; }
    }
    if (!targetField) {
      return res.status(404).json({ ok: false, error: "Question not found" });
    }
    if (targetField.type !== "fill") {
      return res.status(400).json({ ok: false, error: "Only fill-in questions can accept answers" });
    }
    const trimmed = String(answer || "").trim();
    if (!trimmed || trimmed.length > 300) {
      return res.status(400).json({ ok: false, error: "Answer must be between 1 and 300 characters" });
    }
    if (isCorrect(targetField, trimmed)) {
      return res.status(400).json({ ok: false, error: "This answer is already accepted." });
    }
    targetField.answers = targetField.answers || [];
    targetField.answers.push(trimmed);
    test.markModified("skills");
    await test.save();
    const regradedCount = await regradeTestSubmissions(test, skill);
    audit.record({
      req,
      res,
      action: "tests.accept_answer",
      status: 200,
      meta: { testId: test._id, skill, fieldId: Number(fieldId), answer: trimmed, regradedCount },
    });
    return res.status(200).json({ ok: true, regradedCount });
  }

  if (req.method === "POST") {
    const { title, unit } = req.body || {};
    const level = Number(req.body && req.body.level);
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, error: "Missing test title" });
    }

    // Không gửi program -> IELTS (client cũ giữ hành vi cũ); gửi giá trị lạ -> 400.
    const rawProgram = req.body && req.body.program;
    const program = rawProgram == null ? DEFAULT_PROGRAM : rawProgram;
    if (!isProgram(program)) return res.status(400).json({ ok: false, error: "Invalid program" });
    if (!levelAllowed(program, level)) {
      return res.status(400).json({
        ok: false,
        error: PROGRAMS[program].fixedLevels ? "Choose a grade from 6 to 12." : "Please select a valid level",
      });
    }

    const rawTemplate = req.body && req.body.templateKey;
    const templateKey = typeof rawTemplate === "string" && templatesFor(program).some((t) => t.key === rawTemplate)
      ? rawTemplate
      : "";

    const built = buildSkillsFromBody(req.body || {});
    if (built.error) return res.status(400).json({ ok: false, error: built.error });
    const error = await validateAllSkills(req.ws, built.skills, program);
    if (error) return res.status(400).json({ ok: false, error });

    const schedule = parseSchedule(req.body || {}, null);
    if (schedule.error) return res.status(400).json({ ok: false, error: schedule.error });

    const test = await Test.create({
      workspaceId: req.ws.workspaceId,
      title: String(title).trim(),
      unit: String(unit || "").trim(),
      level,
      program,
      // Khuôn chỉ nhận khi thuộc chương trình; lạ -> bỏ qua. Key mới chỉ thêm khi có khuôn (IELTS/TOEIC giữ payload cũ).
      ...(templateKey ? { templateKey } : {}),
      status: "draft",
      classIds: await sanitizeClassIds(req.ws, req.body && req.body.classIds, level, program),
      opensAt: schedule.opensAt || null,
      closesAt: schedule.closesAt || null,
      skills: built.skills
    });

    return res.status(201).json({ ok: true, test });
  }

  // GET-with-id / PUT / DELETE all operate on a single test.
  const test = await assertOwned(req.ws, Test, id, { message: "Mock test not found" });

  if (req.method === "GET") {
    await populateSkillMedia(test);
    // toJSON() giữ nguyên hình dạng như khi res.json(doc); chỉ thêm 2 field.
    const out = test.toJSON();
    out.program = programOf(test);
    out.programLocked = !!(await programLockReason(req.ws, "test", test));
    return res.status(200).json({ ok: true, test: out });
  }

  if (req.method === "PUT") {
    const { title, unit, status, level, program } = req.body || {};

    // Đổi chương trình chỉ khi chưa giao lớp nào và chưa có bài nộp (C7); gửi
    // lại đúng program cũ không phải là đổi. Không có nhánh "đổi rồi gỡ".
    const programChange = await resolveProgramChange(req.ws, "test", test, program);
    if (programChange.error) {
      return res.status(programChange.status).json({ ok: false, error: programChange.error });
    }

    if (title != null) {
      if (!String(title).trim()) {
        return res.status(400).json({ ok: false, error: "Test title cannot be empty" });
      }
      test.title = String(title).trim();
    }
    if (unit != null) test.unit = String(unit).trim();
    if (level != null) test.level = Number(level);
    if (programChange.changed) test.program = program;
    const testProgram = programOf(test);
    if (!levelAllowed(testProgram, test.level)) {
      return res.status(400).json({
        ok: false,
        error: PROGRAMS[testProgram].fixedLevels ? "Choose a grade from 6 to 12." : "Invalid level",
      });
    }
    if (req.body && req.body.classIds != null) {
      test.classIds = await sanitizeClassIds(req.ws, req.body.classIds, test.level, testProgram);
    }

    if (req.body && req.body.skills != null) {
      const built = buildSkillsFromBody(req.body);
      if (built.error) return res.status(400).json({ ok: false, error: built.error });
      const error = await validateAllSkills(req.ws, built.skills, testProgram);
      if (error) return res.status(400).json({ ok: false, error });
      test.skills = built.skills;
    }

    if (status != null) {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }
      if (status === "published") {
        const filled = ALL_SKILLS.filter((key) => skillHasContent(test.skills[key], key));
        if (!filled.length) {
          return res.status(400).json({
            ok: false,
            error: "Requires content in at least 1 skill before publishing."
          });
        }
        // Chương trình có publishCheck (General): không xuất bản đề còn câu dở. test.skills đã là
        // skills hiệu lực (body.skills nếu có đã gán ở trên).
        if (PROGRAMS[testProgram].publishCheck) {
          const unfinished = incompleteQuestions(test.skills);
          if (unfinished.length) {
            return res.status(400).json({
              ok: false,
              error: `Question ${unfinished[0].fieldId} is not finished: ${unfinished[0].reason}`
            });
          }
        }
        // classIds rỗng = chưa giao cho lớp nào, không phải "giao cho tất cả" —
        // publish mà không tick lớp thì không học sinh nào thấy bài, chặn luôn.
        if (!(test.classIds || []).length) {
          return res.status(400).json({
            ok: false,
            error: "Select at least 1 class before publishing."
          });
        }
      }
      test.status = status;
    }

    const schedule = parseSchedule(req.body || {}, test);
    if (schedule.error) return res.status(400).json({ ok: false, error: schedule.error });
    for (const key of ["opensAt", "closesAt"]) {
      if (key in schedule) test[key] = schedule[key];
    }

    await test.save();
    return res.status(200).json({ ok: true, test });
  }

  if (req.method === "DELETE") {
    await test.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;
