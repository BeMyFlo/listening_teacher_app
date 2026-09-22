# PLAN — Multi-Tenant Platform Migration

> **Đọc file này trước khi làm bất cứ việc gì liên quan tới multi-tenant.**
> File này là nguồn sự thật duy nhất về tiến độ. Mỗi lần hoàn thành một phase,
> cập nhật bảng ở mục 0.1 và ghi vào Nhật ký (mục 10). Không sửa code theo trí nhớ
> hay theo mô tả ở file PLAN khác — các file `PLAN-*.md` còn lại đều viết cho kiến
> trúc single-tenant và đã lỗi thời ở điểm này.

Ngày lập: 2026-09-22 · Soát lại số liệu: 2026-09-22 (xem Nhật ký mục 10)
Trạng thái tổng: **Phase 0 — chưa bắt đầu code. Mới có audit.**

---

## 0. Bảng điều khiển

### 0.1 Tiến độ các phase

| Phase | Tên | Trạng thái | Ghi chú |
|---|---|---|---|
| 0 | Lưới an toàn (backup, script kiểm kê, không đổi hành vi) | ☑ xong | 2026-09-22 |
| 1 | Thêm `Workspace` + `WorkspaceMember` + backfill dữ liệu cũ | ☑ xong | Chạy trên live 2026-09-22: 941 doc, còn thiếu 0 |
| 2 | Tầng enforcement `lib/tenant.js` + áp cho mọi route ĐỌC | ☑ code xong, **CHƯA deploy được** | 26/26 route. 🔴 Phải deploy chung bước 1–2 Phase 3 — mục 8.1.1 |
| 3 | Áp `workspaceId` cho mọi route GHI + luồng học sinh | ☐ chưa làm | |
| 4 | Siết cứng: `required: true`, bỏ fallback, index, kiểm tra mồ côi | ☐ chưa làm | |
| 5 | Tách Platform Admin vs Teacher (phân quyền thật) | ☐ chưa làm | |
| 6 | Self-serve signup + onboarding + Workspace Settings | ☐ chưa làm | |
| 7 | Gỡ branding cứng (app, email, Cloudinary folder) | ☐ chưa làm | |
| 8 | Taxonomy Subject / Program / Skill (mở đường TOEIC, General, Toán…) | ☐ chưa làm | |
| 9 | Tương lai: nhiều giáo viên / 1 workspace, enrollment nhiều lớp, Organization | ☐ chưa làm | không làm trong V1 |

Ký hiệu: ☐ chưa làm · ◐ đang làm · ☑ xong & đã verify trên production

### 0.2 Con đường đi (để lần sau đọc lại hiểu ngay)

```
HÔM NAY                    V1 (phase 1-7)              V2 (phase 8)             V3 (phase 9)
1 app của Ms Nhi     →     Nhiều giáo viên        →    Nhiều môn/chương    →    Nhiều trung tâm
mọi teacher dùng chung     mỗi người 1 workspace       trình trong 1 môn         (org có nhiều GV)
dữ liệu                    cô lập hoàn toàn            English: IELTS/            + marketplace
                                                       TOEIC/General
                                                       sau: Toán, Lý, Hoá
```

Nguyên tắc xuyên suốt: **app đang chạy thật, có học sinh thật đang dùng.**
Mỗi phase phải deploy được độc lập và app vẫn hoạt động bình thường sau khi deploy.
Không có phase nào "làm dở dang rồi deploy".

**Một ngoại lệ duy nhất, phát hiện lúc thi hành:** Phase 2 (bật lọc khi ĐỌC) và bước 1–2 của
Phase 3 (gán `workspaceId` khi GHI) **phải lên production cùng một lần**. Tách commit thì được,
tách lần deploy thì app hỏng — lý do và bằng chứng ở mục 8.1.1.

### 0.3 Ba quyết định kiến trúc đã chốt

1. **Dùng `Workspace` (tenant) chứ không dùng `ownerTeacherId` trên từng model.**
   Lý do: brief yêu cầu sau này 1 trung tâm có nhiều giáo viên. Nếu gắn quyền sở hữu
   vào `teacherId`, tới lúc đó phải migrate lại toàn bộ. `workspaceId` là 1 lớp gián
   tiếp rẻ tiền, thêm ngay từ đầu thì sau này chỉ cần thêm member vào workspace.

2. **Có bảng `WorkspaceMember` ngay từ Phase 1, dù V1 mỗi workspace chỉ 1 owner.**
   Lý do: quan hệ member là thứ đắt nhất khi retrofit. Tạo sẵn bảng với 1 dòng/workspace
   gần như không tốn gì, nhưng mở được phase 9 mà không phải migrate.

3. **Workspace hiện tại được giải ở SERVER theo `userId`, KHÔNG lấy từ JWT claim,
   KHÔNG lấy từ body/query của client.** Có cache in-memory. Lý do: brief yêu cầu
   không tin client; đồng thời tránh token cũ mang workspaceId đã lỗi thời khi
   membership đổi.

4. **Ngân sách AI là của TOÀN PLATFORM, không chia theo workspace.** Admin đặt một
   hạn mức chung (ví dụ 1 triệu đồng/tháng); mọi lượt gọi LLM của mọi giáo viên cộng
   dồn vào cùng một con số, chạm trần là chặn tất cả. Vì vậy `AiSpend` giữ nguyên
   `_id = "YYYY-MM"` và **không** thêm `workspaceId`.
   Hệ quả phải biết trước: một workspace xài mạnh có thể tiêu hết quota của cả nhà.
   Muốn chặn riêng từng workspace thì cần hạn mức theo workspace — để phase 9, cùng
   với billing. Trước mắt `AiLog` có `workspaceId` nên admin vẫn xem được ai tiêu bao nhiêu.

---

## 1. (A) Kiến trúc hiện tại

Stack: Next.js 14 (App Router cho UI + `pages/api` cho serverless) · MongoDB/Mongoose ·
Cloudinary · Gemini · Nodemailer · Vercel + Vercel Cron.
Quy mô: **20 model**, **41 route API**, **40 trang** (`app/**/page.js`).
*(Audit gốc đếm 17/37/37; đợt tính năng AI bổ sung 3 model `AiLog`/`AiPrompt`/`AiSpend`,
4 route `admin/ai-lesson`, `admin/test-submissions`, `sysadmin/ai-logs`, `changelog`,
và 3 trang `admin/ai-logs`, `teacher/tests/[testId]/submissions[/[studentId]]`.)*

### 1.1 Auth & danh tính

- `lib/models/User.js` — danh tính đăng nhập DUY NHẤT của mọi vai trò.
  `username` unique **toàn cục**, `role` ∈ {admin, teacher, student}, trỏ tới hồ sơ
  nghiệp vụ qua `teacherId` / `studentId`.
- `lib/models/Teacher.js` — hồ sơ giáo viên: name, username, passwordHash, email,
  **`classIds[]`** (lớp phụ trách).
- `lib/models/Student.js` — hồ sơ học sinh: name, username, passwordHash, email,
  **`classId`** (MỘT lớp duy nhất, nullable).
- `pages/api/auth.js` — chỉ có **login**, không có signup. Có rate limit theo
  (IP+username) và theo IP. Tự backfill `User` cho tài khoản Teacher/Student cũ.
- `lib/auth.js` — `requireRole(role)` bọc handler, gắn `req.auth` = JWT payload.
  `requireAuth` = `requireTeacher` = `requireRole("teacher")`.
  Token: teacher 12h, student 30d. Không có khái niệm workspace ở bất kỳ đâu.
- Tài khoản được tạo bởi: admin qua `sysadmin/users.js`, hoặc giáo viên tạo học sinh
  qua `admin/students.js`. `lib/users.js` giữ toàn bộ logic tạo/đổi/xoá.

### 1.2 Quan hệ dữ liệu hiện tại

```
User ──1:1──> Teacher ──classIds[]──> Class <──classId── Student <──1:1── User
                                        │
                                        │ (level)
                                        ▼
                         Unit.level / Test.level  ← nội dung lọc theo LEVEL, không theo GV
                         Unit.classIds[] / Test.classIds[]  ← gán lớp (tuỳ chọn)
```

- `Class` = { name, level }. **Không có chủ sở hữu.**
- Học sinh thấy nội dung gì: `pages/api/units.js` đọc `Class.level` của em → lọc
  `Unit{status:"published", level, (classIds rỗng HOẶC chứa lớp em)}`.
  `pages/api/tests.js` làm y hệt. → **Nội dung được ghép với học sinh qua `level`,
  một số nguyên toàn cục.** Đây là gốc rễ của vấn đề multi-tenant.
- `Unit` = bài học, có 6 category cố định (grammar, vocabulary, listening, reading,
  writing, speaking), mỗi category có theory + exercises + prompts + topics + groups;
  có `deadlines[]` và `skillLocks[]` theo lớp.
- `Test` = mock test 4 kỹ năng, có `opensAt`/`closesAt`, `classIds[]`.
- `Submission` = mọi bài nộp (kind: test | exercise | writing | speaking), gắn
  `studentId`, có rubric/annotation/AI grading.
- `Audio`, `Image` = thư viện media, **dùng chung toàn hệ thống**.
- `AttendanceSession` = buổi điểm danh của 1 lớp.
- `StudentNote` = sổ tay học sinh (gắn `studentId`).
- `Notification`, `Ticket` = có `studentId` HOẶC `teacherId`.
- `AuditLog`, `AppSetting`, `GradingJob`, `DeadlineEmailJob` = hạ tầng.

### 1.3 Scoping đã có (một phần, chưa commit)

`lib/teacherScope.js` — file mới, **chưa vào git**:
- `Teacher.classIds` rỗng → `{all: true}` (thấy TẤT CẢ);
- có giá trị → chỉ thấy đúng các lớp đó.

Đã áp cho **4/18** route giáo viên: `classes`, `students`, `attendance`, `submissions`
(+ `admin/dashboard.js` tự làm inline, cùng quy ước).

---

## 2. (B) Toàn bộ chỗ giả định "chỉ có một giáo viên"

### B1 — Không model nội dung nào biết ai sở hữu nó

