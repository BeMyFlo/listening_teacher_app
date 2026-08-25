# Spec tái cấu trúc "IELTS with Ms Nhi" → Dashboard chuyên nghiệp

> Tài liệu này viết cho một AI coding agent khác (không có lịch sử hội thoại này) đọc và code lại đúng. Đọc hết file này + `HANDOFF.md` trước khi code bất cứ dòng nào. Không tự ý đổi kiến trúc/quyết định đã chốt ở đây trừ khi thấy mâu thuẫn với code thật — nếu vậy, dừng lại và hỏi người dùng thay vì tự suy diễn.

## 0. Bối cảnh & nguyên tắc bắt buộc

Web app cho 1 giáo viên tiếng Anh (IELTS) quản lý học viên + nội dung học. Stack: **static HTML/CSS/JS** (không build step, không framework) + **Vercel Serverless Functions** (`/api/**/*.js`, CommonJS `module.exports = async (req,res)=>{...}`) + **MongoDB Atlas** (Mongoose) + **Cloudinary** (audio/ảnh). Chạy local bằng `npm run dev:local` (Express shim `server.js`, tự map `/api/x/y.js` → route `/api/x/y`, và `/api/x/[id].js` → route `/api/x/:id`) hoặc `vercel dev`.

**Nguyên tắc 1 — Vercel Hobby giới hạn 12 serverless functions/deployment.** Mỗi file `.js` trong `/api/**` = 1 function. Hiện tại đã dùng **10/12**:
```
api/admin/audio.js
api/admin/dashboard.js
api/admin/images.js
api/admin/students.js
api/admin/submissions.js
api/admin/tests.js
api/auth/login.js
api/auth/student.js
api/submissions.js
api/tests.js
```
Một commit trước đây (`Consolidate API routes to fit Vercel Hobby's 12-function limit`) đã cố ý gộp CRUD list+detail thành 1 file/resource, dispatch theo `req.method` + `req.query.id` (xem `api/admin/tests.js`, `api/admin/students.js` để thấy pattern). **TUYỆT ĐỐI không tạo file API mới nếu có thể gộp vào file đã có.** Spec dưới đây đã tính toán để cuối cùng chỉ dùng tối đa 11/12, còn dư đúng 1 slot — đừng phá vỡ con số này.

**Nguyên tắc 2 — Tái dùng engine câu hỏi generic đã có, không tạo schema riêng cho từng dạng bài IELTS.** Xem `HANDOFF.md` mục "Quyết định thiết kế cốt lõi". Engine hiện tại (field `type: 'fill'|'choice'` + `selectCount` + `matchOptions` ở section) đã giải quyết được: điền từ, trắc nghiệm 1 đáp án, trắc nghiệm nhiều đáp án ("chọn HAI đáp án"), True/False/Not Given, các dạng ghép nối (matching headings/features/information/sentence-endings), điền nhãn sơ đồ/bản đồ (diagram/map labelling). Grammar/Vocabulary/Listening/Reading trong module Bài học sẽ **tái dùng y nguyên** engine này (xem §3.3). Writing/Speaking KHÔNG dùng engine này — đó là dạng nộp bài tự luận/ghi âm, giáo viên chấm tay.

**Nguyên tắc 3 — Code hiện có phải tái dùng, không viết lại:**
- `lib/grade.js` (`gradeSubmission`, `isCorrect`, `normalizeSet`) — chấm điểm tự động, chỉ đọc `{sections:[{fields:[...]}]}` một cách generic. Dùng lại y nguyên cho cả Test và Exercise trong Lesson.
- `lib/testSections.js` (`normalizeSections`, `validateSections`, `sectionMediaError`) — chuẩn hoá/validate section trước khi lưu DB. Dùng lại y nguyên.
- `lib/auth.js` (`requireRole`, `requireAuth`, `requireStudent`, `signToken`) — middleware JWT. Mở rộng thêm hàm, không viết middleware mới song song.
- `assets/api.js` (`Api.request()` fetch wrapper, token storage) — mọi API call mới đều đi qua đây, thêm hàm chứ không tạo file fetch khác.
- `assets/teacher.js` phần builder section/field (~ nơi render `.field-row`, dropdown `type=fill|choice`, ô `selectCount`, textarea `matchOptions`, nút chèn nhanh True/False/Not Given) — tách thành hàm dùng chung, gọi lại cho builder bài tập trong Lesson thay vì viết lại UI.
- `assets/icons.js` — sprite SVG `<symbol id="icon-...">` có sẵn, thêm icon mới vào đây theo đúng pattern, không thêm icon-library ngoài.

**Nguyên tắc 4 — Không có test framework.** Verify bằng chạy thật qua trình duyệt (`npm run dev:local`), theo checklist verify cuối mỗi phase.

**Nguyên tắc 5 — Làm theo đúng 4 phase dưới đây, tuần tự.** Mỗi phase phải kết thúc ở trạng thái chạy được, verify được trước khi sang phase sau. Không nhảy cóc, không gộp phase để "làm nhanh hơn".

---

## 1. Kiểm kê codebase hiện tại (đọc kỹ trước khi đổi)

