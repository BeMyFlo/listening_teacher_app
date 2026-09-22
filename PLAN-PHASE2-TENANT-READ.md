# PLAN — Phase 2: tầng enforcement + lọc mọi route ĐỌC

> Tài liệu thi hành cho **Phase 2** của [PLAN-MULTI-TENANT.md](PLAN-MULTI-TENANT.md).
> File kia là bộ não (bối cảnh, lý do, tiến độ). File này là tay chân: làm gì,
> ở file nào, dòng nào, đổi thành gì.
>
> **Người thi hành đọc kỹ mục 0 trước khi gõ dòng code đầu tiên.**

Trạng thái: ☐ chưa bắt đầu · Ngày lập: 2026-09-22
Tiền đề: Phase 1 đã xong trên live (941 doc có `workspaceId`, workspace `ms-nhi`).

---

## 0. Luật chơi — đọc trước

### 0.1 Phase 2 làm gì

Bật cô lập **ở chiều ĐỌC**. Sau phase này, một giáo viên chỉ **thấy** dữ liệu
trong workspace của mình.

### 0.2 Phase 2 KHÔNG làm gì

Không đụng tới chiều GHI. Cụ thể, **không** làm những việc sau — chúng là Phase 3:

- Không thêm `workspaceId` vào `Model.create(...)` hay `new Model(...)`.
- Không kiểm tra `classIds` / `audioId` / `unitId` truyền lên có cùng workspace không.
- Không sửa `pages/api/cron/deadline-scan.js`.
- Không đảo fallback ở `lib/notifications/teacher.js`.
- Không bỏ chặn 403 ở `admin/classes.js` (cho giáo viên tự tạo lớp).
- Không chuyển `admin/teachers.js` hay `admin/ai-settings.js` sang `sysadmin/` (Phase 5).
- Không đặt `required: true` cho `workspaceId` (Phase 4).

Làm lố sang Phase 3 thì mất khả năng revert độc lập, mà đó chính là lý do tách phase.

### 0.3 Vì sao phase này an toàn

Phase 1 đã dồn **toàn bộ** dữ liệu vào **cùng một** workspace. Nên khi bật lọc,
`find({workspaceId: X})` khớp đúng 100% dữ liệu — y hệt `find({})` cũ.

**Phase 2 là một thay đổi không-làm-gì-cả.** Đó là tiêu chí nghiệm thu: đếm số
dòng trên từng màn hình trước và sau khi deploy, phải **bằng nhau**. Lệch một dòng
là có lỗi, và vì chưa ghi gì nên sửa xong chạy lại là xong.

### 0.4 Hai quy ước bắt buộc, không có ngoại lệ

**① Cross-tenant trả 404, KHÔNG trả 403.**
403 nghĩa là "có tồn tại nhưng anh không được xem" — tự nó đã rò rỉ thông tin.
404 nghĩa là "không có gì ở đây". Người ngoài không phân biệt được "không tồn tại"
với "của người khác".

**② Mọi truy vấn trong route giáo viên/học sinh phải qua `tenantFilter`.**
Kể cả `countDocuments`, `aggregate`, `distinct`. Sót một chỗ là rò một màn hình.

### 0.5 Thứ tự bọc middleware — CHỖ DỄ SAI NHẤT

`PLAN-MULTI-TENANT.md` mục 5.2 ghi `withTenant(requireAuth(...))`. **Viết vậy là sai.**

`requireAuth` mới là lớp xác thực token và gán `req.auth`. `withTenant` cần đọc
`req.auth` để biết ai đang gọi, nên nó phải nằm **BÊN TRONG**:

```js
// ĐÚNG
module.exports = requireAuth(withTenant(handler));

// SAI — req.auth chưa tồn tại khi withTenant chạy
module.exports = withTenant(requireAuth(handler));
```

Route học sinh tương tự: `requireStudent(withTenant(handler))`.

### 0.6 Quy tắc khi GET và PUT dùng chung một lần load

Nhiều route có dạng:

