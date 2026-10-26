const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const Unit = require("../../../lib/models/Unit");
const Class = require("../../../lib/models/Class");
const Audio = require("../../../lib/models/Audio");
const Image = require("../../../lib/models/Image");
const { normalizeSections, validateSections, normalizePrompts, promptTaskError, promptTaskFields } = require("../../../lib/testSections");
const { sanitizeDoc } = require("../../../lib/tiptap/doc");
const { sanitizeYouTube } = require("../../../lib/lessonImport");
const { sanitizeVocabReview } = require("../../../lib/vocabReviewSource");
const { announceDeadlines } = require("../../../lib/notifications/deadlineAssign");
const { regradeUnitSubmissions } = require("../../../lib/teacher/regrade");
const { PROGRAMS, DEFAULT_PROGRAM, isProgram, programOf, programFilter, levelAllowed } = require("../../../lib/curriculum");
const { programLockReason, resolveProgramChange } = require("../../../lib/curriculumServer");

const S = (v) => String(v == null ? "" : v);

// Link lý thuyết ngoài: chỉ nhận http/https. Thiếu scheme thì thêm https://.
// Không hợp lệ -> trả "" (bỏ qua, không chặn lưu bài).
function normalizeUrl(raw) {
  let s = S(raw).trim();
  if (!s) return "";
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "";
    return u.href;
  } catch {
    return "";
  }
}

function normalizeTopicExercises(exs) {
  return (exs || []).map((ex) => ({
    _id: ex._id || undefined,
    title: S(ex.title).trim(),
    sections: normalizeSections(ex.sections),
  }));
}

// Lọc classIds hợp lệ: là ObjectId có thật, thuộc workspace, đúng level VÀ đúng
// chương trình của Unit/Test (lớp cũ thiếu field program tính là IELTS).
async function sanitizeClassIds(ws, raw, level, program) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const found = await Class.find(
    tenantFilter(ws, { _id: { $in: raw.filter(Boolean) }, level, ...programFilter(program) })
  ).select("_id").lean();
  return found.map((c) => c._id);
}

// Tập id lớp hợp lệ (workspace + level + program) cho deadlines/skillLocks.
async function validClassIdSet(ws, level, program) {
  const found = await Class.find(tenantFilter(ws, { level, ...programFilter(program) })).select("_id").lean();
  return new Set(found.map((c) => String(c._id)));
}

// Hạn nộp theo (lớp, kỹ năng). categoryKey null/rỗng = hạn chung cả Unit;
// hoặc là 1 trong CATEGORY_KEYS = hạn riêng kỹ năng. Chỉ giữ entry có classId
// hợp lệ đúng level + dueAt hợp lệ; dueAt rỗng = bỏ hạn đó. Dedup theo
// (classId, categoryKey). Trả { error } nếu date/kỹ năng sai.
async function sanitizeDeadlines(ws, raw, level, program) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const valid = await validClassIdSet(ws, level, program);
  const seen = new Set();
  const out = [];
  for (const d of raw) {
    if (!d || !valid.has(String(d.classId))) continue;
    const catKey = d.categoryKey || null;
    if (catKey && !Unit.CATEGORY_KEYS.includes(catKey)) {
      return { error: "Invalid deadline skill: " + catKey };
    }
    const dedupe = String(d.classId) + "|" + (catKey || "");
    if (seen.has(dedupe)) continue;
    if (d.dueAt == null || String(d.dueAt).trim() === "") continue;
    const dt = new Date(d.dueAt);
    if (isNaN(dt.getTime())) return { error: "Invalid deadline date/time" };
    seen.add(dedupe);
    out.push({ classId: d.classId, categoryKey: catKey, dueAt: dt });
  }
  return out;
}

// Khóa kỹ năng theo lớp: chỉ giữ entry có classId là Lớp thật đúng level và
// categoryKey hợp lệ; dedup theo (classId, categoryKey).
async function sanitizeSkillLocks(ws, raw, level, program) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const valid = await validClassIdSet(ws, level, program);
  const seen = new Set();
  const out = [];
  for (const l of raw) {
    if (!l || !valid.has(String(l.classId))) continue;
    if (!Unit.CATEGORY_KEYS.includes(l.categoryKey)) continue;
    const k = String(l.classId) + "|" + l.categoryKey;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ classId: l.classId, categoryKey: l.categoryKey });
  }
  return out;
}

const CATEGORY_KEYS = Unit.CATEGORY_KEYS;

