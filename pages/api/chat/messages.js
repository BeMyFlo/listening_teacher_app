const { connectDB } = require("../../../lib/db");
const { requireMember } = require("../../../lib/auth");
const Message = require("../../../lib/models/Message");
const Conversation = require("../../../lib/models/Conversation");
const { userFromAuth, canAccessClassChat } = require("../../../lib/chat/membership");
const { emitToClass, publicMessage } = require("../../../lib/chat/emit");

const PAGE = 30;
const MAX_TEXT = 4000;
const MAX_ATT = 10;

function cloudHost() {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME || "";
  return `res.cloudinary.com/${cloud}/`;
}

function cleanAttachments(raw) {
  if (!Array.isArray(raw)) return [];
  const host = cloudHost();
  const out = [];
  for (const a of raw.slice(0, MAX_ATT)) {
    const url = String(a && a.url || "");
    const type = a && a.type;
    if (!["image", "video"].includes(type)) continue;
    if (!url.startsWith("https://") || !url.includes(host)) continue; // chỉ nhận file trên Cloudinary của mình
    out.push({
      type,
      url,
      publicId: String(a.publicId || ""),
      width: Number(a.width) || undefined,
      height: Number(a.height) || undefined,
      bytes: Number(a.bytes) || undefined,
    });
  }
  return out;
}

async function handler(req, res) {
  await connectDB();
  const user = userFromAuth(req.auth);

  // ---- Lịch sử ----
  if (req.method === "GET") {
    const { classId, before } = req.query;
    if (!classId || !(await canAccessClassChat(user, classId))) {
      return res.status(403).json({ ok: false, error: "You are not in this class chat" });
    }
    const filter = { classId };
    if (before) {
      try {
        const b = await Message.findById(before).select("createdAt").lean();
        if (b) filter.createdAt = { $lt: b.createdAt };
      } catch {}
    }
    const rows = await Message.find(filter).sort({ createdAt: -1 }).limit(PAGE).lean();
    return res.status(200).json({
      ok: true,
      rows: rows.reverse().map(publicMessage),
      hasMore: rows.length === PAGE,
    });
  }

  // ---- Gửi tin ----
  if (req.method === "POST") {
    const { classId, text, attachments } = req.body || {};
    if (!classId || !(await canAccessClassChat(user, classId))) {
      return res.status(403).json({ ok: false, error: "You are not in this class chat" });
    }
    const body = String(text || "").trim().slice(0, MAX_TEXT);
    const atts = cleanAttachments(attachments);
    if (!body && !atts.length) {
      return res.status(400).json({ ok: false, error: "Message is empty" });
    }

    const msg = await Message.create({
      classId,
      senderId: user.id,
      senderRole: user.role,
      senderName: user.name || (user.role === "teacher" ? "Teacher" : "Student"),
      text: body,
      attachments: atts,
    });
    const preview = body || (atts[0] ? (atts[0].type === "video" ? "📹 Video" : "🖼️ Photo") : "");
    await Conversation.findOneAndUpdate(
      { classId },
      { $set: { lastMessageAt: msg.createdAt, lastMessagePreview: preview.slice(0, 120) } },
      { upsert: true }
    );

    const pub = publicMessage(msg.toObject());
    emitToClass(classId, "message", pub); // fire-and-forget
    return res.status(201).json({ ok: true, message: pub });
  }

  // ---- Xoá (mềm) ----
  if (req.method === "DELETE") {
    const { id } = req.query;
    let msg;
    try {
      msg = await Message.findById(id);
    } catch {
      return res.status(404).json({ ok: false, error: "Message not found" });
    }
    if (!msg || msg.deletedAt) return res.status(404).json({ ok: false, error: "Message not found" });
    if (!(await canAccessClassChat(user, msg.classId))) {
      return res.status(403).json({ ok: false, error: "Access denied" });
    }
    const isOwn = String(msg.senderId) === user.id;
    if (!isOwn && user.role !== "teacher") {
      return res.status(403).json({ ok: false, error: "You can only delete your own messages" });
    }
    msg.deletedAt = new Date();
    await msg.save();
    emitToClass(msg.classId, "message-deleted", { _id: msg._id, classId: msg.classId });
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireMember(handler);

module.exports.default = module.exports;
