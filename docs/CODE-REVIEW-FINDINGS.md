# Code Review Findings

Nhật ký các lỗi tìm được khi review code bằng [Open Code Review](https://github.com/alibaba/open-code-review) (`ocr`, delegation mode — OCR chọn file + ra rule, Claude review).

Cách chạy lại:

```bash
ocr delegate preview -c <commit>      # hoặc --from main --to <branch>
ocr delegate rule <các file>
```

Trạng thái: `[ ]` chưa sửa · `[x]` đã sửa · `[~]` chấp nhận / không sửa

---

## Review #1 — commit `98e2768` "update" (tính năng Support Tickets)

Ngày review: 2026-09-20 · 18/18 file · +1223/-2 · 0 critical, 2 high, 5 medium, 3 low

### High

- [x] **`lib/tickets.js:13` [security] — `cleanImages` nhận bất kỳ URL https nào do client gửi**

  ```js
  .filter((x) => x && typeof x.url === "string" && /^https:\/\//.test(x.url))
  ```

  Ảnh đáng lẽ chỉ đến từ Cloudinary, nhưng server không kiểm host. Học sinh POST
  `{"images":[{"url":"https://attacker.com/pixel.png"}]}` là được, và
  `app/admin/tickets/page.js:229` render thẳng `<img src={im.url}>`. Admin mở phiếu →
  trình duyệt admin tự gọi server người gửi → lộ IP / User-Agent / thời điểm đọc phiếu.

  **Sửa:** chặn theo host Cloudinary, ví dụ
  `/^https:\/\/res\.cloudinary\.com\/<cloud_name>\//.test(x.url)`. Áp cho cả
  `pages/api/sysadmin/tickets.js:63`.

- [x] **`lib/models/Ticket.js:38-40` [bug] — `title` / `body` / `messages` không giới hạn độ dài ở server**

  `TicketDialog.js` có `maxLength={140}` nhưng đó là client-side. API
  `pages/api/tickets.js:76-80` chỉ kiểm `title.length < 3`, không có cận trên, và
  `messages` push không giới hạn số lượng. Gọi API bằng token học sinh là ghi được
  document vài MB.

  **Sửa:** `title: { maxlength: 140 }`, `body: { maxlength: 4000 }`,
  `MessageSchema.body: { maxlength: 4000 }`, chặn số message mỗi phiếu.
  Tiền lệ đúng đã có ở `lib/models/StudentNote.js:24`.

### Medium

- [x] **`pages/api/tickets.js:43,62` · `pages/api/sysadmin/tickets.js:19,59` [bug] — `?id=` không validate ObjectId**

  `Ticket.findOne({ _id: id })` với `?id=abc` ném CastError. `requireAnyRole` chỉ có
  `try/finally`, không `catch` → lỗi lọt ra thành 500 kèm stack, đáng lẽ 404.
  Đây là pattern chung cả repo (không file nào dùng `isValidObjectId`).

- [x] **`app/admin/tickets/page.js:27-32` [performance] — ô search gọi API mỗi ký tự**

  `q` nằm trong deps của `useCallback` → `useEffect(load, [load])` bắn 1 request/phím,
  không debounce, không huỷ request cũ → response về trễ ghi đè kết quả mới.

  **Sửa:** debounce ~300ms + cờ `ignore` trong cleanup của effect.

- [x] **`pages/api/sysadmin/tickets.js:74` [security] — `authorName: b.adminName` lấy từ body**

  Client không bao giờ gửi `adminName` → vừa là dead param, vừa cho phép đặt tên tác giả
  tuỳ ý qua curl. Nên lấy từ token: `req.auth.name`.

- [x] **`components/tickets/ReporterTickets.js:38-46` [bug] — fetch theo `openId` không chống response cũ**

  Bấm nhanh giữa 2 phiếu, response của phiếu mở trước về sau sẽ `setActive` đè lên phiếu
  đang xem. Cần `let ignore = false; return () => { ignore = true; }`.

- [x] **`pages/api/tickets.js:52` [bug] — `unreadCount` chỉ đếm trong 100 phiếu đầu**

  Tính từ `rows` đã `.limit(LIMIT)` → badge chuông thiếu khi một người có >100 phiếu.

  **Sửa:** `Ticket.countDocuments({ ...ownerFilter(rep), reporterUnread: true })`.

### Low

- [x] **`lib/tickets.js:18` — `publicId` do client tự đặt, hiện chưa dùng ở đâu.**
  Chưa khai thác được (không ai gọi `deleteImageFile` cho ticket), nhưng nếu sau này thêm
  job dọn ảnh theo `publicId` thì học sinh có thể khai `publicId` của tài nguyên khác.

- [x] **`components/tickets/TicketDialog.js:20-31`** — upload ảnh tuần tự trong `for...await`
  (6 ảnh = 6 lượt chờ nối tiếp), `key={im.url}` trùng nếu upload lại cùng ảnh,
  `setBusy(false)` không chạy ở nhánh thành công nếu thiếu `onCreated`.

- [x] **`components/tickets/SupportWidget.js:40-44`** — `setInterval` bị huỷ/tạo lại mỗi lần
  đổi route vì `pathname` nằm trong deps.

### Đã kiểm tra, không phải lỗi

- `requireRole("admin")` khớp đúng enum `["admin","teacher","student"]` (`lib/models/User.js:12`)
- Regex search `sysadmin/tickets.js:32` đã escape metachar → không ReDoS / injection
- Không có `dangerouslySetInnerHTML`, `eval`, `var`, `==` trong diff
- `emit()` đã bọc try/catch, notify fail không làm hỏng request

---

## Review #2 — quét toàn bộ source

Ngày review: 2026-09-20 · `ocr delegate preview --from cac2963 --to HEAD` → **230/264 file reviewable**, +41723/-3463 · 0 critical, 4 high, 8 medium, 5 low

**Phạm vi thực tế:** quét deterministic (theo đúng checklist rule OCR trả về) trên cả 230 file; đọc kỹ từng dòng phần rủi ro cao: toàn bộ `pages/api/**` (37 route), `lib/auth.js`, `lib/grade.js`, `lib/gemini.js`, `lib/theoryFormat.js`, `lib/notifications/**`, `lib/client/api.js`, `lib/models/**`, `scripts/**`. Phần UI (`app/**`, `components/**`) chỉ quét theo rule, không đọc từng dòng.

### High

- [x] **`pages/api/submissions.js:84-125` [bug/security] — server KHÔNG chặn nộp lại mock test**

  Commit `603fdd9` ("block retakes") chỉ sửa `app/student/tests/[testId]/[skill]/page.js` — tức là chặn
  ở client. Route POST vẫn không kiểm tra đã có submission cho cặp `(studentId, testId, testSkill)` hay
  chưa, ở giữa bước kiểm tra cửa sổ mở/đóng và `Submission.create`. Xoá localStorage hoặc gọi thẳng API
  bằng token học sinh là làm lại đề bao nhiêu lần cũng được, lấy điểm cao nhất. Đồng hồ cũng chỉ tính ở
  client (deadline lưu trong localStorage), server không kiểm tra thời gian làm bài.

  So sánh: luồng Writing/Speaking ĐÃ chặn đúng ở server (`submissions.js:263-266`, `existingResubmit`).

  **Sửa:** trước khi `create`, kiểm tra
  `await Submission.exists({ studentId: student._id, testId: test._id, testSkill: skill })` → 400;
  cân nhắc lưu `startedAt` phía server để kiểm tra thời lượng.

- [x] **`lib/client/api.js:7-8` [security] — Cloudinary dùng unsigned preset hardcode trong bundle client**

  ```js
  const CLOUDINARY_CLOUD_NAME = "oqczcg2z";
  const CLOUDINARY_UNSIGNED_PRESET = "ielts_speaking_unsigned";
  ```

  Hai giá trị này đi thẳng vào JS bundle công khai. Bất kỳ ai mở devtools cũng upload được file tuỳ ý vào
  tài khoản Cloudinary của bạn mà không cần đăng nhập app — đốt storage/bandwidth, và host nội dung lạ
  dưới tên tài khoản của bạn. Không có giới hạn kích thước/định dạng phía server (chỉ có
  `accept="image/*"` và `f.type.startsWith("image/")` ở client, cả hai đều bỏ qua được).

  **Sửa:** trong Cloudinary console khoá preset lại (allowed formats, max file size, folder cố định),
  hoặc chuyển sang signed upload qua một API route ký bằng `CLOUDINARY_API_SECRET`.

- [x] **Phân quyền giáo viên chỉ được áp ở đúng 1 chỗ [security]**

  `Teacher.classIds` tồn tại và admin gán được (`pages/api/admin/teachers.js:47-52`), nhưng nó CHỈ được
  dùng để lọc ở `pages/api/admin/dashboard.js:21-24`. Mọi route giáo viên còn lại —
  `admin/students.js`, `admin/classes.js`, `admin/submissions.js`, `admin/attendance.js`,
  `admin/units.js`, `admin/tests.js` — không lọc theo lớp của giáo viên đang đăng nhập. Một giáo viên
  đọc và sửa được dữ liệu của mọi lớp, mọi học sinh.

  Việc dashboard có lọc cho thấy mô hình phân quyền là CÓ chủ đích, chỉ mới làm một nửa. Nếu hệ thống cố
  ý chỉ dùng cho một giáo viên duy nhất thì đánh dấu `[~]` và bỏ qua — nhưng nên ghi rõ vào `HANDOFF.md`
  để sau này không hiểu nhầm.

- [x] **`lib/tickets.js:13`** — xem Review #1, vẫn chưa sửa.

### Medium

- [x] **`pages/api/auth.js` [security] — không giới hạn số lần đăng nhập sai**

  Không rate limit, không khoá tài khoản, không delay. Username học sinh đoán được (đặt theo tên), mật
  khẩu do giáo viên đặt → brute force thoải mái. Audit có ghi `auth.login_failed` nhưng chỉ ghi, không chặn.

  Phụ: nhánh bootstrap `ADMIN_PASSWORD` (dòng 61) chạy lại ở MỌI lần đăng nhập; nếu có lúc nào đó không
  còn user admin nào thì ai biết `ADMIN_PASSWORD` cũng tạo được admin mới với username bất kỳ.

- [x] **`lib/grade.js:70-76` [bug] — `gradeSubmission` không guard `sections` rỗng**

  `test.sections.forEach(...)` — nếu kỹ năng chưa được soạn (`test.skills.listening` là `{}`) thì
  `sections` là `undefined` → TypeError → 500. Hàm `rebuildDetail` ngay bên dưới (dòng 96) CÓ guard
  `Array.isArray(skillBlock.sections)`; hai hàm cùng file mà lệch nhau.

- [x] **Xử lý ObjectId không nhất quán toàn repo [bug]**

  `submissions.js:90-95` và `impersonate.js:16` xử lý đúng (try/catch hoặc `.catch(() => null)` → 404).
  Nhưng `pages/api/tickets.js:43,62`, `pages/api/sysadmin/tickets.js:19,59` và `submissions.js:145`
  (`category.exercises.id(exerciseId)`) thì không → CastError thành 500 kèm stack. Nên có helper dùng
  chung, ví dụ `asObjectId(id)` trả `null` khi không hợp lệ.

- [x] **`lib/gemini.js:28` [bug] — `fetch` tới Gemini không có timeout**

  Không `AbortController`. Gemini treo là giữ nguyên serverless function tới khi hết `maxDuration`, đốt
  thời gian chạy và bắt người dùng chờ. Chấm AI rất dễ gặp.

- [x] **Truy vấn không giới hạn [performance]**

  `pages/api/admin/students.js:15` (`Student.find()`), `admin/submissions.js:40`
  (`Submission.find(filter)`), `admin/audio.js:11`, `admin/images.js:11`, `admin/classes.js:14` — đều
  `.lean()` nhưng không `.limit()`, tải toàn bộ collection mỗi lần mở trang. Nặng nhất:
  `pages/api/student/dashboard.js:55` tải TOÀN BỘ submission của cả lớp (mọi học sinh, mọi thời điểm)
  chỉ để dựng bảng xếp hạng — mỗi lần một học sinh mở dashboard.

- [x] **`scripts/clone-db.js:38` [bug] — `deleteMany({})` mọi collection, không có xác nhận**

  Script xoá sạch DB đích rồi copy sang. TARGET lấy từ `process.argv[3] || process.env.TARGET_URI`,
  không có bước xác nhận, không dry-run, không chặn khi TARGET trỏ tới URI remote/Atlas. Gõ nhầm biến
  môi trường một lần là mất DB thật. `scripts/dedupe-pending-prompts.js:9` đã làm đúng với cờ `--apply`
  — nên áp cùng kiểu.

- [x] **`pages/api/cron/deadline-scan.js:16-21` [security] — mở toang khi thiếu `CRON_SECRET`**

  Không đặt `CRON_SECRET` và `NODE_ENV !== "production"` thì endpoint chạy tự do, không auth — ai cũng
  kích được đợt quét + gửi email hàng loạt.

- [x] **`pages/api/admin/deadline-jobs/run.js:20-36` [maintainability] — tự verify JWT thay vì dùng `lib/auth`**

  Gọi thẳng `jwt.verify(token, process.env.JWT_SECRET)`, bỏ qua `getSecret()` (hàm này ném lỗi rõ ràng
  khi thiếu env) và bỏ qua cả audit log mà `requireRole` vẫn ghi. Logic auth nhân bản ở 2 nơi sẽ lệch nhau.

### Low

- [x] **`lib/notifications/channels/email.js:28` — `notif.link` không escape khi ghép vào `href`.**
  Hiện mọi link đều do server dựng từ ID nên chưa khai thác được, nhưng một dấu nháy kép lọt vào là thoát
  khỏi attribute. Nên `escapeHtml(linkPath)` hoặc validate `linkPath.startsWith("/")`.

- [x] **`lib/notifications/channels/email.js:25` — tham số `recipientName` khai báo nhưng không dùng.**

- [x] **`lib/gemini.js:47` — `JSON.parse(m[0])` nằm trong `catch`**, nếu chuỗi khớp regex vẫn hỏng thì ném
  `SyntaxError` thô thay vì thông báo "Gemini response was not valid JSON" ngay dưới.

- [x] **`pages/api/submissions.js:119` — `replayCount` lấy nguyên từ client**, học sinh khai bao nhiêu cũng
  được. Nếu con số này dùng để đánh giá thì phải đếm ở server.

- [x] **`lib/models/Unit.js:45` — trường tên `theory.html` nhưng nội dung là markdown rút gọn**
  (render qua `renderTheory`, không phải HTML thô). Tên gây hiểu nhầm, dễ khiến người sau vô tình bỏ
  qua bước escape.

### Đã kiểm tra kỹ, KHÔNG có vấn đề

- **Đáp án không lọt xuống client.** `pages/api/tests.js:7-32` và `pages/api/units.js:24-46` đều dùng
  allowlist tường minh khi chiếu field; `answers` và `explanation` không nằm trong danh sách. Chấm điểm
  chạy hoàn toàn ở server (`lib/grade.js`). Kỹ năng bị khoá trả về rỗng chứ không chỉ ẩn ở UI.
- **Phân quyền học sinh chuẩn ở mọi endpoint.** `notifications.js`, `student/notes.js`,
  `submissions/reflection.js`, `submissions.js`, `tickets.js` — tất cả lọc theo `req.auth.studentId`,
  không có chỗ nào nhận id từ query rồi tin luôn.
- **Không có XSS.** Chỉ 2 chỗ `dangerouslySetInnerHTML`: `components/Icon.js:95` (markup tĩnh) và
  `app/student/lessons/[unitId]/page.js:398` đi qua `lib/theoryFormat.js` — escape `& < >` trước, chỉ
  sinh tập thẻ cố định, link bắt buộc `^https?://`, dấu nháy kép trong URL đổi thành `%22`. Không có
  `eval`, `new Function`, `innerHTML`, `document.write` ở bất kỳ đâu.
- **Không có secret hardcode** (trừ Cloudinary preset ở trên, vốn thiết kế để public).
  `lib/audit.js:4,20` che `password` / `token` / `passwordHash` trước khi ghi log.
- **`pages/api/sysadmin/impersonate.js`** viết rất chắc: `.catch(() => null)` cho ObjectId hỏng, chỉ cho
  impersonate teacher, chặn tài khoản disabled, token 2h, ghi `impBy` vào audit.
- **`pages/api/sysadmin/users.js`** chặn hạ quyền / vô hiệu hoá admin cuối cùng (dòng 110-111, 143-144).
- **Không có `var`, không có `==`/`!=` sai.** Toàn bộ kết quả `!=` tìm được đều là `!= null` / `== null`.
- **`.env` không bị commit** — chỉ có `.env.example` trong git.

---

## Lượt sửa — 2026-09-20

Toàn bộ 27 mục ở trên đã sửa. `npx next build` compile sạch.

### File mới

| File | Vai trò |
|---|---|
| `lib/validate.js` | `asObjectId` (id hỏng → `null` thay vì CastError), `isCloudinaryUrl`, `publicIdFromUrl` |
| `lib/rateLimit.js` | Đếm số lần thử trong bộ nhớ tiến trình, dùng cho đăng nhập |
| `lib/teacherScope.js` | Phạm vi lớp của giáo viên — `teacherScope` / `scopeFilter` / `canAccessClass` |

### Phát hiện thêm trong lúc sửa (nặng hơn mục đã ghi)

**`pages/api/submissions.js` — `audioPublicId` lấy thẳng từ body, và nó chính là tham số đưa vào
`deleteAudioFile()` khi học sinh nộp lại bài Speaking** (`submissions.js:315`). Nghĩa là khai
`audioPublicId` của file người khác rồi nộp lại là xoá được file đó trên Cloudinary. Mục Low #8 của
Review #2 ghi rủi ro này là "hiện chưa dùng ở đâu" — đúng với ảnh của ticket, nhưng với audio thì
đường xoá đã tồn tại sẵn. Đã sửa: bắt buộc `isCloudinaryUrl(audioUrl)` và suy `publicId` từ URL.

### Ghi chú về ngữ nghĩa

- **Phân quyền giáo viên** dùng đúng quy ước sẵn có ở `admin/dashboard.js`:
  `Teacher.classIds` rỗng = thấy tất cả, có giá trị = chỉ thấy đúng những lớp đó. Nên cấu hình hiện
  tại chạy y như trước; ranh giới chỉ siết lại khi admin bắt đầu gán lớp cho giáo viên.
  Áp cho `admin/students.js`, `admin/classes.js`, `admin/submissions.js`, `admin/attendance.js`.
- **Bảng xếp hạng** (`student/dashboard.js`) giờ sort ở DB + kẹp trần 5000 bản ghi thay vì tải nguyên
  collection của cả lớp. Lớp vượt quá 5000 lượt nộp thì phần rất cũ không tính vào điểm xếp hạng.
- **Rate limit đăng nhập** đếm trong bộ nhớ từng instance serverless, nên chặn được script dò mật
  khẩu trong một phiên chứ không chặn được tấn công phân tán. Muốn chắc phải đếm ở tầng dùng chung.
- **`ADMIN_PASSWORD` bootstrap** giữ nguyên hành vi: nhánh này chỉ mở khi `adminCount === 0`, mà
  `sysadmin/users.js` đã chặn xoá/vô hiệu hoá admin cuối cùng nên trạng thái đó không đạt tới được từ
  giao diện. Đã ghi chú bất biến này ngay tại `pages/api/auth.js`.
- **`theory.html`** giữ nguyên tên trường (dữ liệu cũ trong DB đang dùng khoá này), chỉ bổ sung cảnh
  báo tại `lib/models/Unit.js` rằng nội dung là markdown và bắt buộc render qua `renderTheory()`.

### CÒN LẠI — phải làm tay, không sửa bằng code được

- [ ] **Khoá unsigned upload preset trong Cloudinary console.** Phía code đã siết hết mức có thể
  (mọi URL client gửi lên đều qua `isCloudinaryUrl`, publicId suy từ URL, giới hạn 10MB khi chọn ảnh),
  nhưng bản thân preset `ielts_speaking_unsigned` vẫn public trong bundle. Vào Cloudinary → Settings →
  Upload → preset đó, bật **Allowed formats**, **Max file size**, **Folder cố định**. Không làm bước
  này thì người ngoài vẫn upload thẳng lên tài khoản được, chỉ là không gắn được vào app.

- [ ] **Đặt `CRON_SECRET`.** `/api/cron/deadline-scan` giờ trả 500 khi thiếu biến này, ở mọi môi
  trường (trước đây chạy tự do khi không phải production). `.env.local` hiện chưa có — cần thêm vào cả
  local lẫn Vercel, nếu không job quét hạn nộp sẽ không chạy.
