# PLAN — Phase 3 bước 1–2: gán `workspaceId` khi GHI (GÓI GỠ CHẶN DEPLOY)

> Tài liệu thi hành cho **bước 1 và 2 của Phase 3** trong [PLAN-MULTI-TENANT.md](PLAN-MULTI-TENANT.md).
> Tách riêng khỏi phần còn lại của Phase 3 vì đây là **gói gỡ chặn deploy cho Phase 2**
> (xem mục 8.1.1 của plan gốc). Bước 3–5 của Phase 3 làm sau, không chặn gì.
>
> **Đọc hết mục 0 trước khi gõ dòng code đầu tiên.**

Trạng thái: ☑ XONG 2026-09-22 (thi hành bởi Sonnet) · Ngày lập: 2026-09-22 · Kết quả đầy đủ: PLAN-MULTI-TENANT.md mục 10
Tiền đề: Phase 2 đã code xong (commit `2748237`), **chưa deploy**.

---

## 0. Luật chơi

### 0.1 Vì sao có tài liệu này

Phase 2 bật lọc theo `workspaceId` ở chiều ĐỌC. Nhưng chưa chỗ nào gán `workspaceId`
khi GHI. Deploy Phase 2 một mình thì app hỏng theo 3 cách, **đã tái hiện được thật**:

| Hỏng gì | Biểu hiện |
|---|---|
| Giáo viên tạo lớp/bài/media | `201 Created` rồi biến mất khỏi danh sách, mở ra `404` |
| Tài khoản tạo mới | `403 "This account is not in a workspace"` ở **mọi** route |
| Học sinh cũ nộp bài | Bài không hiện trong danh sách của chính em |

Làm xong tài liệu này là hết cả ba. **Phase 2 + gói này deploy CÙNG MỘT LẦN.**

### 0.2 Phạm vi — CHỈ bước 1 và 2

**LÀM:**
- Bước 1: gán `workspaceId` cho mọi document tạo mới.
- Bước 2: 2 truy vấn ghi còn sót ở `student/notes.js`.

**KHÔNG LÀM** (bước 3–5 của Phase 3, để commit sau):
- Không kiểm tra tham chiếu chéo cùng workspace (`classIds` trong `units.js`/`tests.js`,
  `classId` trong `students.js`, `audioId`/`imageId`, `unitId`/`testId`).
- Không bỏ chặn 403 "Only an admin can create a new class" ở `admin/classes.js`.
- Không sửa `pages/api/cron/deadline-scan.js` (lặp theo workspace).
- Không đảo fallback ở `lib/notifications/teacher.js` (B7).
- Không đặt `required: true` (Phase 4).
- Không chuyển `teachers.js`/`ai-settings.js` sang `sysadmin/` (Phase 5).

### 0.3 Quy tắc vàng: `workspaceId` lấy từ đâu

Theo thứ tự ưu tiên. **Không bao giờ lấy từ `req.body`** — client không được quyết
mình thuộc workspace nào.

1. **Trong route đã bọc `withTenant`** → `req.ws.workspaceId`. Đây là 90% trường hợp.
2. **Trong hàm ở `lib/`** (không có `req`) → suy từ **document neo** đang cầm sẵn:
   `student.workspaceId`, `unit.workspaceId`, `submission.workspaceId`, `job.workspaceId`.
3. **Không suy được** → **ném lỗi**, đừng đoán.

### 0.4 Cấm tuyệt đối: fallback "workspace duy nhất"

Hiện live chỉ có 1 workspace, nên rất cám dỗ viết kiểu
`workspaceId || (await Workspace.findOne())._id`. **KHÔNG ĐƯỢC.**

Đó đúng là kiểu fallback "không khớp gì thì mở tất cả" mà plan gốc gọi là lỗi B5 —
nó chạy ngon hôm nay và âm thầm gán sai workspace vào ngày có khách hàng thứ hai.
Thiếu workspace thì **ném lỗi to**, để hỏng ngay lúc dev chứ không hỏng lúc chạy thật.