```js
let unit;
unit = await Unit.findById(id);        // dùng chung cho GET, PUT, DELETE
if (!unit) return res.status(404)...
if (req.method === "GET")  { ... }
if (req.method === "PUT")  { ... }
```

Thay lần load đó bằng `assertOwned` là **được phép và nên làm**, dù nó chạm cả
nhánh PUT/DELETE. Lý do: nó chỉ làm chiều ghi **chặt hơn**, không đổi hành vi
trong workspace, và đằng nào Phase 3 cũng cần. Đây là ngoại lệ duy nhất của 0.2.

### 0.7 Không tự ý sáng tạo

Nếu gặp tình huống tài liệu này không nói tới, **dừng lại và hỏi**, đừng đoán.
Ghi câu hỏi vào mục 8 cuối file. Một route lọc sai không báo lỗi gì cả — nó chỉ
âm thầm giấu hoặc lộ dữ liệu.

---

## 1. Bước 1 — `lib/tenant.js` (file mới)

Tạo file mới, chép nguyên văn:

```js
// Tầng enforcement multi-tenant. Xem PLAN-MULTI-TENANT.md mục 5.1.
//
// Workspace của người đang đăng nhập LUÔN được giải ở server theo danh tính
// trong token, KHÔNG bao giờ lấy từ body/query của client, và KHÔNG nhét vào
// JWT. Lý do: token học sinh sống 30 ngày — nhét workspaceId vào token thì khi
// membership đổi, token cũ vẫn mang giá trị lỗi thời. Giải từ DB mỗi request
// thì token cũ vẫn chạy đúng (rủi ro R4 trong plan).
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
    // id sai định dạng ObjectId -> cũng là "không thấy".
    throw new TenantNotFound(opts.message);
  }
  if (!doc) throw new TenantNotFound(opts.message);
  return doc;
}

// Bọc handler: giải workspace, gắn req.ws, và biến TenantNotFound thành 404.
// Thứ tự bọc: requireAuth(withTenant(handler)) — xem mục 0.5 của
// PLAN-PHASE2-TENANT-READ.md.
function withTenant(handler) {
  return async (req, res) => {
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
```

**Giả định của V1 phải nhớ:** `currentWorkspace` dùng
`WorkspaceMember.findOne({ userId })` — tức là **một user thuộc đúng một workspace**.
Đúng với V1 (mỗi giáo viên một workspace). Nếu một user lỡ có hai dòng membership
thì `findOne` trả về dòng nào tuỳ ý, và người đó sẽ nhảy workspace ngẫu nhiên giữa
các request. Đừng bao giờ tạo membership thứ hai cho một user trước Phase 9.

**Kiểm tra ngay sau khi tạo file:**

```bash
node --check lib/tenant.js
node -e "const t=require('./lib/tenant');console.log(Object.keys(t))"
```

Phải in ra: `[ 'currentWorkspace', 'tenantFilter', 'assertOwned', 'withTenant', 'TenantNotFound' ]`

---

## 2. Bước 2 — `pages/api/teacher/me.js` (file mới)

UI cần biết tên workspace để hiển thị (Phase 7 dùng tới, nhưng tạo sẵn ở đây vì
Phase 2 đã có sẵn `req.ws`).

```js
// Hồ sơ của giáo viên đang đăng nhập + workspace của họ. Dùng cho header/sidebar.
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant } = require("../../../lib/tenant");
const Teacher = require("../../../lib/models/Teacher");
const Workspace = require("../../../lib/models/Workspace");

async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }
  await connectDB();

  const teacher = await Teacher.findById(req.auth.teacherId)
    .select("name username email classIds")
    .lean();
  const workspace = await Workspace.findById(req.ws.workspaceId)
    .select("name slug logoUrl locale timezone status")
    .lean();

  return res.status(200).json({
    ok: true,
    teacher: teacher || null,
    workspace: workspace || null,
    membershipRole: req.ws.role,
  });
}

module.exports = requireAuth(withTenant(handler));
```

**Chưa gắn vào UI ở phase này.** Hook `useWorkspace()` và `components/Shell.js`
là việc của Phase 7 (mục 6 của plan gốc).