```
index.html              — trang chủ, hiện là "chọn vai trò" (2 choice-card: Học sinh -> /student, Giáo viên -> /teacher)
teacher.html             — shell HTML dashboard giáo viên (239 dòng), có màn login nhúng (#step-login) + #step-dashboard với .tab-btn/.tab-panel
student.html             — shell HTML học sinh (130 dòng), có #step-auth (login/register 2 tab), #step-subject, #step-picker, #step-test, #step-result
assets/api.js            — fetch wrapper Api.request(), quản lý token: teacherToken (sessionStorage), studentToken (localStorage)
assets/teacher.js        — 968 dòng: toàn bộ logic dashboard giáo viên (audio/image library, test builder, students, submissions, dashboard overview)
assets/student.js        — 573 dòng: login/register, chọn subject, làm bài, nộp bài, xem kết quả
assets/icons.js          — sprite SVG icon dùng chung
assets/style.css         — 537 dòng, palette: --navy:#0b3d66 --navy-dark:#082c4a --blue:#1565c0 --blue-light:#e8f1fb --accent:#d3a11a(vàng) --ink --muted --border --bg:#f4f7fa --card:#fff

lib/db.js                — connectDB(), cache connection trên global (serverless-safe)
lib/auth.js               — signToken/signTeacherToken/signStudentToken/requireRole/requireAuth/requireStudent
lib/cloudinary.js         — uploadAudioFile/uploadImageFile + delete tương ứng
lib/grade.js              — gradeSubmission(test, answers) — pure, generic theo shape {sections:[{fields}]}
lib/testSections.js       — normalizeSections/validateSections/sectionMediaError/hasDuplicateFieldIds
lib/models/Student.js     — name, username(unique), passwordHash, createdAt
lib/models/Test.js        — subject('listening'|'reading'), title, unit(string tự do), instructions, status('draft'|'published'), sections:[{name,audioId,passageText,imageId,matchOptions,fields:[{id,label,type,pre,post,options,selectCount,answers}]}]
lib/models/Submission.js  — studentId(ref,required), studentName, testId(ref), testTitle(snapshot), answers(Mixed), score, total, replayCount, submittedAt
lib/models/Audio.js       — thư viện audio Cloudinary
lib/models/Image.js       — thư viện ảnh Cloudinary

api/auth/login.js         — POST {password} so với process.env.TEACHER_PASSWORD -> signTeacherToken() {role:'teacher'} (KHÔNG có identity/username)
api/auth/student.js       — POST ?action=register (tự đăng ký) | mặc định = login, dùng bcrypt so username/password trong Student
api/tests.js              — PUBLIC (không auth), GET list (filter ?subject=) + GET ?id= (trả bản public, ẩn đáp án qua toPublicTest())
api/submissions.js        — POST, requireStudent, lấy studentId/studentName từ JWT (không tin body), gọi gradeSubmission()
api/admin/tests.js        — requireAuth, GET list/GET one/POST/PUT/DELETE dispatch theo query.id
api/admin/students.js     — requireAuth, GET list (kèm đếm submissions)/PUT (đổi mật khẩu)/DELETE — CHƯA có POST (giáo viên tạo học viên)
api/admin/submissions.js  — requireAuth, GET list submissions
api/admin/dashboard.js    — requireAuth, GET số liệu tổng quan (totalTests, publishedTests, totalAudio, totalSubmissions, uniqueStudents, avgScorePct, byTest, recent)
api/admin/audio.js        — requireAuth, CRUD audio qua Cloudinary (multipart, dùng formidable)
api/admin/images.js       — requireAuth, CRUD ảnh qua Cloudinary (multipart)

vercel.json               — rewrites: /teacher->teacher.html, /student->student.html, /->index.html
server.js                 — dev server local, tự map api/**/*.js thành route Express, xử lý cả [id].js và multipart (formidable) cho audio/images
```

---

## 2. PHASE 1 — Auth hợp nhất + Level + Giáo viên tạo học viên

### 2.1 Mục tiêu
- Đăng nhập 1 form duy nhất (username + password), **tự nhận diện** vào dashboard giáo viên hay học sinh, không cần chọn vai trò.
- Có model `Teacher` thật (không còn mật khẩu dùng chung `TEACHER_PASSWORD` sau khi bootstrap xong).
- Học sinh **không tự đăng ký được nữa** — chỉ giáo viên tạo tài khoản, có chọn `level` (số nguyên 1,2,3,4,5,...).
- `Test` có field `level`, `api/tests.js` chỉ trả về bài đúng level của học sinh đang đăng nhập.

### 2.2 Model mới: `lib/models/Teacher.js`
```js
const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema({
  name: { type: String, required: true },
  username: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Teacher || mongoose.model("Teacher", TeacherSchema);
```
(Copy y hệt pattern của `lib/models/Student.js`.)

### 2.3 Sửa `lib/models/Student.js`
Thêm field:
```js
level: { type: Number, required: true, min: 1 },
```

### 2.4 Sửa `lib/models/Test.js`
Thêm field:
```js
level: { type: Number, required: true, min: 1 },
```

### 2.5 Sửa `lib/auth.js`
```js
// Thêm hàm mới, giữ nguyên các hàm cũ (signToken, requireRole, requireAuth, requireStudent, getTokenFromRequest)

function signTeacherToken(teacher) {
  return signToken({ role: "teacher", teacherId: String(teacher._id), name: teacher.name });
}
```
Đổi chữ ký hàm này (trước đây `signTeacherToken()` không nhận tham số, trả `{role:'teacher'}` không có identity — giờ bắt buộc truyền `teacher` doc vì đã có Teacher thật). Cập nhật `module.exports` thêm không cần gì khác vì tên hàm giữ nguyên.

### 2.6 File mới: `api/auth.js` (thay thế `api/auth/login.js` + `api/auth/student.js` — XOÁ 2 FILE CŨ NÀY)
```js
const bcrypt = require("bcryptjs");
const { connectDB } = require("../lib/db");
const { signTeacherToken, signStudentToken } = require("../lib/auth");
const Teacher = require("../lib/models/Teacher");
const Student = require("../lib/models/Student");

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  const username = String((req.body && req.body.username) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");

  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Vui lòng nhập tên đăng nhập và mật khẩu" });
  }

  // Bootstrap: chưa có Teacher nào trong DB -> mật khẩu đúng TEACHER_PASSWORD (env cũ)
  // sẽ tự tạo Teacher đầu tiên. Sau khi có >=1 Teacher, nhánh này không bao giờ chạy nữa.
  const teacherCount = await Teacher.countDocuments();
  if (teacherCount === 0) {
    const bootstrapPassword = process.env.TEACHER_PASSWORD;
    if (bootstrapPassword && password === bootstrapPassword) {
      const passwordHash = await bcrypt.hash(password, 10);
      const teacher = await Teacher.create({
        name: "Giáo viên",
        username: username || "admin",
        passwordHash
      });
      return res.status(200).json({ ok: true, role: "teacher", token: signTeacherToken(teacher), name: teacher.name });
    }
  }

  const teacher = await Teacher.findOne({ username });
  if (teacher && (await bcrypt.compare(password, teacher.passwordHash))) {
    return res.status(200).json({ ok: true, role: "teacher", token: signTeacherToken(teacher), name: teacher.name });
  }

  const student = await Student.findOne({ username });
  if (student && (await bcrypt.compare(password, student.passwordHash))) {
    return res.status(200).json({
      ok: true,
      role: "student",
      token: signStudentToken(student),
      name: student.name,
      level: student.level
    });
  }

  return res.status(401).json({ ok: false, error: "Sai tên đăng nhập hoặc mật khẩu" });
};
```
Lưu ý bảo mật: thông báo lỗi giống nhau dù username không tồn tại hay sai mật khẩu — không lộ thông tin tài khoản nào có tồn tại.

**Xoá** `api/auth/login.js` và `api/auth/student.js` (và xoá thư mục `api/auth/` nếu trống). Tổng function: 10 - 2 + 1 = **9**.

