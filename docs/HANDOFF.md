# Handoff — IELTS with Ms Nhi

Bàn giao giữa các phiên AI. Đọc file này trước, rồi đọc kế hoạch chi tiết đã được duyệt tại
`/home/nhanlt/.claude/plans/cozy-floating-pike.md` (đầy đủ thiết kế schema/API/UI, agent tiếp theo nên đọc kỹ trước khi code).

## Bối cảnh dự án

- Web app cho giáo viên tiếng Anh (IELTS) quản lý bài Nghe + Đọc, học sinh có tài khoản riêng làm bài.
- Stack: **static HTML/CSS/JS** (không build step) + **Vercel Serverless Functions** (`/api`) + **MongoDB Atlas** (Mongoose) + **Cloudinary** (lưu file audio/ảnh).
- Không có test framework — verify bằng cách chạy thật (xem mục "Cách chạy thử" bên dưới).
- Repo đã `git init` nhưng **chưa commit gì cả** (chỉ init, theo yêu cầu "chỉ commit khi được bảo").

## Việc đã xong và đã verify (vòng 1 — hệ thống nghe cơ bản)

Toàn bộ vòng 1 đã test end-to-end với DB thật (đăng nhập, upload audio, tạo test, học sinh nộp bài, chấm điểm, dashboard) rồi dọn dữ liệu test:
- Backend: `lib/db.js`, `lib/auth.js`, `lib/cloudinary.js`, `lib/grade.js`, `lib/testSections.js`, models `Audio`/`Test`/`Submission`.
- API: `api/auth/login.js` (giáo viên), `api/admin/audio/*`, `api/admin/tests/*`, `api/admin/submissions.js`, `api/admin/dashboard.js`, `api/tests/*`, `api/submissions/index.js`.
- Frontend gốc: `index.html`, `assets/api.js`, `assets/icons.js` (sprite SVG), `assets/style.css`.
- Đã rebrand `index.html` xong: tên "IELTS with Ms Nhi", logo "MN".
- `package.json` đã đổi tên + có `bcryptjs` trong dependencies.

## Việc đã xong ở vòng 2 (tính năng mới — **CHỈ MỚI XONG BACKEND**)

Yêu cầu mới của cô giáo (đã lên plan, đã duyệt): tài khoản học sinh, module Đọc song song với Nghe, mở rộng dạng câu hỏi Nghe, đổi tên app, sửa lỗi "bấm Nghe & Luyện tắt browser" (nguyên nhân: 6 bài luyện tập cũ trỏ tới file mp3 không tồn tại — quyết định: **xoá hẳn**, không giữ nữa).

### Quyết định thiết kế cốt lõi (đã note trong plan file, RẤT QUAN TRỌNG phải đọc)
Thay vì tạo schema riêng cho từng dạng câu hỏi IELTS (11 dạng Reading), TẤT CẢ dạng đều dùng lại 2 field type có sẵn (`fill`, `choice`) + 2 field mới:
- `selectCount` trên field (mặc định 1): >1 → chọn nhiều đáp án (checkbox, chấm theo tập hợp đúng tuyệt đối).
- `matchOptions` trên section (bank `{value,label}` dùng chung): field `choice` không có `options` riêng sẽ fallback dùng bank này → giải quyết toàn bộ dạng ghép nối (matching headings/features/information/sentence-endings).
- True/False/Not Given = `choice` field bình thường, chỉ cần nút "chèn nhanh" prefill options trong UI, KHÔNG cần schema riêng.
- Diagram/map labelling = field `fill` hoặc `choice` + section có `imageId` (ảnh minh hoạ), KHÔNG cần schema riêng.
- Reading = section có `passageText` thay vì/thêm `audioId`.

