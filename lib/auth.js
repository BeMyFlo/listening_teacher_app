const jwt = require("jsonwebtoken");

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET environment variable");
  return secret;
}

function signToken(payload, expiresIn) {
  return jwt.sign(payload, getSecret(), { expiresIn: expiresIn || "12h" });
}

function signTeacherToken() {
  return signToken({ role: "teacher" });
}

// Student tokens live longer — this is a real account, not a login session.
function signStudentToken(student) {
  return signToken({ role: "student", studentId: String(student._id), name: student.name }, "30d");
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
        return res.status(401).json({ ok: false, error: "Chưa đăng nhập" });
      }
      let decoded;
      try {
        decoded = jwt.verify(token, getSecret());
      } catch (err) {
        return res.status(401).json({ ok: false, error: "Phiên đăng nhập hết hạn, vui lòng đăng nhập lại" });
      }
      if (decoded.role !== role) {
        return res.status(403).json({ ok: false, error: "Không có quyền truy cập" });
      }
      req.auth = decoded;
      return handler(req, res);
    };
  };
}

const requireAuth = requireRole("teacher");
const requireStudent = requireRole("student");

module.exports = { signToken, signTeacherToken, signStudentToken, requireRole, requireAuth, requireStudent };
