// Sao chép toàn bộ database từ SOURCE -> TARGET (để test local với data thật).
// XOÁ SẠCH target trước khi ghi. KHÔNG bao giờ ghi ngược vào source. Chạy:
//   node scripts/clone-db.js "<SOURCE_URI>" "<TARGET_URI>"            # dry-run
//   node scripts/clone-db.js "<SOURCE_URI>" "<TARGET_URI>" --apply    # thật
//   thêm --force nếu target không phải localhost
// hoặc đặt env SOURCE_URI / TARGET_URI. TARGET_URI mặc định:
//   mongodb://127.0.0.1:27017/listening_app
const { MongoClient } = require("mongodb");

const SOURCE = process.argv[2] || process.env.SOURCE_URI;
const TARGET = process.argv[3] || process.env.TARGET_URI || "mongodb://127.0.0.1:27017/listening_app";

if (!SOURCE) {
  console.error("Missing source URI. Usage: node scripts/clone-db.js <SOURCE_URI> [TARGET_URI]");
  process.exit(1);
}
if (SOURCE === TARGET) {
  console.error("Source and target are the same — refusing.");
  process.exit(1);
}

// Script này XOÁ SẠCH mọi collection của TARGET trước khi ghi. Trước đây nó
// chạy thẳng, nên gõ nhầm một biến môi trường là mất DB thật. Giờ:
//   - TARGET không phải localhost  -> bắt buộc có cờ --force
//   - mặc định là dry-run, phải có --apply mới thực sự ghi
const APPLY = process.argv.includes("--apply");
const FORCE = process.argv.includes("--force");
const TARGET_IS_LOCAL = /(^|@|\/\/)(localhost|127\.0\.0\.1)(:|\/)/.test(TARGET);

if (!TARGET_IS_LOCAL && !FORCE) {
  console.error(
    `REFUSING: target is not localhost —\n  ${TARGET}\n` +
      "This script deletes every collection in the target first.\n" +
      "Re-run with --force if you really mean to overwrite that database."
  );
  process.exit(1);
}
if (!APPLY) {
  console.error(
    `DRY RUN — nothing will be written.\n  source: ${SOURCE}\n  target: ${TARGET}\n` +
      "Every collection in the target would be DELETED, then replaced.\n" +
      "Re-run with --apply to actually do it."
  );
  process.exit(0);
}

function dbName(uri) {
  const m = uri.match(/\/([^/?]+)(\?|$)/);
  return m ? m[1] : "test";
}

(async () => {
  const src = new MongoClient(SOURCE);
  const dst = new MongoClient(TARGET);
  await src.connect();
  await dst.connect();
  const sdb = src.db(dbName(SOURCE));
  const ddb = dst.db(dbName(TARGET));

  console.log(`Cloning  ${dbName(SOURCE)}  ->  ${TARGET}`);
  const cols = (await sdb.listCollections().toArray()).filter((c) => !c.name.startsWith("system."));

  for (const { name } of cols) {
    const docs = await sdb.collection(name).find({}).toArray();
    await ddb.collection(name).deleteMany({});
    if (docs.length) await ddb.collection(name).insertMany(docs, { ordered: false });
    // sao chép index (bỏ _id_)
    for (const ix of await sdb.collection(name).indexes()) {
      if (ix.name === "_id_") continue;
      const { key, name: iname, v, ns, ...opts } = ix;
      try { await ddb.collection(name).createIndex(key, { name: iname, ...opts }); } catch (e) { /* ignore */ }
    }
    console.log(`  ${name}: ${docs.length} docs`);
  }

  await src.close();
  await dst.close();
  console.log("Done.");
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