### 2.7 Sửa `api/admin/students.js` — thêm `POST` (giáo viên tạo học viên)
Thêm nhánh `POST` vào handler hiện có (giữ nguyên GET/PUT/DELETE):
```js
const bcrypt = require("bcryptjs");
// ... require Student như cũ, thêm ở đầu file nếu chưa có

if (req.method === "POST") {
  const name = String((req.body && req.body.name) || "").trim();
  const username = String((req.body && req.body.username) || "").trim().toLowerCase();
  const password = String((req.body && req.body.password) || "");
  const level = Number((req.body && req.body.level));

  if (!name) return res.status(400).json({ ok: false, error: "Vui lòng nhập họ tên" });
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) {
    return res.status(400).json({ ok: false, error: "Tên đăng nhập chỉ gồm chữ thường, số, dấu chấm/gạch dưới, 3-30 ký tự" });
  }
  if (password.length < 4) {
    return res.status(400).json({ ok: false, error: "Mật khẩu cần ít nhất 4 ký tự" });
  }
  if (!Number.isInteger(level) || level < 1) {
    return res.status(400).json({ ok: false, error: "Vui lòng chọn cấp độ hợp lệ" });
  }

  const existing = await Student.exists({ username });
  if (existing) {
    return res.status(409).json({ ok: false, error: "Tên đăng nhập đã có người dùng, hãy chọn tên khác" });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const student = await Student.create({ name, username, passwordHash, level });
  return res.status(201).json({ ok: true, student: { _id: student._id, name: student.name, username: student.username, level: student.level } });
}
```
Đặt nhánh này **trước** đoạn `if (req.method === "PUT" || req.method === "DELETE")` hiện có (những nhánh đó cần `id`, còn `POST` tạo mới thì không). Nhớ cập nhật `res.setHeader("Allow", ...)` ở cuối file thêm `POST`. Đồng thời sửa nhánh `GET` list để trả thêm `level` trong mỗi row (field đã có sẵn trên document, chỉ cần thêm vào object map).

Cho phép `PUT` (đổi mật khẩu) nhận thêm `level` optional để giáo viên đổi cấp độ học viên sau này:
```js
if (req.method === "PUT") {
  const { password, level } = req.body || {};
  if (password != null) {
    if (String(password).length < 4) return res.status(400).json({ ok:false, error:"Mật khẩu cần ít nhất 4 ký tự" });
    student.passwordHash = await bcrypt.hash(String(password), 10);
  }
  if (level != null) {
    const lvl = Number(level);
    if (!Number.isInteger(lvl) || lvl < 1) return res.status(400).json({ ok:false, error:"Cấp độ không hợp lệ" });
    student.level = lvl;
  }
  await student.save();
  return res.status(200).json({ ok: true });
}
```

### 2.8 Sửa `api/admin/tests.js`
- Nhánh `POST`: thêm `level` bắt buộc, validate `Number.isInteger(level) && level>=1`, lưu vào `Test.create({...level})`.
- Nhánh `PUT`: cho phép cập nhật `level` giống các field khác (`if (level != null) {...}`).
- Nhánh GET list: field `level` tự động có trong `.lean()` output, không cần sửa gì thêm.

### 2.9 Sửa `api/tests.js` (public → bắt buộc đăng nhập học sinh, lọc theo level)
```js
const { connectDB } = require("../lib/db");
const { requireStudent } = require("../lib/auth");
const Student = require("../lib/models/Student");
const Test = require("../lib/models/Test");

function toPublicTest(test) { /* giữ nguyên y hệt hiện tại */ }

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  await connectDB();

  // Luôn lấy level thật từ DB, không tin field level trong JWT
  // (giáo viên có thể đổi level sau khi token học sinh đã phát ra).
  const student = await Student.findById(req.auth.studentId);
  if (!student) {
    return res.status(401).json({ ok: false, error: "Tài khoản không còn tồn tại, vui lòng đăng nhập lại" });
  }

  const { id } = req.query;

  if (id) {
    let test;
    try {
      test = await Test.findOne({ _id: id, status: "published", level: student.level })
        .populate("sections.audioId", "cloudinaryUrl")
        .populate("sections.imageId", "cloudinaryUrl");
    } catch (err) {
      return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
    }
    if (!test) {
      return res.status(404).json({ ok: false, error: "Không tìm thấy bài kiểm tra" });
    }
    return res.status(200).json({ ok: true, test: toPublicTest(test) });
  }

  const filter = { status: "published", level: student.level };
  if (req.query.subject === "listening" || req.query.subject === "reading") {
    filter.subject = req.query.subject;
  }
  const tests = await Test.find(filter).sort({ createdAt: -1 }).lean();

  const rows = tests.map((t) => ({
    id: t._id,
    subject: t.subject,
    title: t.title,
    unit: t.unit,
    totalQuestions: (t.sections || []).reduce((n, s) => n + (s.fields || []).length, 0)
  }));

  return res.status(200).json({ ok: true, rows });
}

module.exports = requireStudent(handler);
```
Đây là thay đổi hành vi có chủ đích: API này từ public chuyển thành yêu cầu JWT học sinh — cần thiết để lọc theo level phía server (không thể tin client tự lọc).

### 2.10 Script backfill dữ liệu cũ (chạy 1 lần bằng tay, KHÔNG phải Vercel function)
Tạo `scripts/migrate-add-level.js` (thư mục `scripts/` không nằm trong `/api` nên không tính vào 12 function):
```js
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { connectDB } = require("../lib/db");
const Student = require("../lib/models/Student");
const Test = require("../lib/models/Test");

(async () => {
  await connectDB();
  const s = await Student.updateMany({ level: { $exists: false } }, { $set: { level: 1 } });
  const t = await Test.updateMany({ level: { $exists: false } }, { $set: { level: 1 } });
  console.log("Students backfilled:", s.modifiedCount);
  console.log("Tests backfilled:", t.modifiedCount);
  process.exit(0);
})();
```
Chạy bằng `node scripts/migrate-add-level.js` trước khi deploy Phase 1 lên production, xác nhận log ra số bản ghi đã update khớp với số Student/Test hiện có trong DB thật.

### 2.11 Sửa `assets/api.js`
```js
// Xoá: login(password), studentRegister, studentLogin
// Thêm 1 hàm duy nhất:
login: (username, password) => request("/api/auth", { method: "POST", body: { username, password } }),
```
Trong `admin`, thêm:
```js
createStudent: (data) => request("/api/admin/students", { method: "POST", body: data, auth: "teacher" }),
```
Xoá `studentRegister`/`studentLogin` khỏi object trả về.

