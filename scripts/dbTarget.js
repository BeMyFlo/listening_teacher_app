// Chọn database cho các script chạy tay.
//
// KHÔNG có giá trị mặc định: bắt buộc nói rõ `--live`, `--dev`, hoặc đưa thẳng
// URI. Lý do: `scripts/use-db.js` ghi đè `MONGODB_URI` trong .env.local mỗi lần
// đổi qua lại, nên đọc biến đó ra là không biết đang trỏ vào đâu. Với đợt
// migration multi-tenant (PLAN-MULTI-TENANT.md) thì chạy nhầm DB là rủi ro lớn
// nhất — thà bắt gõ thêm một chữ.
const fs = require("fs");
const path = require("path");

const ENV_PATH = path.join(__dirname, "..", ".env.local");

function readEnv(name) {
  let text;
  try {
    text = fs.readFileSync(ENV_PATH, "utf8");
  } catch {
    return null;
  }
  const m = text.match(new RegExp("^" + name + "=(.*)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : null;
}

// Tên database nằm trong URI, sau dấu / cuối cùng.
function dbName(uri) {
  const m = String(uri).match(/\/([^/?]+)(\?|$)/);
  return m ? m[1] : "test";
}

// Che user/password khi in ra màn hình hoặc ghi vào file.
function redact(uri) {
  return String(uri).replace(/\/\/[^@/]*@/, "//<credentials>@");
}

// argv: process.argv.slice(2). Trả { uri, flag, name } hoặc thoát với hướng dẫn.
function resolveTarget(argv, usage) {
  const wantsLive = argv.includes("--live");
  const wantsDev = argv.includes("--dev");
  const explicit = argv.find((a) => /^mongodb(\+srv)?:\/\//.test(a));

  const picked = [wantsLive, wantsDev, Boolean(explicit)].filter(Boolean).length;
  if (picked !== 1) {
    console.error(
      (picked === 0 ? "Chưa chọn database." : "Chọn nhiều hơn một database.") +
        "\n\n" + usage +
        "\n\n  --live   MONGODB_URI_LIVE trong .env.local  (dữ liệu học sinh thật)" +
        "\n  --dev    MONGODB_URI_DEV  trong .env.local" +
        "\n  <URI>    đưa thẳng connection string"
    );
    process.exit(1);
  }

  const flag = explicit ? "explicit" : wantsLive ? "live" : "dev";
  const uri = explicit || readEnv(wantsLive ? "MONGODB_URI_LIVE" : "MONGODB_URI_DEV");
  if (!uri) {
    console.error(
      `Thiếu MONGODB_URI_${wantsLive ? "LIVE" : "DEV"} trong ${ENV_PATH}.\n` +
        "Thêm dòng đó rồi chạy lại, hoặc đưa thẳng URI làm tham số."
    );
    process.exit(1);
  }

  const name = dbName(uri);
  console.log(`DB: ${name}  (${flag})  ${redact(uri)}`);
  if (flag === "live") console.log("⚠  LIVE — dữ liệu giáo viên/học sinh thật.\n");
  else console.log("");

  return { uri, flag, name };
}

module.exports = { resolveTarget, dbName, redact };
