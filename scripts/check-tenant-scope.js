// Quét các route giáo viên/học sinh, cảnh báo file nào có truy vấn Mongoose
// mà không đi qua tầng tenant (tenantFilter / assertOwned / req.ws).
//
// PLAN-PHASE2-TENANT-READ.md mục 4. Chống tái phát lỗi B2: một route quên
// lọc theo workspace không báo lỗi gì cả, nó chỉ âm thầm rò rỉ hoặc giấu dữ
// liệu — đây là cách duy nhất bắt được lỗi đó trước khi merge.
//
// Whitelist một file bằng comment ở đầu file: // tenant-exempt: <lý do>
//
//   node scripts/check-tenant-scope.js            in danh sách, exit 0
//   node scripts/check-tenant-scope.js --strict    exit 1 nếu có vi phạm
const fs = require("fs");
const path = require("path");

const STRICT = process.argv.includes("--strict");
const ROOT = path.join(__dirname, "..");

// Route giáo viên + học sinh — đúng phạm vi mục 3 của PLAN-PHASE2-TENANT-READ.md.
// KHÔNG quét pages/api/sysadmin/, pages/api/cron/, pages/api/auth.js,
// pages/api/tickets.js, pages/api/teacher/notifications.js — nhóm 3, ngoài
// phạm vi Phase 2.
const SCAN_DIRS = [
  "pages/api/admin",
  "pages/api/student",
];
// File rời ở gốc pages/api/ (không quét cả thư mục vì gồm cả sysadmin/auth/tickets).
const SCAN_FILES = [
  "pages/api/units.js",
  "pages/api/tests.js",
  "pages/api/notifications.js",
  "pages/api/submissions.js",
  "pages/api/submissions/reflection.js",
  "pages/api/changelog.js",
  "pages/api/teacher/me.js",
];

// Chỉ bắt lệnh gọi trên một Model Mongoose — nhận diện bằng quy ước đặt tên
// PascalCase mà TOÀN BỘ model trong lib/models/ đều theo (Unit, Submission,
// GradingJob...). Không bắt .find()/.filter() trên mảng thường (biến chữ
// thường, vd `failed.find(...)`) — đó không phải truy vấn DB.
const QUERY_RE = /\b[A-Z][A-Za-z0-9]*\.(find|findOne|findById|findOneAndUpdate|findByIdAndUpdate|countDocuments|aggregate|distinct|exists|updateOne|updateMany|deleteOne|deleteMany)\s*\(/;
const TENANT_MARKERS = ["tenantFilter", "assertOwned", "req.ws"];
const EXEMPT_RE = /\/\/\s*tenant-exempt:/;

function listFiles(dir) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) return [];
  const out = [];
  for (const entry of fs.readdirSync(abs, { withFileTypes: true })) {
    const rel = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFiles(rel));
    } else if (entry.name.endsWith(".js")) {
      out.push(rel);
    }
  }
  return out;
}

function checkFile(rel) {
  const abs = path.join(ROOT, rel);
  const text = fs.readFileSync(abs, "utf8");

  if (EXEMPT_RE.test(text)) return { rel, status: "exempt" };

  const hasQuery = QUERY_RE.test(text);
  if (!hasQuery) return { rel, status: "no-query" };

  const hasMarker = TENANT_MARKERS.some((m) => text.includes(m));
  if (hasMarker) return { rel, status: "ok" };

  // Tìm dòng đầu tiên có truy vấn để báo cho dễ tra.
  const lines = text.split("\n");
  const lineNo = lines.findIndex((l) => QUERY_RE.test(l)) + 1;
  return { rel, status: "violation", line: lineNo };
}

const targets = new Set(SCAN_FILES);
for (const dir of SCAN_DIRS) listFiles(dir).forEach((f) => targets.add(f));

const results = [...targets].sort().map(checkFile).filter((r) => fs.existsSync(path.join(ROOT, r.rel)));

const violations = results.filter((r) => r.status === "violation");
const ok = results.filter((r) => r.status === "ok");
const exempt = results.filter((r) => r.status === "exempt");
const noQuery = results.filter((r) => r.status === "no-query");

console.log(`Quét ${results.length} file — ${ok.length} có tenant filter, ${exempt.length} exempt, ${noQuery.length} không có truy vấn DB.`);

if (violations.length) {
  console.log(`\n⚠  ${violations.length} file KHÔNG có tenantFilter/assertOwned/req.ws dù có truy vấn DB:`);
  for (const v of violations) {
    console.log(`  ${v.rel}:${v.line}`);
  }
  console.log(
    "\nMỗi route giáo viên/học sinh phải lọc theo workspace ở MỌI truy vấn —" +
      " kể cả countDocuments/aggregate/distinct (PLAN-PHASE2-TENANT-READ.md mục 0.4)." +
      "\nNếu file này cố ý không cần (chỉ đọc hồ sơ chính mình, không đọc DB thật...)," +
      " thêm dòng `// tenant-exempt: <lý do>` ở đầu file."
  );
} else {
  console.log("\nKhông có file nào vi phạm.");
}

if (STRICT && violations.length) {
  process.exit(1);
}
process.exit(0);