### 2.12 Sửa `index.html` — trang login hợp nhất
Thay toàn bộ `.choice-grid` (2 choice-card) bằng 1 form:
```html
<form id="loginForm" class="card">
  <label>Tên đăng nhập
    <input id="loginUsername" type="text" autocomplete="username" required />
  </label>
  <label>Mật khẩu
    <input id="loginPassword" type="password" autocomplete="current-password" required />
  </label>
  <div id="loginError" class="notice error" style="display:none"></div>
  <button type="submit" class="btn primary">Đăng nhập</button>
</form>
```
Thêm `<script src="assets/api.js"></script>` + script nhỏ:
```html
<script>
  document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUsername").value.trim();
    const password = document.getElementById("loginPassword").value;
    const errEl = document.getElementById("loginError");
    errEl.style.display = "none";
    try {
      const data = await Api.login(username, password);
      if (data.role === "teacher") {
        Api.setToken(data.token);
        location.href = "/teacher";
      } else {
        Api.setStudentToken(data.token);
        location.href = "/student";
      }
    } catch (err) {
      errEl.textContent = err.message;
      errEl.style.display = "block";
    }
  });
</script>
```
Class `.card`/`.btn`/`.notice.error` đã có sẵn trong `assets/style.css` — tái dùng, không tạo class mới ở bước này (Phase 2 mới làm lại giao diện).

### 2.13 Sửa `teacher.html` + `assets/teacher.js` — bỏ login nhúng
- `teacher.html`: xoá toàn bộ `#step-login` (input mật khẩu + nút đăng nhập nhúng trong trang).
- `assets/teacher.js`: xoá `tryLogin()`, xoá 3 dòng gắn listener `btnLogin`/`pw` (dòng 14-17 hiện tại). Đổi dòng 52 `if (Api.getToken()) enterDashboard();` thành:
```js
if (Api.getToken()) {
  enterDashboard();
} else {
  location.href = "/";
}
```
- Nút đăng xuất (`btnLogout`) giữ nguyên hành vi (`Api.clearToken(); location.reload();`) nhưng nên đổi `location.reload()` → `location.href = "/"` để quay về màn login thay vì reload trang dashboard trống.

### 2.14 Sửa `student.html` + `assets/student.js` — bỏ login/register nhúng
- `student.html`: xoá toàn bộ `#step-auth` (2 tab Đăng nhập/Đăng ký).
- `assets/student.js`: xoá toàn bộ khối "XỬ LÝ AUTHENTICATION" (tab login/register, gọi `Api.studentLogin`/`Api.studentRegister`). Sửa `checkAuth()`:
```js
function checkAuth() {
  const token = Api.getStudentToken();
  if (!token) {
    location.href = "/";
    return;
  }
  const payload = decodeJwt(token);
  if (!payload || payload.role !== "student") {
    Api.clearStudentToken();
    location.href = "/";
    return;
  }
  studentName = payload.name || payload.username;
  document.getElementById("studentNavName").textContent = studentName;
  document.getElementById("studentNavInfo").style.display = "inline";
  document.getElementById("btnStudentLogout").style.display = "inline";
  if (!currentSubject) show("step-subject"); else show("step-picker");
}
```
Giữ nguyên `decodeJwt()`, giữ nguyên toàn bộ luồng chọn subject → làm bài → nộp bài → kết quả (không đổi trong Phase 1).
Nút đăng xuất: `Api.clearStudentToken(); location.href = "/";` (thay vì `location.reload()`).

### 2.15 `.env.example` — cập nhật ghi chú
Thêm comment cho `TEACHER_PASSWORD`: chỉ dùng 1 lần để bootstrap tài khoản giáo viên đầu tiên qua `/api/auth`, sau khi đã có Teacher trong DB thì biến này không còn tác dụng (có thể xoá khỏi env sau khi bootstrap xong, hoặc giữ lại cũng vô hại).

### 2.16 Verify Phase 1 (bắt buộc làm hết trước khi coi Phase 1 xong)
1. `npm run dev:local`, mở `http://localhost:3001/`.
2. Đăng nhập lần đầu bằng username bất kỳ + mật khẩu đúng `TEACHER_PASSWORD` trong `.env.local` → phải vào `/teacher` thành công (bootstrap tạo Teacher đầu tiên).
3. Đăng xuất, đăng nhập lại bằng đúng username/password vừa bootstrap → vẫn vào được `/teacher` (xác nhận nhánh bootstrap đã đóng, giờ đi qua nhánh `Teacher.findOne`).
4. Trong dashboard giáo viên, tạo 1 học viên mới với `level=1` (cần thêm tạm 1 form/nút gọi `Api.admin.createStudent` nếu UI chưa có — Phase 1 chỉ cần API hoạt động đúng, UI đầy đủ cho tạo học viên có thể làm tối giản, Phase 2 sẽ đẹp hoá).
5. Đăng xuất, đăng nhập bằng tài khoản học viên vừa tạo → phải vào `/student` (không phải `/teacher`).
6. Giáo viên tạo 1 bài kiểm tra Nghe với `level=1`, publish. Học viên (level 1) phải thấy bài này trong danh sách và làm/nộp bài được, chấm điểm đúng như trước.
7. Tạo thử 1 bài kiểm tra `level=2` — xác nhận học viên level 1 KHÔNG thấy bài này.
8. Kiểm tra Network tab: `/api/auth/login`, `/api/auth/student` phải trả 404 (đã xoá file, route không còn tồn tại) — xác nhận không còn code nào gọi 2 endpoint cũ.
9. Chạy `node scripts/migrate-add-level.js` nhắm vào DB thật (hoặc bản sao) một lần, xác nhận log ra đúng số bản ghi cũ được backfill `level:1`.
10. Dọn sạch dữ liệu test (student/test tạo ra lúc verify) khỏi MongoDB thật sau khi xong — đúng lưu ý trong `HANDOFF.md`.

---

## 3. PHASE 2 — UI Dashboard shell (chỉ giao diện, KHÔNG đổi backend/API)

### 3.1 Mục tiêu
Bọc lại `teacher.html`/`student.html` (và `index.html`) trong layout dashboard chuyên nghiệp kiểu sidebar — tham khảo layout ảnh "Zippy" người dùng gửi (sidebar trái nhóm mục + icon, topbar trên có search + avatar, hàng stat-card 4 ô icon+số lớn+dòng phụ, bảng/danh sách bên dưới có status pill), đổi màu theo tông xanh dương đã có sẵn trong `assets/style.css` (`--navy`, `--blue`, `--blue-light`). Không thêm tính năng, không đổi API nào — Phase 1 phải chạy y hệt, chỉ khác giao diện.