---

## 3. Bước 3 — Sửa route

### 3.0 Khuôn chung

Mỗi route làm đúng 3 việc:

1. Thêm import: `const { withTenant, tenantFilter, assertOwned } = require("<đường dẫn>/lib/tenant");`
   (chỉ import thứ thực sự dùng)
2. Sửa dòng export cuối file: `requireAuth(handler)` → `requireAuth(withTenant(handler))`
3. Thêm `workspaceId` vào các truy vấn ĐỌC theo bảng dưới.

Đường dẫn import: route trong `pages/api/admin/` dùng `../../../lib/tenant`;
route trong `pages/api/` dùng `../../lib/tenant`; trong `pages/api/student/` và
`pages/api/submissions/` dùng `../../../lib/tenant`.

### 3.1 Nhóm 1 — route giáo viên

Tất cả đều đang là `module.exports = requireAuth(handler);` → đổi thành
`module.exports = requireAuth(withTenant(handler));`

| # | File | Dòng | Việc |
|---|---|---|---|
| 1 | `admin/units.js` | 118 | `Unit.find()` → `Unit.find(tenantFilter(req.ws))` |
| | | 125 | `Unit.findById(id)` (nhánh regrade) → `await assertOwned(req.ws, Unit, id, { message: "Unit not found" })` |
| | | 158 | `Unit.findById(id)` (load dùng chung) → `assertOwned` như trên; **bỏ** khối `try/catch` và `if (!unit)` ngay sau nó vì `assertOwned` đã lo (xem 0.6) |
| | | 39, 50, 76 | `Class.find({...})` trong `sanitizeClassIds`/`sanitizeDeadlines`/`sanitizeSkillLocks` — **ĐỂ NGUYÊN**. Đây là kiểm tra đầu vào của chiều GHI → Phase 3 |
| 2 | `admin/tests.js` | 109 | `Test.find()` → `Test.find(tenantFilter(req.ws))` |
| | | 148 | `Test.findById(id)` → `assertOwned(req.ws, Test, id, { message: "Test not found" })` |
| | | 9 | `Class.find(...)` trong `sanitizeClassIds` — **ĐỂ NGUYÊN** (Phase 3) |
| 3 | `admin/classes.js` | 18 | `Class.find(scope.all ? {} : {...})` → thêm workspace: `Class.find(tenantFilter(req.ws, scope.all ? {} : { _id: { $in: scope.classIds } }))` |
| | | 21 | `Student.aggregate([...])` → thêm `{ $match: tenantFilter(req.ws) }` làm **stage đầu tiên** |
| | | 56 | `Class.findById(id)` → `assertOwned(req.ws, Class, id, { message: "Class not found" })` |
| | | 66 | `Student.find({ classId: cls._id })` → `Student.find(tenantFilter(req.ws, { classId: cls._id }))` |
| | | 40 | Khối chặn 403 "Only an admin can create a new class" — **ĐỂ NGUYÊN** (Phase 3) |
| 4 | `admin/students.js` | 21 | `Student.find(classWhere)` → `Student.find(tenantFilter(req.ws, classWhere))` |
| | | 22 | `Submission.aggregate([{ $group: ... }])` → thêm `{ $match: tenantFilter(req.ws) }` làm **stage đầu tiên** |
| | | 23 | `Class.find(classIdWhere)` → `Class.find(tenantFilter(req.ws, classIdWhere))` |
| | | 84 | `Student.findById(id)` → `assertOwned(req.ws, Student, id, { message: "Student not found" })` |
| | | 54, 125 | `Class.findById(classId)` — **ĐỂ NGUYÊN** (kiểm tra đầu vào chiều ghi, Phase 3) |
| 5 | `admin/dashboard.js` | 21 | `Teacher.findById(req.auth.teacherId)` → để nguyên (là chính mình) |
| | | 22 | `Class.find()` → `Class.find(tenantFilter(req.ws))` |
| | | 29 | `Student.find({ classId: {$in: ...} })` → bọc `tenantFilter(req.ws, {...})` |
| | | 30 | `Unit.find({ status: "published", ... })` → bọc `tenantFilter` |
| | | 31 | `Unit.countDocuments()` → `Unit.countDocuments(tenantFilter(req.ws))` |
| | | 32 | `Test.countDocuments()` → `Test.countDocuments(tenantFilter(req.ws))` |
| | | 33 | `Notification.countDocuments({...})` → bọc `tenantFilter` |
| | | 41 | `Submission.find({ studentId: {$in: ...} })` → bọc `tenantFilter` |
| 6 | `admin/attendance.js` | 50 | `AttendanceSession.findOne({...})` → bọc `tenantFilter` |
| | | 58 | `Unit.find({...})` → bọc `tenantFilter` |
| | | 69 | `Submission.find({...})` → bọc `tenantFilter` |
| | | 96 | `Student.find({ classId })` → bọc `tenantFilter` |
| | | 134, 164 | `Class.findById(...)` → `assertOwned(req.ws, Class, ..., { lean: true, message: "Class not found" })` |
| | | 142 | `AttendanceSession.find({ classId })` → bọc `tenantFilter` |
| | | 143 | `Student.countDocuments({ classId })` → bọc `tenantFilter` |
| | | 174 | `AttendanceSession.findOne({ classId: cid })` → bọc `tenantFilter` |
| | | 192 | `AttendanceSession.findById(id)` → `assertOwned` |
| 7 | `admin/submissions.js` | 21 | `Student.find({ classId: {$in: scope.classIds} })` → bọc `tenantFilter` |
| | | 62 | `Submission.find(filter)` → `Submission.find(tenantFilter(req.ws, filter))` |
| | | 71 | `Test.find({ _id: {$in: testIds} })` → bọc `tenantFilter` |
| | | 90 | `Submission.findById(id)` → `assertOwned(req.ws, Submission, id, { message: "Submission not found" })` |
| 8 | `admin/unit-submissions.js` | 25 | `Unit.findById(unitId)` → `assertOwned(req.ws, Unit, unitId, { lean: true, message: "Unit not found" })` |
| | | 35 | `Class.find({ level: unit.level })` → bọc `tenantFilter` |
| | | 43 | `Student.find({ classId: {$in: ...} })` → bọc `tenantFilter` |
| | | 47 | `Submission.find({ unitId: unit._id })` → bọc `tenantFilter` |
| 9 | `admin/test-submissions.js` | 24 | `Test.findById(testId)` → `assertOwned(req.ws, Test, testId, { lean: true, message: "Test not found" })` — **đây là lỗ hổng B2 nặng nhất, sửa cho đúng** |
| | | 34 | `Class.find({ level: test.level })` → bọc `tenantFilter` |
| | | 42 | `Student.find({...})` → bọc `tenantFilter` |
| | | 46 | `Submission.find({ testId: test._id })` → bọc `tenantFilter` |
| 10 | `admin/grading-queue.js` | 24 | `Submission.find({...})` → bọc `tenantFilter` |
| | | 33 | `Unit.find({ _id: {$in: unitIds} })` → bọc `tenantFilter` |
| 11 | `admin/grading-jobs.js` | 14 | `Submission.findById(submissionId)` → `assertOwned(req.ws, Submission, submissionId, { message: "Submission not found" })` |
| | | 58, 92 | `GradingJob.findById(id)` → `assertOwned(req.ws, GradingJob, id, ...)`. **Lưu ý dòng 92 dùng `.lean()`** → truyền `{ lean: true }` |
| | | 65 | `GradingJob.findOne({...})` → bọc `tenantFilter` |
| 12 | `admin/audio.js` | 12 | `Audio.find()` → `Audio.find(tenantFilter(req.ws))` |
| | | 41 | `Audio.findById(id)` → `assertOwned(req.ws, Audio, id, { message: "Audio not found" })` |
| | | `Test.find(...)` kiểm tra "đang dùng" | bọc `tenantFilter` |
| 13 | `admin/images.js` | 12 | `Image.find()` → `Image.find(tenantFilter(req.ws))` |
| | | 41 | `Image.findById(id)` → `assertOwned(req.ws, Image, id, { message: "Image not found" })` |
| | | `Test.find(...)` kiểm tra "đang dùng" | bọc `tenantFilter` |
| 14 | `admin/deadline-jobs.js` | 44, 69 | `DeadlineEmailJob.find({...})` → bọc `tenantFilter` |
| 15 | `admin/deadline-jobs/run.js` | — | Đọc file, bọc mọi truy vấn ĐỌC bằng `tenantFilter`; nếu có load job theo id → `assertOwned` |
| 16 | `admin/import.js` | — | **CHỈ** đổi dòng export sang `requireAuth(withTenant(handler))`. Route này toàn ghi → Phase 3. Nếu có truy vấn ĐỌC để đối chiếu, bọc `tenantFilter` |
| 17 | `admin/ai-lesson.js` | — | **CHỈ** đổi dòng export. Không ghi DB, không đọc DB |
| 18 | `admin/ai-settings.js` | — | **KHÔNG ĐỤNG VÀO.** Chuyển sang `sysadmin/` là Phase 5 |
| 19 | `admin/teachers.js` | — | **KHÔNG ĐỤNG VÀO.** Chuyển sang `sysadmin/` là Phase 5 (lỗ hổng B3) |

