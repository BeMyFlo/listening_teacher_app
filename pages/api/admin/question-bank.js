// Ngân hàng câu hỏi của workspace (Phase 12 G4, 2.2). Chỉ chương trình có `questionBank` (General).
//   GET  ?program=&level=[&format&difficulty&topic&q&page&limit]  danh sách phân trang
//   GET  ?action=counts&program=&level=                         đếm theo (dạng, mức độ) cho ma trận
//   GET  ?id=                                                    1 mục
//   POST { program, items: [...] }                               tạo (trần 100/lần)
//   POST ?action=pick { program, level, rows, excludeIds }       bốc ngẫu nhiên theo ma trận
//   PUT  { id, ...nhãn/nội dung }    PUT { ids, set: { topic, difficulty, unitLabel, textbook } } sửa nhãn nhiều mục
//   DELETE ?id= | { ids }
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter, assertOwned } = require("../../../lib/tenant");
const QuestionItem = require("../../../lib/models/QuestionItem");
const { PROGRAMS, isProgram, levelAllowed } = require("../../../lib/curriculum");
const { isDifficulty } = require("../../../lib/generalTopics");
const {
  MAX_ITEMS_PER_REQUEST,
  MAX_CANDIDATES_PER_ROW,
  isFormatKey,
  buildItem,
  validateItem,
  parsePickRows,
  pickItems,
  escapeRegex,
} = require("../../../lib/questionBank");

const MAX_PAGE_LIMIT = 50;
const MAX_DELETE_IDS = 100;
const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

const bad = (res, error, status = 400) => res.status(status).json({ ok: false, error });

// Chương trình phải có ngân hàng câu hỏi (đọc registry). -> null nếu hợp lệ, hoặc câu lỗi.
function programError(program) {
  if (!isProgram(program)) return "Invalid program";
  if (!PROGRAMS[program].questionBank) return "This program does not have a question bank.";
  return null;
}

function levelFrom(program, v) {
  const level = Number(v);
  return Number.isInteger(level) && levelAllowed(program, level) ? level : null;
}