### 0.5 Thà lỗi rõ còn hơn tạo tài khoản chết

`createStudent` mà không biết workspace thì **throw**, đừng tạo. Tạo được một học sinh
không workspace nghĩa là tạo ra một tài khoản đăng nhập được nhưng 403 mọi màn hình —
người dùng không hiểu chuyện gì, còn khó chẩn đoán hơn nhiều so với một lỗi 400 rõ ràng
ngay lúc bấm nút.

### 0.6 Gặp chỗ tài liệu không nói tới

Dừng, ghi vào mục 7, đừng tự sáng tạo. Đặc biệt: **đừng mở rộng sang bước 3–5** vì
thấy "tiện tay" — gói này phải revert được độc lập.

---

## 1. Bước 1A — 12 chỗ `.create()` trong route

Cả 12 route đều đã bọc `withTenant` ở Phase 2, nên `req.ws.workspaceId` **luôn có sẵn**.
Chỉ việc thêm một field.

| # | File | Model | Sửa |
|---|---|---|---|
| 1 | `pages/api/admin/classes.js` | Class | `Class.create({ name, level })` → thêm `workspaceId: req.ws.workspaceId` |
| 2 | `pages/api/admin/units.js` | Unit | thêm `workspaceId: req.ws.workspaceId` vào object `Unit.create({...})` |
| 3 | `pages/api/admin/tests.js` | Test | như trên |
| 4 | `pages/api/admin/audio.js` | Audio | như trên |
| 5 | `pages/api/admin/images.js` | Image | như trên |
| 6 | `pages/api/admin/attendance.js` | AttendanceSession | như trên |
| 7 | `pages/api/admin/submissions/ai-grade.js` | GradingJob | như trên |
| 8 | `pages/api/student/notes.js` | StudentNote | như trên |
| 9–12 | `pages/api/submissions.js` | Submission | **4 chỗ** `Submission.create({...})` — sửa cả 4 |

Cách tìm cho chắc, đừng đếm bằng mắt:

```bash
grep -n "\.create(" pages/api/admin/classes.js pages/api/admin/units.js \
  pages/api/admin/tests.js pages/api/admin/audio.js pages/api/admin/images.js \
  pages/api/admin/attendance.js pages/api/admin/submissions/ai-grade.js \
  pages/api/student/notes.js pages/api/submissions.js
```

Mẫu sửa:

```js
// TRƯỚC
const cls = await Class.create({ name, level });

// SAU
const cls = await Class.create({ name, level, workspaceId: req.ws.workspaceId });
```

---

## 2. Bước 1B — `lib/users.js` (chỗ gây lỗi 403)

Đây là chỗ quan trọng nhất của cả gói: `createStudent`/`createTeacher` không gắn
`workspaceId` nên tài khoản mới bị khoá khỏi toàn app.

### 2.1 Sửa `lib/users.js`

`createStudent` — thêm tham số **bắt buộc**:

```js
async function createStudent({ name, username, password, email, classId = null, workspaceId }) {
  // ...các validate sẵn có giữ nguyên...

  // Không có workspace thì KHÔNG tạo: tài khoản sinh ra sẽ 403 mọi màn hình
  // (lib/tenant.js currentWorkspace -> null -> withTenant trả 403).
  if (!workspaceId) {
    const e = new Error("Cannot create a student without a workspace");
    e.status = 400;
    throw e;
  }

  const student = await Student.create({ name: nm, username, passwordHash, email: em, classId, workspaceId });
  // User.create giữ NGUYÊN — User là tầng platform, không có workspaceId (bảng mục 3).
}
```

`createTeacher` — nhận `workspaceId` **tuỳ chọn**:

```js
async function createTeacher({ name, username, password, email, classIds = [], workspaceId = null }) {
  // ...
  const teacher = await Teacher.create({
    name: nm, username, passwordHash, email: em, classIds,
    ...(workspaceId ? { workspaceId } : {}),
  });
}
```

