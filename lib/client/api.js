// Fetch wrapper cho API backend (Next pages/api). Port từ
// public/legacy/assets/api.js, gọn lại cho app mới.
import { getTeacherToken, getStudentToken } from "./session";

// Upload thẳng lên Cloudinary (không qua server) — dùng cho ghi âm
// Speaking. Preset phải là loại "Unsigned" trong Cloudinary dashboard.
const CLOUDINARY_CLOUD_NAME = "oqczcg2z";
const CLOUDINARY_UNSIGNED_PRESET = "ielts_speaking_unsigned";

async function request(path, { method = "GET", body, auth = false, isForm = false } = {}) {
  const headers = {};
  if (auth) {
    const token = auth === "student" ? getStudentToken() : getTeacherToken();
    if (token) headers["Authorization"] = "Bearer " + token;
  }
  let payload = body;
  if (body && !isForm) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(path, { method, headers, body: payload });
  } catch {
    throw new Error("Could not reach the server. Please check your connection.");
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok || data.ok === false) {
    const err = new Error(data.error || "Something went wrong (" + res.status + ")");
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  login: (username, password) =>
    request("/api/auth", { method: "POST", body: { username, password } }),

  student: {
    listUnits: () => request("/api/units", { auth: "student" }),
    getUnit: (id) => request("/api/units?id=" + id, { auth: "student" }),
    listTests: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request("/api/tests" + (qs ? "?" + qs : ""), { auth: "student" });
    },
    getTest: (id) => request("/api/tests?id=" + id, { auth: "student" }),
    mySubmissions: () => request("/api/submissions", { auth: "student" }),
    dashboard: () => request("/api/student/dashboard", { auth: "student" }),
    submit: (p) => request("/api/submissions", { method: "POST", body: p, auth: "student" }),
    saveReflection: (submissionId, body) =>
      request("/api/submissions/reflection?id=" + submissionId, { method: "PATCH", body, auth: "student" }),

    notifications: () => request("/api/notifications", { auth: "student" }),
    markNotifications: (body) =>
      request("/api/notifications", { method: "PUT", body, auth: "student" }),
    async uploadSpeakingAudio(blob) {
      const fd = new FormData();
      fd.append("file", blob);
      fd.append("upload_preset", CLOUDINARY_UNSIGNED_PRESET);
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/video/upload",
        { method: "POST", body: fd }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.secure_url) {
        throw new Error(
          (data.error && data.error.message) || "Failed to upload the recording to Cloudinary"
        );
      }
      return { audioUrl: data.secure_url, audioPublicId: data.public_id };
    },
  },

  teacher: {
    dashboard: () => request("/api/admin/dashboard", { auth: "teacher" }),

    notifications: () => request("/api/teacher/notifications", { auth: "teacher" }),
    markNotifications: (body) =>
      request("/api/teacher/notifications", { method: "PUT", body, auth: "teacher" }),

    listTeachers: () => request("/api/admin/teachers", { auth: "teacher" }),
    updateTeacher: (id, d) =>
      request("/api/admin/teachers?id=" + id, { method: "PUT", body: d, auth: "teacher" }),

    aiSettings: () => request("/api/admin/ai-settings", { auth: "teacher" }),
    saveAiSettings: (models) =>
      request("/api/admin/ai-settings", { method: "PUT", body: { models }, auth: "teacher" }),

    listUnits: () => request("/api/admin/units", { auth: "teacher" }),
    getUnit: (id) => request("/api/admin/units?id=" + id, { auth: "teacher" }),
    createUnit: (d) => request("/api/admin/units", { method: "POST", body: d, auth: "teacher" }),
    updateUnit: (id, d) => request("/api/admin/units?id=" + id, { method: "PUT", body: d, auth: "teacher" }),
    deleteUnit: (id) => request("/api/admin/units?id=" + id, { method: "DELETE", auth: "teacher" }),

    // Job gửi thông báo "vừa có hạn nộp" (chạy ngầm).
    deadlineJobs: (unitId) =>
      request("/api/admin/deadline-jobs?unitId=" + unitId, { auth: "teacher" }),
    runDeadlineJobs: (ids) =>
      request("/api/admin/deadline-jobs/run", { method: "POST", body: { ids }, auth: "teacher" }),

    listTests: () => request("/api/admin/tests", { auth: "teacher" }),
    getTest: (id) => request("/api/admin/tests?id=" + id, { auth: "teacher" }),
    createTest: (d) => request("/api/admin/tests", { method: "POST", body: d, auth: "teacher" }),
    updateTest: (id, d) => request("/api/admin/tests?id=" + id, { method: "PUT", body: d, auth: "teacher" }),
    deleteTest: (id) => request("/api/admin/tests?id=" + id, { method: "DELETE", auth: "teacher" }),

    listAudio: () => request("/api/admin/audio", { auth: "teacher" }),
    createAudio: (d) => request("/api/admin/audio", { method: "POST", body: d, auth: "teacher" }),
    deleteAudio: (id) => request("/api/admin/audio?id=" + id, { method: "DELETE", auth: "teacher" }),

    listImages: () => request("/api/admin/images", { auth: "teacher" }),
    createImage: (d) => request("/api/admin/images", { method: "POST", body: d, auth: "teacher" }),
    deleteImage: (id) => request("/api/admin/images?id=" + id, { method: "DELETE", auth: "teacher" }),

    listClasses: () => request("/api/admin/classes", { auth: "teacher" }),
    getClass: (id) => request("/api/admin/classes?id=" + id, { auth: "teacher" }),
    createClass: (d) => request("/api/admin/classes", { method: "POST", body: d, auth: "teacher" }),
    updateClass: (id, d) => request("/api/admin/classes?id=" + id, { method: "PUT", body: d, auth: "teacher" }),
    deleteClass: (id) => request("/api/admin/classes?id=" + id, { method: "DELETE", auth: "teacher" }),

    // Điểm danh
    listAttendance: (classId) => request("/api/admin/attendance?classId=" + classId, { auth: "teacher" }),
    getAttendanceSession: (id) => request("/api/admin/attendance?id=" + id, { auth: "teacher" }),
    createAttendanceSession: (d) =>
      request("/api/admin/attendance", { method: "POST", body: d, auth: "teacher" }),
    updateAttendanceSession: (id, d) =>
      request("/api/admin/attendance?id=" + id, { method: "PUT", body: d, auth: "teacher" }),
    deleteAttendanceSession: (id) =>
      request("/api/admin/attendance?id=" + id, { method: "DELETE", auth: "teacher" }),

    listStudents: () => request("/api/admin/students", { auth: "teacher" }),
    createStudent: (d) => request("/api/admin/students", { method: "POST", body: d, auth: "teacher" }),
    resetStudentPassword: (id, password) =>
      request("/api/admin/students?id=" + id, { method: "PUT", body: { password }, auth: "teacher" }),
    updateStudent: (id, d) => request("/api/admin/students?id=" + id, { method: "PUT", body: d, auth: "teacher" }),
    deleteStudent: (id) => request("/api/admin/students?id=" + id, { method: "DELETE", auth: "teacher" }),

    listSubmissions: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request("/api/admin/submissions" + (qs ? "?" + qs : ""), { auth: "teacher" });
    },
    gradeSubmission: (id, d) =>
      request("/api/admin/submissions?id=" + id, { method: "PUT", body: d, auth: "teacher" }),
    aiGradeSubmission: (id) =>
      request("/api/admin/submissions/ai-grade?id=" + id, { method: "POST", auth: "teacher" }),
    gradingJob: (jobId) =>
      request("/api/admin/grading-jobs?id=" + jobId, { auth: "teacher" }),
    gradingJobFor: (submissionId) =>
      request("/api/admin/grading-jobs?submissionId=" + submissionId, { auth: "teacher" }),

    // Per-unit submission views. studentId omitted -> per-student overview;
    // studentId given -> full 6-category breakdown for that student.
    unitSubmissions: (unitId, studentId) => {
      const qs = new URLSearchParams(
        studentId ? { unitId, studentId } : { unitId }
      ).toString();
      return request("/api/admin/unit-submissions?" + qs, { auth: "teacher" });
    },

    importQuestions: (formData) =>
      request("/api/admin/import", { method: "POST", body: formData, auth: "teacher", isForm: true }),
  },
};

// Upload thẳng lên Cloudinary từ trình duyệt (ảnh / audio thư viện giáo
// viên) — tránh giới hạn body ~4.5MB của Vercel Serverless Functions.
export async function uploadToCloudinary(file, { resourceType, folder }) {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("upload_preset", CLOUDINARY_UNSIGNED_PRESET);
  if (folder) fd.append("folder", folder);
  const res = await fetch(
    "https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/" + resourceType + "/upload",
    { method: "POST", body: fd }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.secure_url) {
    throw new Error((data.error && data.error.message) || "Upload to Cloudinary failed");
  }
  return { cloudinaryUrl: data.secure_url, cloudinaryPublicId: data.public_id };
}

export { request };
