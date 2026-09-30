// Gán logo cho 1 workspace có sẵn (dùng 1 lần để chuyển logo Ms Nhi từ code
// vào dữ liệu, PLAN-MULTI-TENANT.md Phase 7). Mặc định DRY-RUN.
//
//   node scripts/seed-workspace-logo.js --dev  --slug ms-nhi --logo /ms-nhi-logo.svg
//   node scripts/seed-workspace-logo.js --live --slug ms-nhi --logo /ms-nhi-logo.svg --apply
//
// Chỉ ghi khi workspace CHƯA có logo (không đè logo giáo viên đã tự upload) —
// muốn đè thì thêm --force.
const mongoose = require("mongoose");
const { resolveTarget } = require("./dbTarget");
const Workspace = require("../lib/models/Workspace");

const USAGE = "Usage: node scripts/seed-workspace-logo.js <--live|--dev|URI> --slug <slug> --logo <đường dẫn> [--apply] [--force]";
const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const FORCE = argv.includes("--force");
const arg = (flag) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] ? argv[i + 1] : null;
};

(async () => {
  const slug = arg("--slug");
  const logo = arg("--logo");
  if (!slug || !logo) { console.error(USAGE); process.exit(1); }
  if (!/^\/[A-Za-z0-9._\-\/]+$/.test(logo) && !/^https:\/\//.test(logo)) {
    console.error("--logo phải là đường dẫn bắt đầu bằng / hoặc URL https"); process.exit(1);
  }
  const { uri, name } = resolveTarget(argv, USAGE);
  await mongoose.connect(uri);
  console.log(`DB: ${name}${APPLY ? "" : "  (DRY RUN — thêm --apply để ghi)"}`);

  const ws = await Workspace.findOne({ slug });
  if (!ws) { console.error(`Không có workspace slug="${slug}"`); process.exit(1); }
  console.log(`Workspace "${ws.name}" — logo hiện tại: ${ws.logoUrl || "(chưa có)"}`);
  if (ws.logoUrl && !FORCE) {
    console.log("Đã có logo — không đè. Thêm --force nếu muốn đè.");
  } else if (APPLY) {
    ws.logoUrl = logo;
    await ws.save();
    console.log(`Đã gán logo: ${logo}`);
  } else {
    console.log(`Sẽ gán logo: ${logo}`);
  }
  await mongoose.disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