`grep teacherId|ownerId|createdBy lib/models/` chỉ trả về `User`, `Notification`, `Ticket`.
**11 model đang hoàn toàn vô chủ**: `Class`, `Unit`, `Test`, `Audio`, `Image`, `Student`,
`AttendanceSession`, `Submission`, `StudentNote`, `GradingJob`, `DeadlineEmailJob`.

`AiLog` có `actorId`/`actorRole` (ai bấm nút) nhưng đó là **người gọi**, không phải
**chủ sở hữu dữ liệu** — vẫn không lọc được theo workspace. Vẫn tính là vô chủ.

### B2 — Route giáo viên không lọc gì cả

| Route | Vấn đề |
|---|---|
| `pages/api/admin/units.js:117` | `Unit.find()` trần — mọi GV thấy & sửa mọi bài học |
| `pages/api/admin/tests.js:109` | `Test.find()` trần — mọi GV thấy & sửa mọi mock test |
| `pages/api/admin/audio.js:12` | `Audio.find()` trần — thư viện audio dùng chung |
| `pages/api/admin/images.js:12` | `Image.find()` trần — thư viện ảnh dùng chung |
| `pages/api/admin/grading-queue.js:24` | `Submission.find()` trần — GV A thấy bài cần chấm của học sinh GV B |
| `pages/api/admin/unit-submissions.js` | không lọc |
| `pages/api/admin/import.js` | import vào kho chung |
| `pages/api/admin/deadline-jobs.js` + `/run.js` | không lọc |
| `pages/api/admin/grading-jobs.js` | không lọc |
| `pages/api/admin/submissions/ai-grade.js` | không kiểm tra submission có thuộc GV không |
| `pages/api/admin/ai-settings.js` | ghi vào `AppSetting` singleton — GV này đổi model AI thì đổi cho CẢ HỆ THỐNG |
| `pages/api/admin/test-submissions.js` | `Test.findById(req.query.testId)` trần — truyền testId bất kỳ là xem được toàn bộ bài thi + tên học sinh của GV khác |
| `pages/api/admin/ai-lesson.js` | không ghi DB, nhưng tiêu ngân sách AI chung và ghi `AiLog` không kèm workspace |

Tổng: **20 route dưới `pages/api/admin/`, chỉ 4 có scope.**

### B3 — Leo thang đặc quyền: `pages/api/admin/teachers.js`

Route này guard bằng `requireAuth` (= teacher). Tức là **bất kỳ giáo viên nào cũng
liệt kê được mọi giáo viên khác và sửa `classIds` + email của họ** (dòng 11–45).
Ở mô hình multi-tenant đây là lỗ hổng nghiêm trọng, không chỉ là "thiếu lọc".

### B4 — Giáo viên không tự tạo được lớp

`pages/api/admin/classes.js:40` — giáo viên có `classIds` thì POST bị chặn 403
("Only an admin can create a new class"). Đúng logic cũ (admin phân công lớp), nhưng
**chặn thẳng mục tiêu "mỗi giáo viên tự tạo lớp riêng"**.

### B5 — Mặc định nguy hiểm: "chưa gán lớp = thấy tất cả"

`lib/teacherScope.js` và `lib/notifications/teacher.js:15` đều fallback theo hướng
"không khớp gì → mở toàn bộ". Ở single-tenant là thiết kế chống mất thông báo. Ở
multi-tenant, **tài khoản giáo viên mới tạo ra sẽ tự động nhìn thấy toàn bộ dữ liệu
của mọi người**. Đây là bug bảo mật nghiêm trọng nhất phải đảo chiều.

### B6 — `level` là số nguyên toàn cục

Nội dung ghép với học sinh qua `Class.level` ↔ `Unit.level` / `Test.level`
(`pages/api/units.js:151`, `pages/api/tests.js:106`). Hai giáo viên cùng đặt "Level 3"
→ bài của người này đổ vào lớp người kia. Tin tốt: **không có danh sách level hardcode**
(`app/teacher/lessons/page.js:46`, `app/teacher/tests/page.js:29` đều suy từ dữ liệu),
nên chỉ cần `workspaceId` là level tự động thành "level trong workspace".

### B7 — Cron & thông báo quét toàn cục

- `pages/api/cron/deadline-scan.js` → `generateDeadlineNotificationsForAll()` →
  `lib/notifications/generate.js:65` `Student.find({classId: {$ne: null}})` — **mọi
  học sinh của mọi giáo viên trong một vòng lặp**.
- `lib/notifications/teacher.js:15` — không GV nào phụ trách lớp đó → gửi cho **tất cả
  giáo viên**. Multi-tenant = rò rỉ tên học sinh sang workspace khác.
- `lib/notifications/deadlineAssign.js` — sweep job toàn cục.

### B8 — Branding cứng

| Vị trí | Nội dung |
|---|---|
| `app/layout.js:5-6` | `title: "Ms Nhi"`, `description: "IELTS LMS"` |
| `app/login/page.js:84` | chữ "IELTS" vẽ cứng trong SVG minh hoạ |
| `app/login/page.js:91`, `components/Shell.js:65` | `<img src="/logo.svg" alt="Ms Nhi">` |
| `lib/notifications/channels/email.js:35,59` | "Ms Nhi IELTS" trong header email + subject |
| `lib/mailer.js` | env `EMAIL_FROM` ví dụ "Ms Nhi IELTS <…>" |
| `public/logo.svg` | logo riêng của cô |

### B9 — Cloudinary dùng chung, folder cứng

- `components/teacher/MediaLibrary.js:18,33` — folder `"ielts-listening"` / `"ielts-images"` hardcode.
- `lib/client/api.js:16` — upload **unsigned** qua preset `"ielts_speaking_unsigned"`,
  **folder do client quyết định**. Nghĩa là kể cả khi tách folder theo workspace, client
  vẫn ghi được vào folder workspace khác nếu cố tình. Tách folder là "ngăn nắp", KHÔNG
  phải "bảo mật" — phải nói rõ điều này khi làm phase 7.
- `pages/api/sysadmin/storage.js` — quota Cloudinary tính chung toàn account.

### B10 — Cấu hình AI là toàn cục nhưng do giáo viên chỉnh

`AppSetting(key="grading")` là singleton; trang chỉnh nó là `/teacher/ai-grading`
(`lib/grading/aiModels.js:3`). Một giáo viên đổi chuỗi model → ảnh hưởng mọi giáo viên.

### B11 — Impersonate chỉ hiểu 1 tầng

`pages/api/sysadmin/impersonate.js` chỉ cho admin "đăng nhập hộ" role teacher, chưa có
khái niệm "vào workspace nào".

### B12 — Không có đường đăng ký

`pages/api/auth.js` chỉ có login. Giáo viên mới **bắt buộc** phải có admin tạo tay.

---

## 3. (C) Phân loại ranh giới tenant cho từng model

| Model | Tầng | Cần `workspaceId`? | Ghi chú |
|---|---|---|---|
| `User` | **Platform** | ❌ | Danh tính đăng nhập toàn cục. `username` giữ unique toàn cục (xem 4.4). |
| `Workspace` *(mới)* | **Platform** | — | Chính nó là tenant. |
| `WorkspaceMember` *(mới)* | **Platform** | ✅ (là khoá) | (workspaceId, userId, role) |
| `Teacher` | Workspace | ✅ | Hồ sơ nghiệp vụ nằm trong 1 workspace |
| `Student` | Workspace | ✅ | V1: 1 student ∈ 1 workspace (xem 3.1) |
| `Class` | Workspace | ✅ | |
| `Unit` | Workspace | ✅ | Kho bài học riêng của GV |
| `Test` | Workspace | ✅ | |
| `Audio` | Workspace | ✅ | |
| `Image` | Workspace | ✅ | |
| `AttendanceSession` | Workspace (qua Class) | ✅ | Giữ `classId`, thêm `workspaceId` để query 1 tầng |
| `Submission` | Workspace (qua Student) | ✅ | Denormalize để grading-queue lọc được 1 phát |
| `StudentNote` | Workspace (qua Student) | ✅ | |
| `Notification` | Workspace | ✅ | |
| `GradingJob` | Workspace | ✅ | |
| `DeadlineEmailJob` | Workspace | ✅ | |
| `Ticket` | **Platform** | ⚠️ nên có, không bắt buộc | Ticket gửi cho Platform Admin. Thêm `workspaceId` chỉ để thống kê. |
| `AuditLog` | **Platform** | ⚠️ nên có | Thêm `workspaceId` để admin lọc theo workspace |
| `AppSetting` | **Platform** | ❌ | Cấu hình platform (model AI, safety). Phần workspace-level tách sang `Workspace.settings` khi cần. |
| `AiLog` | **Platform** | ⚠️ nên có | Nhật ký gọi LLM. `context` chứa tên học sinh/bài → admin lọc theo workspace để không trộn dữ liệu khi đọc log. Không `required` (cron gọi LLM thì chưa chắc có workspace). TTL 30 ngày. |
| `AiPrompt` | **Platform** | ❌ | Kho system prompt khử trùng lặp, `_id` = sha1 của nội dung. Thêm `workspaceId` sẽ **phá cơ chế dedupe** (cùng một prompt sẽ bị lưu nhiều bản). Prompt không chứa dữ liệu học sinh. |
| `AiSpend` | **Platform** | ❌ | Ngân sách AI dùng chung toàn platform — quyết định 0.3.4. `_id` = "YYYY-MM", cộng dồn cho mọi workspace. |

**Quy tắc denormalize:** `Submission`, `StudentNote`, `AttendanceSession` đều có thể suy
ra workspace qua join. Vẫn ghi thẳng `workspaceId` lên document — vì mọi màn hình liệt kê
đều cần lọc, join mỗi lần vừa chậm vừa dễ quên (chính là nguồn gốc lỗi rò rỉ dữ liệu).

### 3.1 Phân tích model Student (brief mục 10 yêu cầu)

Hiện tại `Student.classId` là **một** ObjectId. Kiểm tra 5 kịch bản:

| Kịch bản | Hiện tại | Sau Phase 1-4 | Cần gì thêm |
|---|---|---|---|
| 1 GV có nhiều lớp | ✅ chạy được | ✅ | — |
| HS chuyển lớp | ✅ (đổi `classId`, level lấy theo `Class.level`) | ✅ | Cần cảnh báo: đổi sang lớp khác level → nội dung em thấy đổi theo |
| HS học nhiều lớp cùng lúc | ❌ không được | ❌ vẫn không | Cần `Enrollment` (phase 9) |
| Nhiều GV / 1 workspace | ❌ | ⚠️ được, nhưng mọi GV trong workspace thấy mọi HS | Cần `Class.teacherIds` (phase 9) |
| HS học với 2 GV khác workspace | ❌ | ❌ | Cần tách `User` ↔ `Student profile` 1:N (phase 9) |

**Kết luận: KHÔNG rewrite model Student trong V1.** Chỉ thêm `workspaceId`. Ba kịch bản
còn thiếu đều thuộc phase 9 và đều giải được bằng cách thêm bảng `Enrollment`
(studentId, classId, workspaceId, status) mà không phải sửa dữ liệu cũ — vì `classId`
hiện tại chuyển thành "lớp chính" và enrollment là bảng phụ. Đây là lý do không cần
động vào nó bây giờ.

---

## 4. (D) Thay đổi schema

### 4.1 Model mới

```js
// lib/models/Workspace.js
{
  name: String,              // "Ms Nhi English Academy" — GV tự đặt
  slug: String,              // unique, dùng cho URL/folder Cloudinary
  ownerUserId: ObjectId,     // User role=teacher — chủ workspace
  logoUrl: String,           // "" = dùng logo mặc định của platform
  locale: String,            // "vi" | "en"
  timezone: String,          // mặc định "Asia/Ho_Chi_Minh"
  subjects: [String],        // ["english"] — phase 8 dùng
  programs: [String],        // ["ielts"]   — phase 8 dùng
  status: String,            // active | suspended
  settings: Mixed,           // chỗ chứa cấu hình workspace-level về sau (rubric, AI prefs)
  createdAt, updatedAt
}

// lib/models/WorkspaceMember.js
{
  workspaceId: ObjectId,
  userId: ObjectId,
  role: String,              // "owner" | "teacher"  (V1 luôn là "owner")
  createdAt
}
// index unique (workspaceId, userId); index (userId)
```

### 4.2 Thêm field vào model cũ

`workspaceId: { type: ObjectId, ref: "Workspace", index: true }` vào **16 model** ở bảng mục 3.

Trong đó **13 model bắt buộc** (Phase 4 đặt `required: true`): `Teacher`, `Student`, `Class`,
`Unit`, `Test`, `Audio`, `Image`, `AttendanceSession`, `Submission`, `StudentNote`,
`Notification`, `GradingJob`, `DeadlineEmailJob`.
Và **3 model chỉ thêm field để lọc/thống kê**, **KHÔNG** đặt `required`: `Ticket`, `AuditLog`,
`AiLog` — đây là doc tầng platform, có thể sinh ra khi chưa xác định được workspace
(ví dụ log lần gọi LLM từ cron, hoặc audit hành động của admin). Ép `required` ở nhóm này
là cách nhanh nhất để dính R9.

`AiPrompt` và `AiSpend` **không** có `workspaceId` — xem quyết định 0.3.4 và bảng mục 3.

**Phase 1–3: KHÔNG đặt `required: true`.** Field optional → dữ liệu cũ vẫn đọc được,
code cũ vẫn chạy, deploy không gãy. Chỉ tới **Phase 4** mới siết `required` sau khi
script kiểm tra xác nhận không còn document nào thiếu.

### 4.3 Index cần thêm (Phase 4)

```
Unit:              { workspaceId: 1, level: 1, order: 1 }
Test:              { workspaceId: 1, status: 1, level: 1 }
Class:             { workspaceId: 1, level: 1, name: 1 }
Student:           { workspaceId: 1, classId: 1 }
Submission:        { workspaceId: 1, gradingStatus: 1, submittedAt: -1 }
Submission:        { workspaceId: 1, studentId: 1, submittedAt: -1 }
Audio / Image:     { workspaceId: 1, uploadedAt: -1 }
AttendanceSession: { workspaceId: 1, classId: 1, date: -1 }
Notification:      { workspaceId: 1, createdAt: -1 }
AiLog:             { workspaceId: 1, at: -1 }          ← chỉ để admin lọc; giữ nguyên TTL sẵn có
```

### 4.4 Quyết định về `username`

**Giữ `username` unique TOÀN CỤC.** Lý do: trang login không có ô chọn workspace
(`app/login/page.js`) và role được tự nhận diện từ tài khoản. Nếu cho trùng username
giữa các workspace thì buộc phải thêm bước chọn workspace khi đăng nhập — UX xấu hơn và
không cần thiết cho V1. Đổi lại: khi GV tạo học sinh mà username đã tồn tại, lỗi phải
nói rõ "username này đã có người dùng trên hệ thống, hãy chọn tên khác"
(`lib/users.js:16` `assertUsernameFree`). Có thể gợi ý tự động hậu tố `.{ws-slug}`.

### 4.5 Script migration (Phase 1)

`scripts/migrate-workspace.js` — **phải idempotent**, chạy lại nhiều lần không hỏng:
1. Tạo (hoặc tìm) workspace `slug: "ms-nhi"`, `name: "Ms Nhi English Academy"`,
   `ownerUserId` = User teacher đầu tiên theo `createdAt`.
2. Tạo `WorkspaceMember` cho MỌI user role=teacher hiện có — role="owner" cho chủ,
   "teacher" cho phần còn lại. **Thực tế đo 2026-09-22: live DB chỉ có 1 teacher
   (`msnhi`)**, nên vòng lặp này chạy đúng 1 lần và người đó là owner. Vẫn viết dạng
   vòng lặp để script chạy đúng cả trên DB dev (có thể có tài khoản test).
3. `updateMany({workspaceId: {$exists: false}}, {$set: {workspaceId: wsId}})` cho 16 collection.
4. In báo cáo: mỗi collection còn bao nhiêu doc thiếu `workspaceId` (phải = 0).
5. Có cờ `--dry-run` in ra số lượng sẽ sửa mà không ghi.

---

## 5. (E) Thay đổi authorization API

### 5.1 Tầng enforcement mới — `lib/tenant.js`

```js
// Giải workspace của người đang đăng nhập — LUÔN từ server, không từ client.
async function currentWorkspace(auth)      // -> { workspaceId, role } | null   (có cache)
function tenantFilter(ws, extra)           // -> { workspaceId: ws.workspaceId, ...extra }
async function assertOwned(ws, Model, id)  // -> doc | throw 404 (KHÔNG throw 403)
function withTenant(handler)               // wrapper: gắn req.ws, 403 nếu user không có workspace
```

Hai quy ước bắt buộc:
- **Cross-tenant trả 404, không trả 403.** 403 xác nhận "id này có tồn tại" → rò rỉ thông tin.
- **Mọi truy vấn trong route giáo viên phải đi qua `tenantFilter`.** Không có ngoại lệ,
  kể cả `countDocuments`, `aggregate`, `distinct`.

### 5.2 Bảng route cần sửa

**Nhóm 1 — route giáo viên (20 route, `requireAuth(handler)` → `requireAuth(withTenant(handler))`)**

> Thứ tự bọc: `withTenant` nằm **bên trong** `requireAuth`, vì `requireAuth` mới là
> lớp xác thực token và gán `req.auth` — thứ mà `withTenant` cần đọc.

| Route | Việc phải làm |
|---|---|
| `admin/units.js` | lọc list; gán `workspaceId` khi tạo; `assertOwned` khi sửa/xoá; `sanitizeClassIds`/`sanitizeDeadlines`/`sanitizeSkillLocks` phải lọc `Class` trong workspace |
| `admin/tests.js` | như trên |
| `admin/classes.js` | bỏ chặn 403 ở dòng 40 → GV **được** tạo lớp trong workspace mình |
| `admin/students.js` | lọc + gán; kiểm tra `classId` truyền lên thuộc workspace |
| `admin/attendance.js` | thay `teacherScope` bằng `tenantFilter` |
| `admin/submissions.js` | như trên |
| `admin/unit-submissions.js` | thêm lọc |
| `admin/grading-queue.js` | thêm lọc — hiện đang hở to nhất |
| `admin/grading-jobs.js` | thêm lọc + `assertOwned` submission |
| `admin/submissions/ai-grade.js` | `assertOwned` submission trước khi gọi AI |
| `admin/audio.js`, `admin/images.js` | lọc + gán; kiểm tra "đang dùng" trong workspace |
| `admin/import.js` | gán `workspaceId` cho mọi doc sinh ra |
| `admin/deadline-jobs.js`, `deadline-jobs/run.js` | lọc theo workspace |
| `admin/dashboard.js` | thay scope inline bằng `tenantFilter` |
| `admin/ai-settings.js` | **chuyển sang `sysadmin/`** (platform-level) |
| `admin/teachers.js` | **chuyển sang `sysadmin/`** — lỗ hổng B3 |
| `admin/test-submissions.js` | `assertOwned(Test)` trước khi dựng overview; lọc `Student`/`Submission` theo workspace |
| `admin/ai-lesson.js` | `withTenant` để ghi `workspaceId` vào `AiLog`. Ngân sách vẫn dùng chung (0.3.4) — **không** tách quota theo workspace |

**Nhóm 2 — route học sinh (7 route)**

| Route | Việc phải làm |
|---|---|
| `units.js` | thêm `workspaceId` của học sinh vào filter (cạnh `level` + `classIds`) |
| `tests.js` | như trên |
| `submissions.js` | gán `workspaceId` khi tạo; verify unit/test cùng workspace |
| `submissions/reflection.js` | `assertOwned` |
| `student/dashboard.js` | leaderboard/streak lọc trong workspace |
| `student/notes.js` | gán + lọc |
| `notifications.js` | lọc |

**Nhóm 3 — platform (9 route `sysadmin/*` + `teacher/notifications.js` + `tickets.js`)**
- `sysadmin/*`: giữ `requireRole("admin")`, thêm **bộ lọc workspace tuỳ chọn** cho
  dashboard/audit/storage/notifications để admin xem theo từng workspace.