**Vì sao teacher lại tuỳ chọn còn student thì bắt buộc:** tạo giáo viên đúng nghĩa là
tạo luôn một `Workspace` + `WorkspaceMember` mới cho người đó — việc đó là **Phase 5**
(mục "sysadmin/users.js: khi tạo teacher → tự tạo Workspace + WorkspaceMember").
Gói này không làm Phase 5. Xem 2.3.

`createAdmin` — **không đụng**. Admin là tầng platform, không thuộc workspace nào.

### 2.2 Sửa các chỗ gọi

| File | Dòng | Sửa |
|---|---|---|
| `pages/api/admin/students.js` | chỗ `users.createStudent({...})` | thêm `workspaceId: req.ws.workspaceId` |
| `pages/api/sysadmin/users.js` | nhánh `role === "student"` | **xem 2.3 bên dưới** |
| `pages/api/sysadmin/users.js` | nhánh `role === "teacher"` | **không đổi** (Phase 5) |
| `pages/api/auth.js` | bootstrap `createTeacher` | **không đổi** (xem 2.4) |

### 2.3 `sysadmin/users.js` — admin không có `req.ws`

Route này là `requireRole("admin")`, **không** bọc `withTenant`, nên **không có
`req.ws`**. Admin là tầng platform, không thuộc workspace nào — đúng thiết kế.

Nhưng admin vẫn tạo được học sinh. Workspace suy từ **lớp** được chọn (route đã bắt buộc
có `classId`, xem `if (!b.classId) return 400`):

```js
if (role === "student") {
  if (!b.classId) return res.status(400).json({ ok: false, error: "Please select a class" });
  // Workspace của học sinh = workspace của lớp. Admin không có workspace của
  // riêng mình nên phải suy từ lớp, không được đoán.
  const Class = require("../../../lib/models/Class");
  const cls = await Class.findById(b.classId).select("workspaceId").lean();
  if (!cls || !cls.workspaceId) {
    return res.status(400).json({ ok: false, error: "That class does not belong to a workspace yet" });
  }
  const { user } = await users.createStudent({ ...b, workspaceId: cls.workspaceId });
  // ...
}
```

Nhánh `role === "teacher"` **giữ nguyên**. Hệ quả phải ghi vào changelog/ghi chú vận hành:
**tài khoản giáo viên do admin tạo sẽ 403 cho tới khi Phase 5 xong.** Hôm nay live chỉ có
1 giáo viên nên chưa ảnh hưởng ai. **Đừng tự chế fallback** để "cho nó chạy" — xem 0.4.

### 2.4 `pages/api/auth.js` — đường bootstrap, không đụng

`auth.js` tạo giáo viên đầu tiên bằng `TEACHER_PASSWORD`, nhưng chỉ khi
`Teacher.countDocuments() === 0`. Trên live đã có 1 giáo viên nên nhánh này không bao giờ
chạy nữa. Để nguyên.

---

## 3. Bước 1C — `lib/notifications` (chuông của học sinh)

Đây là chỗ **dễ quên nhất** vì nó không dùng `.create()` nên `grep ".create("` không thấy.

`lib/notifications/index.js` tạo `Notification` bằng `findOneAndUpdate` + `upsert`:

```js
const r = await Notification.findOneAndUpdate(
  { dedupeKey },
  { $setOnInsert: { studentId, teacherId, type, ... } },   // <- thiếu workspaceId
  { upsert: true, new: true, includeResultMetadata: true }
);
```

`Notification` nằm trong nhóm **bắt buộc**, và `pages/api/notifications.js` đã lọc theo
workspace ở Phase 2 → **thông báo mới sẽ không hiện trong chuông của học sinh**.

### 3.1 `emit()` tự suy workspaceId

`emit()` có **6 chỗ gọi**, phần lớn nằm trong `lib/` nên không có `req.ws`:

