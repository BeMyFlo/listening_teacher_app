// Gán mọi document hiện có vào MỘT workspace — Phase 1 của PLAN-MULTI-TENANT.md.
//
// Trước: dữ liệu vô chủ, nội dung ghép với học sinh qua `level` (số nguyên
// toàn cục). Sau: mọi document đều có `workspaceId`, nhưng CHƯA có route nào
// đọc field đó nên app chạy y hệt. Chính vì vậy Phase 2 (bật lọc khi ĐỌC) mới
// là no-op và sai là thấy ngay — xem mục 0.2 của plan.
//
// IDEMPOTENT: chạy lại nhiều lần cho cùng kết quả. Workspace tra theo slug,
// thành viên upsert theo (workspaceId, userId), document chỉ đụng tới những
// cái còn THIẾU workspaceId.
//
// Mặc định là DRY-RUN (giống scripts/clone-db.js) — phải có --apply mới ghi:
//   node scripts/migrate-workspace.js --live               # xem trước
//   node scripts/migrate-workspace.js --live --apply       # ghi thật
//   node scripts/migrate-workspace.js --live --apply --name "Tên" --slug ten
const mongoose = require("mongoose");
const { resolveTarget } = require("./dbTarget");

const USAGE = "Usage: node scripts/migrate-workspace.js <--live|--dev|URI> [--apply] [--name <tên>] [--slug <slug>]";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const arg = (flag, fallback) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : fallback;
};

const WS_NAME = arg("--name", "Ms Nhi English Academy");
const WS_SLUG = arg("--slug", "ms-nhi");

// Đúng bảng mục 3 của plan. Dùng tên MODEL chứ không phải tên collection: tên
// collection được suy ra từ model nên script và schema không thể lệch nhau.
const REQUIRED = [
  "Teacher", "Student", "Class", "Unit", "Test", "Audio", "Image",
  "AttendanceSession", "Submission", "StudentNote", "Notification",
  "GradingJob", "DeadlineEmailJob",
];
const OPTIONAL = ["Ticket", "AuditLog", "AiLog"]; // có field, không bao giờ required

// Document "thiếu" = chưa có field, hoặc có mà null. Cả hai đều không khớp
// filter `{workspaceId: ws}` ở Phase 2, tức là sẽ biến mất khỏi giao diện.
const MISSING = { $or: [{ workspaceId: { $exists: false } }, { workspaceId: null }] };

(async () => {
  const { uri } = resolveTarget(argv, USAGE);
  await mongoose.connect(uri);

  const User = require("../lib/models/User");
  const Workspace = require("../lib/models/Workspace");
  const WorkspaceMember = require("../lib/models/WorkspaceMember");
  const models = [...REQUIRED, ...OPTIONAL].map((n) => require(`../lib/models/${n}`));

  if (!APPLY) console.log("DRY RUN — không ghi gì. Thêm --apply để chạy thật.\n");

  // --- 1. Chủ workspace ---------------------------------------------------
  const teachers = await User.find({ role: "teacher" }).sort({ createdAt: 1, _id: 1 }).lean();
  if (!teachers.length) {
    console.error("Không có User nào role=teacher — không biết ai là chủ workspace. Dừng.");
    process.exit(1);
  }
  const owner = teachers[0];
  console.log(`Chủ workspace: ${owner.username} (${owner.name || "không tên"})`);
  if (teachers.length > 1) {
    console.log(`Còn ${teachers.length - 1} teacher khác -> vào cùng workspace với role "teacher".`);
  }

  // --- 2. Workspace -------------------------------------------------------
  let ws = await Workspace.findOne({ slug: WS_SLUG });
  if (ws) {
    console.log(`Workspace "${WS_SLUG}" đã có (${ws._id}) — dùng lại.`);
  } else if (APPLY) {
    ws = await Workspace.create({ name: WS_NAME, slug: WS_SLUG, ownerUserId: owner._id });
    console.log(`Tạo workspace "${WS_NAME}" (${WS_SLUG}) -> ${ws._id}`);
  } else {
    console.log(`Sẽ tạo workspace "${WS_NAME}" (${WS_SLUG}).`);
  }

  // Dry-run chưa có workspace thật thì dùng id giả để đếm cho ra số liệu.
  const wsId = ws ? ws._id : new mongoose.Types.ObjectId();

  // --- 3. Thành viên ------------------------------------------------------
  let added = 0;
  let already = 0;
  for (const t of teachers) {
    const role = String(t._id) === String(owner._id) ? "owner" : "teacher";
    const exists = ws && (await WorkspaceMember.findOne({ workspaceId: wsId, userId: t._id }).lean());
    if (exists) {
      already++;
      continue;
    }
    if (APPLY) {
      // upsert: chạy lại script không sinh bản sao (index unique cũng chặn).
      await WorkspaceMember.updateOne(
        { workspaceId: wsId, userId: t._id },
        { $setOnInsert: { role, createdAt: new Date() } },
        { upsert: true }
      );
    }
    added++;
  }
  console.log(`Thành viên: thêm ${added}, đã có sẵn ${already}.\n`);

  // --- 4. Đóng dấu workspaceId lên document cũ ----------------------------
  const w = Math.max(20, ...models.map((m) => m.collection.name.length));
  console.log(`${"collection".padEnd(w)} ${"tổng".padStart(7)} ${"sẽ sửa".padStart(8)} ${"còn thiếu".padStart(10)}`);
  console.log("-".repeat(w + 29));

  let touched = 0;
  let leftover = 0;
  for (const Model of models) {
    const col = Model.collection.name;
    const total = await Model.countDocuments({});
    const missing = await Model.countDocuments(MISSING);

    if (APPLY && missing) await Model.updateMany(MISSING, { $set: { workspaceId: wsId } });

    const after = APPLY ? await Model.countDocuments(MISSING) : missing;
    touched += missing;
    leftover += after;
    const mark = APPLY && after ? "  <-- CHƯA SẠCH" : "";
    console.log(
      `${col.padEnd(w)} ${String(total).padStart(7)} ${String(missing).padStart(8)} ${String(after).padStart(10)}${mark}`
    );
  }

  console.log("");
  console.log(`${APPLY ? "Đã gán" : "Sẽ gán"} workspaceId cho ${touched} document trên ${models.length} collection.`);

  if (APPLY) {
    console.log(`Còn thiếu sau khi chạy: ${leftover} (phải = 0).`);
    console.log(leftover === 0 ? "\nOK. Chạy scripts/check-orphans.js --live để xác nhận lại độc lập." : "\nCHƯA SẠCH — xem lại trước khi sang Phase 2.");
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