### 3.2 `assets/style.css` — thêm mới, không xoá class cũ đang dùng (xoá sau khi Phase 2 xong và xác nhận không còn nơi nào dùng `.choice-card`/`.hero`/`.topbar` cũ)
Thêm các class:
- `.app-shell` — CSS grid 2 cột: `grid-template-columns: 260px 1fr;` sidebar cố định trái, main bên phải.
- `.sidebar` — nền `--navy-dark` hoặc `--card` (chọn theo mockup), danh sách `.sidebar-group` (label nhóm nhỏ, uppercase, `--muted`) chứa nhiều `.sidebar-link` (icon + text + badge số optional).
- `.sidebar-link.active` — nền `--blue-light`, chữ `--blue`, bo góc.
- `.topbar-v2` — thanh ngang trên main: ô search bên trái, cụm avatar+tên+role bên phải.
- `.stat-card-grid` — CSS grid 4 cột responsive (`repeat(auto-fit, minmax(220px,1fr))`), mỗi `.stat-card` có icon nhỏ góc trên phải, số lớn, label, dòng phụ màu xanh lá/cam tuỳ tăng giảm.
- `.data-table` — bảng list kiểu ảnh mẫu: tên chính + dòng phụ mờ bên dưới, cột phải có `.pill` (trạng thái, ví dụ `.pill-expired`/`.pill-warning`/`.pill-ok` màu đỏ/cam/xanh).

### 3.3 `assets/shell.js` (file mới)
```js
const Shell = (function () {
  function mount({ root, navGroups, activeKey, userName, roleLabel, onNavigate, onLogout }) {
    // navGroups: [{ label: 'MAIN', items: [{ key, label, icon, badge? }] }, ...]
    // Render sidebar + topbar vào `root` (1 phần tử DOM cha), gắn click listener
    // gọi onNavigate(key) khi bấm 1 sidebar-link — KHÔNG tự chuyển .tab-panel ở đây,
    // để teacher.js/student.js xử lý y hệt cơ chế .tab-btn/.tab-panel đã có sẵn,
    // chỉ đổi việc mount thêm class .active lên .sidebar-link tương ứng thay vì .tab-btn.
  }
  return { mount };
})();
```
Mục tiêu: `teacher.js`/`student.js` gọi `Shell.mount(...)` một lần khi vào dashboard, truyền `onNavigate` = hàm hiện có đang xử lý click `.tab-btn` (đổi `.tab-panel.active`). Không viết lại state machine chuyển tab, chỉ đổi UI trigger.

### 3.4 `teacher.html`/`student.html` — cấu trúc lại HTML
Bọc nội dung `#step-dashboard` hiện có trong `<div class="app-shell"><aside class="sidebar" id="sidebarRoot"></aside><main>...</main></div>`. Menu giáo viên: Bài học / Bài kiểm tra / Học viên / Thư viện (audio+ảnh) / Bài nộp. Menu học sinh: Bài học / Bài kiểm tra. Giữ nguyên toàn bộ `#panel-*` nội dung bên trong `<main>`, chỉ đổi khung bao ngoài.

### 3.5 `assets/icons.js` — thêm icon
Thêm `<symbol>` cho: search, bell (nếu cần), calendar, clock, grammar (vd hình sách/bút), vocabulary (vd hình thẻ từ), writing (bút), speaking (mic) — theo đúng pattern SVG path hiện có trong file, giữ `viewBox` nhất quán.

### 3.6 Verify Phase 2
1. So sánh trực quan với ảnh tham khảo (sidebar/topbar/stat-card), xác nhận tông màu xanh dương.
2. Lặp lại đúng bước 2-7 của checklist Phase 1 — mọi hành vi phải giống hệt, chỉ giao diện khác.
3. Test responsive tối thiểu ở độ rộng ~1280px (không bắt buộc mobile-first vì app dùng chủ yếu desktop, nhưng sidebar không được vỡ layout).

---

## 4. PHASE 3 — Module Bài học (Unit × 6 kỹ năng, gồm chấm tay Writing/Speaking)

### 4.1 Mục tiêu
- Giáo viên tạo **Unit** theo level (vd "UNIT 1" ở level 3). Mỗi Unit tự động có đủ 6 mục cố định: Grammar, Vocabulary, Listening, Reading, Writing, Speaking.
- Mỗi mục có 2 tab: **Lý thuyết** (nội dung dạy, text tự do, có thể gắn audio/ảnh từ thư viện có sẵn) và **Bài tập**:
  - Grammar/Vocabulary/Listening/Reading: bài tập dạng câu hỏi, **tái dùng y nguyên engine field/section** của Test (fill/choice/selectCount/matchOptions) — chấm điểm tự động.
  - Writing/Speaking: đề bài (prompt) dạng văn bản hướng dẫn (+ ảnh minh hoạ optional cho Writing Task 1 dạng biểu đồ) — học sinh nộp bài luận (textarea) hoặc ghi âm (MediaRecorder), giáo viên chấm tay (điểm + nhận xét).
- Học sinh chỉ thấy Unit đúng level của mình, Unit ở trạng thái `published`.

### 4.2 Tách schema câu hỏi dùng chung — `lib/models/schemas/questionSchema.js` (file mới)
```js
const mongoose = require("mongoose");

const FieldSchema = new mongoose.Schema(
  {
    id: { type: Number, required: true },
    label: { type: String, default: "" },
    type: { type: String, enum: ["fill", "choice"], default: "fill" },
    pre: { type: String, default: "" },
    post: { type: String, default: "" },
    options: [{ value: String, label: String }],
    selectCount: { type: Number, default: 1 },
    answers: { type: [String], default: [] }
  },
  { _id: false }
);

const SectionSchema = new mongoose.Schema(
  {
    name: { type: String, default: "" },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    passageText: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" },
    matchOptions: [{ value: String, label: String }],
    fields: { type: [FieldSchema], default: [] }
  },
  { _id: false }
);

module.exports = { FieldSchema, SectionSchema };
```
**Sửa `lib/models/Test.js`**: xoá định nghĩa `FieldSchema`/`SectionSchema` cũ ngay trong file đó, thay bằng `const { FieldSchema, SectionSchema } = require("./schemas/questionSchema");` — đây là refactor thuần, hành vi `Test` model không đổi. Chạy lại toàn bộ checklist verify Phase 1 mục 6-7 sau khi refactor này để chắc chắn không có gì hỏng.