```
lib/notifications/student.js        (notifyStudentGraded)
lib/notifications/teacher.js        (notifyTeachersOfSubmission)
lib/notifications/generate.js       (generateDeadlineNotifications)
lib/notifications/deadlineAssign.js (runDeadlineEmailJob)
pages/api/submissions.js            (notifyLate)
pages/api/sysadmin/tickets.js       (admin trả lời phiếu — route admin, KHÔNG có req.ws)
```

**Đừng bắt 6 chỗ gọi tự truyền vào** — quên một chỗ là rò âm thầm, và chỗ
`sysadmin/tickets.js` thì không có gì để truyền. Thay vào đó cho `emit()` **tự suy**:

```js
async function emit({ studentId, teacherId, type, dedupeKey, /* ... */, workspaceId }) {
  if ((!studentId && !teacherId) || !type || !dedupeKey) { /* giữ nguyên */ }

  // Thông báo thuộc workspace của người NHẬN. Chỗ gọi nào cầm sẵn thì truyền vào
  // cho đỡ 1 query; không thì tự tra — để không chỗ gọi nào có thể quên.
  let wsId = workspaceId || null;
  if (!wsId) {
    if (studentId) {
      const s = await Student.findById(studentId).select("workspaceId").lean();
      wsId = s && s.workspaceId;
    } else if (teacherId) {
      const t = await Teacher.findById(teacherId).select("workspaceId").lean();
      wsId = t && t.workspaceId;
    }
  }

  const r = await Notification.findOneAndUpdate(
    { dedupeKey },
    { $setOnInsert: { studentId, teacherId, type, /* ... */, ...(wsId ? { workspaceId: wsId } : {}) } },
    { upsert: true, new: true, includeResultMetadata: true }
  );
  // phần còn lại giữ nguyên
}
```

Cần `require` thêm `Student` và `Teacher` ở đầu `lib/notifications/index.js`.

**Không ném lỗi khi không suy được** — khác với `createStudent`. Lý do: thông báo là
việc phụ, chạy ngầm; ném lỗi ở đây có thể làm hỏng cả request nộp bài của học sinh.
Thiếu workspaceId thì thông báo vẫn được tạo, chỉ là chưa hiện cho tới khi quét lại —
đúng bản chất "trôi dạt", chấp nhận được (còn tài khoản chết thì không).

### 3.2 `DeadlineEmailJob` trong `deadlineAssign.js`

```js
const job = await DeadlineEmailJob.create({
  unitId: unit._id,
  classId: d.classId,
  // ...
  workspaceId: unit.workspaceId,   // <- THÊM. Suy từ unit đang cầm sẵn (quy tắc 0.3 #2)
});
```

---

## 4. Bước 2 — 2 truy vấn ghi còn sót

Bước 2 của plan gốc ("mọi PUT/DELETE phải `assertOwned()`") **gần như đã xong ở Phase 2**
nhờ quy tắc 0.6 của tài liệu Phase 2 (chỗ nào GET/PUT/DELETE dùng chung một lần load thì
đã thay bằng `assertOwned`). Đã có: `units`, `tests`, `classes`, `students`, `attendance`,
`submissions`, `audio`, `images`, `grading-jobs`.

Còn đúng 2 truy vấn, cả hai ở `pages/api/student/notes.js`:

```js
// PATCH
const note = await StudentNote.findOneAndUpdate({ _id: id, studentId }, patch, { new: true }).lean();
// DELETE
const r = await StudentNote.deleteOne({ _id: id, studentId });
```

Sửa thành:

```js
const note = await StudentNote.findOneAndUpdate(tenantFilter(req.ws, { _id: id, studentId }), patch, { new: true }).lean();
const r = await StudentNote.deleteOne(tenantFilter(req.ws, { _id: id, studentId }));
```

Dùng `tenantFilter` chứ **không** phải `assertOwned` — `assertOwned` chỉ nhận `_id` đơn,
không nhận filter ghép `_id + studentId`. `tenantFilter` đã import sẵn ở file này từ Phase 2.

Hai chỗ này đã lọc theo `studentId` (chính mình) nên **không rò rỉ dữ liệu**; sửa để nhất
quán và để Phase 4 siết được.