### Đã code xong (backend, đã qua `node --check`, CHƯA test end-to-end với DB thật ở vòng này):
- `lib/models/Student.js`, `lib/models/Image.js` (mới)
- `lib/models/Test.js`: thêm `subject` ('listening'|'reading'), section thêm `passageText`/`imageId`/`matchOptions`, field thêm `selectCount`
- `lib/models/Submission.js`: thêm `studentId` (required)
- `lib/auth.js`: generalize thành `requireRole(role)`, `requireAuth = requireRole('teacher')` (giữ tên cũ, không phải sửa chỗ khác), thêm `requireStudent`, `signStudentToken`
- `lib/cloudinary.js`: thêm `uploadImageFile`/`deleteImageFile` (resource_type: "image")
- `lib/grade.js`: `isCorrect` xử lý multi-select (so sánh tập hợp)
- `lib/testSections.js`: `normalizeSections` thêm các field mới; thêm `sectionMediaError` + `validateSections` (validate theo subject: nghe cần audioId, đọc cần passageText hoặc imageId; field choice rỗng options phải có matchOptions ở section)
- API mới: `api/auth/student/register.js`, `api/auth/student/login.js`, `api/admin/students/index.js` (list + đếm số bài nộp), `api/admin/students/[id].js` (xoá / đặt lại mật khẩu), `api/admin/images/index.js` + `[id].js` (mirror audio, có check "đang được dùng thì không xoá được")
- API sửa: `api/admin/tests/index.js` + `[id].js` (dùng `validateSections`, có `subject`), `api/tests/index.js` (filter `?subject=`), `api/tests/[id].js` (`toPublicTest` trả thêm `passageText`/`imageUrl`/`matchOptions`/`selectCount`), `api/submissions/index.js` (giờ bắt buộc đăng nhập học sinh qua `requireStudent`, lấy `studentId`/`studentName` từ JWT chứ KHÔNG tin client gửi lên nữa — đóng lỗ hổng giả danh)
- `package.json` đã thêm `bcryptjs`, đã chạy `npm install` xong (node_modules có sẵn).
- `assets/icons.js`: thêm icon `book-open`, `image`, `lock`, `user-plus`.
- `assets/style.css`: thêm CSS cho `.reading-layout`/`.passage-pane`/`.diagram-image`/`.subject-toggle`/`.match-options-box`/`.subject-grid`/checkbox styling/textarea styling.
- `HUONG-DAN-CAI-DAT.md`: đã cập nhật đoạn đầu + phần "LƯU Ý QUAN TRỌNG" cho phù hợp tài khoản học sinh + Reading.

## VIỆC CHƯA LÀM (đây là phần agent tiếp theo cần làm)

**Task 14 — Student flow rewrite (CHƯA BẮT ĐẦU CODE, mới chuyển task sang in_progress)**
File: `student.html` + `assets/student.js`. Hiện tại 2 file này **VẪN LÀ BẢN CŨ** (chỉ nhập tên, không có đăng nhập, không có subject picker, list `GRADED_TESTS` qua API cũ nhưng chưa hỗ trợ multi-select/matching/reading). Cần:
1. Xoá hẳn: `step-practice` section trong HTML, các hàm `startPractice`/`renderPracticeList` trong JS, và **xoá file `assets/exercises.js`** (không còn PRACTICE_TRACKS nữa — quyết định của cô giáo là xoá hẳn 6 bài cũ).
2. Thay `step-name` (nhập tên tự do) bằng màn hình đăng nhập/đăng ký thật: toggle 2 tab "Đăng nhập"/"Đăng ký" (dùng lại class `.tabs`/`.tab-btn`/`.tab-panel` có sẵn trong CSS), gọi `Api` — **cần thêm các hàm mới vào `assets/api.js`**: `Api.studentRegister({name,username,password})`, `Api.studentLogin({username,password})` (POST tới `/api/auth/student/register` và `/api/auth/student/login`), lưu token vào `localStorage` (khác với teacher dùng `sessionStorage` — set trong `assets/api.js`, xem cách `TOKEN_KEY`/`getToken`/`setToken` hiện có cho giáo viên, cần thêm cặp tương tự cho học sinh, ví dụ `studentToken` key riêng). Thêm nút "Đăng xuất".
3. Thêm bước mới sau khi đăng nhập: chọn kỹ năng "Nghe (Listening)" / "Đọc (Reading)" — 2 card giống `.choice-card` ở `index.html`. Lưu `currentSubject`, gọi `Api.listTests({subject: currentSubject})` (cần sửa `Api.listTests` trong `assets/api.js` để nhận query param subject).
4. Render danh sách bài kiểm tra theo subject đã chọn (bỏ phần "Bài luyện tập" cũ).
5. Render câu hỏi tổng quát — hiện tại `renderTestForm`/field renderer trong `student.js` chỉ hỗ trợ `fill` và `choice` (radio). Cần mở rộng:
   - `choice` với `selectCount > 1` → checkbox, giới hạn chọn tối đa `selectCount` (disable checkbox thừa hoặc validate khi submit).
   - `choice` với `options` rỗng → lấy từ `section.matchOptions` (API `/api/tests/:id` đã trả field này rồi).
   - Section có `passageText` và/hoặc `imageUrl` (bài Đọc) → render trong layout `.reading-layout` > `.passage-pane` (CSS đã có sẵn) thay vì `.player` (audio).
   - Submit: với field multi-select, `answers[f.id]` phải là **mảng** giá trị đã chọn (không phải string), khớp với `lib/grade.js` đã cập nhật ở server.
