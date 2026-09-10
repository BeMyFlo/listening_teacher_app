// Phiếu hỗ trợ — phía ADMIN (IT).
//   GET /api/sysadmin/tickets                 -> danh sách (lọc reporterRole / status / kind / q)
//   GET /api/sysadmin/tickets?id=<id>         -> 1 phiếu (kèm thread) + đánh dấu admin đã đọc
//   PUT /api/sysadmin/tickets?id=<id>         -> đổi status / priority và/hoặc trả lời
const { connectDB } = require("../../../lib/db");
const { requireRole } = require("../../../lib/auth");
const Ticket = require("../../../lib/models/Ticket");
const { emit } = require("../../../lib/notifications");
const { STATUS_LABEL, cleanImages, toPublic } = require("../../../lib/tickets");

const LIMIT = 100;

async function handler(req, res) {
  await connectDB();
  const id = req.query.id ? String(req.query.id) : null;

  if (req.method === "GET") {
    if (id) {
      const t = await Ticket.findById(id);
      if (!t) return res.status(404).json({ ok: false, error: "Ticket not found" });
      if (t.adminUnread) {
        t.adminUnread = false;
        await t.save();
      }
      return res.status(200).json({ ok: true, ticket: toPublic(t, { full: true }) });
    }

    const { reporterRole, status, kind, q } = req.query;
    const filter = {};
    if (reporterRole === "student" || reporterRole === "teacher") filter.reporterRole = reporterRole;
    if (Ticket.STATUSES.includes(status)) filter.status = status;
    if (Ticket.KINDS.includes(kind)) filter.kind = kind;
    if (q) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: rx }, { reporterName: rx }, { body: rx }];
    }

    const [rows, counts] = await Promise.all([
      Ticket.find(filter).sort({ updatedAt: -1 }).limit(LIMIT).lean(),
      Ticket.aggregate([
        { $group: { _id: { role: "$reporterRole", open: { $in: ["$status", ["open", "in_progress"]] } }, n: { $sum: 1 } } },
      ]),
    ]);

    const summary = { student: { open: 0, total: 0 }, teacher: { open: 0, total: 0 }, adminUnread: 0 };
    counts.forEach((c) => {
      const bucket = summary[c._id.role];
      if (!bucket) return;
      bucket.total += c.n;
      if (c._id.open) bucket.open += c.n;
    });
    summary.adminUnread = await Ticket.countDocuments({ adminUnread: true });

    return res.status(200).json({ ok: true, rows: rows.map((r) => toPublic(r)), summary });
  }

  if (req.method === "PUT" && id) {
    const b = req.body || {};
    const t = await Ticket.findById(id);
    if (!t) return res.status(404).json({ ok: false, error: "Ticket not found" });

    const reply = String(b.reply || "").trim();
    const images = cleanImages(b.images);
    const nextStatus = Ticket.STATUSES.includes(b.status) ? b.status : null;
    const nextPriority = Ticket.PRIORITIES.includes(b.priority) ? b.priority : null;

    if (!reply && !images.length && !nextStatus && !nextPriority) {
      return res.status(400).json({ ok: false, error: "Nothing to update" });
    }

    const statusChanged = nextStatus && nextStatus !== t.status;

    if (reply || images.length) {
      t.messages.push({ authorRole: "admin", authorName: b.adminName || "Support", body: reply, images });
      t.lastReplyRole = "admin";
    }
    if (nextPriority) t.priority = nextPriority;
    if (nextStatus) {
      t.status = nextStatus;
      t.resolvedAt = nextStatus === "resolved" || nextStatus === "closed" ? new Date() : undefined;
    }
    t.adminUnread = false;
    t.reporterUnread = true;
    await t.save();

    // Báo chuông về đúng reporter (student hoặc teacher).
    const recipient = t.reporterRole === "student" ? { studentId: t.studentId } : { teacherId: t.teacherId };
    const link =
      (t.reporterRole === "student" ? "/student/tickets?id=" : "/teacher/tickets?id=") + t._id;
    let title;
    let body;
    if (statusChanged) {
      title = "Support ticket: " + STATUS_LABEL[t.status];
      body = '"' + t.title + '" is now ' + STATUS_LABEL[t.status].toLowerCase() + ".";
    } else {
      title = "New reply on your ticket";
      body = reply ? reply.slice(0, 140) : 'Support replied to "' + t.title + '".';
    }
    try {
      await emit({
        ...recipient,
        type: "ticket_update",
        dedupeKey:
          "ticket:" + t._id + ":" + Date.now() + ":" + Math.random().toString(36).slice(2, 8),
        link,
        title,
        body,
      });
    } catch (err) {
      console.error("[tickets] notify failed:", err.message);
    }

    return res.status(200).json({ ok: true, ticket: toPublic(t, { full: true }) });
  }

  res.setHeader("Allow", "GET, PUT");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireRole("admin")(handler);
module.exports.default = module.exports;
