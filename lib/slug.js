// Quy tắc cho slug của workspace — slug trở thành tên miền `<slug>.<APP_BASE_DOMAIN>`
// (PLAN-MULTI-TENANT.md Phase 10) nên phải an toàn với DNS và không đụng tên hệ thống.
//
// Chỉ áp cho slug MỚI hoặc được ĐỔI. Slug đã có (ms-nhi, demo...) giữ nguyên dù
// không qua kiểm tra này.

const MIN_LEN = 3;
const MAX_LEN = 40;

// Tên dành riêng: dịch vụ hạ tầng, đường dẫn của app, và các tên dễ bị mạo danh.
const RESERVED = new Set([
  "www", "admin", "administrator", "api", "app", "apps", "login", "logout", "signin", "signup",
  "register", "auth", "account", "accounts", "settings", "dashboard", "teacher", "teachers",
  "student", "students", "sysadmin", "legacy", "root", "mail", "email", "smtp", "imap", "pop",
  "ftp", "ns", "ns1", "ns2", "dns", "static", "assets", "cdn", "files", "media", "img", "images",
  "docs", "help", "support", "status", "blog", "billing", "pay", "payment", "payments", "store",
  "shop", "test", "dev", "staging", "preview", "beta", "vercel", "bemyflo", "security", "abuse",
  "privacy", "terms", "about", "contact", "home", "web", "webmail", "cpanel", "localhost",
]);

// -> { ok: true, slug } | { ok: false, error }
function validateSlug(input) {
  if (typeof input !== "string") return { ok: false, error: "Workspace address is required" };
  const slug = input.trim().toLowerCase();
  if (slug.length < MIN_LEN || slug.length > MAX_LEN) {
    return { ok: false, error: `Workspace address must be ${MIN_LEN}-${MAX_LEN} characters` };
  }
  // chữ thường/số, nhãn nối bằng MỘT dấu gạch; không bắt đầu/kết thúc bằng gạch, không "--"
  // (chặn luôn dạng "xn--" của tên miền quốc tế hoá).
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return { ok: false, error: "Workspace address can only use lowercase letters, numbers and single hyphens" };
  }
  if (RESERVED.has(slug)) {
    return { ok: false, error: "That address is reserved — please choose another" };
  }
  return { ok: true, slug };
}

module.exports = { validateSlug, RESERVED, MIN_LEN, MAX_LEN };
