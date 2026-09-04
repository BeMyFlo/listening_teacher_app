const jwt = require("jsonwebtoken");
const audit = require("./audit");

const AUDIT_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET environment variable");
  return secret;
}

function signToken(payload, expiresIn) {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn || "12h" });
}

function signTeacherToken(teacher) {
  return signToken({ role: "teacher", teacherId: String(teacher._id), name: teacher.name });
}

// Student tokens live longer — this is a real account, not a login session.
function signStudentToken(student) {
  return signToken({ role: "student", studentId: String(student._id), name: student.name }, "30d");
}

// Token cho danh tính User (bảng User). Giữ teacherId/studentId trong payload
// để MỌI handler cũ (req.auth.teacherId / req.auth.studentId) chạy y nguyên.
//   opts.impBy   -> userId của admin đang "đăng nhập hộ" (impersonation)
//   opts.expiresIn-> ghi đè hạn token (mặc định: 30d cho student, 12h còn lại)
function signUserToken(user, profile, opts = {}) {
  const payload = {
    role: user.role,
    userId: String(user._id),
    name: (profile && profile.name) || user.name || "",
  };
  if (user.teacherId) payload.teacherId = String(user.teacherId);
  if (user.studentId) payload.studentId = String(user.studentId);
  if (opts.impBy) payload.impBy = String(opts.impBy);
  const exp = opts.expiresIn || (user.role === "student" ? "30d" : "12h");
  return signToken(payload, exp);
}

function getTokenFromRequest(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  return null;
}

// Wraps an API handler so it 401/403s unless a valid JWT with the given
// role is present. Attaches the decoded payload as req.auth.
function requireRole(role) {
  return function (handler) {
    return async (req, res) => {
      const token = getTokenFromRequest(req);
      if (!token) {
        return res.status(401).json({ ok: false, error: "Not logged in" });
      }
      let decoded;
      try {
        decoded = jwt.verify(token, getSecret());
      } catch (err) {
        return res.status(401).json({ ok: false, error: "Session expired, please sign in again" });
      }
      if (decoded.role !== role) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
      req.auth = decoded;
      try {
        return await handler(req, res);
      } finally {
        // Ghi nhật ký MỌI thao tác thay đổi (không GET). Bắn rồi quên.
        if (AUDIT_METHODS.has(req.method)) audit.record({ req, res });
      }
    };
  };
}

const requireAuth = requireRole("teacher");
const requireTeacher = requireAuth;
const requireStudent = requireRole("student");

module.exports = { signToken, signTeacherToken, signStudentToken, signUserToken, requireRole, requireAuth, requireTeacher, requireStudent };
