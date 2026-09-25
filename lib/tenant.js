// Tầng enforcement multi-tenant. Xem PLAN-MULTI-TENANT.md mục 5.1.
//
// Workspace của người đang đăng nhập LUÔN được giải ở server theo danh tính
// trong token, KHÔNG bao giờ lấy từ body/query của client, và KHÔNG nhét vào
// JWT. Lý do: token học sinh sống 30 ngày — nhét workspaceId vào token thì khi
// membership đổi, token cũ vẫn mang giá trị lỗi thời. Giải từ DB mỗi request
// thì token cũ vẫn chạy đúng (rủi ro R4 trong plan).
const { connectDB } = require("./db");
const Student = require("./models/Student");
const User = require("./models/User");
const WorkspaceMember = require("./models/WorkspaceMember");

// Cache trong RAM của từng container serverless. TTL ngắn: đổi membership
// chậm nhất 1 phút là có hiệu lực, đổi lại tiết kiệm 1 query mỗi request.
const TTL_MS = 60 * 1000;
const cache = new Map();

function cacheGet(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return hit.value;
}

function cacheSet(key, value) {
  // Trần thô để container chạy lâu không phình bộ nhớ.
  if (cache.size > 500) cache.clear();
  cache.set(key, { value, at: Date.now() });
  return value;
}

// Lỗi "không thấy" dùng chung. withTenant bắt lấy và trả 404.
class TenantNotFound extends Error {
  constructor(message) {
    super(message || "Not found");
    this.name = "TenantNotFound";
    this.statusCode = 404;
  }
}

// -> { workspaceId, role } | null
// null nghĩa là người này không thuộc workspace nào (admin platform, hoặc
// tài khoản hỏng). Route giáo viên/học sinh coi đó là 403.
async function currentWorkspace(auth) {
  if (!auth) return null;

  // Học sinh: workspace nằm thẳng trên hồ sơ. Không có WorkspaceMember cho
  // học sinh — bảng đó chỉ dành cho giáo viên (xem lib/models/WorkspaceMember.js).
  if (auth.role === "student") {
    if (!auth.studentId) return null;
    const key = "s:" + auth.studentId;
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;

    const student = await Student.findById(auth.studentId).select("workspaceId").lean();
    const ws = student && student.workspaceId
      ? { workspaceId: student.workspaceId, role: "student" }
      : null;
    return cacheSet(key, ws);
  }

  if (auth.role === "teacher") {
    const key = "t:" + (auth.userId || auth.teacherId || "");
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;

    // Token hiện tại luôn có userId (lib/auth.js signUserToken), nhưng token
    // cũ trong tay người dùng có thể chỉ có teacherId. Tra ngược cho chắc.
    let userId = auth.userId || null;
    if (!userId && auth.teacherId) {
      const user = await User.findOne({ teacherId: auth.teacherId }).select("_id").lean();
      userId = user ? user._id : null;
    }
    if (!userId) return cacheSet(key, null);

    const member = await WorkspaceMember.findOne({ userId }).select("workspaceId role").lean();
    const ws = member ? { workspaceId: member.workspaceId, role: member.role } : null;
    return cacheSet(key, ws);
  }

  // admin: tầng platform, không thuộc workspace nào.
  return null;
}

// Ghép workspace vào filter của mongoose. LUÔN dùng hàm này thay vì tự viết
// { workspaceId: ... } để scripts/check-tenant-scope.js nhận ra được.
function tenantFilter(ws, extra) {
  return Object.assign({}, extra || {}, { workspaceId: ws.workspaceId });
}

// Nạp 1 document và xác nhận nó thuộc workspace hiện tại.
// Không thuộc -> ném TenantNotFound -> 404 (KHÔNG PHẢI 403, xem mục 0.4).
async function assertOwned(ws, Model, id, options) {
  const opts = options || {};
  if (!id) throw new TenantNotFound(opts.message);
  let doc = null;
  try {
    const query = Model.findOne(tenantFilter(ws, { _id: id }));
    doc = opts.lean ? await query.lean() : await query;
  } catch (err) {
    // Chỉ id sai định dạng ObjectId mới là "không thấy" — CastError. Lỗi khác
    // (mất kết nối DB, timeout...) phải văng nguyên vẹn để framework trả 500,
    // không được nguỵ trang thành 404 khiến sự cố hạ tầng thật bị đọc nhầm
    // thành "tài nguyên không tồn tại" lúc xem log.
    if (err && err.name === "CastError") {
      throw new TenantNotFound(opts.message);
    }
    throw err;
  }
  if (!doc) throw new TenantNotFound(opts.message);
  return doc;
}

// Bọc handler: giải workspace, gắn req.ws, và biến TenantNotFound thành 404.
// Thứ tự bọc: requireAuth(withTenant(handler)) — xem mục 0.5 của
// PLAN-PHASE2-TENANT-READ.md.
function withTenant(handler) {
  return async (req, res) => {
    // currentWorkspace() queries the DB before the wrapped handler gets a
    // chance to call connectDB() itself, so it must connect first.
    // connectDB() is cached on `global` (lib/db.js) — calling it again from
    // inside the handler is a cheap no-op, not a second connection.
    await connectDB();
    const ws = await currentWorkspace(req.auth);
    if (!ws) {
      return res.status(403).json({ ok: false, error: "This account is not in a workspace" });
    }
    req.ws = ws;
    try {
      return await handler(req, res);
    } catch (err) {
      if (err && err.name === "TenantNotFound") {
        return res.status(404).json({ ok: false, error: err.message });
      }
      throw err;
    }
  };
}

module.exports = { currentWorkspace, tenantFilter, assertOwned, withTenant, TenantNotFound };