- `sysadmin/impersonate.js`: token trả về phải kèm workspace của giáo viên đó.
- `tickets.js`: thêm `workspaceId` vào ticket để admin biết ticket từ workspace nào.
- `sysadmin/ai-logs.js`: thêm bộ lọc workspace tuỳ chọn. Phần hiển thị ngân sách giữ
  nguyên con số **toàn platform** — đúng theo 0.3.4, không chia theo workspace.
- `changelog.js`: `// tenant-exempt: chỉ đọc hồ sơ của chính người đăng nhập.`

**Nhóm 4 — cron**
- `cron/deadline-scan.js`: lặp theo workspace (`for each active workspace → generate…`).
  Giữ nguyên `CRON_SECRET`. Lỗi 1 workspace không được làm hỏng các workspace còn lại →
  bọc try/catch từng workspace, trả về báo cáo `{workspaceId, ok, error}`.
- `lib/notifications/teacher.js:15`: **đảo fallback** — không khớp lớp thì gửi cho
  owner của workspace, KHÔNG gửi cho mọi giáo viên.

### 5.3 Chống tái phát

Thêm `scripts/check-tenant-scope.js` chạy trong `npm run build` (hoặc CI): quét mọi file
trong `pages/api/admin/` và `pages/api/student/`, báo lỗi nếu có `.find(`, `.findOne(`,
`.countDocuments(`, `.aggregate(` mà trong cùng hàm không có `tenantFilter` /
`assertOwned` / `req.ws`. Whitelist bằng comment `// tenant-exempt: <lý do>`.
Đây là thứ giữ cho lỗi B2 không quay lại sau 6 tháng.

---

## 6. (F) Thay đổi UI

| Vị trí | Hiện tại | Sau |
|---|---|---|
| `app/layout.js:5-6` | `title: "Ms Nhi"` | tên platform |
| `components/Shell.js:65` | logo + alt "Ms Nhi" | `workspace.logoUrl \|\| logo platform`, alt = `workspace.name` |
| `app/login/page.js:84,91` | SVG có chữ "IELTS", alt "Ms Nhi" | minh hoạ trung tính, branding platform |
| `app/teacher/overview/page.js` | tiêu đề tĩnh | `Welcome, {teacherName}` + `{workspaceName}` |
| `lib/nav.js` | `userSub: "Administrator"` cho teacher | `userSub` = tên workspace |
| `app/teacher/ai-grading/page.js` | GV chỉnh model AI toàn hệ thống | chuyển phần chọn model sang `/admin/system` (platform) |
| *(mới)* `app/teacher/settings/workspace/page.js` | — | đổi tên/logo/locale/timezone workspace |
| *(mới)* `app/signup/page.js` | — | đăng ký giáo viên |
| *(mới)* `app/teacher/onboarding/page.js` | — | 3 bước: đặt tên workspace → tạo lớp đầu tiên → thêm học sinh |
| `app/teacher/classes/page.js:76` | placeholder "e.g. IELTS 6.0 – Evening A" | placeholder trung tính |
| `components/teacher/LessonImport.js:76,81` | tên file mẫu "IELTS_Grammar_BaiTap.xlsx" | giữ (đúng tên template thật) nhưng gắn theo program ở phase 8 |
| `app/admin/*` | dashboard toàn cục | thêm cột/bộ lọc Workspace |
| `app/admin/ai-logs/page.js` | log LLM toàn cục | thêm cột + bộ lọc Workspace; ô ngân sách giữ nguyên số toàn platform (0.3.4) |
| `app/teacher/tests/[testId]/submissions/**` | không kiểm tra chủ sở hữu | GV mở test của workspace khác → trang 404 |

Cần thêm 1 hook client `useWorkspace()` (đọc từ `/api/teacher/me`) và nhét workspace
name/logo vào `components/Shell.js` — đây là điểm duy nhất mọi trang giáo viên đi qua.

---

## 7. (G) Rủi ro

| # | Rủi ro | Mức | Cách giảm |
|---|---|---|---|
| R1 | Migration gán sai `workspaceId` → GV mất sạch dữ liệu trên màn hình | **Cao** | Script idempotent + `--dry-run` + backup trước + Phase 2 chỉ đọc (filter) nên nếu sai là thấy ngay, chưa ghi đè gì |
| R2 | Quên lọc 1 route → rò rỉ dữ liệu giữa GV | **Cao** | `scripts/check-tenant-scope.js` + review theo đúng bảng 5.2, tick từng dòng |
| R3 | Đảo fallback B5 làm GV cũ mất quyền xem | Trung bình | Phase 1 backfill đưa TẤT CẢ GV cũ vào chung 1 workspace → không ai mất gì. Chỉ GV tạo MỚI mới bị cô lập |
| R4 | Token 30 ngày của học sinh không có workspace | Trung bình | Không nhét workspace vào JWT; giải từ DB mỗi request (quyết định 0.3.3) → token cũ vẫn chạy, không cần bắt đăng nhập lại |
| R5 | Cloudinary unsigned preset — client tự chọn folder | Trung bình | Phase 7 ghi rõ: tách folder là ngăn nắp, không phải bảo mật. Muốn bảo mật thật phải chuyển sang signed upload (ghi vào phase 9) |
| R6 | Dữ liệu media cũ nằm ở folder `ielts-listening` | Thấp | **Không move file cũ.** URL đã lưu trong DB vẫn trỏ đúng. Chỉ file upload MỚI vào folder mới |
| R7 | Cron chạy lâu hơn khi lặp theo workspace → timeout Vercel | Trung bình | Bọc try/catch từng workspace + phân trang; nếu >10 workspace thì chuyển sang queue |
| R8 | `username` trùng khi GV mới tạo học sinh tên phổ biến | Thấp | Thông báo lỗi rõ + gợi ý hậu tố (4.4) |
| R9 | Phase 4 đặt `required: true` mà còn doc mồ côi → app 500 | **Cao** | Bắt buộc chạy `scripts/check-orphans.js` = 0 trước khi merge Phase 4 |
| R10 | `level` trùng giữa workspace | Đã giải | `workspaceId` trong filter là đủ, không cần sửa gì thêm |
| R11 | Deploy Vercel giữa chừng migration | Trung bình | Chạy migration TRƯỚC khi deploy code Phase 2; code cũ không đọc `workspaceId` nên vô hại |

---

## 8. (H) Các phase — chi tiết

> Mỗi phase có: **Mục tiêu · Việc làm · App còn chạy không · Cách verify · Rollback.**
> Không sang phase sau khi phase trước chưa verify xong trên production.

### Phase 0 — Lưới an toàn *(0.5 ngày, không đổi hành vi)*

**Mục tiêu:** có đường lùi trước khi động vào dữ liệu thật.

**Việc làm**
1. ~~Commit `lib/teacherScope.js`, `lib/rateLimit.js`, `lib/validate.js` đang untracked.~~
   **XONG** — cả 3 đã vào git, working tree sạch.
2. ~~`scripts/backup-db.js` — dump toàn bộ collection ra JSON có timestamp.~~ **XONG.**
   **Đã kiểm tra: `scripts/clone-db.js` KHÔNG tái dùng được** — nó clone DB→DB và xoá sạch
   target trước khi ghi, không phải dump ra file. Viết mới, hoặc dùng thẳng `mongodump`.
   Lưu ý: phải nhắm `MONGODB_URI_LIVE`; `npm run dev` đang trỏ DB dev (`scripts/use-db.js`),
   dump nhầm DB dev là có backup rỗng mà tưởng đã an toàn.
3. ~~`scripts/check-orphans.js` — đếm doc thiếu `workspaceId` theo từng collection.~~
   **XONG.** Chạy trên live ra "tất cả đều thiếu" — đúng, đó là baseline (941 doc).
4. ~~Ghi lại số liệu hiện trạng vào Nhật ký mục 10.~~ **XONG** — bảng số liệu ở mục 10,
   mốc 2026-09-22. Sau mỗi phase so lại con số này.
5. ~~Xoá collection rác `user` (số ít, 0 doc) trên live DB.~~ **XONG** — `--strict` pass sạch.
6. ~~Chạy `node scripts/backup-db.js --live` lấy bản dump thật.~~ **XONG 2026-09-22.**
   `backups/listening_app-live-20260922-144756/` — 18 collection · 965 doc · 3.3 MB.

**App còn chạy không:** có, không sửa dòng code chạy nào.
**Verify:** ~~chạy được `node scripts/backup-db.js` ra file JSON đọc được.~~ **ĐÃ VERIFY**
trên DB dev: 22 collection / 52 doc, EJSON parse ngược lại giữ đúng kiểu `ObjectId` và
`Date`, `_meta.json` có đủ index (kể cả `username_1` unique).
**Rollback:** không cần.

---

### Phase 1 — `Workspace` + `WorkspaceMember` + backfill *(1 ngày)*

**Mục tiêu:** mọi document hiện có đều thuộc về 1 workspace. **Chưa có code nào đọc nó.**

**Việc làm**
1. ~~`lib/models/Workspace.js`, `lib/models/WorkspaceMember.js` (schema mục 4.1).~~ **XONG.**
2. ~~Thêm `workspaceId` **optional** vào 16 model (mục 4.2).~~ **XONG.**
3. ~~`scripts/migrate-workspace.js` (mục 4.5).~~ **XONG.** Mặc định là dry-run, phải có
   `--apply` mới ghi — theo đúng quy ước của `scripts/clone-db.js`.
4. ~~Chạy thật trên live DB. Kiểm tra `check-orphans.js` = 0 ở mọi collection.~~
   **XONG 2026-09-22** — 941 doc, còn thiếu 0. Xem Nhật ký mục 10.

**App còn chạy không:** có. Field mới optional, không route nào đọc → hành vi y hệt.
**Verify:**
- `check-orphans.js` in ra 0 ở cả 13 collection bắt buộc;
- đăng nhập bằng tài khoản GV thật + tài khoản HS thật, xem dashboard/lessons/tests
  vẫn đủ dữ liệu như trước (so với số liệu Phase 0).

**Rollback:** `updateMany({}, {$unset: {workspaceId: 1}})` + xoá 2 collection mới.
Code chưa phụ thuộc gì nên gỡ sạch được.