Về `lib/teacherScope.js`: **giữ nguyên, chạy song song.** Nó lọc theo LỚP — một
tầng khác, vẫn còn ích ở Phase 9 khi một workspace có nhiều giáo viên. Không xoá,
không sửa mặc định `{all: true}` (việc đó là Phase 4).

### 3.2 Nhóm 2 — route học sinh

Đổi export thành `requireStudent(withTenant(handler));`

| # | File | Dòng | Việc |
|---|---|---|---|
| 20 | `pages/api/units.js` | 181 | `Unit.find({ status, level, ...classFilter })` → bọc `tenantFilter`. **Đây là chỗ vá lỗi B6** — không có nó thì học sinh workspace A vẫn thấy bài Level 3 của workspace B |
| | | 162 | `Unit.findOne({ _id: id, status, level, ...classFilter })` → bọc `tenantFilter` |
| | | 140, 148 | `Student.findById(req.auth.studentId)` / `Class.findById(student.classId)` → để nguyên (là chính mình) |
| 21 | `pages/api/tests.js` | 140 | `Test.find({ status, level, ...classFilter })` → bọc `tenantFilter` (B6) |
| | | 117 | `Test.findOne({ _id: id, ... })` → bọc `tenantFilter` |
| 22 | `pages/api/student/dashboard.js` | 44 | `Unit.find({ status, level, ...classFilter })` → bọc `tenantFilter` (B6) |
| | | 45 | `Student.find({ classId: cls._id })` → bọc `tenantFilter` |
| | | 54 | `Submission.find({ studentId: {$in: classmateIds} })` → bọc `tenantFilter` |
| 23 | `pages/api/notifications.js` | 40, 44, 61 | `Notification.find/countDocuments({ studentId })` → bọc `tenantFilter` |
| 24 | `pages/api/student/notes.js` | 31 | `StudentNote.find(q)` → `StudentNote.find(tenantFilter(req.ws, q))` |
| 25 | `pages/api/submissions.js` | 58 | `Submission.find({ studentId })` (nhánh GET) → bọc `tenantFilter` |
| | | 93, 158, 226, 268, 286, 294, 309 | **ĐỂ NGUYÊN** — đều nằm trong nhánh POST, thuộc Phase 3 |
| 26 | `pages/api/submissions/reflection.js` | 18 | `Submission.findOne({ _id: id, studentId })` → bọc `tenantFilter` |

