// Sao chép toàn bộ database từ SOURCE -> TARGET (để test local với data thật).
// KHÔNG bao giờ ghi ngược vào source. Chạy:
//   node scripts/clone-db.js "<SOURCE_URI>" "<TARGET_URI>"
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
