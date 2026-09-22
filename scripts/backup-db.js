// Dump toàn bộ database ra file JSON — đường lùi trước khi chạy migration.
//
// PLAN-MULTI-TENANT.md, Phase 0. MongoDB không có Undo: chạy nhầm một
// updateMany lên DB thật là hỏng dữ liệu của 21 học sinh mà không lấy lại được.
// Máy này chưa cài `mongodump` nên dùng driver có sẵn trong node_modules.
//
// Ghi bằng EJSON (không phải JSON.stringify) để giữ nguyên kiểu ObjectId và
// Date. JSON thường sẽ biến ObjectId thành chuỗi — bản dump vẫn đọc được nhưng
// restore vào là sai hết tham chiếu, tức là có backup mà không dùng được.
//
//   node scripts/backup-db.js --live
//   node scripts/backup-db.js --live --out /duong/dan/khac
//
// Chỉ ĐỌC, không ghi gì vào database.
const fs = require("fs");
const path = require("path");
const { MongoClient } = require("mongodb");
const { EJSON } = require("bson");
const { resolveTarget, redact } = require("./dbTarget");

const USAGE = "Usage: node scripts/backup-db.js <--live|--dev|URI> [--out <dir>]";

function stamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

(async () => {
  const argv = process.argv.slice(2);
  const { uri, name, flag } = resolveTarget(argv, USAGE);

  const outIdx = argv.indexOf("--out");
  const baseDir = outIdx !== -1 && argv[outIdx + 1] ? argv[outIdx + 1] : path.join(__dirname, "..", "backups");
  const dir = path.join(baseDir, `${name}-${flag}-${stamp()}`);

  if (fs.existsSync(dir)) {
    console.error(`Thư mục đã tồn tại, không ghi đè: ${dir}`);
    process.exit(1);
  }
  fs.mkdirSync(dir, { recursive: true });

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db(name);

  const cols = (await db.listCollections().toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();

  const meta = {
    database: name,
    target: flag,
    uri: redact(uri), // che credentials — file dump có thể bị chia sẻ
    takenAt: new Date().toISOString(),
    collections: {},
  };

  let totalDocs = 0;
  let totalBytes = 0;
  const w = Math.max(18, ...cols.map((c) => c.length));

  for (const col of cols) {
    const docs = await db.collection(col).find({}).toArray();
    const text = EJSON.stringify(docs, { relaxed: false });
    const file = path.join(dir, `${col}.json`);
    fs.writeFileSync(file, text);

    // Index cũng phải lưu: restore mà thiếu index unique là dữ liệu trùng lặp
    // lọt vào mà không ai biết (ví dụ username).
    let indexes = [];
    try {
      indexes = await db.collection(col).indexes();
    } catch {
      /* collection vừa bị xoá giữa chừng — bỏ qua */
    }

    meta.collections[col] = { docs: docs.length, bytes: text.length, indexes };
    totalDocs += docs.length;
    totalBytes += text.length;
    console.log(`  ${col.padEnd(w)} ${String(docs.length).padStart(7)} docs  ${humanSize(text.length).padStart(9)}`);
  }

  meta.totals = { collections: cols.length, docs: totalDocs, bytes: totalBytes };
  fs.writeFileSync(path.join(dir, "_meta.json"), JSON.stringify(meta, null, 2));

  await client.close();

  console.log("");
  console.log(`Xong: ${cols.length} collection · ${totalDocs} document · ${humanSize(totalBytes)}`);
  console.log(`Thư mục: ${dir}`);
  console.log("\nBản dump chứa dữ liệu thật (tên, email, bài làm của học sinh).");
  console.log("backups/ đã nằm trong .gitignore — đừng commit, đừng gửi qua chat.");
  process.exit(0);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