// Danh sách (phân trang) + tìm chữ an toàn.
async function listItems(req, res, ws) {
  const q = req.query || {};
  const program = String(q.program || "");
  const perr = programError(program);
  if (perr) return bad(res, perr);

  const filter = { program };
  if (q.level != null && q.level !== "") {
    const level = levelFrom(program, q.level);
    if (level == null) return bad(res, "Invalid grade.");
    filter.level = level;
  }
  if (q.format) {
    if (!isFormatKey(String(q.format))) return bad(res, "Invalid question type.");
    filter.format = String(q.format);
  }
  if (q.difficulty) {
    if (!isDifficulty(String(q.difficulty))) return bad(res, "Invalid difficulty.");
    filter.difficulty = String(q.difficulty);
  }
  if (q.topic) filter.topic = String(q.topic).slice(0, 80);
  const text = String(q.q || "").trim().slice(0, 100);
  if (text) {
    const re = new RegExp(escapeRegex(text), "i");
    filter.$or = [{ passageText: re }, { "fields.label": re }, { unitLabel: re }, { textbook: re }];
  }

  const limit = Math.min(MAX_PAGE_LIMIT, Math.max(1, parseInt(q.limit, 10) || 20));
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const where = tenantFilter(ws, filter);
  const [items, total] = await Promise.all([
    QuestionItem.find(where).sort({ _id: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    QuestionItem.countDocuments(where),
  ]);
  return res.status(200).json({ ok: true, items, total, page, limit });
}

// Đếm theo ô (dạng × mức độ) cho 1 khối.
async function countItems(req, res, ws) {
  const q = req.query || {};
  const program = String(q.program || "");
  const perr = programError(program);
  if (perr) return bad(res, perr);
  const level = levelFrom(program, q.level);
  if (level == null) return bad(res, "Choose a valid grade.");
  const match = { program, level };
  if (q.topic) match.topic = String(q.topic).slice(0, 80);
  const rows = await QuestionItem.aggregate([
    { $match: tenantFilter(ws, match) },
    { $group: { _id: { format: "$format", difficulty: "$difficulty" }, items: { $sum: 1 }, questions: { $sum: "$questionCount" } } },
  ]);
  return res.status(200).json({
    ok: true,
    counts: rows.map((r) => ({ format: r._id.format, difficulty: r._id.difficulty || "", items: r.items, questions: r.questions })),
  });
}

async function createItems(req, res, ws) {
  const body = req.body || {};
  const program = String(body.program || "");
  const perr = programError(program);
  if (perr) return bad(res, perr);
  const raws = Array.isArray(body.items) ? body.items : body.item ? [body.item] : [];
  if (!raws.length) return bad(res, "Send at least one item.");
  if (raws.length > MAX_ITEMS_PER_REQUEST) return bad(res, `At most ${MAX_ITEMS_PER_REQUEST} items per request.`);

  const docs = [];
  for (let i = 0; i < raws.length; i++) {
    const built = buildItem(raws[i], program);
    const error = built.error || (await validateItem(ws, built.item));
    if (error) return bad(res, `Item ${i + 1}: ${error}`);
    docs.push({
      ...built.item,
      workspaceId: ws.workspaceId,
      createdBy: String(req.auth.userId || req.auth.teacherId || ""),
    });
  }
  const created = await QuestionItem.create(docs);
  return res.status(201).json({ ok: true, created: created.length, ids: created.map((d) => String(d._id)) });
}

// Sửa nhãn nhiều mục cùng lúc: chỉ 4 nhãn, không đụng nội dung. Luôn lọc theo workspace (id lạ bị bỏ qua).
async function updateLabels(req, res, ws) {
  const body = req.body || {};
  const ids = body.ids.map(String).filter((x) => OBJECT_ID_RE.test(x)).slice(0, MAX_DELETE_IDS);
  if (!ids.length) return bad(res, "Send at least one id.");
  const src = body.set && typeof body.set === "object" ? body.set : {};
  const set = {};
  if ("difficulty" in src) {
    const d = src.difficulty == null ? "" : String(src.difficulty);
    if (d && !isDifficulty(d)) return bad(res, "Invalid difficulty.");
    set.difficulty = d;
  }
  if ("topic" in src) set.topic = String(src.topic == null ? "" : src.topic).trim().slice(0, 80);
  if ("unitLabel" in src) set.unitLabel = String(src.unitLabel == null ? "" : src.unitLabel).trim().slice(0, 120);
  if ("textbook" in src) set.textbook = String(src.textbook == null ? "" : src.textbook).trim().slice(0, 120);
  if (!Object.keys(set).length) return bad(res, "Choose at least one label to set.");
  const r = await QuestionItem.updateMany(tenantFilter(ws, { _id: { $in: ids } }), { $set: set });
  return res.status(200).json({ ok: true, updated: (r && (r.matchedCount != null ? r.matchedCount : r.nModified)) || 0 });
}

async function updateItem(req, res, ws) {
  const body = req.body || {};
  if (Array.isArray(body.ids)) return updateLabels(req, res, ws);
  const old = await assertOwned(ws, QuestionItem, body.id, { lean: true, message: "Question not found" });
  const perr = programError(old.program);
  if (perr) return bad(res, perr);

  // Gộp nhãn/nội dung mới lên mục cũ rồi chuẩn hoá lại; chỉ kiểm nội dung khi nội dung đổi.
  const keys = ["level", "textbook", "unitLabel", "topic", "difficulty", "format", "kind", "passageText", "imageId", "fields"];
  const raw = { sourceRef: old.sourceRef };
  for (const k of keys) raw[k] = k in body ? body[k] : old[k];
  const built = buildItem(raw, old.program);
  if (built.error) return bad(res, built.error);
  if (["kind", "passageText", "imageId", "fields"].some((k) => k in body)) {
    const error = await validateItem(ws, built.item);
    if (error) return bad(res, error);
  }
  const { program: _p, sourceRef: _s, ...set } = built.item;
  const update = { $set: set };
  if (!set.imageId) {
    delete set.imageId; // bỏ ảnh nhóm -> $unset (undefined trong $set bị Mongoose bỏ qua)
    update.$unset = { imageId: 1 };
  }
  const updated = await QuestionItem.findOneAndUpdate(tenantFilter(ws, { _id: old._id }), update, { new: true }).lean();
  if (!updated) return bad(res, "Question not found", 404);
  return res.status(200).json({ ok: true, item: updated });
}

async function deleteItems(req, res, ws) {
  const src = { ...(req.query || {}), ...(req.body || {}) };
  if (Array.isArray(src.ids)) {
    const ids = src.ids.map(String).filter((x) => OBJECT_ID_RE.test(x)).slice(0, MAX_DELETE_IDS);
    if (!ids.length) return bad(res, "Send at least one id.");
    const r = await QuestionItem.deleteMany(tenantFilter(ws, { _id: { $in: ids } }));
    return res.status(200).json({ ok: true, deleted: (r && r.deletedCount) || 0 });
  }
  const doc = await assertOwned(ws, QuestionItem, src.id, { lean: true, message: "Question not found" });
  await QuestionItem.deleteOne(tenantFilter(ws, { _id: doc._id }));
  return res.status(200).json({ ok: true, deleted: 1 });
}

// Bốc ngẫu nhiên theo ma trận (D4/D5). Không ghi gì vào DB.
async function pickFromBank(req, res, ws) {
  const body = req.body || {};
  const program = String(body.program || "");
  const perr = programError(program);
  if (perr) return bad(res, perr);
  const level = levelFrom(program, body.level);
  if (level == null) return bad(res, "Choose a valid grade.");
  const parsed = parsePickRows(body.rows);
  if (parsed.error) return bad(res, parsed.error);

  const excludeIds = (Array.isArray(body.excludeIds) ? body.excludeIds : [])
    .map(String)
    .filter((x) => OBJECT_ID_RE.test(x))
    .slice(0, 1000);

  const used = new Set(excludeIds);
  const rows = [];
  const chosenAll = [];
  for (const r of parsed.rows) {
    const filter = { program, level, format: r.format };
    if (r.difficulty) filter.difficulty = r.difficulty;
    if (r.topic) filter.topic = r.topic;
    if (excludeIds.length) filter._id = { $nin: excludeIds };
    const candidates = await QuestionItem.find(tenantFilter(ws, filter))
      .select("_id questionCount")
      .limit(MAX_CANDIDATES_PER_ROW)
      .lean();
    const res1 = pickItems(candidates, r.count, used);
    chosenAll.push(...res1.chosen);
    rows.push({
      format: r.format,
      difficulty: r.difficulty,
      topic: r.topic,
      requested: r.count,
      picked: res1.picked,
      shortage: res1.shortage,
      itemIds: res1.chosen.map(String),
    });
  }

  let items = [];
  if (chosenAll.length) {
    const docs = await QuestionItem.find(tenantFilter(ws, { _id: { $in: chosenAll } })).lean();
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    items = chosenAll.map((id) => byId.get(String(id))).filter(Boolean);
  }
  return res.status(200).json({
    ok: true,
    rows,
    items,
    shortage: rows.reduce((n, r) => n + r.shortage, 0),
  });
}

async function handler(req, res) {
  await connectDB();
  const ws = req.ws;
  const q = req.query || {};

  if (req.method === "GET") {
    if (q.action === "counts") return countItems(req, res, ws);
    if (q.id) {
      const doc = await assertOwned(ws, QuestionItem, q.id, { lean: true, message: "Question not found" });
      return res.status(200).json({ ok: true, item: doc });
    }
    return listItems(req, res, ws);
  }
  if (req.method === "POST") {
    if (q.action === "pick") return pickFromBank(req, res, ws);
    return createItems(req, res, ws);
  }
  if (req.method === "PUT") return updateItem(req, res, ws);
  if (req.method === "DELETE") return deleteItems(req, res, ws);

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return bad(res, "Method not allowed", 405);
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;
