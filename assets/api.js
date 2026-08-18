// ============================================================
//  FETCH WRAPPER CHO API BACKEND (Vercel serverless + MongoDB)
// ============================================================
const Api = (function () {
  const TOKEN_KEY = "teacherToken";
  const STUDENT_TOKEN_KEY = "studentToken";

  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY);
  }
  function setToken(token) {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
  }

  function getStudentToken() {
    return localStorage.getItem(STUDENT_TOKEN_KEY);
  }
  function setStudentToken(token) {
    localStorage.setItem(STUDENT_TOKEN_KEY, token);
  }
  function clearStudentToken() {
    localStorage.removeItem(STUDENT_TOKEN_KEY);
  }

  async function request(path, { method = "GET", body, auth = false, isForm = false } = {}) {
    const headers = {};
    if (auth) {
      const token = auth === "student" ? getStudentToken() : getToken();
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
    } catch (err) {
      throw new Error("Không kết nối được máy chủ. Kiểm tra lại mạng.");
    }

    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "Có lỗi xảy ra (" + res.status + ")");
    }
    return data;
  }

  return {
    getToken,
    setToken,
    clearToken,
    getStudentToken,
    setStudentToken,
    clearStudentToken,

    login: (password) => request("/api/auth/login", { method: "POST", body: { password } }),
    studentRegister: (data) => request("/api/auth/student?action=register", { method: "POST", body: data }),
    studentLogin: (data) => request("/api/auth/student?action=login", { method: "POST", body: data }),

    listTests: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request("/api/tests" + (qs ? "?" + qs : ""));
    },
    getTest: (id) => request("/api/tests?id=" + id),
    submit: (payload) => request("/api/submissions", { method: "POST", body: payload, auth: "student" }),

    admin: {
      listAudio: () => request("/api/admin/audio", { auth: "teacher" }),
      uploadAudio: (formData) => request("/api/admin/audio", { method: "POST", body: formData, auth: "teacher", isForm: true }),
      renameAudio: (id, data) => request("/api/admin/audio?id=" + id, { method: "PUT", body: data, auth: "teacher" }),
      deleteAudio: (id) => request("/api/admin/audio?id=" + id, { method: "DELETE", auth: "teacher" }),

      listImages: () => request("/api/admin/images", { auth: "teacher" }),
      uploadImage: (formData) => request("/api/admin/images", { method: "POST", body: formData, auth: "teacher", isForm: true }),
      deleteImage: (id) => request("/api/admin/images?id=" + id, { method: "DELETE", auth: "teacher" }),

      listStudents: () => request("/api/admin/students", { auth: "teacher" }),
      deleteStudent: (id) => request("/api/admin/students?id=" + id, { method: "DELETE", auth: "teacher" }),
      resetStudentPassword: (id, password) => request("/api/admin/students?id=" + id, { method: "PUT", body: { password }, auth: "teacher" }),

      listTests: () => request("/api/admin/tests", { auth: "teacher" }),
      getTest: (id) => request("/api/admin/tests?id=" + id, { auth: "teacher" }),
      createTest: (data) => request("/api/admin/tests", { method: "POST", body: data, auth: "teacher" }),
      updateTest: (id, data) => request("/api/admin/tests?id=" + id, { method: "PUT", body: data, auth: "teacher" }),
      deleteTest: (id) => request("/api/admin/tests?id=" + id, { method: "DELETE", auth: "teacher" }),

      listSubmissions: (params) => {
        const qs = new URLSearchParams(params || {}).toString();
        return request("/api/admin/submissions" + (qs ? "?" + qs : ""), { auth: "teacher" });
      },
      dashboard: () => request("/api/admin/dashboard", { auth: "teacher" })
    }
  };
})();