### 4.3 Model mới: `lib/models/Unit.js`
```js
const mongoose = require("mongoose");
const { SectionSchema } = require("./schemas/questionSchema");

const CATEGORY_KEYS = ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"];

const ExerciseSchema = new mongoose.Schema(
  { title: { type: String, default: "" }, sections: { type: [SectionSchema], default: [] } },
  { timestamps: true }
);

const PromptSchema = new mongoose.Schema(
  {
    title: { type: String, default: "" },
    instructions: { type: String, default: "" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" }
  },
  { timestamps: true }
);

const CategorySchema = new mongoose.Schema({
  key: { type: String, enum: CATEGORY_KEYS, required: true },
  theory: {
    html: { type: String, default: "" },
    audioId: { type: mongoose.Schema.Types.ObjectId, ref: "Audio" },
    imageId: { type: mongoose.Schema.Types.ObjectId, ref: "Image" }
  },
  exercises: { type: [ExerciseSchema], default: [] },
  prompts: { type: [PromptSchema], default: [] }
});

function seedCategories() {
  return CATEGORY_KEYS.map((key) => ({ key, theory: {}, exercises: [], prompts: [] }));
}

const UnitSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, min: 1 },
    name: { type: String, required: true },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    categories: { type: [CategorySchema], default: seedCategories }
  },
  { timestamps: true }
);

UnitSchema.statics.CATEGORY_KEYS = CATEGORY_KEYS;

module.exports = mongoose.models.Unit || mongoose.model("Unit", UnitSchema);
```
Lưu ý: `ExerciseSchema`/`PromptSchema`/`CategorySchema` cố tình để Mongoose tự sinh `_id` (KHÔNG đặt `{_id:false}`) vì cả exercise, prompt và category đều cần được sửa/xoá riêng lẻ qua API bằng `_id` của chúng — khác với `SectionSchema` trong Test vốn không cần địa chỉ hoá riêng từng section.

### 4.4 Sửa `lib/models/Submission.js` — thêm field `kind`
```js
kind: { type: String, enum: ["test", "exercise", "writing", "speaking"], default: "test" },

// dùng khi kind='exercise'
unitId: { type: mongoose.Schema.Types.ObjectId, ref: "Unit" },
categoryKey: String,
exerciseId: mongoose.Schema.Types.ObjectId,
exerciseTitle: String,

// dùng khi kind='writing'
essayText: String,

// dùng khi kind='speaking'
audioUrl: String,
audioPublicId: String,

// dùng khi kind='writing'|'speaking'
promptId: mongoose.Schema.Types.ObjectId,

// chấm tay (writing/speaking)
gradingStatus: { type: String, enum: ["submitted", "graded"], default: "submitted" },
manualScore: Number,
manualFeedback: String,
gradedAt: Date,
gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: "Teacher" },
```
Đặt tên field chấm tay là `gradingStatus` (không phải `status`) để tránh trùng với các field `status` khác trong hệ thống (Test.status, Unit.status) gây nhầm khi đọc log/DB. `testId`/`testTitle` hiện có giữ nguyên required chỉ khi `kind==='test'` — **bỏ `required:true`** trên `testId` trong schema (đổi thành optional), tự validate bắt buộc theo `kind` ở tầng API (`api/submissions.js`), không ở tầng schema, vì Mongoose không dễ validate "required nếu field khác = X" gọn gàng.

### 4.5 File mới: `api/admin/units.js` (giáo viên, CRUD Unit) — tổng function: 9 → **10**
Dispatch y hệt pattern `api/admin/tests.js` (theo `req.method` + `req.query.id`):
- `GET` không `id`: list tất cả Unit (`.sort({level:1, order:1})`), populate tối thiểu tên audio/ảnh trong theory nếu cần hiển thị.
- `POST`: body `{level, name, order}` → tạo Unit với `categories: seedCategories()` mặc định (dùng static/helper export từ model).
- `GET ?id=`: 1 Unit đầy đủ.
- `PUT ?id=`: cập nhật `name`/`order`/`status`/toàn bộ hoặc từng phần `categories` (client gửi lại toàn bộ mảng `categories` mỗi lần lưu — đơn giản hơn patch từng exercise, chấp nhận payload lớn vì đây là app 1 giáo viên, không phải hệ thống nhiều người sửa đồng thời). Validate mỗi exercise's `sections` bằng `normalizeSections()`/`validateSections()` đã có (tái dùng, coi mỗi exercise như 1 "test" nhỏ, subject truyền vào validate là `categoryKey` tương ứng nếu categoryKey thuộc `['listening','reading']`; với `grammar`/`vocabulary` không có ràng buộc audio/passage bắt buộc — cần thêm nhánh trong `sectionMediaError`/`validateSections` chấp nhận `subject` ngoài `'listening'|'reading'` mà không bắt buộc media, xem §4.6).
- `DELETE ?id=`: xoá Unit — cân nhắc chặn xoá nếu đã có Submission `kind:'exercise'|'writing'|'speaking'` tham chiếu `unitId` này (giữ lịch sử) giống cách `api/admin/students.js` xử lý xoá học viên (không chặn, chỉ để submission tự "mồ côi" — làm tương tự cho nhất quán, không cần chặn xoá).

### 4.6 Sửa `lib/testSections.js` — mở rộng `sectionMediaError`/`validateSections` để dùng được cho exercise trong Lesson
Hiện tại `sectionMediaError(subject, section)` chỉ nhận `subject: 'listening'|'reading'` và bắt buộc media tương ứng. Thêm nhánh: nếu `subject` không phải `'listening'` cũng không phải `'reading'` (tức đang validate 1 exercise Grammar/Vocabulary trong Lesson) → không bắt buộc `audioId`/`passageText`/`imageId`, trả `null` (hợp lệ) trừ phi rỗng hoàn toàn cả section lẫn field. Đây là điểm mở rộng nhỏ, không phá vỡ hành vi cũ khi `subject` vẫn là `'listening'|'reading'` (dùng bởi `api/admin/tests.js`).

### 4.7 File mới: `api/units.js` (học sinh đọc Unit) — tổng function: 10 → **11**
```
GET /api/units                 requireStudent — list Unit status='published' && level===student.level (lấy student.level từ DB như api/tests.js), trả rút gọn: {id,name,order}
GET /api/units?id=<id>         requireStudent — 1 Unit published + đúng level, ẩn `answers` trong mọi field (dùng lại logic tương tự toPublicTest trong api/tests.js — viết hàm toPublicUnit() riêng trong file này, KHÔNG export dùng chung để tránh coupling không cần thiết), giữ nguyên prompts.instructions (không có đáp án để ẩn)
```

