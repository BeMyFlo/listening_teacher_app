// Đếm document thiếu `workspaceId`, theo từng collection.
//
// Đây là cái đồng hồ đo của cả đợt multi-tenant (PLAN-MULTI-TENANT.md mục 4.5,
// Phase 0/1/4). Dùng ở ba thời điểm:
//   Phase 0  -> tất cả đều thiếu. Đó là baseline, đúng như vậy mới là chạy đúng.
//   Phase 1  -> sau migration phải = 0 ở nhóm BẮT BUỘC.
//   Phase 4  -> cổng chặn trước khi đặt `required: true`. Còn > 0 mà vẫn siết
//               là app văng 500 khi lưu (rủi ro R9).
//
// Quan trọng không kém phần đếm: script CẢNH BÁO khi gặp collection chưa được
// phân loại ở bảng dưới. Kịch bản hỏng đáng sợ nhất của Phase 1 là quên một
// collection trong danh sách migrate — lúc Phase 2 bật lọc lên thì đống document
// đó không khớp filter nào, biến mất khỏi giao diện mà không có lỗi nào cả.
//
//   node scripts/check-orphans.js --live
//   node scripts/check-orphans.js --live --strict   # exit 1 nếu nhóm bắt buộc còn thiếu
const { MongoClient } = require("mongodb");
const { resolveTarget } = require("./dbTarget");

const USAGE = "Usage: node scripts/check-orphans.js <--live|--dev|URI> [--strict]";

// Bảng phân loại — bám đúng mục 3 và 4.2 của PLAN-MULTI-TENANT.md.
// Sửa ở đây mỗi khi thêm model mới, nếu không script sẽ kêu "chưa phân loại".
const REQUIRED = [
  "teachers", "students", "classes", "units", "tests", "audios", "images",
  "attendancesessions", "submissions", "studentnotes", "notifications",
  "gradingjobs", "deadlineemailjobs",
];
const OPTIONAL = ["tickets", "auditlogs", "ailogs"]; // có workspaceId, KHÔNG required
// Không có `workspaceId` để mà thiếu:
//   users/appsettings/aiprompts/aispends — tầng platform (mục 3 của plan).
//   workspaces      — chính nó LÀ tenant.
//   workspacemembers — workspaceId là khoá, schema đã required nên luôn có.
const PLATFORM = [
  "users", "appsettings", "aiprompts", "aispends", "workspaces", "workspacemembers",
];

const STRICT = process.argv.includes("--strict");

(async () => {
  const { uri, name } = resolveTarget(process.argv.slice(2), USAGE);
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(name);

  const present = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();

  const rows = [];
  const unknown = [];

  for (const col of present) {
    if (PLATFORM.includes(col)) continue;
    const group = REQUIRED.includes(col) ? "bắt buộc" : OPTIONAL.includes(col) ? "tuỳ chọn" : null;
    if (group === null) {
      unknown.push(col);
      continue;
    }
    const total = await db.collection(col).countDocuments();
    // Thiếu = chưa có field, hoặc có mà null (cả hai đều không khớp filter theo workspace).
    const missing = await db.collection(col).countDocuments({
      $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }],
    });
    rows.push({ col, group, total, missing });
  }

  // Collection khai trong bảng nhưng không có trong DB: chưa ai dùng tới nên
  // Mongo chưa tạo. Không phải lỗi, nhưng nói ra để khỏi tưởng đã kiểm tra rồi.
  const absent = [...REQUIRED, ...OPTIONAL].filter((c) => !present.includes(c));

  const w = Math.max(18, ...rows.map((r) => r.col.length));
  console.log(`${"collection".padEnd(w)}  ${"nhóm".padEnd(9)} ${"tổng".padStart(7)} ${"thiếu".padStart(7)}`);
  console.log("-".repeat(w + 26));
  for (const r of rows) {
    const mark = r.missing === 0 ? "" : r.group === "bắt buộc" ? "  <-- CHẶN" : "  <-- xem lại";
    console.log(
      `${r.col.padEnd(w)}  ${r.group.padEnd(9)} ${String(r.total).padStart(7)} ${String(r.missing).padStart(7)}${mark}`
    );
  }

  const blocking = rows.filter((r) => r.group === "bắt buộc" && r.missing > 0);
  const totalMissing = rows.reduce((s, r) => s + r.missing, 0);

  console.log("");
  console.log(`Tổng document thiếu workspaceId: ${totalMissing}`);
  console.log(`Nhóm bắt buộc còn thiếu: ${blocking.length}/${rows.filter((r) => r.group === "bắt buộc").length} collection`);

  if (absent.length) console.log(`\nChưa tồn tại trong DB (Mongo tạo collection lười): ${absent.join(", ")}`);
  if (unknown.length) {
    console.log(
      `\n⚠  CHƯA PHÂN LOẠI: ${unknown.join(", ")}\n` +
        "   Collection này không nằm trong REQUIRED/OPTIONAL/PLATFORM ở đầu file.\n" +
        "   Phân loại nó vào bảng mục 3 của PLAN-MULTI-TENANT.md rồi cập nhật script,\n" +
        "   nếu không migration sẽ bỏ sót và dữ liệu sẽ biến mất sau Phase 2."
    );
  }

  await client.close();

  if (STRICT && (blocking.length || unknown.length)) {
    console.log("\n--strict: FAIL");
    process.exit(1);
  }
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
