const { connectDB } = require("../../../lib/db");
const { requireMember } = require("../../../lib/auth");
const Class = require("../../../lib/models/Class");
const Conversation = require("../../../lib/models/Conversation");
const { userFromAuth, classIdsForUser } = require("../../../lib/chat/membership");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const user = userFromAuth(req.auth);
  const ids = await classIdsForUser(user);
  if (!ids.length) return res.status(200).json({ ok: true, rows: [] });

  const [classes, convs] = await Promise.all([
    Class.find({ _id: { $in: ids } }).select("name level").lean(),
    Conversation.find({ classId: { $in: ids } }).lean(),
  ]);
  const meta = {};
  convs.forEach((c) => (meta[String(c.classId)] = c));

  const rows = classes
    .map((c) => {
      const m = meta[String(c._id)] || {};
      return {
        classId: c._id,
        name: c.name,
        level: c.level,
        lastMessageAt: m.lastMessageAt || null,
        lastMessagePreview: m.lastMessagePreview || "",
      };
    })
    .sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));

  return res.status(200).json({ ok: true, rows });
}

module.exports = requireMember(handler);

module.exports.default = module.exports;
