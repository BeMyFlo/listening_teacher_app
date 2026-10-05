// Chuyển phiên đăng nhập từ domain gốc sang <slug>.<base> (Phase 10B) theo mô hình
// "mã ủy quyền dùng một lần + state", cùng họ với đăng nhập bằng Google/Facebook.
//
// Chốt chặn bảo mật (mỗi cái có test riêng):
//  - mã 256 bit ngẫu nhiên, DB chỉ lưu bản băm, sống 60s, xoá nguyên tử khi dùng (dùng 1 lần,
//    và bị "đốt" ngay lần trình ra đầu tiên dù các kiểm tra sau có hỏng);
//  - gắn với đúng (userId, workspaceId, state); đổi mã chỉ hợp lệ trên đúng subdomain;
//  - địa chỉ đích do SERVER tính từ workspace của tài khoản, không nhận từ client;
//  - state do trình duyệt ở subdomain sinh và giữ trong sessionStorage — chặn kẻ xấu nhét
//    mã của CHÍNH HỌ vào trình duyệt nạn nhân (login CSRF);
//  - mã đi trong phần sau dấu # (không vào log máy chủ, không vào Referer).
const crypto = require("crypto");
const HandoffCode = require("./models/HandoffCode");

const CODE_TTL_MS = 60 * 1000;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/; // 32 byte base64url

const sha256 = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

function safeEqualHex(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function issueCode({ userId, role, workspaceId, state }) {
  const code = crypto.randomBytes(32).toString("base64url");
  await HandoffCode.create({
    codeHash: sha256(code),
    stateHash: sha256(state),
    userId,
    role,
    workspaceId,
    expiresAt: new Date(Date.now() + CODE_TTL_MS),
  });
  return code;
}

// Xoá-và-trả-về nguyên tử: hai request song song cùng mã thì chỉ một cái nhận được bản ghi.
async function consumeCode(code) {
  return HandoffCode.findOneAndDelete({ codeHash: sha256(code) }).lean();
}

module.exports = { TOKEN_RE, CODE_TTL_MS, sha256, safeEqualHex, issueCode, consumeCode };
