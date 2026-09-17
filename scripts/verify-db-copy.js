// Đối chiếu 2 database sau khi chuyển (vd Atlas -> MongoDB tự cài trên VPS).
// CHỈ ĐỌC cả hai bên — không ghi gì. Chạy:
//   node scripts/verify-db-copy.js "<SOURCE_URI>" "<TARGET_URI>"
// So từng collection: số document, và các index (kể cả TTL tự xoá).
// Thoát với mã 1 nếu có chỗ lệch. Nên chạy lúc web đã tạm dừng — nếu bên
// nguồn vẫn đang có người ghi thì số document có thể lệch chút.
const { MongoClient } = require("mongodb");

const SOURCE = process.argv[2] || process.env.SOURCE_URI;
const TARGET = process.argv[3] || process.env.TARGET_URI;

if (!SOURCE || !TARGET) {
  console.error('Usage: node scripts/verify-db-copy.js "<SOURCE_URI>" "<TARGET_URI>"');
  process.exit(1);
}

function dbName(uri) {
  const m = uri.match(/\/([^/?]+)(\?|$)/);
  return m ? m[1] : "test";
}

// Chuỗi so sánh được của 1 index: khoá + các tuỳ chọn quan trọng.
function indexSig(ix) {
  const parts = [JSON.stringify(ix.key)];
  if (ix.unique) parts.push("unique");
  if (ix.sparse) parts.push("sparse");
  if (ix.expireAfterSeconds != null) parts.push(`ttl=${ix.expireAfterSeconds}s`);
  return parts.join(" ");
}

(async () => {
  const src = new MongoClient(SOURCE);
  const dst = new MongoClient(TARGET);
  await src.connect();
  await dst.connect();
  const sdb = src.db(dbName(SOURCE));
  const ddb = dst.db(dbName(TARGET));

  const names = (db) =>
    db.listCollections().toArray().then((cs) => cs.map((c) => c.name).filter((n) => !n.startsWith("system.")).sort());
  const [sNames, dNames] = await Promise.all([names(sdb), names(ddb)]);

  console.log(`Nguon: ${dbName(SOURCE)} (${sNames.length} collection)  ->  Dich: ${dbName(TARGET)} (${dNames.length} collection)\n`);
  let problems = 0;

  for (const name of sNames) {
    const [sc, dc, sIx, dIx] = await Promise.all([
      sdb.collection(name).countDocuments(),
      dNames.includes(name) ? ddb.collection(name).countDocuments() : Promise.resolve(null),
      sdb.collection(name).indexes(),
      dNames.includes(name) ? ddb.collection(name).indexes() : Promise.resolve([]),
    ]);
    const dSigs = new Set(dIx.map(indexSig));
    const missingIx = sIx.filter((ix) => !dSigs.has(indexSig(ix))).map(indexSig);

    const ok = dc === sc && missingIx.length === 0;
    if (!ok) problems++;
    const countTxt = dc == null ? "THIEU CA COLLECTION" : `${sc} -> ${dc}`;
    console.log(`${ok ? "OK  " : "LECH"} ${name.padEnd(24)} ${countTxt}${missingIx.length ? `  | thieu index: ${missingIx.join("; ")}` : ""}`);
  }

  const extra = dNames.filter((n) => !sNames.includes(n));
  if (extra.length) console.log(`\n(Dich co them collection khong co o nguon: ${extra.join(", ")})`);

  await src.close();
  await dst.close();
  console.log(problems ? `\n${problems} collection bi lech — KHONG chuyen web sang DB moi.` : "\nKhop hoan toan.");
  process.exit(problems ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
