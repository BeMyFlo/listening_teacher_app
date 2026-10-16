// Gán `program: "ielts"` cho Class/Unit/Test/Submission còn thiếu field — Bước 1
// của docs/plans/multi-tenant/PLAN-PHASE8-TOEIC.md (mục 3.3).
//
// Không bắt buộc để app chạy đúng (programFilter chịu được field thiếu), chỉ để
// dữ liệu sạch và index { workspaceId, program, ... } có tác dụng.
//
// IDEMPOTENT: chỉ đụng tới doc thiếu field (hoặc null). Mặc định là DRY-RUN —
// phải có --apply mới ghi. Bắt buộc chọn DB rõ ràng, không có mặc định:
//   node scripts/backfill-program.js --dev                # xem trước
//   node scripts/backfill-program.js --dev --apply        # ghi thật
//   node scripts/backfill-program.js --live               # CHỈ khi chủ dự án đồng ý
const mongoose = require("mongoose");
const { resolveTarget } = require("./dbTarget");
const { DEFAULT_PROGRAM } = require("../lib/curriculum");

const USAGE = "Usage: node scripts/backfill-program.js <--live|--dev|URI> [--apply]";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");

// Tên MODEL (không phải tên collection) — giống scripts/migrate-workspace.js.
const MODELS = ["Class", "Unit", "Test", "Submission"];

// Thiếu = chưa có field, hoặc có mà null.
const MISSING = { $or: [{ program: { $exists: false } }, { program: null }] };

(async () => {
  const { uri } = resolveTarget(argv, USAGE);
  await mongoose.connect(uri);

  const models = MODELS.map((n) => require(`../lib/models/${n}`));

  if (!APPLY) console.log("DRY RUN — không ghi gì. Thêm --apply để chạy thật.\n");

  const w = Math.max(14, ...models.map((m) => m.collection.name.length));
  console.log(`${"collection".padEnd(w)} ${"tổng".padStart(7)} ${"sẽ sửa".padStart(8)} ${"còn thiếu".padStart(10)}`);
  console.log("-".repeat(w + 29));

  let touched = 0;
  let leftover = 0;
  for (const Model of models) {
    const col = Model.collection.name;
    const total = await Model.countDocuments({});
    const missing = await Model.countDocuments(MISSING);

    // Dùng collection gốc (không qua Mongoose update) để không kích hoạt
    // timestamps -> updatedAt của doc cũ giữ nguyên.
    if (APPLY && missing) await Model.collection.updateMany(MISSING, { $set: { program: DEFAULT_PROGRAM } });

    const after = APPLY ? await Model.countDocuments(MISSING) : missing;
    touched += missing;
    leftover += after;
    const mark = APPLY && after ? "  <-- CHƯA SẠCH" : "";
    console.log(
      `${col.padEnd(w)} ${String(total).padStart(7)} ${String(missing).padStart(8)} ${String(after).padStart(10)}${mark}`
    );
  }

  console.log("");
  console.log(`${APPLY ? "Đã gán" : "Sẽ gán"} program="${DEFAULT_PROGRAM}" cho ${touched} document trên ${models.length} collection.`);

  if (APPLY) {
    console.log(`Còn thiếu sau khi chạy: ${leftover} (phải = 0).`);
    console.log(leftover === 0 ? "\nOK. Chạy scripts/check-orphans.js để xác nhận lại độc lập." : "\nCHƯA SẠCH — xem lại.");
  } else {
    console.log("\nChưa ghi gì. Thêm --apply để chạy thật.");
  }

  await mongoose.disconnect();
  process.exit(APPLY && leftover !== 0 ? 1 : 0);
})().catch(async (e) => {
  console.error(e.message);
  try { await mongoose.disconnect(); } catch {}
  process.exit(1);
});