6. Đổi lời gọi `Api.submit(...)` — endpoint `/api/submissions` giờ **bắt buộc header Authorization** (student JWT) — `assets/api.js`'s `submit` hiện chưa có `auth:true`, cần sửa. Và **body không còn gửi `studentName`** nữa (server tự lấy từ token) — bỏ field đó khỏi payload gửi lên.
7. Rebrand: title/topbar text trong `student.html` (đang còn "IELTS Listening Practice", logo "IE" — đổi giống `index.html` đã làm: "IELTS with Ms Nhi" / "MN").
8. Thêm xử lý lỗi audio (onerror trên thẻ `<audio>`) để không bao giờ "im lặng lỗi" nữa — hiện log console 404 nhưng UI không báo gì, nên thêm listener hiển thị `.notice.error` khi audio load fail.

**Task 15 — Teacher dashboard: tab Học viên + builder theo subject (CHƯA BẮT ĐẦU)**
File: `teacher.html` + `assets/teacher.js`. Cần:
1. Tab mới "Học viên" (icon `student` có sẵn hoặc thêm icon phù hợp): gọi `Api.admin.listStudents()` (**cần thêm hàm này vào `assets/api.js`**, trỏ `GET /api/admin/students`), hiển thị bảng tên/username/ngày tạo/số bài nộp, nút xoá (`DELETE /api/admin/students/:id` — cần thêm `Api.admin.deleteStudent(id)`) và đặt lại mật khẩu (`PUT /api/admin/students/:id {password}` — cần thêm `Api.admin.resetStudentPassword(id, password)`).
2. Tab "Bài kiểm tra" — builder cần mở rộng lớn:
   - Toggle Nghe/Đọc khi tạo test mới (dùng CSS `.subject-toggle` đã có), lưu vào `builderSubject` state.
   - Section editor: nếu subject Nghe → giữ dropdown chọn Audio như cũ; nếu Đọc → hiện `<textarea>` cho `passageText` thay vào đó.
   - Cả 2 subject: thêm dropdown chọn ảnh minh hoạ (optional, cho diagram/map) — cần API upload ảnh riêng (`Api.admin.listImages()`, `Api.admin.uploadImage(formData)`, `Api.admin.deleteImage(id)` — thêm vào `assets/api.js`, trỏ `/api/admin/images*`, y hệt pattern audio đã có) + 1 form upload ảnh trong builder hoặc 1 tab riêng "Ảnh minh hoạ" (tuỳ chọn UX, plan không bắt buộc tab riêng, có thể gộp vào trong builder).
   - Field editor: thêm input số `selectCount` (chỉ hiện khi type=choice), nút "chèn Đúng/Sai/Không có thông tin" (prefill textarea options với `true|TRUE\nfalse|FALSE\nng|NOT GIVEN` hoặc tương tự), và checkbox/toggle "dùng danh sách đáp án chung của phần (ghép nối)" — khi bật thì ẩn textarea options riêng của field, để trống, dựa vào `matchOptions` ở section.
   - Section cần thêm 1 textarea "Danh sách đáp án dùng chung (ghép nối)" — format giống options field hiện tại (`value|label` mỗi dòng) — map vào `section.matchOptions`.
   - Khi load test cũ để sửa: field có `options.length>0` → hiển thị chế độ "trắc nghiệm own-options"; field `options` rỗng + `selectCount===1` + type choice → hiển thị chế độ "ghép nối" (không cần lưu thêm cờ nào, suy luận từ shape, đã note trong plan).