Ghi chú: phần lớn truy vấn học sinh đã an toàn sẵn nhờ lọc theo `studentId`.
Thêm `workspaceId` ở đây là phòng thủ nhiều lớp, **trừ** 3 chỗ đánh dấu **B6** —
đó là lỗi thật, bắt buộc phải sửa.

### 3.3 Nhóm 3 — KHÔNG ĐỤNG Ở PHASE NÀY

`pages/api/sysadmin/*` (9 route), `pages/api/teacher/notifications.js`,
`pages/api/tickets.js`, `pages/api/changelog.js`, `pages/api/auth.js`,
`pages/api/cron/deadline-scan.js`.

Riêng `changelog.js` thêm một dòng ghi chú để `check-tenant-scope.js` bỏ qua:

```js
// tenant-exempt: chỉ đọc hồ sơ của chính người đăng nhập.
```

---

## 4. Bước 4 — `scripts/check-tenant-scope.js` (file mới)

Quét `pages/api/admin/`, `pages/api/student/`, và các route học sinh ở gốc
`pages/api/`. Với mỗi file: nếu có `.find(`, `.findOne(`, `.countDocuments(`,
`.aggregate(`, `.distinct(` mà **cả file** không hề xuất hiện `tenantFilter`,
`assertOwned` hoặc `req.ws` → báo lỗi.

