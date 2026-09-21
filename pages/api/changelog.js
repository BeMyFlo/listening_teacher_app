const { connectDB } = require("../../lib/db");
const { requireAnyRole } = require("../../lib/auth");
const Teacher = require("../../lib/models/Teacher");
const Student = require("../../lib/models/Student");
const { CHANGELOG } = require("../../lib/changelog");

function loadProfile(auth) {
  return auth.role === "teacher" ? Teacher.findById(auth.teacherId) : Student.findById(auth.studentId);
}

// GET  -> có bản cập nhật chưa xem không, kèm nội dung (đã lọc theo vai trò).
// POST -> đánh dấu đã xem tới bản mới nhất.
async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();
  const profile = await loadProfile(req.auth);
  if (!profile) {
    return res.status(401).json({ ok: false, error: "Account no longer exists, please sign in again" });
  }

  const latestVersion = (CHANGELOG[0] && CHANGELOG[0].version) || "";

  if (req.method === "POST") {
    profile.lastSeenChangelogVersion = latestVersion;
    await profile.save();
    return res.status(200).json({ ok: true });
  }

  const seenVersion = profile.lastSeenChangelogVersion || "";
  const unseen = !!latestVersion && seenVersion !== latestVersion;
  const entries = unseen
    ? CHANGELOG.filter((e) => e.version > seenVersion)
        .map((e) => ({
          version: e.version,
          date: e.date,
          items: e.items.filter((i) => i.audience === "all" || i.audience === req.auth.role).map((i) => i.text),
        }))
        .filter((e) => e.items.length)
    : [];

  return res.status(200).json({ ok: true, latestVersion, unseen: unseen && entries.length > 0, entries });
}

module.exports = requireAnyRole(["teacher", "student"])(handler);

module.exports.default = module.exports;