3. Tab "Bài nộp": thêm dropdown lọc theo subject — **lọc phía client** (dùng `testsCache` đã có sẵn subject field, không cần sửa API `admin/submissions.js`).
4. Rebrand text trong `teacher.html`.

**Task 16 — Verify cuối cùng (CHƯA LÀM)**
Chạy thử toàn bộ luồng với DB thật rồi xoá dữ liệu test, theo đúng checklist trong plan file (mục "Verification" ở cuối `/home/nhanlt/.claude/plans/cozy-floating-pike.md`):
1. Đăng ký học sinh, đăng xuất, đăng nhập lại.
2. Giáo viên: upload 1 audio + 1 ảnh, tạo 1 test Nghe (có field fill + multi-select + matching) và 1 test Đọc (có passage + True/False/NG + matching headings), publish cả 2.
3. Học sinh: chọn Nghe, làm và nộp; chọn Đọc, làm và nộp — kiểm tra chấm điểm đúng ở MỌI dạng field kể cả multi-select và matching.
4. Kiểm tra dashboard: bài nộp gắn đúng học sinh/test, tab Học viên hiện đúng số bài nộp.
5. Test xoá/đặt lại mật khẩu học viên, xoá không làm hỏng dashboard.
6. Kiểm tra không còn text "IELTS Listening Practice" hay link bài luyện tập cũ nào sót lại.
7. **Nhớ xoá sạch dữ liệu test** khỏi MongoDB thật sau khi verify xong (đã làm mẫu ở vòng 1, xem lịch sử hội thoại nếu cần cách làm).

## Cách chạy thử (local, không cần đăng nhập Vercel)

`vercel dev` cần `vercel login` (chưa đăng nhập trong môi trường này). Cách nhanh đã dùng để test: viết 1 file Node harness nhỏ (không thuộc repo, để ở thư mục scratchpad) giả lập routing của Vercel cho `/api/*` (bao gồm dynamic `[id].js`) + serve static file, đọc biến môi trường từ `.env.local`. Có thể tái tạo lại pattern này nếu cần test nhanh — logic: map `/api/x/y` → thử `api/x/y.js`, rồi `api/x/y/index.js`, rồi `api/x/[id].js` với `req.query.id = y`; set `req.body` từ JSON parse khi content-type json; set `req.query` từ URL query + params; gọn khoảng 80 dòng.

## Thông tin cấu hình quan trọng

- `.env.local` (đã có sẵn, **gitignored**, đừng commit) chứa `MONGODB_URI`, `JWT_SECRET`, `TEACHER_PASSWORD=2026`, `CLOUDINARY_CLOUD_NAME=oqczcg2z`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — đều đã verify hoạt động thật (Mongo connect OK, Cloudinary `api.ping()` OK).
- `.env.example` có template cho Vercel Environment Variables khi deploy thật (xem `HUONG-DAN-CAI-DAT.md`).
- MongoDB Atlas dùng chung 1 database cho cả dev/test — **luôn dọn dữ liệu test sau khi verify** (đã làm ở vòng 1, xoá Test/Audio/Submission tạo ra khi test).

## Lưu ý khác

- Đừng dùng `--no-verify`, đừng force push, đừng tự ý `git commit` trừ khi được yêu cầu rõ ràng (repo hiện chưa có commit nào).
- User đã xác nhận 3 quyết định phạm vi: (1) làm luôn dạng diagram/map labelling (cần upload ảnh) chứ không hoãn, (2) xoá hẳn 6 bài luyện tập cũ, (3) học sinh tự đăng ký chứ giáo viên không tạo tài khoản trước.
