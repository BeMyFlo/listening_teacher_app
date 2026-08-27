// ============================================================
//  FETCH WRAPPER CHO API BACKEND (Vercel serverless + MongoDB)
// ============================================================
// Cloudinary unsigned upload — dùng cho ghi âm Speaking (Phase 3) và cả
// audio/ảnh trong thư viện giáo viên (audio.js/images.js không còn nhận
// file thẳng qua server nữa). Lý do: Vercel Serverless Functions giới hạn
// cứng request body ~4.5MB (hạ tầng AWS Lambda, không tăng được dù trả phí)
// — file nghe thật thường vượt mức này. Upload thẳng từ trình duyệt lên
// Cloudinary thì không đi qua giới hạn đó. Preset phải được tạo loại
// "Unsigned" trong Cloudinary dashboard (đã hướng dẫn tạo cho Speaking ở
// Phase 3 — dùng lại đúng preset đó, không cần tạo thêm).
const CLOUDINARY_CLOUD_NAME = "oqczcg2z";
const CLOUDINARY_UNSIGNED_PRESET = "ielts_speaking_unsigned";

const Api = (function () {
  const TOKEN_KEY = "teacherToken";
  const STUDENT_TOKEN_KEY = "studentToken";

  // Mặc định lưu token giáo viên ở sessionStorage (mất khi đóng trình
  // duyệt). Nếu bật "Remember me" ở màn đăng nhập, lưu ở localStorage thay
  // vào đó để phiên đăng nhập sống sót qua việc đóng/mở lại trình duyệt
  // (token vẫn hết hạn theo JWT 12h như thường, chỉ khác nơi lưu).
  function getToken() {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  }
  function setToken(token, remember) {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
  }
  function clearToken() {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
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
      throw new Error("Unable to connect to server. Please check your network connection.");
    }

    let data = {};
    try {
      data = await res.json();
    } catch (err) {
      data = {};
    }

    if (!res.ok || data.ok === false) {
      throw new Error(data.error || "An error occurred (" + res.status + ")");
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

    login: (username, password) => request("/api/auth", { method: "POST", body: { username, password } }),

    listTests: (params) => {
      const qs = new URLSearchParams(params || {}).toString();
      return request("/api/tests" + (qs ? "?" + qs : ""), { auth: "student" });
    },
    getTest: (id) => request("/api/tests?id=" + id, { auth: "student" }),
    submit: (payload) => request("/api/submissions", { method: "POST", body: payload, auth: "student" }),
    mySubmissions: () => request("/api/submissions", { auth: "student" }),

    listUnits: () => request("/api/units", { auth: "student" }),
    getUnit: (id) => request("/api/units?id=" + id, { auth: "student" }),

    // Upload speaking recording blob to Cloudinary
    uploadSpeakingAudio: async (blob) => {
      const fd = new FormData();
      fd.append("file", blob);
      fd.append("upload_preset", CLOUDINARY_UNSIGNED_PRESET);
      const res = await fetch(
        "https://api.cloudinary.com/v1_1/" + CLOUDINARY_CLOUD_NAME + "/video/upload",
        { method: "POST", body: fd }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.secure_url) {
        throw new Error(data.error && data.error.message ? data.error.message : "Failed to upload audio recording to Cloudinary");
      }
      return { audioUrl: data.secure_url, audioPublicId: data.public_id };
    },

    // Upload thẳng lên Cloudinary từ trình duyệt (không qua server) — dùng
    // cho thư viện Audio/Image của giáo viên, tránh giới hạn body ~4.5MB
    // của Vercel Serverless Functions.
    uploadToCloudinary: async (file, { resourceType, folder }) => {
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
        throw new Error(data.error && data.error.message ? data.error.message : "Upload to Cloudinary failed");
      }
      return { cloudinaryUrl: data.secure_url, cloudinaryPublicId: data.public_id };
    },

    admin: {
      listAudio: () => request("/api/admin/audio", { auth: "teacher" }),
      // data: { title, unit, cloudinaryUrl, cloudinaryPublicId } — file đã
      // được upload thẳng lên Cloudinary từ trình duyệt trước đó (xem
      // Api.uploadToCloudinary), đây chỉ tạo bản ghi DB.
      uploadAudio: (data) => request("/api/admin/audio", { method: "POST", body: data, auth: "teacher" }),
      renameAudio: (id, data) => request("/api/admin/audio?id=" + id, { method: "PUT", body: data, auth: "teacher" }),
      deleteAudio: (id) => request("/api/admin/audio?id=" + id, { method: "DELETE", auth: "teacher" }),

      listImages: () => request("/api/admin/images", { auth: "teacher" }),
      uploadImage: (data) => request("/api/admin/images", { method: "POST", body: data, auth: "teacher" }),
      deleteImage: (id) => request("/api/admin/images?id=" + id, { method: "DELETE", auth: "teacher" }),

      listStudents: () => request("/api/admin/students", { auth: "teacher" }),
      createStudent: (data) => request("/api/admin/students", { method: "POST", body: data, auth: "teacher" }),
      updateStudent: (id, data) => request("/api/admin/students?id=" + id, { method: "PUT", body: data, auth: "teacher" }),
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
      gradeSubmission: (id, data) => request("/api/admin/submissions?id=" + id, { method: "PUT", body: data, auth: "teacher" }),

      listUnits: () => request("/api/admin/units", { auth: "teacher" }),
      getUnit: (id) => request("/api/admin/units?id=" + id, { auth: "teacher" }),
      createUnit: (data) => request("/api/admin/units", { method: "POST", body: data, auth: "teacher" }),
      updateUnit: (id, data) => request("/api/admin/units?id=" + id, { method: "PUT", body: data, auth: "teacher" }),
      deleteUnit: (id) => request("/api/admin/units?id=" + id, { method: "DELETE", auth: "teacher" }),

      dashboard: () => request("/api/admin/dashboard", { auth: "teacher" }),

      importQuestions: (formData) => request("/api/admin/import", { method: "POST", body: formData, auth: "teacher", isForm: true })
    }
  };
})();
