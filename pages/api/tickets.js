// Phiếu hỗ trợ — phía người gửi (HỌC SINH hoặc GIÁO VIÊN).
//   GET  /api/tickets            -> danh sách phiếu của tôi
//   GET  /api/tickets?id=<id>    -> 1 phiếu (kèm thread) + đánh dấu đã đọc
//   POST /api/tickets            -> tạo phiếu mới
//   POST /api/tickets?id=<id>    -> trả lời vào phiếu của tôi
const { connectDB } = require("../../lib/db");
const { requireAnyRole } = require("../../lib/auth");
const Ticket = require("../../lib/models/Ticket");
const Student = require("../../lib/models/Student");
const Teacher = require("../../lib/models/Teacher");
const { cleanImages, toPublic } = require("../../lib/tickets");

const LIMIT = 100;

async function reporterFrom(auth) {
  if (auth.role === "student") {
    const s = await Student.findById(auth.studentId).select("name").lean();
    return s && { role: "student", id: s._id, name: s.name || auth.name || "" };
  }
  if (auth.role === "teacher") {
    const t = await Teacher.findById(auth.teacherId).select("name").lean();
    return t && { role: "teacher", id: t._id, name: t.name || auth.name || "" };
  }
  return null;
}

function ownerFilter(rep) {
  return rep.role === "student" ? { studentId: rep.id } : { teacherId: rep.id };
}

async function handler(req, res) {
  await connectDB();

  const rep = await reporterFrom(req.auth);
  if (!rep) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  const id = req.query.id ? String(req.query.id) : null;

  if (req.method === "GET") {
    if (id) {
      const t = await Ticket.findOne({ _id: id, ...ownerFilter(rep) });
      if (!t) return res.status(404).json({ ok: false, error: "Ticket not found" });
      if (t.reporterUnread) {
        t.reporterUnread = false;
        await t.save();
      }
      return res.status(200).json({ ok: true, ticket: toPublic(t, { full: true }) });
    }
    const rows = await Ticket.find(ownerFilter(rep)).sort({ updatedAt: -1 }).limit(LIMIT).lean();
    const unreadCount = rows.filter((r) => r.reporterUnread).length;
    return res.status(200).json({ ok: true, rows: rows.map((r) => toPublic(r)), unreadCount });
  }

  if (req.method === "POST" && id) {
    const body = String((req.body && req.body.body) || "").trim();
    const images = cleanImages(req.body && req.body.images);
    if (!body && !images.length) {
      return res.status(400).json({ ok: false, error: "Message is empty" });
    }
    const t = await Ticket.findOne({ _id: id, ...ownerFilter(rep) });
    if (!t) return res.status(404).json({ ok: false, error: "Ticket not found" });
    t.messages.push({ authorRole: rep.role, authorName: rep.name, body, images });
    t.lastReplyRole = rep.role;
    t.adminUnread = true;
    t.reporterUnread = false;
    if (t.status === "resolved" || t.status === "closed") t.status = "open"; // mở lại khi có phản hồi
    await t.save();
    return res.status(200).json({ ok: true, ticket: toPublic(t, { full: true }) });
  }

  if (req.method === "POST") {
    const b = req.body || {};
    const title = String(b.title || "").trim();
    const desc = String(b.body || "").trim();
    const kind = Ticket.KINDS.includes(b.kind) ? b.kind : "bug";
    const images = cleanImages(b.images);
    if (title.length < 3) {
      return res.status(400).json({ ok: false, error: "Please add a short title (min 3 characters)" });
    }
    if (!desc) {
      return res.status(400).json({ ok: false, error: "Please describe the problem or request" });
    }
    const t = await Ticket.create({
      reporterRole: rep.role,
      ...(rep.role === "student" ? { studentId: rep.id } : { teacherId: rep.id }),
      reporterName: rep.name,
      kind,
      title,
      body: desc,
      pageUrl: String(b.pageUrl || "").slice(0, 300),
      images,
      status: "open",
      adminUnread: true,
      lastReplyRole: rep.role,
    });
    return res.status(201).json({ ok: true, ticket: toPublic(t, { full: true }) });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAnyRole(["student", "teacher"])(handler);
module.exports.default = module.exports;
