const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Unit = require("../../../lib/models/Unit");
const Class = require("../../../lib/models/Class");
const { normalizeSections, validateSections } = require("../../../lib/testSections");
const { sanitizeYouTube } = require("../../../lib/lessonImport");
const { announceDeadlines } = require("../../../lib/notifications/deadlineAssign");

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

// Lọc classIds hợp lệ: là ObjectId có thật và đúng level của Unit/Test.
async function sanitizeClassIds(raw, level) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const found = await Class.find({ _id: { $in: raw.filter(Boolean) }, level }).select("_id").lean();
  return found.map((c) => c._id);
}

// Hạn nộp theo (lớp, kỹ năng). categoryKey null/rỗng = hạn chung cả Unit;
// hoặc là 1 trong CATEGORY_KEYS = hạn riêng kỹ năng. Chỉ giữ entry có classId
// hợp lệ đúng level + dueAt hợp lệ; dueAt rỗng = bỏ hạn đó. Dedup theo
// (classId, categoryKey). Trả { error } nếu date/kỹ năng sai.
async function sanitizeDeadlines(raw, level) {
  if (!Array.isArray(raw) || !raw.length) return [];
  const valid = new Set(
    (await Class.find({ level }).select("_id").lean()).map((c) => String(c._id))
  );
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

const CATEGORY_KEYS = Unit.CATEGORY_KEYS;

// Validates a full client-sent categories array. Exercise sections reuse the
// Test engine validation — listening/reading exercises keep media rules,
// grammar/vocabulary exercises only need at least one question.
async function validateCategories(categories) {
  if (!Array.isArray(categories)) return "Invalid categories format";
  for (const cat of categories) {
    if (!CATEGORY_KEYS.includes(cat.key)) return "Invalid unit category: " + cat.key;
    const exGroups = [
      ...(cat.exercises || []).map((ex) => ({ label: ex.title || "exercise", sections: ex.sections })),
      ...(cat.topics || []).flatMap((t) => (t.exercises || []).map((ex) => ({ label: `${t.name || "topic"} — ${ex.title || "exercise"}`, sections: ex.sections }))),
      ...(cat.groups || []).flatMap((g) => (g.exercises || []).map((ex) => ({ label: `${g.name || "group"} — ${ex.title || "exercise"}`, sections: ex.sections }))),
    ];
    for (const g of exGroups) {
      const error = await validateSections(cat.key, normalizeSections(g.sections));
      if (error) return `${cat.key} — ${g.label}: ${error}`;
    }
  }
  return null;
}

async function handler(req, res) {
  await connectDB();
  const { id } = req.query;

  if (req.method === "GET" && !id) {
    const rows = await Unit.find().sort({ level: 1, order: 1 }).lean();
    return res.status(200).json({ ok: true, rows });
  }

  if (req.method === "POST") {
    const { name } = req.body || {};
    const level = Number(req.body && req.body.level);
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, error: "Missing Unit name" });
    }
    if (!Number.isInteger(level) || level < 1) {
      return res.status(400).json({ ok: false, error: "Please select a valid level" });
    }
    const deadlines = await sanitizeDeadlines(req.body.deadlines, level);
    if (deadlines.error) return res.status(400).json({ ok: false, error: deadlines.error });

    const unit = await Unit.create({
      level,
      name: String(name).trim(),
      order: Number(req.body.order) || 0,
      status: "draft",
      classIds: await sanitizeClassIds(req.body.classIds, level),
      deadlines,
      categories: Unit.seedCategories()
    });
    return res.status(201).json({ ok: true, unit });
  }

  let unit;
  try {
    unit = await Unit.findById(id);
  } catch (err) {
    return res.status(404).json({ ok: false, error: "Unit not found" });
  }
  if (!unit) {
    return res.status(404).json({ ok: false, error: "Unit not found" });
  }

  if (req.method === "GET") {
    return res.status(200).json({ ok: true, unit });
  }

  if (req.method === "PUT") {
    const { name, order, status, categories, level, classIds, deadlines } = req.body || {};
    const levelChanged = level != null && Number(level) !== unit.level;

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
    if (level != null) {
      const lvl = Number(level);
      if (!Number.isInteger(lvl) || lvl < 1) {
        return res.status(400).json({ ok: false, error: "Invalid level" });
      }
      unit.level = lvl;
    }
    if (classIds != null) {
      unit.classIds = await sanitizeClassIds(classIds, unit.level);
    }
    if (deadlines != null) {
      const clean = await sanitizeDeadlines(deadlines, unit.level);
      if (clean.error) return res.status(400).json({ ok: false, error: clean.error });
      unit.deadlines = clean;
    } else if (levelChanged) {
      // Đổi level nhưng không gửi deadlines mới -> rụng các mốc của lớp sai level.
      const clean = await sanitizeDeadlines(unit.deadlines, unit.level);
      unit.deadlines = Array.isArray(clean) ? clean : [];
    }
    if (order != null) unit.order = Number(order) || 0;
    if (status != null) {
      if (!["draft", "published"].includes(status)) {
        return res.status(400).json({ ok: false, error: "Invalid status" });
      }
      unit.status = status;
    }

    if (categories != null) {
      const error = await validateCategories(categories);
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
            audioId: (cat.theory && cat.theory.audioId) || undefined,
            imageId: (cat.theory && cat.theory.imageId) || undefined,
            resourceUrl: normalizeUrl((cat.theory && cat.theory.resourceUrl) || ""),
            resourceLabel: String((cat.theory && cat.theory.resourceLabel) || "").trim()
          },
          exercises: normalizeTopicExercises(cat.exercises),
          prompts: (cat.prompts || []).map((p) => ({
            _id: p._id || undefined,
            title: String(p.title || "").trim(),
            instructions: String(p.instructions || ""),
            imageId: p.imageId || undefined,
            writingTask: ["task1", "task2"].includes(p.writingTask) ? p.writingTask : "task2"
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

    return res.status(200).json({ ok: true, unit, deadlineJobIds });
  }

  if (req.method === "DELETE") {
    await unit.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