---

### Phase 2 — `lib/tenant.js` + áp cho mọi route ĐỌC *(2 ngày)*

> **Phase này có tài liệu thi hành chi tiết riêng: [PLAN-PHASE2-TENANT-READ.md](PLAN-PHASE2-TENANT-READ.md)**
> — mã nguồn đầy đủ của `lib/tenant.js`, bảng 26 route kèm số dòng đã đối chiếu
> với code thật, quy trình nghiệm thu và checklist. Phần dưới đây là bản tóm tắt.
>
> **Đính chính so với mục 5.2:** thứ tự bọc middleware phải là
> `requireAuth(withTenant(handler))`, **không** phải `withTenant(requireAuth(...))`.
> `requireAuth` mới là lớp gán `req.auth`, nên `withTenant` phải nằm bên trong.

**Mục tiêu:** bật cô lập ở chiều đọc. Vì Phase 1 đã gán mọi thứ vào **cùng một**
workspace, bật lọc lên là **no-op** — đây chính là lý do tách phase như vậy.

**Việc làm**
1. Viết `lib/tenant.js` (mục 5.1) + test tay cho `assertOwned` (404 chứ không phải 403).
2. `pages/api/teacher/me.js` — trả `{teacher, workspace}` cho UI.
3. Áp `withTenant` + `tenantFilter` cho **mọi GET** ở nhóm 1 và nhóm 2 (bảng 5.2).
4. `lib/teacherScope.js` **giữ nguyên, chạy song song** — nó lọc theo lớp (một tầng
   khác, vẫn còn ích cho phase 9 khi 1 workspace có nhiều GV). Chưa xoá.
5. Viết `scripts/check-tenant-scope.js` (mục 5.3), chạy thủ công trước, chưa gắn CI.

**App còn chạy không:** có với **dữ liệu đã có** — mọi document cũ cùng 1 workspace nên filter
không loại gì. **KHÔNG** với dữ liệu tạo mới: sau khi deploy Phase 2, mọi thứ tạo mới đều thiếu
`workspaceId` nên tự biến mất khỏi màn hình, và tài khoản tạo mới bị 403 toàn bộ. Vì vậy Phase 2
**phải deploy cùng bước 1–2 của Phase 3** — xem mục 8.1.1.
**Verify:**
- Đếm số dòng trên từng màn hình GV trước/sau khi deploy — phải **bằng nhau**;
- tạo 1 workspace thứ 2 + 1 GV test → đăng nhập, thấy **màn hình rỗng hoàn toàn**;
- GV test gọi `GET /api/admin/units?id=<id của Ms Nhi>` → phải nhận **404**.

**Rollback:** revert commit. Dữ liệu không đổi.

---

### Phase 3 — Áp cho mọi route GHI *(2 ngày)*

**Mục tiêu:** mọi thứ tạo mới đều tự gắn đúng workspace; không sửa được đồ của người khác.

**Việc làm**

> **Bước 1 và 2 là phần GỠ CHẶN DEPLOY cho Phase 2** (mục 8.1.1). Làm xong hai bước này là
> deploy được Phase 2 + 3 cùng lúc, không cần chờ xong bước 3–5.

1. Mọi POST: `workspaceId: req.ws.workspaceId` — **không bao giờ lấy từ body**.
   13 chỗ `.create()`: `admin/classes.js`, `admin/units.js`, `admin/tests.js`, `admin/audio.js`,
   `admin/images.js`, `admin/attendance.js`, `admin/submissions/ai-grade.js` (GradingJob),
   `student/notes.js`, `submissions.js` (×4).
   **Và `lib/users.js`** — `createStudent`/`createTeacher` hiện không gắn `workspaceId`, đây
   chính là chỗ làm tài khoản tạo mới bị 403 toàn app.
2. Mọi PUT/DELETE: `assertOwned()` trước khi sửa.
3. Mọi tham chiếu chéo phải verify cùng workspace: `classIds` trong `units.js`/`tests.js`,
   `classId` trong `students.js`, `audioId`/`imageId` trong section, `unitId`/`testId`
   trong `submissions.js`.
4. **Bỏ chặn 403 ở `admin/classes.js:40`** → GV tự tạo lớp trong workspace mình.
5. Cron: `deadline-scan.js` lặp theo workspace; đảo fallback ở `notifications/teacher.js:15`.
6. **Hai lỗi CÓ SẴN phát hiện khi soát Phase 2** (không do Phase 2 gây ra, sửa tiện tay):
   - `admin/grading-jobs.js`: nhánh poll theo `submissionId` gọi
     `findOneAndUpdate({_id: id, ...})` trong khi nhánh đó `id` là `undefined` → không bao giờ
     giành được job. Sửa thành `{_id: job._id, status: "pending"}`.
   - `admin/audio.js` + `admin/images.js`: `Test.exists({"sections.audioId": ...})` dò sai
     đường dẫn schema (`Test` không có `sections` ở gốc, đúng phải là `skills.<skill>.sections`)
     → chốt "đang dùng" chưa bao giờ chặn, xoá được media đang dùng trong mock test.

**App còn chạy không:** có.
**Verify (kịch bản 2 workspace — bắt buộc chạy đủ):**
```
WS-A (Ms Nhi thật)   |  WS-B (test)
tạo lớp              |  tạo lớp        → mỗi bên chỉ thấy lớp mình
tạo unit             |  tạo unit       → không thấy unit của nhau
HS A nộp writing     |  GV B mở Grading Queue → KHÔNG thấy bài của HS A
GV B sửa unit của A qua API trực tiếp  → 404
cron chạy            |  → HS A chỉ nhận thông báo từ WS-A
```
Chạy xong **xoá sạch WS-B** khỏi DB thật.

**Rollback:** revert. Doc tạo trong lúc lỗi vẫn có `workspaceId` đúng → không rác.

---

### Phase 4 — Siết cứng *(0.5 ngày)*

**Mục tiêu:** biến cô lập từ "quy ước" thành "ràng buộc DB".

**Việc làm**
0. **Chạy lại `migrate-workspace.js --live --apply` để quét phần trôi dạt.** Bắt buộc, không
   phải tuỳ chọn — xem mục 8.1 ngay dưới. Script idempotent nên chạy lại vô hại.
1. Chạy `check-orphans.js` — **phải = 0**, không thì dừng.
2. `workspaceId: { required: true }` cho **13 model bắt buộc** (mục 4.2) — KHÔNG đặt cho
   `Ticket`, `AuditLog`, `AiLog`.
3. Thêm index mục 4.3.
4. Gắn `check-tenant-scope.js` vào `npm run build`.
5. Đảo mặc định `lib/teacherScope.js`: bỏ `{all: true}` khi `classIds` rỗng → trong
   phạm vi 1 workspace, GV thấy mọi lớp của workspace (đúng V1: 1 GV/workspace);
   ranh giới thật đã do `workspaceId` lo.

**App còn chạy không:** có — với điều kiện bước 1 sạch.
**Verify:** build pass; tạo mới mọi loại entity thành công; `check-orphans` = 0.
**Rollback:** gỡ `required` (chỉ là schema, không đụng dữ liệu).

---

### 8.1 Trôi dạt giữa Phase 1 và Phase 3 — VÀ VÌ SAO PHASE 2 KHÔNG ĐƯỢC DEPLOY MỘT MÌNH

Phase 1 đóng dấu xong là `check-orphans` ra 0. Con số đó **không ổn định**: nó là ảnh chụp
tại một thời điểm, không phải trạng thái được duy trì.

Lý do: Phase 1 chỉ sửa dữ liệu CŨ. Việc gán `workspaceId` cho document MỚI là Phase 3. Giữa
hai mốc đó app vẫn đang chạy và vẫn tạo document mới không có field — mỗi lần học sinh đăng
nhập, nộp bài, ghi chú, mỗi lần cron gửi thông báo.

Quan sát thực tế 2026-09-22: migration chạy xong lúc 07:58, tới 08:02 đã có 1 `auditlog` mới
thiếu `workspaceId` — một học sinh đăng nhập. Lần đó rơi vào nhóm tuỳ chọn nên `--strict` vẫn
pass; nếu em đó **nộp bài** thì document rơi vào `submissions`, thuộc nhóm bắt buộc, và
`--strict` sẽ fail.

Hệ quả cho cách làm việc:
- **Đừng coi `check-orphans = 0` sau Phase 1 là đã xong vĩnh viễn.** Càng để lâu giữa Phase 1
  và Phase 3, số document trôi dạt càng nhiều.
- **Phase 4 phải chạy lại migration trước khi siết `required`** (bước 0 ở trên). Không làm thì
  đúng rủi ro R9: doc mồ côi + `required: true` = app 500 khi lưu.
- 🔴 **PHASE 2 VÀ PHASE 3 PHẢI DEPLOY CÙNG MỘT LẦN.** Tách commit thì được (và nên), nhưng
  **không được đẩy Phase 2 lên production một mình.** Xem 8.1.1 ngay dưới.
- Rút ngắn khoảng cách Phase 1 → Phase 3 là cách giảm trôi dạt rẻ nhất.

### 8.1.1 Đính chính — bản trước của mục này viết SAI

> Bản viết ngày 2026-09-22 khẳng định: *"Trôi dạt **không** gây hại trong lúc chờ: Phase 2 chỉ
> lọc ở chiều ĐỌC của route giáo viên, và document mới thiếu field chỉ đơn giản là không hiện
> ra ở màn hình giáo viên cho tới khi được quét. Không mất dữ liệu, không lỗi."*

Câu đó **sai**, và sai ở ba điểm. Nó chỉ suy luận về 941 document CŨ (đều đã có `workspaceId`
sau Phase 1), quên mất document **mới tạo sau khi Phase 2 lên**. Phase 2 bật lọc ở chiều ĐỌC,
nhưng Phase 3 mới là chỗ gán `workspaceId` khi GHI — nên giữa hai mốc đó, **mọi thứ tạo mới
đều vô hình với chính bộ lọc vừa bật.**

Ba hậu quả, đã tái hiện bằng cách gọi thẳng handler trên DB dev (2026-09-22):

