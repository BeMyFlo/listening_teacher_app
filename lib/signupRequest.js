// Kiểm tra dữ liệu form xin dùng thử (dùng bởi pages/api/public/signup-request.js).
// Tách riêng để test được không cần server/DB.

const EMAIL_RE = /^[^\s@<>"',;:()[\]\\]+@[^\s@<>"',;:()[\]\\]+\.[^\s@<>"',;:()[\]\\]{2,}$/;
const PHONE_RE = /^[0-9+\-().\s]{6,20}$/;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

function clean(v, max) {
  if (typeof v !== "string") return "";
  return v.replace(CONTROL_RE, "").trim().slice(0, max);
}

// -> { value } | { error }. Thông báo lỗi là tiếng Anh (API); trang giới thiệu tự hiện câu tiếng Việt.
function validateSignupRequest(body) {
  const b = body && typeof body === "object" ? body : {};
  const name = clean(b.name, 100).replace(/\s+/g, " ");
  const email = clean(b.email, 200).toLowerCase();
  const phone = clean(b.phone, 30);
  const organization = clean(b.organization, 120).replace(/\s+/g, " ");
  const message = clean(b.message, 1000);

  if (name.length < 2) return { error: "Please enter your name" };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email" };
  if (phone && !PHONE_RE.test(phone)) return { error: "Please enter a valid phone number" };
  return { value: { name, email, phone, organization, message } };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

module.exports = { validateSignupRequest, escapeHtml };