---

## 5. Nghiệm thu

### 5.1 Tĩnh

```bash
for f in $(git diff --name-only -- '*.js'); do node --check "$f" || echo "FAIL $f"; done
node scripts/check-tenant-scope.js --strict
```

**Không chạy `npm run build`** — dev server của chủ máy dùng chung `.next`.

### 5.2 Tái hiện lại đúng 3 thí nghiệm đã chứng minh lỗi

Đây là tiêu chí nghiệm thu chính. Trước khi sửa cả ba đều FAIL; sau khi sửa phải PASS.
Gọi thẳng handler trên **DB dev** (mock `req`/`res`, JWT ký bằng `JWT_SECRET` thật,
`req.ws` do `withTenant` tự giải) — cách này Phase 2 đã dùng, không cần dev server.

| # | Kịch bản | Trước (FAIL) | Sau (phải đạt) |
|---|---|---|---|
| 1 | POST `/api/admin/classes` rồi GET danh sách | tạo xong không thấy, mở ra 404 | **thấy trong danh sách**, GET theo id trả **200** |
| 2 | `users.createStudent(...)` rồi gọi 6 route học sinh | 403 tất cả | **200 tất cả** |
| 3 | Tạo `Submission` qua route rồi GET `/api/submissions` | không thấy bài vừa nộp | **thấy** |

Thêm 2 kịch bản cho phần mới:

| # | Kịch bản | Phải đạt |
|---|---|---|
| 4 | `notifications.emit({studentId, ...})` rồi GET `/api/notifications` | thông báo mới **hiện trong chuông** |
| 5 | `sysadmin/users.js` POST role=student với `classId` hợp lệ | 201, và học sinh đó gọi `/api/units` được **200** |

### 5.3 Không lọt workspace lạ

Sau khi chạy hết kịch bản trên DB dev:

```bash
node scripts/check-orphans.js --dev --strict
```

Phải **0 thiếu** ở nhóm bắt buộc. Trước gói này, mỗi lần chạy test là số thiếu lại tăng.

**Dọn sạch** mọi dữ liệu test (lớp probe, học sinh probe, submission probe) trước khi commit.

### 5.4 Ghi lại

Cập nhật `PLAN-MULTI-TENANT.md`: bảng 0.1 đổi Phase 3 sang ◐ (bước 1–2 xong, 3–5 chưa),
đổi Phase 2 từ "CHƯA deploy được" sang "deploy được cùng gói này", thêm mục Nhật ký.

---

## 6. Checklist

- [x] 1. 12 chỗ `.create()` trong route (mục 1)
- [x] 2. Kiểm ngay kịch bản 1 — tạo lớp phải thấy lại
- [x] 3. `lib/users.js` + 2 chỗ gọi (mục 2)
- [x] 4. Kiểm ngay kịch bản 2 — học sinh mới không còn 403
- [x] 5. `lib/notifications/index.js` `emit()` + `deadlineAssign.js` (mục 3)
- [x] 6. `student/notes.js` 2 truy vấn (mục 4)
- [x] 7. Nghiệm thu 5.1 → 5.2 → 5.3, dọn dữ liệu test
- [ ] 8. Cập nhật plan, commit **một commit riêng**

Bước 2 và 4 là chốt chặn: sai thì dừng, đừng làm tiếp.

---

## 7. Câu hỏi phát sinh

| # | Câu hỏi | File/dòng | Trạng thái |
|---|---|---|---|
| | | | |

Không gặp chỗ nào tài liệu không nói tới — mọi bước đều mapping thẳng theo mục 1–4, kể cả
`sysadmin/users.js` (§2.3, `Class` đã import sẵn nên bỏ dòng `require` mẫu trong tài liệu)
và `admin/attendance.js` (không nằm trong bảng bước 1A vì route đó không tạo document mới
ở nhánh đã sửa — chỉ có 1 `.create()` cho `AttendanceSession`, đã liệt kê đúng ở mục 1).