**① Giáo viên tạo gì cũng biến mất ngay lập tức.**
```
classes BEFORE create: 3
POST /api/admin/classes -> 201 created
classes AFTER create : 3          <- vẫn 3, lớp vừa tạo không có trong danh sách
GET  /api/admin/classes?id=<vừa tạo> -> 404 "Class not found"
```
13 chỗ `.create()` trong các route Phase 2 đã bọc đều không gắn `workspaceId`: `Class`, `Unit`,
`Test`, `Audio`, `Image`, `AttendanceSession`, `Submission`, `StudentNote`, `GradingJob`.

**② Tài khoản tạo mới bị khoá khỏi toàn bộ app** — đây là chỗ câu "không lỗi" sai nặng nhất:
```
student created. workspaceId = UNDEFINED
/api/units  /api/tests  /api/notifications
/api/submissions  /api/student/dashboard  /api/student/notes
  -> tất cả 403 "This account is not in a workspace"
```
`lib/users.js` không hề có chữ `workspaceId`, nên `createStudent` sinh ra hồ sơ không workspace
→ `currentWorkspace()` trả null → `withTenant` trả **403**. Đăng nhập được, nhưng mọi màn hình
403. Giáo viên tạo mới cũng vậy (chưa có `WorkspaceMember` — việc đó ở Phase 5).

**③ Học sinh cũ nộp bài thì bài biến mất khỏi danh sách của chính em.**
```
submissions visible BEFORE: 7
submission created, workspaceId = UNDEFINED
submissions visible AFTER : 7     <- em không thấy bài mình vừa nộp
```
Đây là hậu quả tệ nhất vì nó chạm thẳng 21 học sinh thật: nộp xong nhìn như mất bài.

**Điểm sai thứ hai của câu cũ:** "chỉ lọc ở chiều ĐỌC **của route giáo viên**" — không đúng.
Phase 2 lọc cả **6 route học sinh** (`units`, `tests`, `submissions`, `notifications`,
`student/dashboard`, `student/notes`), nên học sinh chịu ảnh hưởng ngang giáo viên.

**Điểm sai thứ ba:** "không hiện ra… cho tới khi được quét" nghe như một độ trễ hiển thị.
Thực tế là 404 khi mở, và 403 khi đăng nhập bằng tài khoản mới — tức là **lỗi cứng**, không
phải chậm hiện.

**Cách xử lý:** làm **bước 1 và 2 của Phase 3** (gán `workspaceId` ở 13 chỗ `.create()` +
`lib/users.js`) rồi deploy chung một lần với Phase 2. Không cần chờ xong cả Phase 3.

**Bài học về cách viết plan:** câu sai đó ra đời vì suy luận về *dữ liệu đang có* mà không
suy luận về *dữ liệu sắp sinh ra*. Mỗi lần plan khẳng định "phase này không đổi hành vi",
phải kiểm cả hai vế: dữ liệu cũ đọc có đúng không, **và** dữ liệu mới tạo ra có còn đọc được
không.

---

### Phase 5 — Tách Platform Admin vs Teacher *(1 ngày)*

**Mục tiêu:** GV không chạm được vào quản trị nền tảng (vá B3, B10).

**Việc làm**
1. `pages/api/admin/teachers.js` → `pages/api/sysadmin/teachers.js`, đổi guard sang
   `requireRole("admin")`. Sửa lời gọi trong `lib/client/api.js` + trang dùng nó.
2. `pages/api/admin/ai-settings.js` → `sysadmin/ai-settings.js`, tương tự.
   Trang `/teacher/ai-grading` giữ phần xem trạng thái + hàng đợi, bỏ phần chọn model
   (chuyển sang `/admin/system`).
3. `sysadmin/users.js`: khi tạo teacher → **tự tạo Workspace + WorkspaceMember**.
4. `sysadmin/impersonate.js`: token trả về gắn workspace của GV đó.
5. Trang `/admin/workspaces` (mới): danh sách workspace, số GV/HS/lớp, suspend/active.
6. Thêm bộ lọc workspace cho `sysadmin/dashboard|audit|storage|notifications`.

**App còn chạy không:** có, nhưng **đây là phase đầu tiên đổi URL API** → phải sửa
client cùng commit, không tách PR.
**Verify:** tài khoản teacher gọi `/api/sysadmin/teachers` → 403; admin gọi → 200.
**Rollback:** revert cả cặp API + client cùng lúc.

---

### Phase 6 — Signup + Onboarding *(2 ngày)*

**Mục tiêu:** giáo viên mới tự vào được, không cần dev.

**Việc làm**
1. `pages/api/auth/signup.js` — tạo User(teacher) + Teacher + Workspace + Member trong
   **một** thao tác. Bắt buộc có rate limit (tái dùng `lib/rateLimit.js`).
   Cân nhắc: bật/tắt signup bằng env `ALLOW_SIGNUP` để kiểm soát lúc đầu.
2. `app/signup/page.js`.
3. `app/teacher/onboarding/page.js` — 3 bước: tên workspace → tạo lớp đầu → thêm/import HS.
   Không ép hoàn thành; có nút bỏ qua.
4. Dashboard rỗng: khi workspace chưa có gì, hiện empty state + 3 nút
   `[Create Class] [Create Lesson] [Import Questions]` thay vì bảng trống.
5. `app/teacher/settings/workspace/page.js` — đổi tên, logo, locale, timezone.

**App còn chạy không:** có, hoàn toàn cộng thêm.
**Verify:** đăng ký tài khoản mới từ trình duyệt ẩn danh → vào thẳng dashboard rỗng →
tạo lớp → thêm HS → HS đăng nhập thấy đúng lớp. Dữ liệu Ms Nhi không hề thay đổi.
**Rollback:** ẩn route signup.

---

### Phase 7 — Gỡ branding cứng *(1 ngày)*

**Mục tiêu:** platform có nhận diện riêng; "Ms Nhi" chỉ còn là 1 workspace.

**Việc làm**
1. Chốt tên + logo platform (**cần bạn quyết định — Q1**).
2. `app/layout.js`, `app/login/page.js`, `components/Shell.js`, `lib/nav.js` → dùng
   branding platform; sidebar hiện `workspace.name` + `workspace.logoUrl`.
3. `lib/notifications/channels/email.js:35,59` → lấy tên từ workspace của notification
   (notification đã có `workspaceId` từ Phase 1).
4. Cloudinary: `components/teacher/MediaLibrary.js` dùng folder
   `workspaces/{slug}/audio` và `workspaces/{slug}/images` cho file **mới**.
   **Không di chuyển file cũ** (R6). Ghi chú rõ trong code: tách folder ≠ bảo mật (R5).
5. `public/logo.svg` → thành logo platform; logo Ms Nhi chuyển thành
   `Workspace.logoUrl` của workspace đó.

**App còn chạy không:** có.
**Verify:** upload audio mới → URL chứa `workspaces/<slug>/`; audio cũ vẫn phát được;
email nhận được có tên workspace đúng.
**Rollback:** revert. File đã upload vào folder mới vẫn dùng bình thường.

---

### Phase 8 — Taxonomy Subject / Program / Skill *(2-3 ngày)*

**Mục tiêu:** mở đường TOEIC / General English / môn khác mà **không đụng** vào chức năng
IELTS đang chạy.

**Việc làm**
1. `lib/curriculum.js` — registry khai báo, **không phải collection**:
```js
{
  english: {
    label: "English",
    programs: {
      ielts:   { label: "IELTS",   skills: [grammar, vocabulary, listening, reading, writing, speaking],
                 rubric: "ielts",  bandScale: {min:1, max:9, step:0.5} },
      toeic:   { label: "TOEIC",   skills: [listening, reading, grammar, vocabulary],
                 rubric: null,     scoreScale: {min:10, max:990} },
      general: { label: "General English", skills: [grammar, vocabulary, listening, reading, writing, speaking] }
    }
  }
}
```
2. Thêm `subject: {default: "english"}`, `program: {default: "ielts"}` vào `Unit` và `Test`.
   **Default đúng bằng hiện trạng → dữ liệu cũ không cần migrate.**
3. `Workspace.subjects` / `Workspace.programs` = những gì GV bật; UI lọc theo đó.
4. `lib/grading/rubric.js` chọn rubric theo `program` thay vì mặc định IELTS.
   TOEIC chưa có rubric → xem Q4 ở mục 11; **ghi rõ giới hạn chứ không giả vờ đã hỗ trợ**.
5. `CATEGORY_KEYS` trong `Unit.js` giữ nguyên 6 key; program chỉ quyết định **hiển thị
   kỹ năng nào**, không đổi schema. Đây là điểm tránh over-engineering: không tạo bảng
   Skill động.

**App còn chạy không:** có — mọi Unit/Test cũ mặc định english/ielts.
**Verify:** tạo 1 Unit chọn program TOEIC → chỉ hiện 4 kỹ năng; Unit IELTS cũ mở lên
vẫn đủ 6 kỹ năng, không mất dữ liệu.
**Rollback:** revert; field có default nên dữ liệu cũ không ảnh hưởng.

---

### Phase 9 — Tương lai (KHÔNG làm trong V1)

Ghi lại để sau này không phải nghĩ lại, và để biết Phase 1-8 đã chừa đường:
- **Nhiều GV / 1 workspace:** thêm `WorkspaceMember.role = "teacher"` + `Class.teacherIds[]`.
  Bảng member đã có từ Phase 1 → không phải migrate.
- **HS học nhiều lớp:** thêm `Enrollment(studentId, classId, workspaceId, status)`.
  `Student.classId` thành "lớp chính", giữ tương thích ngược.
- **Organization / trung tâm:** thêm `Organization` + `Workspace.organizationId`.
- **Signed upload Cloudinary** (vá R5).
- **HS học với GV ở 2 workspace:** tách `User` ↔ `Student profile` thành 1:N — đây là
  thay đổi lớn nhất còn lại, để cuối cùng.
- Subscription / billing / AI credits / white-label / marketplace.

---

## 9. Thứ tự ưu tiên nếu phải cắt bớt

Nếu cần ra mắt sớm, thứ tự **không được đảo**:

