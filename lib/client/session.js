// Quản lý token đăng nhập phía client.
// Giữ nguyên key ("teacherToken" / "studentToken") giống bản legacy để
// trong giai đoạn migrate, đăng nhập ở app mới vẫn dùng được ở /legacy.
import { decodeJwt, isExpired } from "./jwt";

const TEACHER_KEY = "teacherToken";
const STUDENT_KEY = "studentToken";
const ADMIN_KEY = "adminToken";

const hasWindow = () => typeof window !== "undefined";

export function getTeacherToken() {
  if (!hasWindow()) return null;
  return sessionStorage.getItem(TEACHER_KEY) || localStorage.getItem(TEACHER_KEY);
}

export function setTeacherToken(token, remember) {
  if (!hasWindow()) return;
  if (remember) {
    localStorage.setItem(TEACHER_KEY, token);
    sessionStorage.removeItem(TEACHER_KEY);
  } else {
    sessionStorage.setItem(TEACHER_KEY, token);
    localStorage.removeItem(TEACHER_KEY);
  }
}

export function clearTeacherToken() {
  if (!hasWindow()) return;
  sessionStorage.removeItem(TEACHER_KEY);
  localStorage.removeItem(TEACHER_KEY);
}

export function getStudentToken() {
  if (!hasWindow()) return null;
  return localStorage.getItem(STUDENT_KEY);
}

export function setStudentToken(token) {
  if (!hasWindow()) return;
  localStorage.setItem(STUDENT_KEY, token);
}

export function getAdminToken() {
  if (!hasWindow()) return null;
  return sessionStorage.getItem(ADMIN_KEY) || localStorage.getItem(ADMIN_KEY);
}

export function setAdminToken(token, remember) {
  if (!hasWindow()) return;
  if (remember) {
    localStorage.setItem(ADMIN_KEY, token);
    sessionStorage.removeItem(ADMIN_KEY);
  } else {
    sessionStorage.setItem(ADMIN_KEY, token);
    localStorage.removeItem(ADMIN_KEY);
  }
}

export function clearSession() {
  if (!hasWindow()) return;
  [TEACHER_KEY, STUDENT_KEY, ADMIN_KEY].forEach((k) => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });
  localStorage.removeItem("impersonating");
}

export function storeLoginResult(res, remember) {
  if (res.role === "admin") setAdminToken(res.token, remember);
  else if (res.role === "teacher") setTeacherToken(res.token, remember);
  else if (res.role === "student") setStudentToken(res.token);
}

const TOKEN_GETTERS = { admin: getAdminToken, teacher: getTeacherToken, student: getStudentToken };

// Trả về { role, name, token, payload } cho vai trò yêu cầu, hoặc null nếu chưa
// đăng nhập / token hỏng / hết hạn.
export function readSession(role) {
  const getter = TOKEN_GETTERS[role] || getStudentToken;
  const token = getter();
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload.role || payload.role !== role || isExpired(payload)) return null;
  return { role, name: payload.name || "", token, payload };
}

// Vai trò nào đang đăng nhập (ưu tiên admin -> teacher -> student).
export function currentRole() {
  if (readSession("admin")) return "admin";
  if (readSession("teacher")) return "teacher";
  if (readSession("student")) return "student";
  return null;
}
