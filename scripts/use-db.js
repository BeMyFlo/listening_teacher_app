// Swap which MongoDB the local server points at, so `npm run dev` and
// `npm run dev:live` don't require hand-editing .env.local's MONGODB_URI
// every time. Reads the two known connection strings from .env.local
// (MONGODB_URI_DEV / MONGODB_URI_LIVE) and rewrites the active MONGODB_URI
// line to match. Run standalone to just check/switch without starting the
// server:  node scripts/use-db.js dev | live
const fs = require("fs");
const path = require("path");

const target = (process.argv[2] || "").trim().toLowerCase();
if (target !== "dev" && target !== "live") {
  console.error("Usage: node scripts/use-db.js <dev|live>");
  process.exit(1);
}

const envPath = path.join(__dirname, "..", ".env.local");
let text;
try {
  text = fs.readFileSync(envPath, "utf8");
} catch {
  console.error(".env.local not found at " + envPath);
  process.exit(1);
}

const varName = target === "live" ? "MONGODB_URI_LIVE" : "MONGODB_URI_DEV";
const m = text.match(new RegExp("^" + varName + "=(.*)$", "m"));
if (!m) {
  console.error(
    `Missing ${varName} in .env.local — add it once (same connection string as MONGODB_URI, just the ` +
      (target === "live" ? "live" : "dev") +
      " db name) and re-run."
  );
  process.exit(1);
}
const uri = m[1].trim();

if (!/^MONGODB_URI=/m.test(text)) {
  console.error("No MONGODB_URI= line found in .env.local to replace.");
  process.exit(1);
}
text = text.replace(/^MONGODB_URI=.*$/m, "MONGODB_URI=" + uri);
fs.writeFileSync(envPath, text);

const dbName = (uri.match(/\/([^/?]+)(\?|$)/) || [])[1] || "(unknown)";
console.log(`[use-db] MONGODB_URI now points at "${dbName}" (${target}).`);
if (target === "live") {
  console.log("[use-db] ⚠ LIVE database — real student/teacher data. Be careful with writes.");
}