```
Phase 0 → 1 → 2 → 3 → 4    ← bắt buộc, đây là phần "cô lập dữ liệu". Dừng ở đây
                              vẫn là sản phẩm dùng được (admin tạo tài khoản GV tay).
Phase 5                     ← bắt buộc trước khi có GV thứ 2 THẬT (lỗ hổng B3).
Phase 6                     ← cần cho self-serve. Không có thì dev phải tạo tay.
Phase 7                     ← cần khi bán cho người ngoài.
Phase 8                     ← chỉ cần khi thật sự có khách hàng TOEIC/General.
```

Sai lầm cần tránh: làm Phase 8 (taxonomy) trước Phase 1-4 vì nó "thú vị hơn".
Cô lập dữ liệu là thứ duy nhất mà làm sai sẽ gây sự cố với người dùng thật.

---

## 10. Nhật ký tiến độ

> Mỗi lần làm xong một phase, thêm 1 mục. Ghi cả thứ **không** làm và lý do.

### 2026-09-22 — Audit
- Đã audit toàn bộ: 17 model, 37 route API, 37 trang.
- Kết luận: app hiện là single-tenant. Không model nội dung nào có chủ sở hữu.
  `lib/teacherScope.js` (chưa commit) mới scope theo LỚP trên 4/18 route giáo viên.
- Xác nhận giả định single-teacher đã được ghi rõ trong
  `PLAN-DASHBOARD-RESTRUCTURE.md:769`: "Không cho phép nhiều giáo viên với phân quyền
  khác nhau (mọi Teacher đều toàn quyền như nhau)."
- Lập file này. **Chưa sửa dòng code nào.**
- Số liệu baseline: *(chưa đo — việc đầu tiên của Phase 0)*

### 2026-09-22 — Soát lại số liệu + chốt 2 quyết định *(vẫn chưa sửa dòng code chạy nào)*

**Đo baseline trên live DB `listening_app`** (chỉ đọc, qua `scripts/db-info.js`):

| Collection | Doc | | Collection | Doc |
|---|---|---|---|---|
| users | 23 | | submissions | 476 |
| teachers | **1** | | notifications | 354 |
| students | 21 | | attendancesessions | 22 |
| classes | 5 | | audios | 20 |
| units | 6 | | studentnotes | 13 |
| tests | 3 | | images | 3 |
| tickets | 8 | | auditlogs | 8 |
| appsettings | 1 | | gradingjobs / deadlineemailjobs | 0 / 0 |

`users by role`: student 21 · admin 1 · **teacher 1**.

**Q3 khép lại.** Chỉ có duy nhất tài khoản teacher `msnhi`. Phương án "chung 1 workspace"
và "tách mỗi người 1 workspace" cho ra kết quả giống hệt nhau → script migration chỉ tạo
đúng 1 workspace, không cần cờ lựa chọn. Bỏ luôn bước 2 phức tạp ở mục 4.5 (phân loại
owner vs teacher cho GV cũ): chỉ có 1 người, người đó là owner.

**Chốt ngân sách AI: dùng chung toàn platform** → quyết định 0.3.4. `AiSpend` và `AiPrompt`
không có `workspaceId`; chỉ `AiLog` có, và chỉ để lọc khi đọc log.

### 2026-09-22 — Phase 1: code xong, đã chạy thật trên DB dev

**Đã thêm:** `lib/models/Workspace.js`, `lib/models/WorkspaceMember.js`,
`scripts/migrate-workspace.js`. Thêm `workspaceId` optional vào đúng 16 model.

Ghi chú thiết kế:
- `migrate-workspace.js` duyệt theo **tên MODEL**, không phải tên collection. Tên
  collection suy ra từ `Model.collection.name` nên script không thể lệch khỏi schema —
  đây là cách rẻ nhất để không bao giờ sót collection.
- "Thiếu workspaceId" định nghĩa là `$exists: false` **hoặc** `null`. Chỉ bắt `$exists`
  là sót doc có field nhưng giá trị null, mà loại đó cũng không khớp filter ở Phase 2.
- Mặc định dry-run, `--apply` mới ghi (quy ước của `clone-db.js`).
- `Workspace.slugify()` bỏ dấu tiếng Việt vì slug đi vào đường dẫn Cloudinary ở Phase 7.

**Chu trình đã chạy trên DB dev `msnhiapp_dev`:**

| Bước | Kết quả |
|---|---|
| dry-run | 40 doc sẽ sửa — khớp `check-orphans --dev` |
| `--apply` | tạo workspace `ms-nhi` + 1 member, gán 40 doc, còn thiếu **0** |
| chạy lại `--apply` | thêm **0** member, sửa **0** doc → idempotent đạt |
| `check-orphans --dev --strict` | 0/13 collection bắt buộc còn thiếu |

**Dry-run trên live: 941 doc** — khớp đúng baseline đo bằng `check-orphans.js`. Hai script
viết độc lập ra cùng một con số.

**`check-orphans.js` lại bắt được chính mình:** sau khi migrate trên dev, nó cảnh báo
`workspaces` và `workspacemembers` chưa phân loại. Đã thêm vào nhóm PLATFORM — `workspaces`
chính nó là tenant, `workspacemembers` có `workspaceId` là khoá và đã `required` ở schema.

### 2026-09-22 — Phase 1 CHẠY XONG TRÊN LIVE ☑

`node scripts/migrate-workspace.js --live --apply`

- Tạo workspace `ms-nhi` — `_id 6ab235caa6ad60d972a35f0a`, "Ms Nhi English Academy",
  owner = user `msnhi`, status active, locale vi, tz Asia/Ho_Chi_Minh, subjects ["english"].
- Tạo 1 `WorkspaceMember` role owner.
- Đóng dấu `workspaceId` cho **941 document** trên 16 collection. Còn thiếu: **0**.

**Ba lớp kiểm tra độc lập sau khi chạy:**

| Kiểm tra | Kết quả |
|---|---|
| `check-orphans.js --live` | 0 thiếu ở cả 16 collection, 0/13 nhóm bắt buộc |
| Tất cả doc có trỏ về CÙNG một workspace không? | Có — `distinct("workspaceId")` trên 16 collection chỉ ra đúng **1** giá trị, và đúng bằng `_id` của workspace vừa tạo |
| `ownerUserId` có trỏ tới user thật không? | Có — `msnhi`, role teacher |

Lớp kiểm tra thứ hai là thứ hai script kia không làm: nếu migration lỡ gán hai workspaceId
khác nhau thì `check-orphans` vẫn báo sạch (doc nào cũng "có" field), nhưng tới Phase 2
bật lọc là một nửa dữ liệu biến mất. Đã xác nhận không xảy ra.

**App không đổi hành vi:** field optional, chưa route nào đọc. Không deploy gì kèm theo.

**Phase 0 khép lại:** collection rác `user` đã xoá, `check-orphans --live --strict` exit 0.

**Quan sát ngay sau đó — trôi dạt bắt đầu luôn:** 08:02, tức 4 phút sau migration, đã có 1
`auditlog` mới thiếu `workspaceId` (học sinh "Trung Hiếu" đăng nhập). Đây là hành vi ĐÚNG
— gán field cho document mới là việc của Phase 3 — nhưng nó cho thấy con số 0 chỉ là ảnh
chụp. Đã viết thành mục 8.1 và thêm bước 0 vào Phase 4.

Tiện thể xác nhận được một điều: **app vẫn chạy bình thường sau khi sửa 941 document** —
có học sinh thật đăng nhập thành công ngay sau đó.

### 2026-09-22 — Phase 2 CHẠY XONG (thi hành theo PLAN-PHASE2-TENANT-READ.md) ☑

Thi hành bởi Sonnet, theo checklist mục 7 của tài liệu thi hành. Kết quả và lệch
so với plan ghi dưới đây, chi tiết đầy đủ nằm trong PLAN-PHASE2-TENANT-READ.md.

**Đã tạo:** `lib/tenant.js`, `pages/api/teacher/me.js`, `scripts/check-tenant-scope.js`.
**Đã sửa 26 route** (20 giáo viên + 6 học sinh — số route giáo viên tăng từ 19 lên 20 khi
phát hiện route bị sót, xem bên dưới) + `pages/api/changelog.js` (exempt comment).
**KHÔNG đụng:** `admin/ai-settings.js`, `admin/teachers.js` (đúng như plan — Phase 5),
`sysadmin/*`, `tickets.js`, `teacher/notifications.js`, `auth.js`, `cron/deadline-scan.js`.

**Một bug thật trong chính `lib/tenant.js` của tài liệu thi hành:** `withTenant` gọi
`currentWorkspace()` (đọc `WorkspaceMember`) TRƯỚC KHI handler được chạy — tức trước khi
`connectDB()` (dòng đầu tiên của mọi handler) kịp thực thi. Query treo, timeout sau 10s.
Sửa: gọi `connectDB()` ngay trong `withTenant`, trước `currentWorkspace()` — an toàn vì
`connectDB()` cache trên `global`, gọi lại không tốn gì. Không phát hiện được nếu không
verify bằng cách gọi handler thật (xem mục kiểm tra bên dưới) — chỉ `node --check` (cú
pháp) sẽ KHÔNG bắt được lỗi này.

**Route bị sót khỏi bảng 3.1 của tài liệu thi hành:** `admin/submissions/ai-grade.js`.
Tài liệu ghi "20 route" nhưng bảng chỉ liệt kê 19. Route này có mặt trong audit B2 gốc
của PLAN-MULTI-TENANT.md ("không kiểm tra submission có thuộc GV không", mục 5.2 gốc ghi
rõ "assertOwned submission trước khi gọi AI") nhưng rơi mất khi tách sang tài liệu thi
hành chi tiết. Phát hiện bằng `check-tenant-scope.js` (chạy strict, file có truy vấn
Mongoose mà không có tenantFilter/assertOwned/req.ws). Đã sửa: `Submission.findOne`
+ `GradingJob.findOne` bọc `tenantFilter`; `GradingJob.create` giữ nguyên (chiều ghi,
Phase 3).

