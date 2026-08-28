// Gửi email qua Gmail SMTP bằng App Password (không dùng OAuth).
//
// Env cần đặt (.env.local khi dev, Project Settings trên Vercel):
//   GMAIL_USER            địa chỉ Gmail dùng để gửi, ví dụ msnhi.center@gmail.com
//   GMAIL_APP_PASSWORD    App Password 16 ký tự (Google Account -> Security ->
//                         2-Step Verification -> App passwords). Bỏ hết dấu cách.
//   EMAIL_FROM (optional) tên hiển thị, ví dụ: Ms Nhi IELTS <msnhi.center@gmail.com>
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

// Trả { ok: true } khi gửi xong, { ok: false, skipped: true } khi chưa cấu hình,
// ném lỗi nếu SMTP từ chối (caller tự bắt để ghi deliveries.email.error).
async function sendMail({ to, subject, html, text }) {
  const transport = getTransport();
  if (!transport) return { ok: false, skipped: true };
  if (!to) return { ok: false, skipped: true };

  const from = process.env.EMAIL_FROM || process.env.GMAIL_USER;
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
