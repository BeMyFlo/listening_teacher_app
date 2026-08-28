// Kênh email — gửi qua Gmail SMTP (lib/mailer.js).
//
// Bật/tắt theo CHANNEL_CONFIG trong ../index.js. Chưa đặt env GMAIL_* thì
// sendMail trả { skipped: true } và bản ghi ghi status="skipped".

const Notification = require("../../models/Notification");
const Student = require("../../models/Student");
const Teacher = require("../../models/Teacher");
const { sendMail } = require("../../mailer");

const APP_URL = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

async function resolveRecipient(notif) {
  if (notif.teacherId) {
    const t = await Teacher.findById(notif.teacherId).select("name email").lean();
    return t && t.email ? { email: t.email, name: t.name } : null;
  }
  if (notif.studentId) {
    const s = await Student.findById(notif.studentId).select("name email").lean();
    return s && s.email ? { email: s.email, name: s.name } : null;
  }
  return null;
}

function renderHtml(notif, recipientName) {
  const linkPath = notif.link || (notif.unitId ? `/student/lessons/${notif.unitId}` : "");
  const linkHtml =
    linkPath && APP_URL
      ? `<p style="margin:24px 0 0"><a href="${APP_URL}${linkPath}" style="background:#2563eb;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Open</a></p>`
      : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:520px;margin:0 auto;color:#1f2937">
    <p style="margin:0 0 4px;color:#6b7280;font-size:13px">Ms Nhi IELTS</p>
    <h2 style="margin:0 0 12px;font-size:18px">${escapeHtml(notif.title || "Notification")}</h2>
    <p style="margin:0;line-height:1.6">${escapeHtml(notif.body || "")}</p>
    ${linkHtml}
  </div>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

async function setStatus(id, patch) {
  await Notification.updateOne({ _id: id }, { $set: Object.fromEntries(Object.entries(patch).map(([k, v]) => [`deliveries.email.${k}`, v])) });
}

module.exports.deliver = async function deliver(notif) {
  const to = await resolveRecipient(notif);
  if (!to) {
    await setStatus(notif._id, { status: "skipped", error: "no recipient email on file" });
    return;
  }
  try {
    const r = await sendMail({
      to: to.email,
      subject: notif.title || "Notification — Ms Nhi IELTS",
      html: renderHtml(notif, to.name),
    });
    if (r.skipped) {
      await setStatus(notif._id, { status: "skipped", error: "mailer not configured" });
    } else {
      await setStatus(notif._id, { status: "sent", sentAt: new Date(), error: "" });
    }
  } catch (err) {
    await setStatus(notif._id, { status: "failed", error: String(err.message || err).slice(0, 500) });
    throw err;
  }
};
