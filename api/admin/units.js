const { connectDB } = require("../../lib/db");
const { requireAuth } = require("../../lib/auth");
const Unit = require("../../lib/models/Unit");
const { normalizeSections, validateSections } = require("../../lib/testSections");

const CATEGORY_KEYS = Unit.CATEGORY_KEYS;

// Validates a full client-sent categories array. Exercise sections reuse the
// Test engine validation — listening/reading exercises keep media rules,
// grammar/vocabulary exercises only need at least one question.
async function validateCategories(categories) {
  if (!Array.isArray(categories)) return "Invalid categories format";
  for (const cat of categories) {
    if (!CATEGORY_KEYS.includes(cat.key)) return "Invalid unit category: " + cat.key;
    for (const ex of cat.exercises || []) {
      const normalized = normalizeSections(ex.sections);
      const error = await validateSections(cat.key, normalized);
      if (error) return `${cat.key} — ${ex.title || "exercise"}: ${error}`;
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
    const unit = await Unit.create({
      level,
      name: String(name).trim(),
      order: Number(req.body.order) || 0,
      status: "draft",
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
    const { name, order, status, categories } = req.body || {};

    if (name != null) {
      if (!String(name).trim()) {
        return res.status(400).json({ ok: false, error: "Unit name cannot be empty" });
      }
      unit.name = String(name).trim();
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
            imageId: (cat.theory && cat.theory.imageId) || undefined
          },
          exercises: (cat.exercises || []).map((ex) => ({
            _id: ex._id || undefined,
            title: String(ex.title || "").trim(),
            sections: normalizeSections(ex.sections)
          })),
          prompts: (cat.prompts || []).map((p) => ({
            _id: p._id || undefined,
            title: String(p.title || "").trim(),
            instructions: String(p.instructions || ""),
            imageId: p.imageId || undefined
          }))
        };
      });
    }

    await unit.save();
    return res.status(200).json({ ok: true, unit });
  }

  if (req.method === "DELETE") {
    await unit.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);
