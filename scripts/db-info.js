// Xem nhanh số liệu 1 database.  node scripts/db-info.js "<MONGODB_URI>"
const { MongoClient } = require("mongodb");

const uri = process.argv[2] || process.env.MONGODB_URI;
if (!uri) { console.error("Usage: node scripts/db-info.js <MONGODB_URI>"); process.exit(1); }

function dbName(u) { const m = u.match(/\/([^/?]+)(\?|$)/); return m ? m[1] : "test"; }

(async () => {
  const c = new MongoClient(uri);
  await c.connect();
  const db = c.db(dbName(uri));
  console.log("DB:", dbName(uri));
  const cols = (await db.listCollections().toArray()).map((x) => x.name).sort();
  for (const name of cols) {
    console.log(`  ${name}: ${await db.collection(name).countDocuments()}`);
  }
  const byRole = await db.collection("users").aggregate([{ $group: { _id: "$role", n: { $sum: 1 } } }]).toArray();
  console.log("users by role:", JSON.stringify(byRole));
  const sample = await db.collection("users").find({}).limit(5).project({ username: 1, role: 1, name: 1 }).toArray();
  console.log("first users:", JSON.stringify(sample, null, 1));
  await c.close();
  process.exit(0);
})().catch((e) => { console.error(e.message); process.exit(1); });