### 4.8 Sửa `api/submissions.js` — nhận `kind`, rẽ nhánh
Thêm import `Unit` model. Đọc `kind` từ `req.body.kind` (mặc định `'test'` nếu không có, để tương thích payload cũ):
```js
const kind = (req.body && req.body.kind) || "test";

if (kind === "test") {
  // giữ nguyên toàn bộ logic hiện có
}

if (kind === "exercise") {
  const { unitId, categoryKey, exerciseId, answers } = req.body || {};
  const unit = await Unit.findOne({ _id: unitId, status: "published" });
  if (!unit) return res.status(404).json({ ok: false, error: "Không tìm thấy bài học" });
  const category = unit.categories.find((c) => c.key === categoryKey);
  const exercise = category && category.exercises.id(exerciseId);
  if (!exercise) return res.status(404).json({ ok: false, error: "Không tìm thấy bài tập" });
  const { score, total, detail } = gradeSubmission(exercise, answers || {});
  const submission = await Submission.create({
    studentId: student._id, studentName: student.name, kind: "exercise",
    unitId: unit._id, categoryKey, exerciseId: exercise._id, exerciseTitle: exercise.title,
    answers: answers || {}, score, total
  });
  return res.status(201).json({ ok: true, submissionId: submission._id, score, total, detail });
}

if (kind === "writing" || kind === "speaking") {
  const { unitId, categoryKey, promptId, essayText, audioUrl, audioPublicId } = req.body || {};
  const unit = await Unit.findOne({ _id: unitId, status: "published" });
  if (!unit) return res.status(404).json({ ok: false, error: "Không tìm thấy bài học" });
  const category = unit.categories.find((c) => c.key === categoryKey);
  const prompt = category && category.prompts.id(promptId);
  if (!prompt) return res.status(404).json({ ok: false, error: "Không tìm thấy đề bài" });
  if (kind === "writing" && !String(essayText || "").trim()) {
    return res.status(400).json({ ok: false, error: "Vui lòng nhập bài luận" });
  }
  if (kind === "speaking" && !audioUrl) {
    return res.status(400).json({ ok: false, error: "Vui lòng ghi âm trước khi nộp" });
  }
  const submission = await Submission.create({
    studentId: student._id, studentName: student.name, kind,
    unitId: unit._id, categoryKey, promptId: prompt._id,
    essayText: kind === "writing" ? essayText : undefined,
    audioUrl: kind === "speaking" ? audioUrl : undefined,
    audioPublicId: kind === "speaking" ? audioPublicId : undefined,
    gradingStatus: "submitted"
  });
  return res.status(201).json({ ok: true, submissionId: submission._id, message: "Đã nộp bài, chờ giáo viên chấm" });
}

return res.status(400).json({ ok: false, error: "kind không hợp lệ" });
```

### 4.9 Sửa `api/admin/submissions.js` — thêm chấm tay + filter
- `GET`: thêm query `?kind=writing|speaking&gradingStatus=submitted` để lọc "hàng chờ chấm".
- Thêm nhánh `PUT ?id=<submissionId>`: body `{manualScore, manualFeedback}` → set `gradingStatus:'graded'`, `gradedAt: Date.now()`, `gradedBy: req.auth.teacherId`, lưu.

### 4.10 Sửa `api/admin/dashboard.js`
Thêm vào response: `totalUnits` (`Unit.countDocuments()`), `pendingGrading` (`Submission.countDocuments({kind:{$in:['writing','speaking']}, gradingStatus:'submitted'})`).

### 4.11 Ghi âm Speaking — Cloudinary unsigned upload, KHÔNG tạo function mới
Bước cấu hình thủ công (làm 1 lần trong Cloudinary dashboard, không phải code): tạo 1 **Upload Preset** loại "Unsigned", giới hạn folder (vd `ielts-speaking/`), giới hạn định dạng audio, giới hạn dung lượng file hợp lý (vd 10MB). Ghi tên preset này vào `.env.example`/`.env.local` dưới dạng biến **client-side** (không secret) — vd thêm vào `assets/api.js` hoặc 1 file config nhỏ:
```js
const CLOUDINARY_CLOUD_NAME = "oqczcg2z"; // đã public sẵn trong mọi cloudinaryUrl hiện có
const CLOUDINARY_SPEAKING_PRESET = "ielts_speaking_unsigned"; // tên preset tạo trong dashboard
```
Frontend (`assets/student.js` hoặc file mới `assets/recorder.js`):
1. `navigator.mediaDevices.getUserMedia({audio:true})` → `MediaRecorder` ghi âm, dừng → tạo `Blob`.
2. `fetch('https://api.cloudinary.com/v1_1/'+CLOUDINARY_CLOUD_NAME+'/video/upload', {method:'POST', body: formDataVoiBlobVaUploadPreset})` (Cloudinary coi audio là resource_type `video`).
3. Nhận `{secure_url, public_id}` từ response Cloudinary → gọi `Api.submit({kind:'speaking', unitId, categoryKey:'speaking', promptId, audioUrl: secure_url, audioPublicId: public_id})`.

### 4.12 Frontend — màn hình mới
**Giáo viên (`teacher.js`, tab "Bài học" mới):**
- List Unit theo level (dropdown chọn level để lọc, hoặc group theo level).
- Tạo Unit mới: nhập `name` + chọn `level` → gọi `api/admin/units.js POST`.
- Vào 1 Unit: hiện 6 tab con cố định (Grammar/Vocabulary/Listening/Reading/Writing/Speaking — dùng icon mới ở §3.5). Trong mỗi tab:
  - Sub-tab "Lý thuyết": textarea/`contentEditable` đơn giản cho `theory.html` (plain text chấp nhận được ở v1 theo §4.1, KHÔNG cần rich text editor thật) + dropdown chọn audio/ảnh optional từ thư viện có sẵn (tái dùng `audioCache`/`imagesCache` đã load sẵn trong `teacher.js`).
  - Sub-tab "Bài tập":
    - Với grammar/vocabulary/listening/reading: list các `exercises[]`, nút "+ Thêm bài tập" mở **đúng builder section/field đã tách hàm dùng chung ở §0 Nguyên tắc 3** (không viết lại UI).
    - Với writing/speaking: list các `prompts[]`, form đơn giản `title` + `instructions` (textarea) + optional chọn ảnh.
- Lưu toàn bộ Unit (categories) bằng 1 nút "Lưu" gọi `PUT /api/admin/units?id=`, gửi lại toàn bộ object `categories` hiện tại trên client.
- Tab "Chấm bài" (hoặc gộp vào tab "Bài nộp" có sẵn, thêm filter): list submission `kind` writing/speaking, `gradingStatus:'submitted'`, bấm vào xem full essayText/audio player, nhập `manualScore` + `manualFeedback`, nút Lưu gọi `PUT /api/admin/submissions?id=`.