Whitelist bằng comment `// tenant-exempt: <lý do>` ở đầu file.

Yêu cầu:
- In danh sách file vi phạm kèm số dòng.
- `--strict` → exit 1 khi có vi phạm. Không cờ → chỉ in, exit 0.
- **Phase 2 chỉ chạy thủ công. CHƯA gắn vào `npm run build`** — việc đó là Phase 4.

Bỏ qua các file ở mục 3.3.

---

## 5. Nghiệm thu

Chạy đủ, theo đúng thứ tự. Không bỏ bước nào.

### 5.1 Tĩnh

```bash
for f in lib/tenant.js pages/api/teacher/me.js pages/api/admin/*.js pages/api/*.js pages/api/student/*.js; do node --check "$f" || echo "FAIL $f"; done
node scripts/check-tenant-scope.js --strict
```

**Không chạy `npm run build`** — dev server của chủ máy đang dùng chung thư mục
`.next`, build sẽ phá nó.

### 5.2 Số liệu phải KHÔNG ĐỔI

Đây là tiêu chí nghiệm thu chính của Phase 2 (mục 0.3). Trước khi deploy, ghi lại
số liệu; sau khi deploy, so lại. Dùng chính live DB làm mốc:

| Màn hình | Kỳ vọng |
|---|---|
| Teacher → Lessons | 6 unit |
| Teacher → Tests | 3 test |
| Teacher → Classes | 5 lớp |
| Teacher → Students | 21 học sinh |
| Teacher → Grading Queue | đúng bằng số trước khi deploy |
| Teacher → Media (audio/ảnh) | 20 audio, 3 ảnh |
| Student → Lessons/Tests | đúng bằng số trước khi deploy |

Lệch **một dòng** cũng phải dừng lại tìm nguyên nhân.

### 5.3 Kịch bản 2 workspace — bắt buộc chạy trên DB DEV

**Tuyệt đối không tạo workspace test trên live DB.**

**KHÔNG dùng `migrate-workspace.js` để tạo workspace test.** Script đó thêm
`WorkspaceMember` cho **mọi** user role=teacher vào workspace mà nó đang xử lý.
Chạy nó với slug mới sẽ tạo cho `msnhi` một dòng membership THỨ HAI, trỏ vào
workspace rỗng. `currentWorkspace()` dùng `WorkspaceMember.findOne({ userId })`
— một user một workspace ở V1 — nên `msnhi` có thể bị đẩy sang workspace rỗng và
mất sạch dữ liệu trên màn hình. Tạo tay theo đúng các bước dưới.

