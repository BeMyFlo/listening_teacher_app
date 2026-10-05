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
| 2 | Tầng enforcement `lib/tenant.js` + áp cho mọi route ĐỌC | ☑ **XONG, ĐÃ LÊN LIVE** | 2026-09-25. 26/26 route. Deploy cùng Phase 3 bước 1–2 — xem Nhật ký |
| 3 | Áp `workspaceId` cho mọi route GHI + luồng học sinh | ☑ **XONG, ĐÃ LÊN LIVE** | 2026-09-25. Bước 1–2–3–4–5–6 đều deploy xong. Bước 3 có 1 lỗ hổng ngoài dự tính, đã vá; bước 4–5 code bởi Haiku subagent, review dòng-theo-dòng + OCR review sau khi push bắt thêm 1 lỗi (cron thiếu workspaceId), đã vá — xem Nhật ký |
| 4 | Siết cứng: `required: true`, bỏ fallback, index, kiểm tra mồ côi | ☑ **XONG, ĐÃ LÊN LIVE** | 2026-09-25. Bước 5 (teacherScope) cố ý bỏ qua — xem Nhật ký |
| 5 | Tách Platform Admin vs Teacher (phân quyền thật) | ☑ **XONG** (5A + 5B + 5C) | 2026-09-30. Code bởi Sonnet subagent, Opus thiết kế + review từng dòng — xem Nhật ký |
| 6 | Onboarding + Workspace Settings + tuỳ chỉnh màu theo workspace (KHÔNG có tự đăng ký) | ☑ **XONG, đã merge vào `main`** (PR #9) | 2026-09-30. Đợt 2 (dọn 214 màu cứng) chưa làm |
| 7 | Gỡ branding cứng (app, email, Cloudinary folder) | ☑ **XONG, đã merge** (PR #10) | 2026-09-30. Tên nền tảng đã chốt **BeMyFlo** (2026-10-05) — xem Nhật ký |
| 8 | Taxonomy Subject / Program / Skill (mở đường TOEIC, General, Toán…) | ☐ chưa làm | |
| 9 | Tương lai: nhiều giáo viên / 1 workspace, enrollment nhiều lớp, Organization | ☐ chưa làm | không làm trong V1 |
| 10 | **Subdomain theo workspace** (`<slug>.bemyflo.com`) | ◐ **code xong** trên branch `phase-10-subdomains`, CHƯA merge/deploy; chờ chủ dự án merge + đặt env | 2026-10-05. Phần DNS/Vercel đã xong (nameserver → Vercel, `*.bemyflo.com` có chứng chỉ). Xem Nhật ký |

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
   ⚠️ **Bắt buộc làm kèm, không được tách:** khi giáo viên đang bị `teacherScope` giới hạn
   (`Teacher.classIds` không rỗng) tạo lớp mới, phải **tự động thêm `_id` lớp vừa tạo vào
   `classIds` của chính họ** trong cùng transaction/request. Không làm thì lặp lại đúng bug
   phát hiện 25/9: giáo viên tạo lớp mới xong tự làm mù chính mình, lớp đó tồn tại trong DB
   nhưng biến mất khỏi màn hình Classes của người vừa tạo ra nó — vì `Class` không có field
   sở hữu (B1, model hoàn toàn vô chủ) nên không có gì tự động đồng bộ. Bằng chứng thật:
   3/5 lớp của `msnhi` (`LEVEL 5`, `THUỲ DƯƠNG`, `TRIAL`, tạo 29/8–11/9) đã rơi vào đúng tình
   trạng này suốt gần 1 tháng trước khi bị phát hiện, chỉ vì lúc đó guard 403 chưa tồn tại.
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

### Phase 10B — Tự chuyển từ domain gốc sang subdomain, không hỏi lại mật khẩu *(chủ dự án chốt cách B, ưu tiên bảo mật, 2026-10-05)*

**Vấn đề:** phiên đăng nhập lưu theo từng địa chỉ nên đăng nhập ở `bemyflo.com` không có hiệu lực ở
`ieltswithnhi.bemyflo.com`. Chủ dự án hỏi vì sao không tự chuyển; bản Phase 10 cố ý chỉ hiện biểu ngữ. Câu trả lời Q9
được hiểu lại: giáo viên/học sinh có workspace thì **tự được chuyển** sang subdomain.

**Thiết kế: mã ủy quyền dùng một lần + `state` (cùng họ OAuth/"đăng nhập bằng Google")**
1. Ở domain gốc, đăng nhập xong (hoặc đã đăng nhập sẵn) → `GET /api/handoff/target` cho biết địa chỉ riêng (**server
   tính từ workspace của tài khoản**) → chuyển tới `<origin>/handoff`.
2. Subdomain (chưa có phiên) sinh `state` ngẫu nhiên 256 bit, giữ trong **sessionStorage của chính nó**, nhảy về
   `bemyflo.com/handoff?state=…`.
3. Domain gốc (đã có token) gọi `POST /api/handoff/start {state}` → server cấp **mã 256 bit, sống 60s, dùng một lần**,
   gắn với (userId, workspaceId, state); trình duyệt nhảy về `<origin>/handoff#code=…&state=…` (**mã nằm sau dấu `#`**).
4. Subdomain xoá `#…` khỏi thanh địa chỉ ngay, kiểm `state` khớp sessionStorage rồi `POST /api/handoff/exchange
   {code,state}` → nhận token thường như đăng nhập → vào trang chính.

**Chốt chặn bảo mật (mỗi dòng đã có test, 49 kịch bản, tất cả đạt):**
| Mối đe doạ | Cách chặn |
|---|---|
| Lộ mã qua lịch sử/log/Referer | mã ở fragment `#` (không gửi lên server, không vào log/Referer); xoá khỏi URL ngay; header `Referrer-Policy: no-referrer`, `no-store`, `X-Frame-Options: DENY` cho `/handoff` |
| Dùng lại / dò mã | 256 bit; DB chỉ lưu SHA-256; sống 60s; xoá nguyên tử khi dùng (**đốt ngay lần trình ra đầu tiên**, kể cả khi sai state/host); 2 request song song chỉ 1 thành công |
| Login CSRF (nhét mã của kẻ xấu vào trình duyệt nạn nhân) | `state` sinh và giữ ở **trình duyệt người dùng**, mã chỉ nhận khi `state` khớp; server cũng ràng mã với hash của state |
| Open redirect | địa chỉ đích do server tính, **bỏ qua** mọi `origin`/`target` client gửi |
| Mã dùng sai trung tâm | đổi mã chỉ hợp lệ trên subdomain của đúng workspace đã gắn; sai → 401 và mã bị đốt |
| Tài khoản đổi trạng thái giữa chừng | kiểm lại lúc đổi mã: user bị khoá, mất membership, học sinh chuyển workspace, workspace bị suspend → 401 |
| CSRF từ trang khác | các endpoint cần header `Authorization: Bearer` (không dùng cookie) |
| Dò hàng loạt | giới hạn tốc độ theo IP cho `start` và `exchange` |
| Phiên "đăng nhập hộ" của admin, admin nền tảng | không được cấp mã; `start` chỉ chạy ở domain gốc, `exchange` chỉ ở subdomain |
| Lộ qua audit log | ghi `auth.handoff_issued/handoff/handoff_failed`, không ghi mã/state (mở rộng `SECRET_KEYS` che `code`,`state`) |
| Vòng lặp chuyển hướng | chỉ thử 1 lần/30s mỗi trình duyệt (`lib/client/handoffGuard.js`); thất bại thì ở lại domain gốc; subdomain không bao giờ tự chuyển ngược |

**Rủi ro còn lại (đã chấp nhận):** XSS ở domain gốc vẫn là rủi ro như trước (script đã đọc được token, cơ chế này
không thêm khả năng mới); đăng xuất ở domain gốc **không** đăng xuất ở subdomain; mã nằm trong lịch sử trình duyệt chỉ
trong vài giây (bị xoá ngay và hết hạn/dùng một lần).
**Code:** `lib/handoff.js`, `lib/models/HandoffCode.js` (TTL), `pages/api/handoff/{target,start,exchange}.js`,
`app/handoff/page.js`, nối vào `app/login/page.js` + `components/RoleGate.js`; collection `handoffcodes` khai báo
PLATFORM trong `scripts/check-orphans.js`. **Chưa kiểm chứng trên trình duyệt thật** (cần bấm thử sau deploy).

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
   ⚠️ **Chức năng tạo giáo viên đang bị CHẶN** (trả 400) kể từ gói gỡ chặn Phase 3 bước 1–2 —
   vì nếu không chặn thì admin bấm tạo sẽ nhận `201` rồi giao ra một tài khoản 403 mọi màn
   hình. Bước 3 này chính là chỗ **mở lại**: tạo Workspace + WorkspaceMember rồi bỏ khối
   `return res.status(400)` trong nhánh `role === "teacher"`.
4. `sysadmin/impersonate.js`: token trả về gắn workspace của GV đó.
5. Trang `/admin/workspaces` (mới): danh sách workspace, số GV/HS/lớp, suspend/active.
6. Thêm bộ lọc workspace cho `sysadmin/dashboard|audit|storage|notifications`.

**App còn chạy không:** có, nhưng **đây là phase đầu tiên đổi URL API** → phải sửa
client cùng commit, không tách PR.
**Verify:** tài khoản teacher gọi `/api/sysadmin/teachers` → 403; admin gọi → 200.
**Rollback:** revert cả cặp API + client cùng lúc.

---

### Phase 6 — Onboarding + Workspace Settings + Tuỳ chỉnh màu *(~2 ngày)*

> **QUYẾT ĐỊNH 2026-09-30 (chủ dự án): KHÔNG có tự đăng ký.** Giai đoạn này chỉ người đã ký hợp
> đồng mới có tài khoản giáo viên, và CHỈ platform admin tạo được (`/admin/users`, đã có từ Phase
> 5B). Không xây `pages/api/auth/signup.js`, `app/signup/page.js`, `ALLOW_SIGNUP`, rate limit đăng
> ký. Hệ quả: rủi ro ngân sách AI dùng chung bị người lạ ăn mất (0.3.4) không còn ở giai đoạn này.
> Mở signup là quyết định riêng ở giai đoạn sau, phải kèm giới hạn AI theo workspace.

**Mục tiêu:** giáo viên mới do admin tạo, đăng nhập lần đầu là dùng được ngay, không lạc trước
một workspace trống.

**Việc làm**
1. `app/teacher/onboarding/page.js` — 3 bước: tên workspace → tạo lớp đầu → thêm/import HS.
   Không ép hoàn thành; có nút bỏ qua. Hiện cho giáo viên khi workspace còn trống.
2. Dashboard rỗng: workspace chưa có gì thì hiện empty state + 3 nút
   `[Create Class] [Create Lesson] [Import Questions]` thay vì bảng trống.
3. `app/teacher/settings/workspace/page.js` — đổi tên, logo, locale, timezone (chủ yếu owner).
   Logo/locale chỉ có ý nghĩa đầy đủ sau Phase 7 (gỡ branding cứng).

4. **Tuỳ chỉnh màu theo workspace (chủ dự án chốt 2026-09-30):** mỗi giáo viên/trung tâm chỉnh được
   màu app của workspace mình, mỗi người một phong cách. **Mặc định = đúng các màu hiện tại của web**
   (workspace chưa chỉnh gì → không có gì ghi đè). Giáo viên có thể đổi từng màu chi tiết, có nút
   Reset từng màu và Reset all. Chi tiết ở mục 6.1 bên dưới.

**Kiểm tra bằng code (không phải việc mới):** xác nhận không có đường tạo giáo viên công khai —
chỉ `sysadmin/users.js` (admin) và bootstrap `TEACHER_PASSWORD` (cần secret env + chỉ khi 0 giáo
viên, không kích hoạt được trên live).

**App còn chạy không:** có, hoàn toàn cộng thêm.
**Verify:** admin tạo giáo viên mới → giáo viên đăng nhập → thấy onboarding/dashboard rỗng → tạo
lớp → thêm HS → HS đăng nhập thấy đúng lớp. Dữ liệu Ms Nhi không hề thay đổi.
**Rollback:** ẩn trang onboarding.

---

### 6.1 Tuỳ chỉnh màu theo workspace — thiết kế và rủi ro

**Hiện trạng đã khảo sát (2026-09-30):** toàn bộ màu nằm ở ~25 biến CSS trong `:root` của
`styles/legacy.css` (file app THẬT SỰ nạp qua `app/globals.css`; `public/legacy/assets/style.css` là bản cũ, đừng nhầm) (`--blue`, `--navy`, `--pink`, `--bg`, `--ink`, `--border`, `--card`...;
stylesheet dùng biến rất nhiều). Không có dark mode. `Workspace.settings` (Mixed) đã có sẵn nên lưu
theme KHÔNG cần đổi schema. Còn **214** chỗ màu viết cứng trong `styles/legacy.css` (đo lại ở đúng file; con số ~100 trước đó đo nhầm file cũ) và
6 file JSX có hex cứng — những chỗ này sẽ KHÔNG đổi theo nếu chưa dọn.

**Thiết kế**
1. Lưu `Workspace.settings.theme = { "--blue": "#3D97D6", ... }`, CHỈ chứa màu đã đổi. Không có
   key = dùng màu mặc định trong CSS.
2. **Kiểm tra phía server là bắt buộc** (giá trị bị chèn thẳng vào CSS → nếu không kiểm sẽ chèn được CSS
   độc hại): chỉ nhận tên biến nằm trong danh sách cho phép (hằng số dùng chung server + UI) và giá trị
   đúng dạng `#RRGGBB`. Không nhận `url(...)`, `;`, `}`, `expression`, tên biến lạ.
3. Áp theme: giáo viên VÀ học sinh của workspace nhận theme (học sinh thấy màu trung tâm mình) qua
   một thẻ `<style>` ghi đè `:root`. Theme lấy theo workspace giải từ DB như `withTenant`, KHÔNG từ
   token/body client.
4. Trang `Settings → Appearance` (trong trang workspace settings): mỗi màu một dòng (ô chọn màu +
   xem trước ngay), gom nhóm theo mục đích, tên dễ hiểu (Primary, Accent, Background, Text...)
   thay vì tên biến. Reset từng màu + Reset all. **Chỉ owner** được sửa.
5. Cảnh báo độ tương phản chữ/nền (WCAG) khi chọn màu khiến chữ khó đọc; Reset luôn dùng được.
6. Trang đăng nhập chưa biết workspace → luôn dùng màu mặc định (theme theo đường dẫn workspace để sau).

**Chia hai đợt**
- **Đợt 1 (thuộc Phase 6):** hạ tầng (lưu, kiểm tra, áp theme, trang chỉnh) với ~10 màu chính.
- **Đợt 2 (sau, có thể gộp Phase 7):** dọn 214 màu viết cứng thành biến rồi mở rộng thêm màu chỉnh
  được. Dễ vỡ giao diện nếu làm ẩu → làm riêng, kiểm bằng ảnh chụp trước/sau.

**Ngoài phạm vi:** màu trong email gửi ra và màu logo (Phase 7). Dark mode không tồn tại → 1 bộ màu.
**Verify:** workspace không đặt theme → giao diện y hệt hiện tại (dữ liệu/CSS Ms Nhi không đổi); đổi
màu ở workspace A → học sinh A thấy, workspace B không; gửi giá trị độc hại (`red;}body{...`, `url(x)`,
biến lạ) → 400; GV không phải owner sửa → 403.
**Rollback:** xoá `settings.theme` (hoặc bỏ thẻ style) — giao diện về mặc định.

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

### Phase 10 — Subdomain theo workspace: `<slug>.bemyflo.com` *(1–2 ngày, ƯU TIÊN NGAY — làm trước Phase 8)*

**Mục tiêu:** mỗi trung tâm có địa chỉ riêng `msnhi.bemyflo.com`, và **trang đăng nhập hiện đúng logo/màu/tên
của trung tâm ngay trước khi đăng nhập** (hiện đang là điểm yếu: trang login luôn dùng màu và logo mặc định
của nền tảng). Khi mở đăng ký công khai sau này, giáo viên đặt `slug` là có địa chỉ ngay, **admin không phải
làm gì** (không tạo DNS, không cấu hình Vercel cho từng người).

**Cách hoạt động — một lần cấu hình, không phải mỗi trung tâm một lần:** thêm tên miền wildcard
`*.bemyflo.com` vào Vercel. Mọi tên `x.bemyflo.com` tự trỏ về cùng một app; app đọc **tên miền người dùng
truy cập** để biết trung tâm nào. Vercel cấp **một chứng chỉ** cho cả `*.bemyflo.com`. Đây đúng là mô hình
"multi-tenant platform" có tài liệu chính thức của Vercel (đã đối chiếu 2026-10-05).

**Nguyên tắc bất di bất dịch:** *tên miền chỉ để ĐỊNH TUYẾN và HIỆN THƯƠNG HIỆU, KHÔNG BAO GIỜ để PHÂN QUYỀN.*
Quyền truy cập dữ liệu vẫn lấy từ tài khoản (token → DB → workspace, đúng như `lib/tenant.js` hiện tại). Tên
miền chỉ được phép **thu hẹp** thêm: nếu tài khoản không thuộc workspace trong tên miền → từ chối. Đổi
`msnhi` thành `trungtamkhac` trên thanh địa chỉ **không bao giờ** mở thêm được dữ liệu nào.

**Hiện trạng (đã kiểm code 2026-10-05):** mọi trung tâm dùng chung `bemyflo.com/teacher/...`; không có
`middleware.js`; `pages/api/auth.js` không biết workspace; `withTenant` giải workspace chỉ từ token;
`Workspace.slug` đã có (unique, `a-z0-9-`) nhưng mới dùng cho thư mục Cloudinary; `APP_URL` dùng ở
`lib/notifications/channels/email.js` để dựng link trong email.

#### 10.0 Việc của chủ dự án (không phải code) — làm trước, vô hại với app đang chạy
1. Kiểm gói Vercel có cho dùng wildcard domain không (tài liệu Vercel không ghi hạn chế theo gói, nhưng gói
   Hobby giới hạn 50 tên miền tùy chỉnh/dự án — con số này tính cho tên miền riêng của từng trung tâm, **không**
   tính từng subdomain của một wildcard). Hobby cũng không dành cho mục đích thương mại — cân nhắc Pro.
2. **Tình trạng thực tế (kiểm 2026-10-05):** `bemyflo.com` đăng ký tại **P.A. Việt Nam**, nameserver đang trỏ
   về **Cloudflare**; DNS hiện chỉ có `A` → Vercel và `www` → CNAME Vercel, **không có MX/TXT** nào cần giữ. Vì
   vậy cách gọn nhất là **đổi nameserver tại P.A. Việt Nam sang `ns1.vercel-dns.com` / `ns2.vercel-dns.com`**
   (Vercel tự tạo lại 2 bản ghi trên). Nếu muốn giữ Cloudflare: thêm 2 bản ghi `NS` tên `_acme-challenge` →
   `ns1.vercel-dns.com.` và `ns2.vercel-dns.com.`, cộng `CNAME *` → `cname.vercel-dns-0.com.` ở chế độ **DNS only**
   (mây xám, không proxy), và bật "Enable Vercel DNS" trong Vercel mà giữ nguyên nameserver. Tài liệu Vercel
   khuyên chỉ dùng cách thứ hai khi không đổi được nameserver. Wildcard **bắt buộc** để Vercel quản lý DNS: đổi **nameserver của `bemyflo.com` sang Vercel**, hoặc nếu
   không muốn đổi thì ủy quyền riêng bản ghi `_acme-challenge` cho Vercel (xem tài liệu "Use wildcard domains
   with an external DNS provider").
3. Thêm 3 tên vào dự án Vercel: `bemyflo.com`, `www.bemyflo.com`, `*.bemyflo.com`.
4. Đặt env trên Vercel: `APP_BASE_DOMAIN=bemyflo.com`, `NEXT_PUBLIC_APP_BASE_DOMAIN=bemyflo.com`,
   `APP_URL=https://bemyflo.com`.
**Trạng thái 2026-10-05: mục 2–3 ĐÃ XONG và kiểm bằng lệnh** (nameserver ở registry là `ns1/ns2.vercel-dns.com`;
`*.bemyflo.com` đã được cấp chứng chỉ Let's Encrypt đến 2027-01; `abc-test.bemyflo.com` trả HTTP 200). Còn mục 1
(kiểm gói) và mục 4 (env, sau khi merge code).

Làm xong 1–3 mà chưa có code thì mọi `x.bemyflo.com` chỉ hiện giống trang chủ (chưa nhận ra trung tâm) —
không gãy gì. Domain gốc `bemyflo.com` **tiếp tục hoạt động mãi** cho mọi người dùng hiện có.

#### 10.1 Việc làm (code)
1. **`lib/slug.js`** — `validateSlug(slug)`: chỉ `a-z`, `0-9`, `-`; dài 3–40; không bắt đầu/kết thúc bằng `-`;
   không có `--` (tránh dạng `xn--` của IDN); **danh sách tên dành riêng** (`www admin api app login logout
   signup register mail email smtp ftp static assets cdn files media img images docs help support status blog
   billing pay dashboard teacher student sysadmin legacy`...). Chỉ áp cho slug **mới hoặc được đổi** — slug đã
   có (`ms-nhi`, `demo`...) được giữ nguyên (grandfather). Tái dùng ở mọi nơi tạo/đổi slug.
2. **`lib/host.js`** — `tenantSlugFromHost(host, baseDomain)`: bỏ cổng, hạ chữ thường; `host === base` hoặc
   `www.<base>` hoặc host không kết thúc bằng `.<base>` (vd `*.vercel.app` của bản preview) → `null` = **chế độ
   gốc** (hành vi như hiện tại); đúng 1 nhãn trước `.<base>` → trả slug; nhiều nhãn (`a.b.<base>`) → coi là
   không hợp lệ. Hỗ trợ `*.localhost` cho máy dev. Hàm thuần, có test theo bảng.
3. **`withTenant`** (`lib/tenant.js`) — sau khi giải workspace từ token: nếu có `hostSlug` thì tra workspace
   theo slug (cache RAM 60s như hiện tại); không thấy → 404; thấy nhưng **khác** workspace của tài khoản →
   từ chối (404, cùng quy ước "không lộ sự tồn tại" của mục 0.4). Chế độ gốc: không đổi gì.
4. **Đăng nhập** (`pages/api/auth.js`) — trên host có slug: giáo viên phải có `WorkspaceMember` của workspace
   đó, học sinh phải có `Student.workspaceId` đó; **admin nền tảng chỉ đăng nhập ở domain gốc**. Sai workspace
   trả **đúng thông báo "sai tên đăng nhập hoặc mật khẩu"** (không để lộ tài khoản này thuộc trung tâm nào) và
   ghi audit. Workspace bị `suspended` → thông báo riêng. Rate limit giữ nguyên.
5. **Endpoint công khai `GET /api/public/workspace-branding`** (không cần token) — slug lấy từ **header Host
   phía server, bỏ qua mọi tham số client**; chỉ trả `{ name, logoUrl, theme }` (3 trường vốn đã công khai
   theo thiết kế) hoặc 404; `Cache-Control: public, max-age=60`. Không bao giờ trả id, slug nội bộ, số liệu.
6. **Trang đăng nhập** (`app/login/page.js`) — đọc hostname phía client (so với
   `NEXT_PUBLIC_APP_BASE_DOMAIN`); nếu là host trung tâm: gọi endpoint ở mục 5, hiện logo + tên + áp màu của
   trung tâm (dùng lại `applyTheme`, đã tự gỡ khi rời trang). Slug không tồn tại → trang "Địa chỉ này chưa
   có trung tâm" kèm link về domain gốc. Domain gốc: giữ trang đăng nhập nền tảng như hiện nay.
7. **Link trong email** (`lib/notifications/channels/email.js`) — gốc link theo workspace của thông báo:
   `https://<slug>.<APP_BASE_DOMAIN>` nếu cấu hình đủ, không thì `APP_URL` như cũ.
8. **Quản lý slug** — `createTeacherWithWorkspace` nhận tham số `slug` tuỳ chọn (qua `validateSlug`; không
   truyền thì sinh từ username như hiện nay, vẫn qua bộ lọc tên dành riêng); form tạo giáo viên ở `/admin/users`
   thêm ô "Workspace address"; `/admin/workspaces` cho **admin** sửa slug (kiểm trùng + tên dành riêng).
   **v1 chỉ admin được đổi slug**; owner tự đổi chỉ cân nhắc khi mở đăng ký. Đổi slug làm link cũ hỏng nên
   v1 **không** làm chuyển hướng từ slug cũ (YAGNI; middleware chạy ở Edge không truy vấn Mongo được) — ghi
   rõ cảnh báo trong UI.
   **Slug đặt lúc tạo workspace; sau đó chỉ admin đổi** (chốt Q8). **Đổi slug có ảnh hưởng gì (đã kiểm code):**

   | Thứ | Ảnh hưởng |
   |---|---|
   | Dữ liệu (học sinh, lớp, bài, bài nộp, điểm danh...) | **Không** — mọi bản ghi tham chiếu `workspaceId`, không ai lưu slug; `slug` chỉ nằm ở bản ghi Workspace |
   | Phiên đăng nhập (JWT) | Không chứa slug; nhưng nằm theo từng subdomain nên đăng nhập lại 1 lần ở địa chỉ mới |
   | File audio/ảnh/logo đã upload | Không hỏng: DB lưu URL đầy đủ + `publicId` từ lúc upload. File **mới** vào thư mục slug mới (thư mục tách đôi, chỉ là cảnh quan) |
   | Link cũ (email đã gửi, bookmark, link gửi học sinh) | **Hỏng** — subdomain cũ thành "địa chỉ chưa có trung tâm" (v1 không chuyển hướng) |
   | Link thông báo trong app (`/student/lessons/...`) | Không — là đường dẫn tương đối |
   | **`scripts/migrate-workspace.js`** | **Nguy hiểm nếu không sửa** — script tra workspace theo slug (mặc định `ms-nhi`); nếu slug đã đổi, chạy lại sẽ **tạo workspace mới trùng tên** → xem mục 10 bên dưới |
9. **Dev trên máy:** `msnhi.localhost:3000` chạy được ở Chrome/Firefox (không cần sửa hosts) khi
   `APP_BASE_DOMAIN=localhost`. Lưu ý `.env.local` hiện hay trỏ DB live — kiểm trước khi bấm thử.
10. **Vá `scripts/migrate-workspace.js`** trước khi cho phép đổi slug: tra workspace theo **chủ sở hữu**
    (`ownerUserId` = giáo viên cũ nhất, như đã dùng để chống trôi owner ở Phase 3) thay vì theo slug; `--slug` chỉ
    dùng khi tạo mới. Script này idempotent và hay được chạy lại sau mỗi lần deploy, nên đây là chỗ duy nhất
    việc đổi slug có thể gây hại dữ liệu thật.

#### 10.2 Hệ quả cần chấp nhận
- **(Đã được thay thế bởi Phase 10B bên dưới — chuyển phiên tự động.)** **Token đăng nhập nằm trong localStorage, mà mỗi subdomain là một "nguồn" riêng** → đăng nhập ở
  `bemyflo.com` **không** tự đăng nhập ở `msnhi.bemyflo.com`. Người dùng hiện có (cô Nhi, học sinh) phải
  đăng nhập lại **một lần** khi chuyển sang địa chỉ mới; domain gốc vẫn dùng được song song nên không gãy link
  cũ. v1 không tự chuyển hướng (tránh vòng lặp, tránh cơ chế chuyển token); chỉ hiện biểu ngữ gợi ý địa chỉ
  mới cho người dùng ở domain gốc. Cơ chế chuyển token một lần (one-time code) để sau nếu cần.
- **Lợi ích bảo mật kèm theo:** vì localStorage tách theo nguồn, lỗi XSS ở trung tâm A **không đọc được token
  của trung tâm B** (hiện tại mọi trung tâm chung một nguồn). Cookie không dùng nên không dính chuyện
  cookie chéo subdomain. Giáo viên không chạy được mã trên subdomain; nội dung lý thuyết đã được escape — chưa
  cần nộp Public Suffix List, ghi lại để cân nhắc nếu sau này cho giáo viên đăng HTML tự do.
- Header `Host` do Vercel đặt; kể cả bị giả mạo thì chỉ làm **thu hẹp thêm** quyền của chính người giả mạo
  (vì mọi kiểm tra quyền vẫn từ token) — đúng nguyên tắc ở đầu mục.

#### 10.3 Kiểm chứng
Probe trên dev DB với handler thật + header `Host` giả lập: (a) bảng test `tenantSlugFromHost` (gốc, `www`,
`*.vercel.app`, 1 nhãn, nhiều nhãn, cổng, hoa/thường, `localhost`); (b) `validateSlug` (hợp lệ, quá ngắn/dài, ký
tự lạ, `--`, tên dành riêng, slug đã có được grandfather); (c) đăng nhập: giáo viên/học sinh đúng trung tâm → OK;
đúng mật khẩu nhưng sai trung tâm → cùng thông báo như sai mật khẩu; admin trên host trung tâm → bị từ chối;
domain gốc không đổi hành vi; trung tâm `suspended`; (d) `withTenant`: token workspace A + host của B → từ chối;
(e) endpoint branding: chỉ đúng 3 trường, bỏ qua slug do client gửi, slug lạ → 404; (f) link email theo workspace
và quay về `APP_URL` khi thiếu cấu hình; (g) `check-tenant-scope --strict`. Sau đó bấm thử thật trên
`*.bemyflo.com` sau khi chủ dự án làm xong mục 10.0.

**App còn chạy không:** có — domain gốc không đổi hành vi; mọi thứ mới chỉ kích hoạt khi truy cập bằng
subdomain. **Rollback:** gỡ `*.bemyflo.com` khỏi Vercel và/hoặc revert; không có migration dữ liệu nào.

**Làm xong thì mở khóa:** (1) trang đăng nhập mang thương hiệu trung tâm; (2) khi mở đăng ký công khai chỉ cần
thêm ô chọn slug trong form; (3) về sau có thể thêm **tên miền riêng của trung tâm** (vd `hoc.msnhi.vn`) bằng
API tên miền của Vercel, dùng cùng cơ chế tra workspace theo host.

---

## 9. Thứ tự ưu tiên nếu phải cắt bớt

Nếu cần ra mắt sớm, thứ tự **không được đảo**:

```
Phase 0 → 1 → 2 → 3 → 4    ← bắt buộc, đây là phần "cô lập dữ liệu". Dừng ở đây
                              vẫn là sản phẩm dùng được (admin tạo tài khoản GV tay).
Phase 5                     ← bắt buộc trước khi có GV thứ 2 THẬT (lỗ hổng B3).
Phase 6                     ← onboarding + đổi màu/cài đặt workspace. Không có tự đăng ký (admin tạo GV).
Phase 7                     ← cần khi bán cho người ngoài.
Phase 10                    ← ƯU TIÊN NGAY (chốt 2026-10-05), làm TRƯỚC Phase 8: subdomain theo workspace.
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

### 2026-09-22 — Phase 3 bước 1–2 XONG (thi hành theo PLAN-PHASE3-STEP12-WRITE-STAMP.md) ☑

Thi hành bởi Sonnet. Đây là gói gỡ chặn deploy cho Phase 2 (mục 8.1.1). **Phase 2 + gói
này giờ deploy được cùng một lần.**

**Đã sửa 14 file:**
- 8 route trong nhóm 1 chỗ `.create()`: `admin/classes.js`, `admin/units.js`,
  `admin/tests.js`, `admin/audio.js`, `admin/images.js`, `admin/attendance.js`,
  `admin/submissions/ai-grade.js`, `student/notes.js`.
- `pages/api/submissions.js` — cả **4** chỗ `Submission.create()`.
- `lib/users.js` — `createStudent` giờ **bắt buộc** `workspaceId` (throw nếu thiếu, không
  tạo tài khoản chết); `createTeacher` nhận `workspaceId` **tuỳ chọn** (tạo teacher đúng
  nghĩa cần Workspace + WorkspaceMember mới, đó là Phase 5, chưa làm ở gói này).
- `admin/students.js`, `sysadmin/users.js` — 2 chỗ gọi `createStudent`. Route sysadmin là
  platform-level (không có `req.ws`), workspace suy từ `Class` được chọn.
- `lib/notifications/index.js` — `emit()` giờ tự suy `workspaceId` từ người nhận
  (`Student`/`Teacher`) khi chỗ gọi không truyền vào, thay vì bắt cả 6 chỗ gọi tự nhớ.
  Không throw khi không suy được (thông báo là việc phụ, chạy ngầm).
- `lib/notifications/deadlineAssign.js` — `DeadlineEmailJob.create` lấy `workspaceId` từ
  `unit` đang cầm sẵn.
- `pages/api/student/notes.js` — 2 truy vấn ghi còn sót (`findOneAndUpdate`/`deleteOne`)
  bọc `tenantFilter`.

**Phát hiện ngoài phạm vi `.create()` — chỗ dễ bỏ sót nhất của cả gói:**
`lib/notifications/index.js` tạo `Notification` bằng `findOneAndUpdate` + `upsert`, không
`.create()`, nên không lộ ra khi grep. `Notification` thuộc nhóm bắt buộc và
`pages/api/notifications.js` đã lọc theo workspace từ Phase 2 — nếu bỏ sót thì chuông của
học sinh sẽ âm thầm ngừng hiện thông báo mới. Đã sửa theo đúng mục 3.1 của tài liệu thi hành.

**Nghiệm thu — tái hiện lại đúng 3 thí nghiệm đã chứng minh Phase 2 hỏng, cộng 2 kịch bản
mới, gọi thẳng handler trên DB dev (không dùng dev server):**

| # | Kịch bản | Trước gói này | Sau (kết quả thật) |
|---|---|---|---|
| 1 | POST `/api/admin/classes` rồi GET danh sách | tạo xong không thấy, mở ra 404 | `201` → **có trong danh sách** → GET theo id **200** |
| 2 | `admin/students.js` tạo học sinh mới rồi gọi 6 route học sinh | 403 tất cả | `201`, `workspaceId` đúng workspace của lớp → **cả 6 route 200** |
| 3 | Tạo `Submission` với `workspaceId` rồi GET `/api/submissions` | không thấy bài vừa nộp | **thấy** (7 → 8 dòng, đúng bài vừa tạo) |
| 4 | `notifications.emit({studentId,...})` rồi GET `/api/notifications` | (chưa kiểm tra ở Phase 2) | `emit()` tự suy đúng `workspaceId`, thông báo **hiện trong chuông** |
| 5 | `sysadmin/users.js` POST role=student với `classId` hợp lệ | (chưa kiểm tra ở Phase 2) | `201`, học sinh gọi `/api/units` **200** |

**Tĩnh:** `node --check` toàn bộ 14 file sạch. `check-tenant-scope.js --strict` — 0 vi phạm.

**`check-orphans.js --dev --strict`:** `Nhóm bắt buộc còn thiếu: 0/13`, tổng thiếu toàn DB
dev **0** (kể cả nhóm tuỳ chọn — dọn luôn 5 dòng `auditlog` sinh ra từ chính các lệnh test ở
trên, dù `AuditLog` không bắt buộc). `--strict` vẫn exit 1 nhưng chỉ vì cảnh báo
`conversations`/`messages` chưa phân loại — hai collection đó thuộc nhánh
`feature/class-chat` chưa merge vào `main`, đã ghi nhận từ Phase 0, không thuộc phạm vi
gói này.

**Không lấn sang bước 3–5** của Phase 3 (kiểm tra tham chiếu chéo cùng workspace, bỏ chặn
403 tạo lớp, cron lặp theo workspace, đảo fallback B7, sang sysadmin của teachers/ai-settings).
Commit tách riêng khỏi phần đó, để revert độc lập được nếu cần.

→ **Phase 2 + Phase 3 bước 1–2 sẵn sàng deploy cùng một lần.** Việc tiếp theo: Phase 3
bước 3–5, sau đó Phase 4.

### 2026-09-25 — Soát lại gói gỡ chặn + 2 sửa nhỏ

Soát lại code của gói Phase 3 bước 1–2 bằng cách gọi handler thật trên DB dev. **Kết luận:
code đúng** — cả 15 chỗ tạo document của 13 model bắt buộc đều gắn `workspaceId`, không sót.

**Lỗ hổng trong phần tự nghiệm thu của lượt trước:** kịch bản 3 gọi `Submission.create()`
thẳng ở tầng model với `workspaceId` truyền sẵn — tức là **không chạm vào đoạn code vừa sửa**.
Đã kiểm lại bằng route thật: `POST /api/submissions` (cả nhánh exercise lẫn writing) gắn
`workspaceId` đúng, và nhánh `emit(teacherId)` — lượt trước chỉ test nhánh studentId — cũng đúng.

**Hai sửa nhỏ trong lượt này:**

1. **Chặn tạo giáo viên chết** (`sysadmin/users.js`). Đo được: admin bấm tạo → `201` báo
   thành công → tài khoản đó `403` ở `/api/admin/units`, `/classes`, `/dashboard`. Đây đúng
   là "tài khoản chết" mà mục 0.5 của tài liệu thi hành cấm, nhưng tài liệu lại tự miễn trừ
   cho teacher ("giữ nguyên, Phase 5") — mâu thuẫn với chính nguyên tắc của nó. Giờ trả `400`
   kèm lời giải thích. Phase 5 bước 3 mở lại. **Không** đặt guard trong `lib/users.js` vì
   `auth.js` còn dùng `createTeacher` cho đường bootstrap (chỉ chạy khi `Teacher.count === 0`).
2. **Bỏ N+1 trong `emit()`**. `emit()` tự tra `Student`/`Teacher` mỗi lần gọi — đúng và an
   toàn, nhưng 3 chỗ gọi đã cầm sẵn `workspaceId` mà không truyền: `deadlineAssign` (có
   `job.workspaceId`, lặp qua CẢ LỚP — lớp 40 em = 40 query thừa mỗi job), `generate.js`
   (có `student`, chạy mỗi lần học sinh mở chuông), `student.js` (có `submission`).
   Đã truyền vào. Đường thoái lui giữ nguyên và **đã kiểm**: document cũ chưa có
   `workspaceId` thì `emit()` vẫn tự tra ra đúng workspace như cũ.

**Hai lỗi CÓ SẴN vẫn chưa sửa** (không do Phase 2/3 gây ra, đã ghi ở Nhật ký 22/9): nhánh
poll theo `submissionId` của `grading-jobs.js` dùng `_id: undefined`; và chốt "media đang
dùng" của `audio.js`/`images.js` dò sai đường dẫn schema. Để vào Phase 3 bước 6.

**Trôi dạt trên live sau 3 ngày** (đo 25/9, chỉ đọc):

| | 22/9 (4h sau migration) | 25/9 | |
|---|---|---|---|
| submissions | 481 / **5** thiếu | 493 / **17** | +12 bài mới, **12/12 đều thiếu** |
| notifications | 357 / **3** | 371 / **17** | +14, **14/14 đều thiếu** |
| Nhóm bắt buộc | **8** mồ côi | **34** | ~8–9 doc/ngày |

100% document mới đang trôi dạt — đúng như mục 8.1 mô tả. **Chưa gây sự cố** vì live vẫn
chạy code cũ (chưa có bộ lọc nào), nhưng xác nhận: phải chạy lại `migrate-workspace.js
--live --apply` **sát giờ deploy**, không phải chạy trước rồi để đó.

### 2026-09-25 — DEPLOY LÊN LIVE ☑ + phát hiện một bug cũ không liên quan multi-tenant

**Chuỗi deploy thật đã chạy, theo đúng thứ tự bắt buộc:**

1. `backup-db.js --live` — 1020 document, đã xác minh parse ngược được, kiểu `ObjectId`/`Date`
   giữ nguyên.
2. `migrate-workspace.js --live --apply` — quét 61 document trôi dạt (17 submissions +
   17 notifications + 27 auditlogs), còn thiếu **0**.
3. `check-orphans.js --live --strict` — exit 0, `0/13` nhóm bắt buộc thiếu. Kiểm độc lập
   thêm: `distinct("workspaceId")` trên 15 collection chỉ ra đúng **1** giá trị — không có
   workspace lạ nào lọt vào.
4. Merge fast-forward `feature/multi-tenant-phase1` → `main` (`24ebfd7..b80ca94`, 62 file).
   Vercel tự build từ push.
5. Chạy lại `migrate-workspace.js --live --apply` NGAY SAU khi Vercel báo xong — hốt nốt
   document sinh ra trong cửa sổ build. Kết quả: **0 document cần sửa** — không ai dùng app
   lúc đó nên không trôi dạt gì thêm. Tín hiệu tốt: code mới đã tự gắn `workspaceId` khi tạo,
   tốc độ trôi dạt về gần 0 ngay sau deploy (so với ~8–9 doc/ngày lúc trước khi deploy).

**Kiểm UI thật phát hiện một thứ đáng ngờ — điều tra ra là bug CŨ, không liên quan Phase 2/3:**

Đăng nhập `msnhi` chỉ thấy **2/5 lớp** trên trang Classes. Điều tra bằng dữ liệu (không đoán):

- `Teacher.classIds` của msnhi = 2 ID cụ thể, không phải `[]`. Soát toàn bộ diff của mọi
  commit multi-tenant (24ebfd7→b80ca94) — **không commit nào từng ghi vào field này**, chỉ đọc.
- Đối chiếu thời gian tạo 5 lớp với 2 ID trong `classIds`:
  ```
  27/8  LEVEL 1, LEVEL 2         [THẤY] — 2 lớp cũ nhất, khớp classIds
  29/8  LEVEL 5                  [ẨN]
  04/9  THUỲ DƯƠNG               [ẨN]
  11/9  TRIAL                    [ẨN]
  ```
- Gốc rễ: `Class` là model hoàn toàn vô chủ (B1 — không field `createdBy`/`teacherId`).
  Route tạo lớp **không hề đồng bộ** `classIds` của người tạo khi lớp mới ra đời. 3 lớp tạo
  sau ngày 27/8 rơi vào khoảng trống này suốt gần 1 tháng, tồn tại đúng trong DB nhưng vô
  hình với chính người tạo ra chúng.
- Vì sao không phát hiện sớm hơn: guard `403 Only an admin can create a new class`
  (chặn giáo viên bị scope tạo lớp mới) chỉ được thêm ngày **22/9** (`d151f19`, đợt code
  review) — 3 lớp kia đã tạo xong từ trước lúc guard đó tồn tại.

**Đã fix ngay:** `Teacher.classIds` của msnhi → `[]` (rỗng = phụ trách tất cả). Xác minh lại
bằng route thật trên live: `GET /api/admin/classes` trả đủ 5 lớp.

**Đã ghi ràng buộc cho Phase 3 bước 4** (xem mục đó): khi bỏ guard 403 để giáo viên tự tạo
lớp, **bắt buộc** làm kèm việc tự động thêm lớp mới vào `classIds` của người tạo — nếu không
sẽ tái diễn đúng bug này ngay khi bước 4 triển khai.

→ **Phase 2 + Phase 3 bước 1–2 đã LÊN LIVE, đang chạy ổn định.** Việc tiếp theo: Phase 3
bước 3–6, sau đó Phase 4.

### 2026-09-25 — Review bằng open-code-review (delegation mode) + Phase 3 bước 3 code xong

**Review toàn bộ đợt multi-tenant** (`24ebfd7..1de2d0f`, 11 commit, 59 file) bằng
`open-code-review` chạy ở chế độ delegation (OCR chỉ chọn file + rule, Claude tự đọc diff
và review — không cần API key riêng). **Kết luận: không có bug nghiêm trọng, không rò rỉ
cross-tenant, không có N+1 mới.** Tìm được 2 finding mức medium, đã vá và deploy
(commit `a7f8a76`):
- `lib/tenant.js` `assertOwned()` nuốt MỌI lỗi (kể cả mất kết nối DB) thành 404 — chỉ nên
  nuốt `CastError` (id sai định dạng). Đã sửa + kiểm 3 kịch bản (id sai, id không tồn tại,
  lỗi hạ tầng giả lập) đều đúng.
- `scripts/migrate-workspace.js` tính lại "chủ workspace" (giáo viên cũ nhất) MỖI LẦN chạy
  thay vì dùng `Workspace.ownerUserId` đã lưu cố định — lệch dữ liệu nếu người tạo ban đầu
  bị xoá sau đó và script chạy lại. Chưa ảnh hưởng V1 (1 giáo viên), nhưng sẽ gây lệch khi
  Phase 9 dùng `WorkspaceMember.role`. Đã sửa: `ownerUserId` chỉ tính mới khi workspace CHƯA
  tồn tại, còn lại luôn đọc từ `ws.ownerUserId`.

**Phase 3 bước 3 (kiểm tra tham chiếu chéo cùng workspace) — code xong, đã kiểm bằng dữ
liệu thật, CHƯA deploy.** 5 điểm sửa:
1. `lib/testSections.js`: `validateSections`/`validatePrompts` nhận thêm `ws`, bọc
   `tenantFilter` khi kiểm `Audio.exists`/`Image.exists`.
2. `admin/units.js`: `validateCategories(ws, categories)` — thread `ws` xuống
   `validateSections`.
3. `admin/tests.js`: `validateSkill`/`validateAllSkills` nhận thêm `ws`, thread xuống
   `validateSections`/`validatePrompts`.
4. `admin/students.js`: 2 chỗ `Class.findById(classId)` (tạo học sinh, đổi lớp) → đổi thành
   `Class.findOne(tenantFilter(req.ws, {_id: classId}))`. Giữ nguyên status `400` (không đổi
   thành `404` như `assertOwned`) vì đây là lỗi input-validation của route Student, không
   phải route Class.
5. `submissions.js` (route học sinh): 4 chỗ `Test.findOne`/`Unit.findOne` khi nộp bài
   (test/exercise/writing/speaking) → bọc `tenantFilter`.

**Lỗ hổng ngoài dự tính, phát hiện nhờ kiểm bằng dữ liệu thật (không phải chỉ đọc code):**
kịch bản "giáo viên A gán `audioId` của workspace B vào Unit của mình" **vẫn PASS (200)**
sau khi làm xong việc số 1–2 ở trên. Điều tra ra: `validateCategories` (units.js) từ trước
tới giờ **chỉ verify `sections` bên trong `exercises`/`topics`/`groups`** — chưa từng verify
`categories[].theory.audioId`, `categories[].theory.imageId`, hay
`categories[].prompts[].imageId`. Route PUT gán thẳng các trường này từ body xuống DB,
không qua bất kỳ hàm validate nào — đây là lỗ hổng **có sẵn từ trước cả dự án multi-tenant**
(route chưa từng kiểm tra Audio/Image đó có tồn tại hay không cho `theory`/`prompts`, dù đã
kiểm cho `sections`). Chỉ thread `ws` vào `validateSections`/`validatePrompts` là không đủ,
vì các hàm đó **chưa từng được gọi** cho hai trường trên. Đã vá trực tiếp trong
`validateCategories`: verify `theory.audioId`, `theory.imageId`, và mọi `prompts[].imageId`
bằng `Audio.exists`/`Image.exists` + `tenantFilter`. `tests.js` không dính lỗi tương tự vì
Test không có khái niệm `theory` riêng — mọi `audioId`/`imageId` của Test đều nằm trong
`sections`/`prompts`, đã được `validateSections`/`validatePrompts` phủ đủ từ trước.

**Kiểm chứng — gọi route thật trên DB dev, dựng workspace B tạm thời làm đối chứng:**

| # | Kịch bản | Kết quả |
|---|---|---|
| 1 | Unit + `audioId`/`imageId` (theory) CÙNG workspace | `200` |
| 2 | Unit + `audioId` (theory) KHÁC workspace | `400` "does not exist" |
| 3 | Unit + `imageId` (theory) KHÁC workspace | `400` |
| 4 | Unit + `imageId` (prompts) KHÁC workspace | `400` |
| 5 | Tạo học sinh + `classId` CÙNG workspace | `201` |
| 6 | Tạo học sinh + `classId` KHÁC workspace | `400` "Class not found" |
| 7 | Sửa `classId` học sinh sang lớp KHÁC workspace | `400` |
| 8 | Học sinh xem Test CÙNG workspace (route thật `/api/tests`) | `200` |

Đã dọn sạch mọi workspace/audio/image/class/student/user probe khỏi DB dev sau khi test.

→ **Việc tiếp theo: push + deploy Phase 3 bước 3, sau đó bước 4–5, rồi Phase 4.**

---

### 2026-09-25 — Phase 3 bước 4–5 XONG (đồng bộ `classIds` khi tạo lớp + cron/thông báo theo workspace) ☑

**Bối cảnh:** thay vì tự code, việc này được giao cho một Claude subagent chạy model
Haiku (rẻ token) trong một `git worktree` riêng, theo đúng tài liệu thi hành
`PLAN-PHASE3-STEP45-CLASS-CRON.md` (chứa nguyên văn mã nguồn trước/sau cho 4 file, luật
"không tự suy luận, dừng nếu không khớp"). Toàn bộ diff Haiku tạo ra đã được review dòng-theo-
dòng, đối chiếu với plan, trước khi chấp nhận — không tin tưởng mù quáng.

**4 file sửa (+32/-13 dòng):**

1. `pages/api/admin/classes.js` — bỏ guard 403 "chỉ admin mới được tạo lớp"; giáo viên đang bị
   `teacherScope` giới hạn (`classIds` không rỗng) tự tạo lớp mới thì lớp đó được `$addToSet`
   thẳng vào `classIds` của chính họ (cùng request, không tách transaction riêng vì chỉ 2 lệnh
   ghi tuần tự lên 2 document khác nhau). Giáo viên "toàn quyền" (`classIds` rỗng) thì bỏ qua —
   rỗng vẫn có nghĩa là thấy hết, không cần đụng gì. Đây chính là fix gốc cho bug UI phát hiện
   sớm hơn trong ngày (lớp mới tạo biến mất khỏi màn hình Classes của người tạo).
2. `lib/notifications/teacher.js` — `recipientsForClass`/`notifyTeachersOfSubmission` nhận thêm
   `ws`, lọc giáo viên nhận thông báo bằng `tenantFilter(ws)` thay vì quét toàn bộ collection
   `Teacher` (lỗ hổng cross-tenant: trước đây học sinh workspace A nộp bài có thể báo nhầm giáo
   viên workspace B nếu không ai khớp `classId`). `emit()` được truyền `workspaceId: ws.workspaceId`
   để khỏi phải tự tra lại.
3. `pages/api/submissions.js` — 2 chỗ gọi `notifyTeachersSafe({...})` thêm `ws: req.ws`.
4. `lib/notifications/generate.js` — `generateDeadlineNotifications` bọc câu truy vấn `Unit.find`
   bằng `tenantFilter({ workspaceId: student.workspaceId }, {...})` thay vì lọc trần theo
   `level`/`deadlines.classId` — tránh hiện thông báo hạn nộp của Unit ở workspace khác nếu lỡ
   trùng level/classId (về lý thuyết `classId` đã unique toàn hệ thống trước migration nên rủi ro
   thấp, nhưng đây là phòng thủ đúng nguyên tắc tầng tenant).

**Kiểm tra tĩnh (working tree chính, sau khi copy từ worktree Haiku):**
`node --check` cả 4 file (pass) + `node scripts/check-tenant-scope.js --strict` (pass, "Không có
file nào vi phạm") + grep xác nhận không còn callsite `recipientsForClass`/
`notifyTeachersOfSubmission` nào bị bỏ sót ngoài 2 file đã sửa.

**Kiểm chứng bằng dữ liệu thật trên dev DB** (gọi thẳng qua middleware thật
`requireAuth(withTenant(handler))` với JWT ký thật bằng `signTeacherToken`, không mock —
xem script tạm `scripts/_probe-phase3-step45-TMP.js`, đã xoá sau khi chạy):

| # | Kịch bản | Kết quả |
|---|----------|---------|
| A | Giáo viên bị scope giới hạn (`classIds=[lớp cũ]`) gọi `POST /api/admin/classes` | `201`, `classIds` sau đó có cả lớp cũ lẫn lớp mới (`$addToSet` đúng) |
| B | Giáo viên toàn quyền (`classIds=[]`) gọi `POST /api/admin/classes` | `201`, `classIds` vẫn `[]` sau đó |
| C | `notifyTeachersOfSubmission` với `ws` giả lập workspace thật | `Notification` tạo ra có đúng `workspaceId` |
| D | `generateDeadlineNotifications` chạy cho học sinh thật + kiểm tra `tenantFilter` với `workspaceId` giả (không tồn tại) trả về `0` document | Không lỗi, cách ly đúng theo workspace |

Đã dọn sạch mọi class/notification probe khỏi DB dev sau khi test (xác nhận lại bằng đếm
`countDocuments` cho tên/tiêu đề bắt đầu bằng `PROBE` → 0).

**Đã push lên `origin/main` (commit `d7e28cb` + `0ca2b8e`).**

**Review lại bằng `open-code-review` (delegation mode) NGAY SAU KHI PUSH** — đúng thói quen
"không tin tưởng mù quáng code do model rẻ viết", kể cả khi đã tự review thủ công trước đó.
Bắt được 1 lỗi thật ở `lib/notifications/generate.js`:

> `generateDeadlineNotificationsForAll()` (đường cron quét toàn bộ học sinh) gọi
> `Student.find({...}).select("_id classId name")` — **thiếu `workspaceId` trong projection.**
> `tenantFilter` vừa thêm vào `Unit.find` bên trong `generateDeadlineNotifications(student)` dựa
> vào `student.workspaceId`; Mongoose/MongoDB driver tự bỏ field có giá trị `undefined` khỏi câu
> truy vấn, nên với MỌI học sinh đi qua đường cron, filter tenant coi như biến mất — y hệt như
> trước khi vá. Không phải lỗ hổng MỚI (trước đó vốn cũng không lọc theo workspace ở đây), nhưng
> "fix" vừa merge vô tác dụng đúng ở chỗ quan trọng nhất (cron chạy toàn platform, không phải
> route `/api/notifications` theo từng học sinh — chỗ đó vẫn ổn vì `Student.findById()` không
> giới hạn field).

**Đã sửa:** thêm `workspaceId` vào `.select()` của `generateDeadlineNotificationsForAll()`.
Kiểm chứng bằng dữ liệu thật trên dev DB (so sánh cùng 1 câu query trước/sau projection, học
sinh thật trả về `workspaceId: undefined` trước sửa, giá trị `ObjectId` thật sau sửa). Đã chạy
lại `node --check` + `check-tenant-scope --strict`. Commit riêng, push tiếp lên `origin/main`.

→ **Việc tiếp theo: chạy lại `migrate-workspace --live --apply` + `check-orphans --live --strict`
sau khi Vercel deploy xong (không bắt buộc cho bước 4–5 vì không thêm `.create()` mới, nhưng vẫn
nên chạy 1 lần cho chắc sau khi có commit thứ 3), rồi Phase 4.**

Đã chạy: `migrate-workspace --live --apply` (0 document mới cần gán), `check-orphans --live --strict`
→ 0/13 nhóm bắt buộc thiếu. Vercel deploy Production đã Ready (xác nhận qua `vercel ls`).

---

### 2026-09-25 — Phase 4 bước 0–3 (siết `required: true` + index) code xong ☑

**Bước 0–1** (chạy lại migration + xác nhận `check-orphans` = 0) — đã làm ở cuối mục trên, live sạch
tuyệt đối trước khi bắt đầu siết `required`.

**Bước 2 — `required: true` cho 13 model bắt buộc** (mục 4.2): `Teacher`, `Student`, `Class`, `Unit`,
`Test`, `Audio`, `Image`, `AttendanceSession`, `Submission`, `StudentNote`, `Notification`,
`GradingJob`, `DeadlineEmailJob`. KHÔNG đặt cho `Ticket`/`AuditLog`/`AiLog` (đúng quyết định 0.3.4 —
đây là doc tầng platform, có thể sinh ra khi chưa xác định được workspace).

Trước khi merge, đã kiểm tra thủ công **mọi `.create()` callsite** của 13 model (grep toàn repo) để
chắc chắn `required: true` không làm gãy request nào đang chạy — tất cả đã truyền `workspaceId` từ
Phase 3 bước 1–2. Phát hiện 1 đường bootstrap cũ tại `pages/api/auth.js:118`
(`users.createTeacher({name:"Teacher", username, password})` — nhánh "bootstrap giáo viên đầu tiên
qua `TEACHER_PASSWORD`") KHÔNG truyền `workspaceId`. Nhánh này chỉ mở khi `Teacher.countDocuments()
=== 0` (chưa từng đạt được trên live vì đã có msnhi từ trước), và đây chính xác là kiểu "tài khoản
chết" mà migration này muốn loại bỏ (giống lý do `pages/api/sysadmin/users.js` đã chặn tạo giáo viên
mới — xem Nhật ký 2026-09-22). Quyết định: **không sửa**, để `required: true` tự chặn cứng nhánh này
(ném `ValidationError`, route đã có `try/catch` trả về 400, không crash) — đúng hướng Phase 5 mới
thiết kế lại flow tạo giáo viên có kèm Workspace.

**Bước 3 — Index mục 4.3**, thêm compound index (và bỏ `index: true` đơn lẻ ở model có compound đè
lên): `Class{workspaceId,level,name}`, `Unit{workspaceId,level,order}`, `Test{workspaceId,status,level}`,
`Student{workspaceId,classId}`, `Submission{workspaceId,gradingStatus,submittedAt}` +
`Submission{workspaceId,studentId,submittedAt}`, `Audio{workspaceId,uploadedAt}`,
`Image{workspaceId,uploadedAt}`, `AttendanceSession{workspaceId,classId,date}`,
`Notification{workspaceId,createdAt}`. 4 model còn lại (`Teacher`, `StudentNote`, `GradingJob`,
`DeadlineEmailJob`) không có compound theo mục 4.3 nên giữ nguyên `index: true` đơn lẻ.

**Bước 5 (đảo mặc định `teacherScope.js`) — QUYẾT ĐỊNH GIỮ NGUYÊN, KHÔNG LÀM.** Đọc lại mục 8.4 bước
5 gốc ("bỏ `{all: true}` khi `classIds` rỗng") thì phát hiện xung đột trực tiếp với bug fix vừa merge
ở Phase 3 bước 4: `pages/api/admin/classes.js` dùng đúng `scope.all` (dựa trên `Teacher.classIds`
rỗng hay không trong DB) để quyết định có `$addToSet` lớp mới vào `classIds` hay không — giáo viên
"toàn quyền" (raw rỗng) phải giữ nguyên rỗng, đã kiểm chứng bằng dữ liệu thật (Test B ở Nhật ký Phase
3 bước 4–5). Nếu đổi `teacherScope()` sang liệt kê tường minh mọi lớp của workspace khi rỗng, `scope.all`
sẽ luôn `false`, phá vỡ đúng bug fix đó. Mục tiêu thật của bước 5 ("ranh giới thật do `workspaceId`
lo, không phải do cờ `all` toàn cục") **đã đạt được** — `check-tenant-scope.js --strict` xác nhận mọi
route đều tự áp `tenantFilter(req.ws)` độc lập với `teacherScope`, nên `{all:true}` không bao giờ là
lối thoát cross-workspace trong thực tế. Bỏ qua bước 5, ghi lại lý do ở đây để không ai lặp lại.

**Bước 4 — gắn `check-tenant-scope.js --strict` vào `npm run build`**: `package.json` → `"build": "node
scripts/check-tenant-scope.js --strict && next build"`.

**Kiểm chứng:** `node --check` cả 13 model + `package.json` hợp lệ JSON; script tạm kết nối dev DB gọi
`Model.init()` cho cả 13 model — build index thành công, không xung đột, đọc được document hiện có
(không lỗi validate khi query — chỉ `required` chặn lúc GHI, không chặn đọc document cũ). Chạy lại
`check-orphans --live --strict` lẫn `--dev --strict`: live sạch 0/13; dev cũng 0/13 (18 `auditlogs`
thiếu — nhóm tuỳ chọn, không chặn — và cảnh báo "chưa phân loại `conversations`/`messages`" là dữ
liệu thử nghiệm của nhánh `feature/class-chat` khác, không liên quan Phase 4, không có trên live).

→ **Việc tiếp theo: review bằng `open-code-review` rồi mới push (đúng quy trình mới), deploy, chạy lại
`migrate-workspace --live --apply` + `check-orphans --live --strict` sau deploy để chắc chắn không có
document nào trôi dạt trong cửa sổ build trước khi `required` có hiệu lực, rồi Phase 5.**

---

### 2026-09-30 — Phase 5 gói 5A: vá B3 + B10 ☑

Cách làm mới: Opus khảo sát + chốt thiết kế + review từng dòng; Sonnet subagent code + tự kiểm
chứng bằng probe dữ liệu thật trên dev DB. Phase 5 chia 3 gói: **5A** (B3+B10, bảo mật), **5B**
(mở lại tạo giáo viên kèm Workspace/WorkspaceMember; mục 4 impersonate thực ra đã đúng sẵn vì
workspace giải từ DB theo `userId`, không từ JWT — chỉ cần verify), **5C** (trang
`/admin/workspaces` + bộ lọc workspace cho sysadmin).

**Lệch plan gốc (có chủ đích):** KHÔNG chuyển `admin/teachers.js` sang `sysadmin/`. Trang
`/teacher/settings` đang dùng nó để giáo viên đặt email nhận thông báo — chuyển đi là mất chức
năng. Admin platform đã quản lý tài khoản giáo viên qua `sysadmin/users.js`. Thay vào đó siết tại
chỗ: `requireAuth(withTenant(...))`, GET chỉ trả giáo viên/lớp cùng workspace, PUT dùng
`assertOwned` (khác workspace → 404) và chỉ cho sửa chính mình hoặc `req.ws.role === "owner"` sửa
đồng nghiệp (→ 403). `classIds` lọc id rác bằng `asObjectId` trước khi query (trước đây id rác →
CastError → 500) và chỉ giữ lớp của workspace.

**B10:** `admin/ai-settings.js` bỏ PUT (→ 405, `Allow: GET`) — model AI là cấu hình toàn platform,
admin đã chỉnh ở `/admin/system`. Trang `/teacher/ai-grading` thành chỉ-xem. Xoá
`api.teacher.saveAiSettings`.

**Kiểm chứng (probe dev DB, handler thật + JWT thật, 2 workspace):** owner A không thấy GV/lớp của
B (200); A sửa GV của B → 404; A sửa email mình → 200, lưu đúng; `classIds=[lớp A, lớp B, "rác"]`
→ chỉ lưu lớp A; GV thường A2 sửa owner → 403, sửa chính mình → 200; owner sửa A2 → 200;
ai-settings GET 200, PUT 405. Dọn sạch probe (0 còn lại). `check-tenant-scope --strict` sạch
(route này hết exempt). OCR review trước push: 4/4 file, không phát hiện.

**Ghi chú vận hành:** lúc chạy probe, `.env.local` đang trỏ LIVE (vừa chạy `npm run dev:live`) —
guard `msnhiapp_dev` trong probe đã chặn đúng; probe tự đổi sang `MONGODB_URI_DEV` trong process.

---

### 2026-09-30 — Phase 5 gói 5B: mở lại tạo giáo viên kèm Workspace ☑

**Tạo giáo viên** (`sysadmin/users.js` POST, và luồng bootstrap `TEACHER_PASSWORD` trong
`auth.js`) giờ đi qua `users.createTeacherWithWorkspace`: validate hết trước khi ghi, sinh sẵn
`workspaceId`, tạo Teacher + User → Workspace (slug từ username, trùng thì `-2`, `-3`…) →
WorkspaceMember(owner). Lỗi ở bất kỳ bước nào → dọn sạch (Teacher xoá theo `workspaceId` vừa sinh,
vì `createTeacher` tạo Teacher TRƯỚC User — review lần 1 bắt được: nếu `User.create` lỗi thì
Teacher mồ côi sót lại). `createTeacher` giờ bắt buộc `workspaceId`. Khối chặn 400 đã gỡ.

**Mục 4 (impersonate):** không cần sửa — token có `userId` của GV, `currentWorkspace` giải qua
`WorkspaceMember` → probe xác nhận đăng nhập hộ GV mới thấy đúng workspace của GV đó, 0 lớp của
workspace khác.

**Vá thêm 3 lỗ sẵn có** ngoài plan: (1) admin đổi lớp học sinh sang lớp workspace khác → giờ 400;
(2) admin gán `classIds` GV lấy lớp workspace khác → giờ lọc theo workspace của GV + bỏ id rác;
(3) xoá GV chỉ xoá Teacher+User, bỏ lại Workspace mồ côi → giờ owner chỉ xoá được khi workspace
rỗng (Student/Class/Unit/Test/Audio/Image/Submission/member khác = 0), còn dữ liệu thì 400 "disable
instead"; xoá workspace rỗng thì dọn luôn Notification/AttendanceSession/StudentNote/GradingJob/
DeadlineEmailJob (review lần 1 bắt được: notification của owner để lại workspaceId treo).

**UI admin:** ô "Workspace name" khi tạo GV; dropdown lớp hiện tên workspace; đổi lớp học sinh chỉ
liệt kê lớp cùng workspace. GET `sysadmin/users` trả thêm `workspaceId`/`workspaceName`.

**Kiểm chứng:** probe dev DB 10 kịch bản (tạo GV, trùng slug, impersonate → `/teacher/me` + 0 lớp
lạ, GV mới tạo lớp, chặn đổi lớp khác workspace, lọc classIds, chặn/cho xoá, createTeacher thiếu
workspace, rollback) + probe vòng 2 cho 2 lỗi review bắt được (rollback khi `User.create` lỗi, dọn
notification). Tất cả pass, dọn sạch. OCR review: không phát hiện đáng kể.

---

### 2026-09-30 — Phase 5 gói 5C: trang Workspaces + thực thi suspend + bộ lọc ☑

**Thực thi suspend (ngoài plan — plan chỉ ghi "suspend/active" ở UI):** trước đây
`Workspace.status` không được đọc ở đâu cả, nút Suspend sẽ là nút giả. Giờ `currentWorkspace` nạp
thêm `status` (cache chung 60s), `withTenant` trả 403 "This workspace has been suspended…" cho mọi
GV/HS của workspace đó. Workspace không tồn tại → null → 403 như cũ. `clearTenantCache()` được gọi
sau khi admin đổi status (hiệu lực ngay trong container đó, container khác trễ tối đa 60s).

**`sysadmin/workspaces.js` + `/admin/workspaces`:** danh sách workspace kèm owner, số GV/HS/lớp
(1 aggregate/collection), đổi tên, suspend/activate qua `useDialog` confirm. Thêm mục nav.

**Bộ lọc `workspaceId`** cho `sysadmin/dashboard|audit|notifications` + select trên 3 trang. Trang
Storage cố ý không lọc (số liệu dung lượng toàn DB). Trên dashboard chỉ số admin là toàn platform.

**Log không gắn workspace (phát hiện khi kiểm live: 62/62 auditlog, 3/3 ailog thiếu
`workspaceId`):** `audit.record()` chưa từng ghi `req.ws.workspaceId`; `recordAiCall` chưa từng nhận
workspace. Đã sửa cả hai (ai-grade/ai-lesson truyền `req.ws`, `runAiGrade` lấy từ submission). Đây là
lý do `migrate-workspace` lần nào cũng phải backfill auditlog.

**Kiểm chứng:** probe dev DB trên workspace probe riêng (không đụng workspace thật): số đếm khớp
`countDocuments`; GV gọi route sysadmin → 403; suspend → GV và HS của workspace đó 403, workspace
khác vẫn 200; activate → 200 lại; validate status/name/id; 3 bộ lọc chỉ trả dòng của workspace, id
rác → 400; audit row của thao tác GV mang đúng `workspaceId`; AiLog lưu `workspaceId` (không gọi
Gemini thật). Dọn sạch. OCR 16/16 file, không phát hiện mức trung bình trở lên.

**Việc để lại:** (1) cron nhắc hạn vẫn gửi cho HS của workspace bị suspend; (2) ~~`/admin/classes` là trang "Soon"~~ — đã xây, xem mục ngay dưới.

→ **Phase 5 xong. Tiếp theo: Phase 6 (onboarding + Workspace Settings + tuỳ chỉnh màu; không có tự đăng ký).**

---

### 2026-09-30 — Trang `/admin/classes` (thay trang "Soon") ☑

Nguyên tắc chủ dự án chốt: lớp thuộc workspace và do giáo viên tạo/quản; admin platform chủ yếu
XEM dữ liệu, chỉ tạo/sửa hộ khi giáo viên nhờ, và KHÔNG xoá lớp (xoá lớp gỡ học sinh khỏi lớp và gỡ
Unit/Test đã gán — vẫn là việc của giáo viên).

`sysadmin/classes.js` (GET danh sách + lọc workspace, GET chi tiết kèm học sinh, POST, PUT; không
có DELETE) và trang `/admin/classes`. POST chọn workspace rõ ràng và `$addToSet` lớp mới vào
`classIds` của giáo viên trong workspace đó NẾU họ đang bị giới hạn lớp (`classIds` không rỗng) —
nếu không giáo viên nhờ tạo sẽ không thấy lớp đó (cùng lỗi đã vá ở Phase 3 bước 4). Giáo viên
`classIds` rỗng giữ nguyên. Audit log của thao tác admin gắn đúng workspace qua `req.auditWorkspaceId`
(route admin không có `req.ws`). Xoá code chết `api.admin.deleteClass`.

Kiểm chứng probe dev DB 10 kịch bản (danh sách khớp số học sinh thật, lọc workspace, giáo viên bị
403, tạo hộ cho GV toàn quyền và GV bị scope, validate, sửa, không có DELETE, audit đúng workspace,
workspace thật không bị đụng). Dọn sạch.

---

### 2026-09-30 — Phase 6 code xong trên branch `phase-6-onboarding-theme` (chưa merge, chưa deploy) ◐

**Quy tắc mới (chủ dự án):** mỗi phase push lên branch riêng, KHÔNG push thẳng `main`. Phase 6 nằm ở
branch `phase-6-onboarding-theme`; chủ dự án tự quyết lúc merge/deploy.

**Đã làm**
- `lib/theme.js` (dùng chung server + client): danh sách 13 màu cho phép (Brand/Surface/Text/Status, mặc
  định = đúng `:root` hiện tại, kèm alias `--indigo/--purple/--teal/--amber`...), `sanitizeTheme`
  (chỉ nhận key trong danh sách + `#RRGGBB`, bỏ màu trùng mặc định), `themeToCss` (`html:root{...}`,
  tự kiểm lại từng giá trị), tính tương phản WCAG + cảnh báo (chỉ tham khảo, không chặn lưu).
- `pages/api/teacher/workspace.js`: GET cho mọi giáo viên, PUT chỉ owner (tên, ngôn ngữ, múi giờ,
  theme; kiểm hết trước khi ghi; theme rỗng = xoá key). `pages/api/workspace/theme.js`: GET cho
  giáo viên + học sinh, kiểm lại lúc đọc (DB có giá trị bẩn → trả rỗng, không bao giờ trả CSS bẩn).
  Cả hai đã vào danh sách `check-tenant-scope`.
- `components/ThemeLoader.js` gắn trong `RoleGate` (chỉ teacher/student): áp cache localStorage ngay
  để không nháy màu, rồi lấy bản mới; rời khu vực đăng nhập thì gỡ → trang login luôn màu mặc định.
- `/teacher/settings/workspace` (General + Appearance: chọn màu xem trước trực tiếp, Reset từng màu /
  Reset all, cảnh báo tương phản; không-owner chỉ xem) + mục nav "Workspace" (Notifications thành `exact`
  để không sáng đôi).
- `/teacher/onboarding` (3 bước, bỏ qua được mọi bước) + dashboard rỗng: workspace chưa có lớp/bài học/
  bài thi → thẻ chào với `Create Class / Create Lesson / Import Questions / Guided setup`.

**Lệch plan có chủ đích**
- **Logo: chưa làm.** Không có chỗ nào hiển thị logo cho tới Phase 7 (gỡ branding cứng); upload logo
  bây giờ chỉ tạo dữ liệu không dùng. Field `Workspace.logoUrl` đã có sẵn.
- **Ngôn ngữ + múi giờ: chỉ lưu, chưa có tác dụng.** Chưa có code nào đọc chúng (email/giờ vẫn cố định
  `Asia/Ho_Chi_Minh`); sẽ nối ở Phase 7.
- "Import Questions" trỏ tới `/teacher/tests/new` vì chức năng import nằm trong trình soạn bài thi/bài học.
- Màu chỉnh được mới có 13 màu chính (đợt 1). `--violet` (màu chấm bài) và các màu `*-light` khác chưa
  chỉnh được; 214 màu viết cứng chưa động tới → một số chỗ sẽ không đổi theo (đợt 2).

**Kiểm chứng:** probe dev DB 27 kịch bản (2 workspace + giáo viên thứ 2 không phải owner + học sinh):
owner ghi/đọc theme; giáo viên + học sinh cùng workspace thấy, workspace khác KHÔNG; non-owner/học
sinh/owner workspace khác ghi → 403/không đổi; 8 kiểu giá trị độc (`red;}body{...`, `url(...)`, key lạ,
`#12345`, mảng, chuỗi, số...) → 400 và theme cũ giữ nguyên; DB bị sửa tay giá trị độc → không bao giờ
được trả ra; validate tên/ngôn ngữ/múi giờ; PUT chỉ tên giữ nguyên theme; màu trùng mặc định bị bỏ;
reset xoá key; workspace suspended → theme 403; luồng onboarding qua API thật (dashboard rỗng → tạo
lớp → thêm học sinh → không còn rỗng); workspace Ms Nhi trên dev không bị đụng. Dọn sạch. Cú pháp
JSX kiểm bằng esbuild (không chạy dev server/build để khỏi đụng `.next` của chủ dự án).

**CHƯA kiểm chứng:** hiển thị thật trên trình duyệt (chưa mở giao diện) — cần chủ dự án bấm thử
trên môi trường của mình: đổi màu → xem toàn app đổi, đăng nhập bằng học sinh xem màu, đăng xuất về
/login xem màu mặc định, workspace mới tạo xem thẻ chào + onboarding.

**Rollback:** không merge branch; hoặc xoá `settings.theme` để về màu mặc định.

---

### 2026-09-30 — Phase 7 code xong trên branch `phase-7-branding` (chưa merge, chưa deploy) ◐

**Quyết định của chủ dự án (sau khi xem bản đầu):** logo MN ("logo góc của app mình") là logo của CHÍNH
NỀN TẢNG, giữ nguyên — không thay bằng logo trung tính. Bản đầu của phase này đã thay nhầm logo và
favicon; đã hoàn lại đúng bản gốc (`public/logo.svg`, `app/icon.svg` trùng khớp `main`).

**Đã làm**
- **Nhận diện nền tảng** (`lib/platform.js`): logo mặc định = `public/logo.svg` (logo MN hiện có), tên lấy
  từ env `NEXT_PUBLIC_PLATFORM_NAME` (mặc định "IELTS LMS"; **chưa chốt tên thật — Q1 còn mở**). Dùng cho
  trang login, tiêu đề tab, admin, và làm logo mặc định cho workspace chưa tự upload logo. Favicon giữ
  nguyên logo MN.
- **Thanh bên** hiện logo + tên của workspace (store `lib/client/branding.js`, nạp bởi `ThemeLoader` cùng
  request với theme, cache localStorage; rời khu vực đăng nhập thì về mặc định). Workspace chưa có logo
  riêng (kể cả Ms Nhi) hiển thị logo MN như trước, kèm tên workspace bên dưới. `GET /api/workspace/theme`
  trả thêm `branding {name, slug, logoUrl}`.
- **Upload logo** (phần Phase 6 hoãn): trang Workspace Settings, chỉ owner; upload lên Cloudinary
  `workspaces/<slug>/logo`; server chỉ nhận URL Cloudinary của mình (≤500 ký tự) hoặc `""` để bỏ.
- **Email:** tên trung tâm trong thân thư + tiêu đề dự phòng theo workspace của thông báo (escape HTML —
  tên do giáo viên đặt); tên hiển thị người gửi = tên workspace, địa chỉ giữ hộp Gmail dùng chung (lấy
  từ `EMAIL_FROM` hoặc `GMAIL_USER`), truyền dạng object cho nodemailer nên CR/LF trong tên không chèn
  được header.
- **Cloudinary:** `MediaLibrary` upload file MỚI vào `workspaces/<slug>/audio|images`; file cũ giữ nguyên
  (R6). Đã kiểm preset unsigned `ielts_speaking_unsigned` qua Admin API: KHÔNG khoá thư mục → tham số
  `folder` từ client được tôn trọng, không cần chỉnh gì bên Cloudinary. Slug lạ/chưa nạp → quay về thư
  mục cũ (không vỡ upload). Tách thư mục ≠ bảo mật (R5).

**Không cần bước chạy tay sau deploy** (bản đầu có script gán logo cho Ms Nhi — đã bỏ vì logo MN giờ là
logo mặc định). Chỉ cần đặt `NEXT_PUBLIC_PLATFORM_NAME` trên Vercel khi chốt tên nền tảng; cân nhắc đổi
`EMAIL_FROM` từ "Ms Nhi IELTS <...>" sang tên nền tảng (tên hiển thị đã được ghi đè theo workspace nên
chỉ còn là dự phòng).

**Ngoài phạm vi / để lại**
- Ngôn ngữ + múi giờ workspace vẫn chỉ lưu, chưa nối vào email/giờ hiển thị (`APP_TZ` cố định).
- Bản cũ `/legacy` (public/legacy) còn chữ "IELTS with Ms Nhi" — đang bị bỏ dần, không sửa.
- Ghi âm Speaking của học sinh và ảnh đính kèm ticket vẫn upload ở gốc/`tickets` (không theo workspace).
- Lỗ hổng có sẵn (không do phase này): `pages/api/admin/audio.js`/`images.js` POST nhận
  `cloudinaryUrl` từ client mà không gọi `isCloudinaryUrl` — nên bổ sung.

**Kiểm chứng (probe dev DB, workspace probe riêng):** branding đúng theo workspace, học sinh workspace
khác không thấy; 6 kiểu `logoUrl` xấu (`javascript:`, `http://`, cloud khác, `data:`, quá dài, số) → 400;
non-owner → 403; đổi tên phản ánh vào branding; email (nodemailer giả): tên người gửi/thân/tiêu đề đúng
workspace, HTML escape, không còn chữ "Ms Nhi", thiếu workspace → tên nền tảng, CRLF không chèn header.
Dọn sạch. Sau khi hoàn lại logo chỉ đổi đường dẫn hằng số (không đổi logic) nên không chạy lại probe.
**Chưa kiểm chứng trên trình duyệt** (thanh bên, upload logo thật lên Cloudinary).

**Rollback:** không merge branch; hoặc revert. Logo đã upload lên Cloudinary vẫn dùng bình thường.

---

### 2026-10-05 — Chốt tên thương hiệu: **BeMyFlo** (tên miền `bemyflo.com`) ☑

Chủ dự án chốt sau nhiều vòng thử tên. Tiêu chí đã thống nhất: bán B2B cho trung tâm, quốc tế ngay, cảm giác
ấm áp gần gũi, tên tự đặt dễ nhớ, **bắt buộc có `.com`**, đủ rộng để làm môn khác ngoài tiếng Anh sau này
(vì vậy không dùng tên có chữ ngành như "class"). BeMyFlo cũng là tên tài khoản GitHub của chủ dự án.

**Đã làm:** mặc định `PLATFORM_NAME` trong `lib/platform.js` đổi thành "BeMyFlo" (vẫn ghi đè được bằng env
`NEXT_PUBLIC_PLATFORM_NAME`); mô tả trang ở `app/layout.js` bỏ chữ "IELTS"; ví dụ `EMAIL_FROM` trong
`lib/mailer.js`. Tên hiển thị người gửi email vẫn theo từng workspace (Phase 7).

**Tên miền (kiểm 2026-10-05 bằng RDAP chính thức): `bemyflo.com`, `.net`, `.org`, `.app` đều CÒN TRỐNG.**
Chưa ai mua — chủ dự án phải tự đăng ký ngay (tên trống có thể mất bất cứ lúc nào). `.co`/`.io` chưa kiểm
được đáng tin.

**Việc còn lại (không làm được bằng code):**
1. Mua `bemyflo.com` (nên mua thêm `.app`/`.net` để giữ thương hiệu).
2. **Tra nhãn hiệu trước khi làm logo/chi tiền quảng bá**: WIPO Global Brand Database + Cục Sở hữu trí tuệ
   Việt Nam, nhóm 9/41/42, tìm "BeMyFlo" và các dạng gần giống ("Be My Flo", "Flo"). Chưa tra.
3. Gắn domain vào Vercel (Project → Settings → Domains), trỏ DNS theo hướng dẫn của Vercel.
4. Đặt biến môi trường trên Vercel: `APP_URL=https://bemyflo.com` (link trong email lấy từ đây) và cân nhắc
   `EMAIL_FROM` dạng `BeMyFlo <địa-chỉ-gửi>`; không cần `NEXT_PUBLIC_PLATFORM_NAME` nữa vì đã là mặc định.
5. Đổi logo (chủ dự án sẽ làm sau) — nhớ thay `public/logo.svg` và `app/icon.svg`.

---

### 2026-10-05 — Thêm Phase 10 (subdomain theo workspace) vào plan, đặt ưu tiên cao ☑

Chủ dự án chốt thương hiệu BeMyFlo/`bemyflo.com` (mục trước), nhận ra URL chưa có tên trung tâm
(`bemyflo.com/teacher/overview` dùng chung) và hỏi việc này thuộc phase nào. Kiểm plan: **chưa có phase nào** —
`slug` chỉ dùng cho thư mục Cloudinary, Phase 9 không nhắc URL/tên miền theo trung tâm. Ghi thành **Phase 10**,
chủ dự án chọn **ưu tiên làm ngay, trước Phase 8**. Chọn **subdomain wildcard** thay vì đường dẫn
(`/ms-nhi/...`) vì: một lần cấu hình dùng cho mọi trung tâm (chủ dự án lo "1000 giáo viên thì không tạo nổi
từng subdomain" — wildcard giải quyết đúng chỗ này), không phải viết lại toàn bộ route, và mở khóa trang đăng
nhập mang thương hiệu trung tâm. Chưa có dòng code nào; xem Phase 10 để biết thiết kế, việc của chủ dự án
(DNS/Vercel) và cách kiểm chứng.

**Cùng ngày, chủ dự án trả lời Q7–Q9** (subdomain wildcard; slug đặt lúc tạo, sau đó chỉ admin đổi; domain
gốc vẫn chạy, dashboard admin ở domain gốc, giáo viên vào workspace bằng subdomain). Khi trả lời "đổi slug có
ảnh hưởng data không" đã rà code và phát hiện `scripts/migrate-workspace.js` tra workspace theo slug → thêm việc
vá vào Phase 10 (mục 10.1.10). Dữ liệu thật thì **không** bị ảnh hưởng vì không bản ghi nào lưu slug ngoài
Workspace.

---

### 2026-10-05 — Phase 10 code xong trên branch `phase-10-subdomains` (chưa merge, chưa deploy) ◐

**Đã làm (đúng thiết kế ở Phase 10, trừ các điểm lệch ghi bên dưới)**
- `lib/slug.js` (`validateSlug`: 3–40 ký tự, `a-z0-9-`, không `--`, danh sách tên dành riêng) và `lib/host.js`
  (`parseHost`: root / tenant / invalid; `workspaceOrigin`; hỗ trợ `*.localhost`). Không đặt `APP_BASE_DOMAIN` =
  tính năng tắt, mọi host coi là gốc.
- `lib/tenant.js`: `workspaceBySlug` (cache chỉ kết quả tìm thấy) + `withTenant` so host với workspace của tài
  khoản: host trung tâm khác / không tồn tại / sai định dạng → 404. Chế độ gốc không đổi.
- `pages/api/auth.js`: trên host trung tâm chỉ giáo viên (có `WorkspaceMember`) và học sinh (đúng
  `workspaceId`) đăng nhập được; admin nền tảng chỉ ở domain gốc; sai trung tâm trả **đúng thông báo "sai tên
  đăng nhập hoặc mật khẩu"** (không lộ tài khoản thuộc đâu) + ghi audit `auth.login_wrong_workspace`; host
  không có trung tâm → 404; trung tâm bị suspend → 403; luồng bootstrap ADMIN/TEACHER_PASSWORD chỉ ở domain gốc.
- `pages/api/public/workspace-branding.js` (không cần token): chỉ trả `{name, logoUrl, theme}`, slug lấy từ
  header Host, bỏ qua tham số client, cache 60s. Trang đăng nhập (`app/login/page.js`) dùng nó để hiện logo +
  tên + màu của trung tâm; slug lạ/suspended → trang "địa chỉ chưa có trung tâm".
- Link trong email theo workspace (`https://<slug>.<APP_BASE_DOMAIN>`, lùi về `APP_URL` khi chưa cấu hình).
- Quản lý slug: `createTeacherWithWorkspace` nhận `slug` (kiểm chặt; sinh tự động thì tránh tên dành riêng /
  quá ngắn / trùng); ô "Workspace address" ở form tạo giáo viên; `/admin/workspaces` hiện địa chỉ và có nút
  **Address** để admin đổi (hộp xác nhận cảnh báo link cũ hỏng); trùng → 409, tên dành riêng → 400.
- `components/AddressBanner.js`: người dùng ở domain gốc thấy gợi ý chuyển sang địa chỉ riêng của trung tâm
  (không tự chuyển hướng; có nút Dismiss).
- **`scripts/migrate-workspace.js` đã vá** (mục 10.1.10): không thấy workspace theo slug mà đã có workspace khác
  → từ chối, đòi `--slug` đúng hoặc `--create-new` (kiểm dry-run trên dev: slug sai bị từ chối, slug mặc định
  vẫn chạy).

**Lệch so với thiết kế:** (1) biểu ngữ gợi ý địa chỉ làm luôn ở bản này (plan ghi là tuỳ chọn); (2) không làm
`previousSlugs`/chuyển hướng slug cũ (đúng YAGNI đã ghi); (3) endpoint branding chưa vào danh sách
`check-tenant-scope` vì cố ý truy vấn không theo tenant (route công khai).

**Kiểm chứng:** probe 41 kịch bản trên dev DB với handler thật + header `Host` giả lập — bảng `parseHost`; đăng
nhập: gốc không đổi, đúng trung tâm OK, sai trung tâm/học sinh khác/admin → 401 cùng một thông báo, host lạ/nhiều
nhãn → 404, host preview như gốc, suspend → 403, audit ghi đủ; `withTenant`: token A trên host B → 404, trên gốc
→ 200; endpoint công khai: đúng 3 trường, không lộ id/slug, bỏ qua slug do client gửi; tạo/đổi slug: tên dành
riêng 400, trùng 409, slug sinh tự động tránh `www` → `www-2`; **đổi slug không đổi một bản ghi dữ liệu nào**
(lớp/học sinh/giáo viên/thành viên/logo giữ nguyên), host cũ 404 và host mới đăng nhập được (cả học sinh), cùng
một token vẫn dùng được ở host mới; link email theo workspace và lùi về `APP_URL`. Dọn sạch. **Chưa kiểm chứng
trên trình duyệt thật và trên `*.bemyflo.com` thật** — cần sau khi merge + đặt env.

**Live đã đổi slug (2026-10-05, theo yêu cầu của chủ dự án):** workspace Ms Nhi trên DB live đổi `ms-nhi` →
**`ieltswithnhi`** (địa chỉ sẽ là `ieltswithnhi.bemyflo.com` khi Phase 10 được merge + đặt env). Ghi trực tiếp, một
document, đối chiếu số liệu trước/sau: dữ liệu (học sinh, lớp, bài, bài nộp...) giữ nguyên. Hệ quả: (a) file
upload MỚI vào thư mục `workspaces/ieltswithnhi/...` (file cũ giữ nguyên); (b) **mọi lệnh
`scripts/migrate-workspace.js --live` về sau phải dùng bản đã vá trong branch này, hoặc thêm
`--slug ieltswithnhi`** — bản cũ trên `main` mặc định tìm slug `ms-nhi` và sẽ tạo workspace trùng; (c) trước khi
Phase 10 lên production, slug mới chưa ảnh hưởng gì nhìn thấy được.

**Việc của chủ dự án sau khi merge** (xem hướng dẫn trong phản hồi cho chủ dự án): đặt 3 env trên Vercel
(`APP_BASE_DOMAIN`, `NEXT_PUBLIC_APP_BASE_DOMAIN`, `APP_URL`) → deploy lại (biến `NEXT_PUBLIC_*` cần build
lại) → thử `ms-nhi.bemyflo.com` / `demo.bemyflo.com`. **Không đổi slug của workspace Ms Nhi** cho tới khi đã thử
xong. Rollback: gỡ `APP_BASE_DOMAIN` (tính năng tắt, mọi host về chế độ gốc) hoặc revert.

---

## 11. Câu hỏi còn treo (cần quyết trước khi tới phase tương ứng)

| # | Câu hỏi | Cần trước phase |
|---|---|---|
| ~~Q1~~ | ~~Tên + logo của **platform** là gì?~~ **ĐÃ CHỐT 2026-10-05: tên BeMyFlo, tên miền bemyflo.com, logo MN giữ nguyên (sẽ đổi logo sau).** | 7 |
| Q2 | Mở signup tự do hay phải có mã mời / admin duyệt? | 6 |
| ~~Q3~~ | ~~Giáo viên hiện có (ngoài cô Nhi) — nằm chung workspace hay tách riêng?~~ **ĐÃ TRẢ LỜI 2026-09-22: câu hỏi không còn tồn tại — live DB chỉ có đúng 1 tài khoản teacher (`msnhi`).** Script chỉ cần tạo 1 workspace. | ~~1~~ |
| Q4 | TOEIC chưa có rubric chấm Writing/Speaking. Tạm dùng rubric IELTS, hay ẩn 2 kỹ năng đó với program TOEIC? | 8 |
| Q5 | Có giới hạn số HS/dung lượng theo workspace ngay từ V1 không, hay để sau cùng với billing? | 6 |
| Q6 | Ngân sách AI dùng chung toàn platform (0.3.4) — khi một workspace tiêu hết quota làm cả nhà bị chặn thì xử lý ra sao: admin nâng trần tay, hay cảnh báo sớm theo workspace? | 6 |
| ~~Q7~~ | ~~Phase 10: subdomain wildcard hay đường dẫn?~~ **ĐÃ TRẢ LỜI 2026-10-05: subdomain wildcard.** Gói Vercel có cho wildcard không vẫn cần chủ dự án tự kiểm. | 10 |
| ~~Q8~~ | ~~Phase 10: ai đổi slug?~~ **ĐÃ TRẢ LỜI 2026-10-05: slug đặt lúc tạo; sau đó CHỈ admin được đổi.** Tác động của việc đổi: xem bảng ở Phase 10.1 mục 8. | 10 |
| ~~Q9~~ | ~~Phase 10: domain gốc về sau thế nào?~~ **ĐÃ TRẢ LỜI 2026-10-05: domain gốc vẫn chạy bình thường; dashboard admin ở lại domain gốc; giáo viên/học sinh thuộc workspace vào bằng subdomain của workspace.** | 10 |
