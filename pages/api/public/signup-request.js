// Form "Đăng ký dùng thử" ở trang giới thiệu. CÔNG KHAI (không có token) nên phải tự phòng thủ:
//   - chỉ POST, chỉ nhận vài trường văn bản, cắt độ dài + bỏ ký tự điều khiển;
//   - ô bẫy `website` (người thật không thấy): bot điền -> giả vờ thành công, không lưu;
//   - giới hạn theo IP (trong bộ nhớ, xem lib/rateLimit.js: hàng rào mềm) + trần số yêu cầu "new" trong DB;
//   - cùng email gửi lại trong 24h -> trả thành công, không tạo dòng mới;
//   - KHÔNG tạo tài khoản, KHÔNG trả lại bất cứ dữ liệu nào cho người gọi.
const { connectDB } = require("../../../lib/db");
const SignupRequest = require("../../../lib/models/SignupRequest");
const { validateSignupRequest, escapeHtml } = require("../../../lib/signupRequest");
const { hit, clientIp } = require("../../../lib/rateLimit");
const { sendMail } = require("../../../lib/mailer");

const MAX_NEW = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

async function notifyOwner(r) {
  const to = process.env.SIGNUP_NOTIFY_EMAIL;
  if (!to) return;
  const row = (k, v) => `<tr><td style="padding:4px 12px 4px 0;color:#6b7280">${k}</td><td>${escapeHtml(v || "-")}</td></tr>`;
  await sendMail({
    to,
    subject: "New BeMyFlo trial request", // cố định: không đưa dữ liệu người lạ vào tiêu đề thư
    html:
      `<div style="font-family:Arial,sans-serif"><h3>New trial request</h3><table>` +
      row("Name", r.name) + row("Email", r.email) + row("Phone", r.phone) + row("Center", r.organization) + row("Message", r.message) +
      `</table><p style="color:#6b7280;font-size:12px">Review it in Admin → Sign-up requests.</p></div>`,
    fromName: "BeMyFlo",
  });
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  // Ô bẫy: người thật không thấy nên không điền.
  if (typeof body.website === "string" && body.website.trim()) return res.status(200).json({ ok: true });

  const rl = hit("signup:" + clientIp(req), { max: 5, windowMs: 60 * 60 * 1000 });
  if (rl.limited) {
    res.setHeader("Retry-After", String(rl.retryAfterSec));
    return res.status(429).json({ ok: false, error: "Too many requests. Please try again later." });
  }

  const { value, error } = validateSignupRequest(body);
  if (error) return res.status(400).json({ ok: false, error });

  await connectDB();
  if ((await SignupRequest.countDocuments({ status: "new" })) >= MAX_NEW) {
    return res.status(503).json({ ok: false, error: "Temporarily unavailable" });
  }
  const dup = await SignupRequest.exists({ email: value.email, createdAt: { $gte: new Date(Date.now() - DAY_MS) } });
  if (dup) return res.status(200).json({ ok: true });

  const doc = await SignupRequest.create(value);
  try {
    await notifyOwner(doc);
  } catch (err) {
    console.error("[signup-request] notify failed:", err.message);
  }
  return res.status(200).json({ ok: true });
};

module.exports.default = module.exports;