**Học sinh (`student.js`, tab "Bài học" mới, song song "Bài kiểm tra" hiện có):**
- List Unit đúng level (gọi `api/units.js`).
- Vào 1 Unit → 6 mục, mỗi mục có Lý thuyết (đọc) + Bài tập (làm).
- Grammar/Vocabulary/Listening/Reading: render form y hệt cơ chế `renderTestForm` hiện có trong `student.js` (tái dùng hàm render field, không viết lại), nộp qua `Api.submit({kind:'exercise', unitId, categoryKey, exerciseId, answers})`.
- Writing: hiện `prompt.instructions` (+ ảnh nếu có) → `<textarea>` nhập bài luận → nộp qua `Api.submit({kind:'writing', ...})`.
- Speaking: hiện `prompt.instructions` → nút ghi âm (MediaRecorder, xem §4.11) → nghe lại trước khi nộp → nộp qua flow Cloudinary unsigned upload rồi `Api.submit({kind:'speaking', ...})`.
- Sau khi nộp Writing/Speaking: hiện thông báo "Đã nộp, chờ giáo viên chấm" — chưa có điểm ngay (khác với exercise tự chấm hiện điểm tức thì).
- Thêm màn xem lại bài đã chấm (điểm + nhận xét giáo viên) — có thể gộp vào "Kết quả" hiện có, thêm nhánh hiển thị khi `gradingStatus==='graded'`.

### 4.13 Verify Phase 3
1. Giáo viên tạo Unit level=1 "UNIT 1", xác nhận tự sinh đủ 6 mục rỗng.
2. Soạn Lý thuyết + 1 bài tập trắc nghiệm cho Grammar, 1 bài tập matching cho Reading, 1 đề Writing, 1 đề Speaking. Publish Unit.
3. Học sinh level 1 vào Bài học, thấy đúng Unit này (level 2 không thấy).
4. Làm bài tập Grammar → nộp → chấm điểm tự động đúng, ngay lập tức.
5. Nộp bài luận Writing → thấy trạng thái "chờ chấm".
6. Ghi âm nộp Speaking (cần trình duyệt cấp quyền mic) → xác nhận file lên Cloudinary thành công (kiểm tra Cloudinary dashboard có file mới) → thấy trạng thái "chờ chấm".
7. Giáo viên vào hàng chờ chấm, thấy đúng 2 bài (Writing + Speaking) vừa nộp, chấm điểm + nhận xét, lưu.
8. Học sinh load lại, thấy điểm + nhận xét giáo viên vừa chấm.
9. Xoá dữ liệu test khỏi DB thật sau khi xong.

---

## 5. PHASE 4 — Bài kiểm tra: lịch thi + UI hoàn thiện

### 5.1 Sửa `lib/models/Test.js`
```js
publishAt: Date,
opensAt: Date,
closesAt: Date,
durationMinutes: Number,
```

### 5.2 Sửa `api/admin/tests.js`
Nhánh `POST`/`PUT`: nhận và lưu 4 field trên (optional, validate `opensAt < closesAt` nếu cả 2 có mặt; `durationMinutes` phải > 0 nếu có).

### 5.3 Sửa `api/tests.js`
Nhánh list: thêm điều kiện thời gian vào `filter` — chỉ trả test có `opensAt` rỗng hoặc `opensAt <= now`, và `closesAt` rỗng hoặc `closesAt >= now`. Nhánh lấy 1 test theo `id`: nếu ngoài window, trả 404 giống như không publish (không tiết lộ đề tồn tại nhưng chưa mở).

### 5.4 Sửa `api/submissions.js` (nhánh `kind==='test'`)
Trước khi chấm, nếu `test.closesAt` đã qua hoặc `test.opensAt` chưa tới → 400 "Bài kiểm tra hiện không mở".

### 5.5 Frontend
- Builder Test (`teacher.js`): thêm input `datetime-local` cho `opensAt`/`closesAt`, input số cho `durationMinutes`.
- Làm bài (`student.js`): khi vào `step-test`, nếu `durationMinutes` có giá trị, hiện đồng hồ đếm ngược góc trên, hết giờ tự động gọi hàm nộp bài hiện có (client-side only, không server-enforce — đã ghi trong plan gốc).
- Tab "Bài kiểm tra" (cả 2 dashboard): thêm stat card đồng bộ style Phase 2 (số bài đã publish, số bài nộp tuần này, điểm trung bình — số liệu này `api/admin/dashboard.js` đã có sẵn phần lớn, chỉ cần hiển thị).

### 5.6 Verify Phase 4
1. Tạo test với `opensAt` = 5 phút sau hiện tại → học sinh chưa thấy bài trong danh sách.
2. Sửa `opensAt` về quá khứ → học sinh thấy ngay.
3. Đặt `closesAt` = quá khứ → học sinh không thấy, nếu cố POST submissions thẳng vào API (test bằng curl/Postman) với testId đó → nhận lỗi 400 đúng như thiết kế.
4. Đặt `durationMinutes=1`, làm bài, xác nhận sau 60s tự động nộp.
5. Dọn dữ liệu test khỏi DB thật.

---

## 6. Tổng kết function budget cuối cùng
```
9  sau Phase 1  (10 cũ - 2 file auth cũ + 1 api/auth.js mới)
9  sau Phase 2  (không đổi API)
11 sau Phase 3  (+ api/admin/units.js + api/units.js)
11 sau Phase 4  (không đổi số file)
```
Còn dư đúng 1/12 — bất kỳ tính năng nào thêm sau 4 phase này gần như chắc chắn phải gộp vào 1 trong 11 file hiện có, không tạo file mới, trừ khi trước đó gộp bớt 2 file thành 1 để giải phóng slot.

## 7. Việc KHÔNG làm trong đợt này (out of scope, đừng tự thêm)
- Không tạo collection `Level` riêng (level là số nguyên đơn giản).
- Không thêm `subject` grammar/vocabulary/writing/speaking vào model `Test` — 4 mục này chỉ tồn tại trong Lessons.
- Không làm rich-text editor thật cho Lý thuyết/bài luận (chỉ textarea/plain text).
- Không enforce thời gian làm bài kiểm tra phía server (chỉ client-side countdown).
- Không cho phép nhiều giáo viên với phân quyền khác nhau (mọi Teacher đều toàn quyền như nhau).
- Không publish riêng từng exercise/prompt trong Unit — chỉ publish/draft ở cấp Unit.