**`check-tenant-scope.js` tự bắt lỗi của chính nó:** regex ban đầu khớp cả `.find(` trên
mảng thường (`failed.find(f => ...)` trong `ai-lesson.js`), báo vi phạm giả. Sửa: chỉ bắt
lệnh gọi trên định danh PascalCase (đúng quy ước đặt tên Model trong `lib/models/`).
`admin/teachers.js` được gắn `// tenant-exempt: ...` (route cố ý chưa lọc, chờ Phase 5) —
đây KHÔNG phải sửa logic, chỉ là comment cho chính script kiểm tra mới viết trong phase
này, không vi phạm "KHÔNG ĐỤNG VÀO" của tài liệu thi hành.

**Kiểm tra đã chạy — không dùng dev server** (theo quy tắc "không tự khởi động dev server"):
viết harness gọi thẳng route handler (mock `req`/`res`, JWT ký thật bằng `JWT_SECRET`, nối
DB dev thật qua Mongoose) — cùng đường code y hệt production, không qua HTTP.

| Kiểm tra | Kết quả |
|---|---|
| `node --check` toàn bộ file đã sửa | Sạch |
| `check-tenant-scope.js --strict` | 0 vi phạm (23 file có tenant filter, 2 exempt, 4 không truy vấn DB) |
| 6 route xương sống (units/tests/classes/students list+detail) cho `msnhi` | 200, đúng số liệu dev DB (4 unit, 1 test, 3 lớp, 1 học sinh) |
| dashboard, submissions, grading-queue, audio, images, unit-submissions, test-submissions, attendance, deadline-jobs cho `msnhi` | 200, đúng số liệu, không lệch dòng nào |
| **Kịch bản 2 workspace** (tạo tay `ws-test` + `gvtest` trên DB dev, theo đúng cảnh báo mục 5.3 — KHÔNG dùng `migrate-workspace.js`) | |
| — `gvtest` gọi units/tests/classes/students/grading-queue/audio | Tất cả `200`, **rows: 0** — rỗng hoàn toàn |
| — `GET admin/units?id=<unit của ms-nhi>` | **404** `{"error":"Unit not found"}` |
| — `GET admin/test-submissions?testId=<test của ms-nhi>` | **404** — lỗ B2 đã vá |
| — `GET admin/classes?id=<class của ms-nhi>` | **404** |
| — Không có response nào là 403 ở 3 kiểm tra trên | Đúng — đúng quy ước 404-not-403 mục 0.4 |
| Membership của `msnhi` sau khi test | vẫn đúng **1** dòng (không bị đẩy nhầm sang ws-test) |
| `msnhi` sau khi dọn `ws-test` | units/classes/students/tests — khớp lại đúng baseline ban đầu |
| Dọn dẹp | Đã xoá `ws-test`, `gvtest` (Teacher+User+WorkspaceMember) khỏi DB dev |

**App không đổi hành vi trên live** — Phase 2 chưa deploy, chỉ mới verify trên DB dev qua
harness. Trước khi deploy thật cần: đếm số dòng trên live cho `msnhi` trước/sau theo đúng
bảng mục 5.2 của tài liệu thi hành (chỉ mới verify bằng DB dev ở đây).

**🔴 Phase 2 CHƯA ĐƯỢC DEPLOY MỘT MÌNH.** Soát lại code sau khi thi hành phát hiện: Phase 2
bật lọc khi ĐỌC, nhưng `workspaceId` khi GHI mãi Phase 3 mới gán — nên sau khi deploy Phase 2,
mọi thứ TẠO MỚI đều tự biến mất, và tài khoản tạo mới bị 403 toàn bộ app. Ba hậu quả đã tái
hiện được trên DB dev, chi tiết + bằng chứng ở **mục 8.1.1**. Mục 8.1 bản cũ khẳng định trôi
dạt "không gây hại, không lỗi" — đã đính chính, câu đó sai.

Hai lỗi CÓ SẴN (không do Phase 2) phát hiện luôn trong lượt soát:
- `admin/grading-jobs.js`: nhánh poll theo `submissionId` dùng `findOneAndUpdate({_id: id})`
  trong khi `id` là `undefined` → code cũ crash 500 (`publicJob(null)`), code mới trả 404.
  Vẫn sai, sửa đúng là `{_id: job._id}`.
- `admin/audio.js` + `admin/images.js`: `Test.exists({"sections.audioId": ...})` — schema `Test`
  không có path `sections` ở gốc (thật ra là `skills.<skill>.sections`), nên chốt "đang dùng"
  CHƯA BAO GIỜ chạy → xoá được audio/ảnh đang dùng trong mock test.

→ **Việc tiếp theo: Phase 3 bước 1–2** (gán `workspaceId` ở 13 chỗ `.create()` + `lib/users.js`),
rồi deploy Phase 2 + Phase 3 cùng một lần.

**Ba việc phát sinh từ đợt tính năng AI** (audit gốc chưa thấy vì code ra sau):
- Số liệu thật: **20 model · 41 route · 40 trang** (audit gốc ghi 17/37/37). Đã sửa mục 1,
  bảng mục 3, mục 4.2, mục 4.3, mục 5.2, mục 6.
- `pages/api/admin/test-submissions.js` là **lỗ hở cùng loại B2 và chưa từng được liệt kê**:
  `Test.findById(req.query.testId)` không kiểm tra gì. Đã thêm vào bảng B2 và bảng 5.2.
- `ailogs` / `aiprompts` / `aispends` **chưa tồn tại trên live DB** (tính năng vừa merge,
  Mongo tạo collection lười). Nghĩa là Phase 1 không phải backfill gì cho nhóm này —
  chỉ thêm field vào schema `AiLog` là xong.

**Việc dọn dẹp nhỏ:** live DB có collection `user` (số ít) rỗng 0 doc — rác, tên đúng là
`users`. Xoá trước khi chạy migration cho đỡ nhầm.

**Phase 0 — đã viết 2 script** (`scripts/check-orphans.js`, `scripts/backup-db.js`, dùng chung
`scripts/dbTarget.js`). Ghi chú thiết kế:
- Không script nào có DB mặc định — bắt buộc `--live` / `--dev` / URI. Vì `scripts/use-db.js`
  ghi đè `MONGODB_URI` mỗi lần đổi, đọc biến đó ra là không biết đang trỏ đâu.
- `backup-db.js` ghi **EJSON** chứ không phải `JSON.stringify`: JSON thường biến `ObjectId`
  thành chuỗi, dump vẫn đọc được nhưng restore vào là sai toàn bộ tham chiếu — tức là có
  backup mà không dùng được. Lưu cả index (thiếu index unique khi restore = trùng username).
- `backups/` đã thêm vào `.gitignore` — dump chứa tên/email/bài làm học sinh thật.
- `check-orphans.js` **cảnh báo collection chưa phân loại**, không chỉ đếm. Đây mới là phần
  chống được kịch bản hỏng của Phase 1 (quên một collection → Phase 2 bật lọc → doc biến mất
  im lặng).

**Baseline thiếu `workspaceId` (live, 2026-09-22): 941 document**, 11/13 collection bắt buộc.
`deadlineemailjobs` và `gradingjobs` đang rỗng nên đã = 0 sẵn. `ailogs` chưa tồn tại.

**Đã có bản dump live:** `backups/listening_app-live-20260922-144756/` — 18 collection,
**965 document**, 3.3 MB (nặng nhất: `submissions` 2.0 MB, `units` 865 KB, `notifications`
253 KB). Kiểm tra lại bản dump: parse ngược đủ 965 doc, số lượng từng collection khớp
`_meta.json`, `_id` giữ kiểu `ObjectId`, `submittedAt` giữ kiểu `Date`, index của `users`
có đủ (`username_1`, `role_1`, `teacherId_1`, `studentId_1`), connection string trong
`_meta.json` đã che credentials.

Đối chiếu hai con số cho khớp: 965 tổng − 941 thiếu = 24 = `users` 23 + `appsettings` 1
+ `user` 0. Đúng bằng nhóm platform không cần `workspaceId` → không sót collection nào.

**Hai thứ `check-orphans.js` phát hiện ngay lần chạy đầu:**
- Live DB: collection rác `user` (số ít, 0 doc) — chưa phân loại, cần xoá.
- Dev DB: `conversations` và `messages` — của tính năng chat lớp, đang nằm ở nhánh
  `feature/class-chat` **chưa merge vào main**. Khi nhánh đó merge thì hai collection này
  phải được phân loại vào bảng mục 3 (nhiều khả năng là Workspace-level, qua `Class`) và
  thêm vào `REQUIRED` trong script. Chưa làm bây giờ vì code chưa có trên main.
(Việc số ① "commit file untracked" đã xong — `lib/teacherScope.js`, `lib/rateLimit.js`,
`lib/validate.js` đều đã vào git. Việc số ④ đo baseline: xong, chính là bảng trên.
`scripts/clone-db.js` **không** tái dùng được cho backup — nó clone DB→DB và xoá sạch
target trước khi ghi, không phải dump ra JSON.)

---

## 11. Câu hỏi còn treo (cần quyết trước khi tới phase tương ứng)

| # | Câu hỏi | Cần trước phase |
|---|---|---|
| Q1 | Tên + logo của **platform** là gì? ("Ms Nhi" sẽ chỉ còn là tên workspace) | 7 |
| Q2 | Mở signup tự do hay phải có mã mời / admin duyệt? | 6 |
| ~~Q3~~ | ~~Giáo viên hiện có (ngoài cô Nhi) — nằm chung workspace hay tách riêng?~~ **ĐÃ TRẢ LỜI 2026-09-22: câu hỏi không còn tồn tại — live DB chỉ có đúng 1 tài khoản teacher (`msnhi`).** Script chỉ cần tạo 1 workspace. | ~~1~~ |
| Q4 | TOEIC chưa có rubric chấm Writing/Speaking. Tạm dùng rubric IELTS, hay ẩn 2 kỹ năng đó với program TOEIC? | 8 |
| Q5 | Có giới hạn số HS/dung lượng theo workspace ngay từ V1 không, hay để sau cùng với billing? | 6 |
| Q6 | Ngân sách AI dùng chung toàn platform (0.3.4) — khi một workspace tiêu hết quota làm cả nhà bị chặn thì xử lý ra sao: admin nâng trần tay, hay cảnh báo sớm theo workspace? | 6 |
