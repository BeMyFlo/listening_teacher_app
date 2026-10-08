// Gửi email qua Gmail SMTP bằng App Password (không dùng OAuth).
//
// Env cần đặt (.env.local khi dev, Project Settings trên Vercel):
//   GMAIL_USER            địa chỉ Gmail dùng để gửi (dùng chung cả nền tảng)
//   GMAIL_APP_PASSWORD    App Password 16 ký tự (Google Account -> Security ->
//                         2-Step Verification -> App passwords). Bỏ hết dấu cách.
//   EMAIL_FROM (optional) tên hiển thị + địa chỉ mặc định, ví dụ: BeMyFlo <hello@bemyflo.com>.
//                         Thư có workspace thì tên hiển thị được thay bằng tên trung tâm
//                         (địa chỉ giữ nguyên).
//
// Thiếu env -> log cảnh báo và bỏ qua (không ném lỗi) để luồng chính không vỡ.

const nodemailer = require("nodemailer");

let cachedTransport;
let warned = false;

function getTransport() {
  const user = process.env.GMAIL_USER;
  const pass = process.env.GMAIL_APP_PASSWORD;
  if (!user || !pass) {
    if (!warned) {
      console.warn("[mailer] GMAIL_USER / GMAIL_APP_PASSWORD not set — email sending disabled");
      warned = true;
    }
    return null;
  }
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    });
  }
  return cachedTransport;
}

function isEnabled() {
  return !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
}

// Địa chỉ gửi: phần <...> của EMAIL_FROM nếu có, không thì GMAIL_USER.
function fromAddress() {
  const raw = process.env.EMAIL_FROM || "";
  const m = raw.match(/<([^<>\s]+@[^<>\s]+)>/);
  if (m) return m[1];
  return /^[^<>\s]+@[^<>\s]+$/.test(raw.trim()) ? raw.trim() : process.env.GMAIL_USER;
}

// Trả { ok: true } khi gửi xong, { ok: false, skipped: true } khi chưa cấu hình,
// ném lỗi nếu SMTP từ chối (caller tự bắt để ghi deliveries.email.error).
// fromName (tuỳ chọn): tên hiển thị người gửi. Truyền dạng object để nodemailer
// tự mã hoá/escape — không nối chuỗi tay (tên do giáo viên đặt, có thể chứa ký tự lạ).
async function sendMail({ to, subject, html, text, fromName }) {
  const transport = getTransport();
  if (!transport) return { ok: false, skipped: true };
  if (!to) return { ok: false, skipped: true };

  const name = fromName ? String(fromName).replace(/[\r\n]+/g, " ").trim().slice(0, 100) : "";
  const from = name ? { name, address: fromAddress() } : process.env.EMAIL_FROM || process.env.GMAIL_USER;
  const info = await transport.sendMail({
    from,
    to,
    subject,
    text: text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim(),
    html,
  });
  return { ok: true, messageId: info.messageId };
}

module.exports = { sendMail, isEnabled };