// Validates a full client-sent categories array. Exercise sections reuse the
// Test engine validation — listening/reading exercises keep media rules,
// grammar/vocabulary exercises only need at least one question.
async function validateCategories(ws, categories, program) {
  if (!Array.isArray(categories)) return "Invalid categories format";
  for (const cat of categories) {
    if (!CATEGORY_KEYS.includes(cat.key)) return "Invalid unit category: " + cat.key;

    // audioId/imageId của theory + mỗi prompt KHÔNG đi qua validateSections
    // (hàm đó chỉ verify sections trong exercises/topics/groups) — route PUT
    // gán thẳng các trường này từ body xuống DB, nên phải verify riêng ở đây.
    // Thiếu bước này thì giáo viên workspace A gán được audioId/imageId của
    // workspace B vào bài học của mình (lỗ hổng cross-tenant thật, phát hiện
    // khi kiểm chứng bằng dữ liệu thật ở Phase 3 bước 3 — không phải chỉ đọc
    // code là thấy, vì bug nằm ở CHỖ THIẾU LỜI GỌI, không phải trong hàm nào).
    if (cat.theory && cat.theory.audioId && !(await Audio.exists(tenantFilter(ws, { _id: cat.theory.audioId })))) {
      return `${cat.key}: Selected audio track does not exist.`;
    }
    if (cat.theory && cat.theory.imageId && !(await Image.exists(tenantFilter(ws, { _id: cat.theory.imageId })))) {
      return `${cat.key}: Selected image does not exist.`;
    }
    const prompts = normalizePrompts(cat.prompts);
    for (let i = 0; i < prompts.length; i++) {
      const p = prompts[i];
      // Luật taskType (8B 2.3) chỉ áp cho Writing/Speaking; IELTS gửi taskType -> 400.
      const taskError = promptTaskError(program, cat.key, p);
      if (taskError && (cat.key === "writing" || cat.key === "speaking" || p.taskType)) {
        return `${cat.key}: Prompt ${i + 1}: ${taskError}`;
      }
      if (p.imageId && !(await Image.exists(tenantFilter(ws, { _id: p.imageId })))) {
        return `${cat.key}: Selected image does not exist for a prompt.`;
      }
      if (p.audioId && !(await Audio.exists(tenantFilter(ws, { _id: p.audioId })))) {
        return `${cat.key}: Selected audio track does not exist for a prompt.`;
      }
    }

    const exGroups = [
      ...(cat.exercises || []).map((ex) => ({ label: ex.title || "exercise", sections: ex.sections })),
      ...(cat.topics || []).flatMap((t) => (t.exercises || []).map((ex) => ({ label: `${t.name || "topic"} — ${ex.title || "exercise"}`, sections: ex.sections }))),
      ...(cat.groups || []).flatMap((g) => (g.exercises || []).map((ex) => ({ label: `${g.name || "group"} — ${ex.title || "exercise"}`, sections: ex.sections }))),
    ];
    for (const g of exGroups) {
      const error = await validateSections(ws, cat.key, normalizeSections(g.sections));
      if (error) return `${cat.key} — ${g.label}: ${error}`;
    }
  }
  return null;
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
    const rows = await Unit.find(tenantFilter(req.ws)).sort({ level: 1, order: 1 }).lean();
    // lean() không áp default của schema -> doc cũ thiếu program phải được điền IELTS.
    return res.status(200).json({ ok: true, rows: rows.map((r) => ({ ...r, program: programOf(r) })) });
  }

  // Chấm lại toàn bộ bài đã nộp của Unit theo đáp án hiện tại — giáo viên bấm
  // khi muốn chấm lại thủ công (vd sau khi tự sửa tay ngoài luồng lưu Unit).
  if (req.method === "POST" && req.query.action === "regrade") {
    const unit = await assertOwned(req.ws, Unit, id, { message: "Unit not found" });
    const regradedCount = await regradeUnitSubmissions(unit);
    return res.status(200).json({ ok: true, regradedCount });
  }

  if (req.method === "POST") {
    const { name } = req.body || {};
    const level = Number(req.body && req.body.level);
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, error: "Missing Unit name" });
    }
    // Không gửi program -> IELTS (client cũ giữ hành vi cũ); gửi giá trị lạ -> 400.
    const rawProgram = req.body.program;
    const program = rawProgram == null ? DEFAULT_PROGRAM : rawProgram;
    if (!isProgram(program)) return res.status(400).json({ ok: false, error: "Invalid program" });
    if (!levelAllowed(program, level)) {
      return res.status(400).json({
        ok: false,
        error: PROGRAMS[program].fixedLevels ? "Choose a grade from 6 to 12." : "Please select a valid level",
      });
    }
    const deadlines = await sanitizeDeadlines(req.ws, req.body.deadlines, level, program);
    if (deadlines.error) return res.status(400).json({ ok: false, error: deadlines.error });

    const unit = await Unit.create({
      workspaceId: req.ws.workspaceId,
      level,
      program,
      name: String(name).trim(),
      order: Number(req.body.order) || 0,
      status: "draft",
      classIds: await sanitizeClassIds(req.ws, req.body.classIds, level, program),
      deadlines,
      skillLocks: await sanitizeSkillLocks(req.ws, req.body.skillLocks, level, program),
      categories: Unit.seedCategories()
    });
    return res.status(201).json({ ok: true, unit });
  }

  const unit = await assertOwned(req.ws, Unit, id, { message: "Unit not found" });

  if (req.method === "GET") {
    // toJSON() giữ nguyên hình dạng như khi res.json(doc); chỉ thêm 2 field.
    const out = unit.toJSON();
    out.program = programOf(unit);
    out.programLocked = !!(await programLockReason(req.ws, "unit", unit));
    return res.status(200).json({ ok: true, unit: out });
  }

  if (req.method === "PUT") {
    const { name, order, status, categories, level, classIds, deadlines, skillLocks, program } = req.body || {};
    const levelChanged = level != null && Number(level) !== unit.level;

    // Đổi chương trình chỉ khi chưa giao lớp nào và chưa có bài nộp (C7); gửi
    // lại đúng program cũ không phải là đổi. Không có nhánh "đổi rồi gỡ".
    const programChange = await resolveProgramChange(req.ws, "unit", unit, program);
    if (programChange.error) {
      return res.status(programChange.status).json({ ok: false, error: programChange.error });
    }

    // Chụp trạng thái hạn nộp + publish TRƯỚC khi ghi đè, để sau khi lưu diff ra
    // các mốc hạn mới/đổi mà gửi thông báo (xem announceDeadlines).
    const wasPublished = unit.status === "published";
    const prevDeadlines = (unit.deadlines || []).map((d) => ({
      classId: String(d.classId),
      categoryKey: d.categoryKey || null,
      dueAtMs: d.dueAt ? +new Date(d.dueAt) : null,
    }));

    if (name != null) {
      if (!String(name).trim()) {
        return res.status(400).json({ ok: false, error: "Unit name cannot be empty" });
      }
      unit.name = String(name).trim();
    }
    if (level != null) unit.level = Number(level);
    if (programChange.changed) unit.program = program;
    // Từ đây mọi sanitize lọc lớp theo (workspace, level, program) của Unit.
    const unitProgram = programOf(unit);
    if (!levelAllowed(unitProgram, unit.level)) {
      return res.status(400).json({
        ok: false,
        error: PROGRAMS[unitProgram].fixedLevels ? "Choose a grade from 6 to 12." : "Invalid level",
      });
    }
    if (classIds != null) {
      unit.classIds = await sanitizeClassIds(req.ws, classIds, unit.level, unitProgram);
    }
    if (deadlines != null) {
      const clean = await sanitizeDeadlines(req.ws, deadlines, unit.level, unitProgram);
      if (clean.error) return res.status(400).json({ ok: false, error: clean.error });
      unit.deadlines = clean;
    } else if (levelChanged) {
      // Đổi level nhưng không gửi deadlines mới -> rụng các mốc của lớp sai level.
      const clean = await sanitizeDeadlines(req.ws, unit.deadlines, unit.level, unitProgram);
      unit.deadlines = Array.isArray(clean) ? clean : [];
    }
    if (skillLocks != null) {
      unit.skillLocks = await sanitizeSkillLocks(req.ws, skillLocks, unit.level, unitProgram);
    } else if (levelChanged) {
      unit.skillLocks = await sanitizeSkillLocks(req.ws, unit.skillLocks, unit.level, unitProgram);
    }
    if (order != null) unit.order = Number(order) || 0;
    if (status != null) {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }
      // classIds rỗng = chưa giao cho lớp nào, không phải "giao cho tất cả" —
      // publish mà không tick lớp thì không học sinh nào thấy Unit, chặn luôn.
      if (status === "published" && !(unit.classIds || []).length) {
        return res.status(400).json({ ok: false, error: "Select at least 1 class before publishing." });
      }
      unit.status = status;
    }

    if (categories != null) {
      const error = await validateCategories(req.ws, categories, unitProgram);
      if (error) return res.status(400).json({ ok: false, error });
      // Client resends the whole categories array on every save. Keeping the
      // incoming _ids preserves exercise/prompt identities that submissions
      // may already reference.
      unit.categories = categories.map((cat) => {
        const existing = unit.categories.find((c) => String(c._id) === String(cat._id));
        return {
          _id: existing ? existing._id : undefined,
          key: cat.key,
          theory: {
            html: String((cat.theory && cat.theory.html) || ""),
            doc: sanitizeDoc(cat.theory && cat.theory.doc),
            audioId: (cat.theory && cat.theory.audioId) || undefined,
            imageId: (cat.theory && cat.theory.imageId) || undefined,
            resourceUrl: normalizeUrl((cat.theory && cat.theory.resourceUrl) || ""),
            resourceLabel: String((cat.theory && cat.theory.resourceLabel) || "").trim()
          },
          exercises: normalizeTopicExercises(cat.exercises),
          // Vocab Review (reading/listening). Phải map lại ở đây vì categories dựng
          // lại từ body — thiếu dòng này thì mỗi lần Save sẽ xoá mất danh sách từ.
          // Body không có field (tab editor mở từ trước khi deploy) -> giữ bản trong DB.
          vocabReview: sanitizeVocabReview(
            cat.key,
            cat.vocabReview !== undefined ? cat.vocabReview : existing && existing.vocabReview
          ),
          prompts: (cat.prompts || []).map((p) => ({
            _id: p._id || undefined,
            title: String(p.title || "").trim(),
            instructions: String(p.instructions || ""),
            imageId: p.imageId || undefined,
            writingTask: ["task1", "task2"].includes(p.writingTask) ? p.writingTask : "task2",
            // Prompt IELTS (không taskType) -> {} : shape cũ, không đụng gì.
            ...promptTaskFields(p)
          })),
          topics: (cat.topics || []).map((t) => ({
            _id: t._id || undefined,
            extId: S(t.extId).trim(),
            name: S(t.name).trim(),
            lesson: {
              formula: S(t.lesson && t.lesson.formula),
              whenToUse: S(t.lesson && t.lesson.whenToUse),
              commonMistakes: S(t.lesson && t.lesson.commonMistakes),
              examples: S(t.lesson && t.lesson.examples),
              videoUrl: sanitizeYouTube(t.lesson && t.lesson.videoUrl),
            },
            exercises: normalizeTopicExercises(t.exercises),
          })),
          groups: (cat.groups || []).map((g) => ({
            _id: g._id || undefined,
            extId: S(g.extId).trim(),
            name: S(g.name).trim(),
            words: (g.words || []).map((w) => ({
              word: S(w.word).trim(),
              partOfSpeech: S(w.partOfSpeech).trim(),
              ipa: S(w.ipa).trim(),
              meaning: S(w.meaning).trim(),
              definitionEn: S(w.definitionEn).trim(),
              example: S(w.example).trim(),
              collocation: S(w.collocation).trim(),
              synonyms: S(w.synonyms).trim(),
            })),
            exercises: normalizeTopicExercises(g.exercises),
          })),
        };
      });
    }

    await unit.save();

    // Sửa đáp án/bài tập -> chấm lại toàn bộ bài học sinh đã nộp cho Unit này,
    // để điểm không bị "đứng hình" theo đáp án cũ. Lỗi ở bước này KHÔNG được
    // làm hỏng việc lưu Unit.
    let regradedCount = 0;
    if (categories != null) {
      try {
        regradedCount = await regradeUnitSubmissions(unit);
      } catch (err) {
        console.error("[regrade] failed:", err.message);
      }
    }

    // Hạn nộp mới/đổi -> tạo job gửi thông báo cho học sinh (chạy ngầm).
    // Lỗi ở bước này KHÔNG được làm hỏng việc lưu Unit.
    let deadlineJobIds = [];
    if (deadlines != null || levelChanged || status != null) {
      try {
        const ids = await announceDeadlines(unit, prevDeadlines, {
          requestedBy: req.auth && req.auth.teacherId,
          announceAll: unit.status === "published" && !wasPublished,
        });
        deadlineJobIds = ids.map(String);
      } catch (err) {
        console.error("[deadline-announce] failed:", err.message);
      }
    }

    return res.status(200).json({ ok: true, unit, deadlineJobIds, regradedCount });
  }

  if (req.method === "DELETE") {
    await unit.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;
