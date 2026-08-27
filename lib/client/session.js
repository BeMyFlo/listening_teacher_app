// Quản lý token đăng nhập phía client.
// Giữ nguyên key ("teacherToken" / "studentToken") giống bản legacy để
// trong giai đoạn migrate, đăng nhập ở app mới vẫn dùng được ở /legacy.
import { decodeJwt, isExpired } from "./jwt";

const TEACHER_KEY = "teacherToken";
const STUDENT_KEY = "studentToken";

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

export function getStudentToken() {
  if (!hasWindow()) return null;
  return localStorage.getItem(STUDENT_KEY);
}

export function setStudentToken(token) {
  if (!hasWindow()) return;
  localStorage.setItem(STUDENT_KEY, token);
}

export function clearSession() {
  if (!hasWindow()) return;
  [TEACHER_KEY, STUDENT_KEY].forEach((k) => {
    sessionStorage.removeItem(k);
    localStorage.removeItem(k);
  });
}

export function storeLoginResult(res, remember) {
  if (res.role === "teacher") setTeacherToken(res.token, remember);
  else if (res.role === "student") setStudentToken(res.token);
}

// Trả về { role, name, token } cho vai trò yêu cầu, hoặc null nếu chưa
// đăng nhập / token hỏng / hết hạn.
export function readSession(role) {
  const token = role === "teacher" ? getTeacherToken() : getStudentToken();
  if (!token) return null;
  const payload = decodeJwt(token);
  if (!payload.role || payload.role !== role || isExpired(payload)) return null;
  return { role, name: payload.name || "", token, payload };
}

// Vai trò nào đang đăng nhập (ưu tiên teacher). Dùng cho trang gốc "/".
export function currentRole() {
  if (readSession("teacher")) return "teacher";
  if (readSession("student")) return "student";
  return null;
}
