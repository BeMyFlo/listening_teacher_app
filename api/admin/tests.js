const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Test = require("../../lib/models/Test");
const { normalizeSections, validateSections, normalizePrompts, validatePrompts } = require("../../lib/testSections");

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

async function validateSkill(key, skill) {
  return QUESTION_SKILLS.includes(key) ? validateSections(key, skill.sections) : validatePrompts(skill.prompts);
}

async function validateAllSkills(skills) {
  for (const key of ALL_SKILLS) {
    const error = await validateSkill(key, skills[key]);
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
    { path: "skills.speaking.prompts.imageId", select: "title unit cloudinaryUrl" }
  ]);
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
    const rows = await populateSkillMedia(Test.find().sort({ updatedAt: -1 })).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    const { title, unit } = req.body || {};
    const level = Number(req.body && req.body.level);
    if (!title || !String(title).trim()) {
      return res.status(400).json({ ok: false, error: "Missing test title" });
    }
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }

    const built = buildSkillsFromBody(req.body || {});
    if (built.error) return res.status(400).json({ ok: false, error: built.error });
    const error = await validateAllSkills(built.skills);
    if (error) return res.status(400).json({ ok: false, error });

    const schedule = parseSchedule(req.body || {}, null);
    if (schedule.error) return res.status(400).json({ ok: false, error: schedule.error });

    const test = await Test.create({
      title: String(title).trim(),
      unit: String(unit || "").trim(),
      level,
      status: "draft",
      opensAt: schedule.opensAt || null,
      closesAt: schedule.closesAt || null,
      skills: built.skills
    });

    return res.status(201).json({ ok: true, test });
  }

  // GET-with-id / PUT / DELETE all operate on a single test.
  let test;
  try {
    test = await Test.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Mock test not found" });
  }
  if (!test) {
    return res.status(404).json({ ok: false, error: "Mock test not found" });
  }

  if (req.method === "GET") {
    await populateSkillMedia(test);
    return res.status(200).json({ ok: true, test });
  }

  if (req.method === "PUT") {
    const { title, unit, status, level } = req.body || {};

    if (title != null) {
      if (!String(title).trim()) {
        return res.status(400).json({ ok: false, error: "Test title cannot be empty" });
      }
      test.title = String(title).trim();
    }
    if (unit != null) test.unit = String(unit).trim();
    if (level != null) {
      const lvl = Number(level);
      if (!Number.isInteger(lvl) || lvl < 1) {
        return res.status(400).json({ ok: false, error: "Invalid level" });
      }
      test.level = lvl;
    }

    if (req.body && req.body.skills != null) {
      const built = buildSkillsFromBody(req.body);
      if (built.error) return res.status(400).json({ ok: false, error: built.error });
      const error = await validateAllSkills(built.skills);
      if (error) return res.status(400).json({ ok: false, error });
      test.skills = built.skills;
    }

    if (status != null) {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }
      if (status === "published") {
        const missing = ALL_SKILLS.filter((key) => !skillHasContent(test.skills[key], key));
        if (missing.length) {
          return res.status(400).json({
            ok: false,
            error: `Requires content in all 4 skills before publishing — missing: ${missing.map((k) => SKILL_LABELS[k]).join(", ")}.`
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

module.exports = requireAuth(handler);