```bash
# Chạy trên DB DEV. Tạo workspace test + user teacher riêng cho nó.
node -e '
const m=require("mongoose"), fs=require("fs"), bcrypt=require("bcryptjs");
const u=fs.readFileSync(".env.local","utf8").match(/^MONGODB_URI_DEV=(.*)$/m)[1].trim();
(async()=>{ await m.connect(u);
  const W=require("./lib/models/Workspace"), WM=require("./lib/models/WorkspaceMember");
  const U=require("./lib/models/User"), T=require("./lib/models/Teacher");
  const ws=await W.create({name:"WS Test",slug:"ws-test",ownerUserId:new m.Types.ObjectId()});
  const hash=await bcrypt.hash("test12345",10);
  const t=await T.create({name:"GV Test",username:"gvtest",passwordHash:hash,workspaceId:ws._id});
  const usr=await U.create({username:"gvtest",passwordHash:hash,role:"teacher",teacherId:t._id,name:"GV Test"});
  await W.updateOne({_id:ws._id},{$set:{ownerUserId:usr._id}});
  await WM.create({workspaceId:ws._id,userId:usr._id,role:"owner"});
  console.log("workspace",ws._id,"| user gvtest / test12345");
  // Chốt an toàn: msnhi phải vẫn đúng 1 membership.
  const msnhi=await U.findOne({username:"msnhi"}).lean();
  console.log("membership của msnhi:", await WM.countDocuments({userId:msnhi._id}), "(phải = 1)");
  await m.disconnect();})()'
```

Sau đó kiểm:

```
1. Đăng nhập gvtest / test12345  -> mọi màn hình giáo viên RỖNG HOÀN TOÀN
2. GET /api/admin/units?id=<id unit của ms-nhi>           -> phải 404
3. GET /api/admin/test-submissions?testId=<id của ms-nhi> -> phải 404 (lỗ B2)
4. GET /api/admin/grading-queue                           -> phải rỗng
5. Đăng nhập lại bằng msnhi trên dev -> dữ liệu vẫn đủ y như trước
```

Bước 2 và 3 phải trả **404**, không phải 403 (mục 0.4). Nhận 403 là làm sai.

Dọn sau khi xong: xoá workspace `ws-test`, user + teacher `gvtest`, và dòng
`WorkspaceMember` của nó trên DB dev.

### 5.4 Ghi lại

Cập nhật `PLAN-MULTI-TENANT.md`: bảng 0.1 đổi Phase 2 sang ☑, thêm một mục vào
Nhật ký mục 10 ghi rõ số liệu trước/sau và kết quả kịch bản 2 workspace.

---

## 6. Rollback

`git revert` commit của Phase 2. Dữ liệu không đổi gì trong cả phase này nên
revert là sạch tuyệt đối — không có gì phải dọn.

Đây là lý do Phase 2 nên nằm **một commit riêng**, tách khỏi Phase 1.

---

## 7. Thứ tự làm — checklist

Làm tuần tự, tick từng dòng. Sau mỗi nhóm chạy lại `node --check`.

- [ ] 1. `lib/tenant.js` + kiểm tra `node -e` in ra đủ 5 export
- [ ] 2. `pages/api/teacher/me.js`
- [ ] 3. Route 1–4 (units, tests, classes, students) — 4 route xương sống
- [ ] 4. Kiểm tra tay: đăng nhập giáo viên, 4 màn hình đó còn đủ dữ liệu
- [ ] 5. Route 5–9 (dashboard, attendance, submissions, unit-submissions, test-submissions)
- [ ] 6. Route 10–17 (grading-queue, grading-jobs, audio, images, deadline-jobs, run, import, ai-lesson)
- [ ] 7. Route 20–26 (nhóm học sinh)
- [ ] 8. `scripts/check-tenant-scope.js` + chạy `--strict`
- [ ] 9. Nghiệm thu 5.1 → 5.2 → 5.3
- [ ] 10. Cập nhật `PLAN-MULTI-TENANT.md`, commit riêng một commit

Bước 4 là chốt chặn quan trọng: nếu 4 route xương sống đã sai thì dừng luôn,
đừng làm tiếp 22 route còn lại rồi mới phát hiện.

---

## 8. Câu hỏi phát sinh khi thi hành

> Gặp chỗ tài liệu không nói tới thì ghi vào đây, đừng tự đoán (mục 0.7).

| # | Câu hỏi | File/dòng | Trạng thái |
|---|---|---|---|
| | | | |
