# PLAN — Tên cho từng Level (theo trung tâm và theo chương trình)

Trạng thái: ◐ code xong trên branch `phase-8-toeic`, chưa kiểm bằng trình duyệt, chưa merge · Ngày lập: 2026-10-16

Liên quan: [PLAN-PHASE8-TOEIC.md](multi-tenant/PLAN-PHASE8-TOEIC.md) (mục 2 C3: level tính riêng theo chương trình).

## 1. Mục tiêu

Lớp, Unit và Mock Test đều có `level` là số (1, 2, 3...) dùng để xếp thứ tự và để khớp nội dung với học sinh.
Giáo viên cần thêm **tên dễ hiểu** cho từng level, ví dụ IELTS Level 1 = "Band 3.5–5.0", TOEIC Level 1 = "300–450".
Tên khác nhau theo trung tâm (workspace) và theo chương trình. Số vẫn là khoá thật; tên chỉ là nhãn hiển thị.

Bất biến: workspace chưa đặt tên nào thấy app **y hệt hôm nay** (cùng chữ "Level N", cùng ô số trong form lớp).

## 2. Dữ liệu

- `Workspace.levelNames: [{ program, level, name }]`, mặc định `[]`. `program` thuộc `PROGRAM_KEYS`, `level` là số nguyên >= 1,
  `name` trim, tối đa 60 ký tự. Không cần migrate, không có index.
- **Duy nhất theo (program, level)** do bộ làm sạch ép, không dùng index: `sanitizeLevelNames` trong `lib/levelNames.js`
  (program hợp lệ, level nguyên 1–50, tên trim và cắt 60, bỏ tên rỗng, trùng thì giữ dòng cuối; sai thì trả lỗi 400).
- `lib/levelNames.js` (dùng chung server + client): `sanitizeLevelNames`, `levelNameOf`, `levelLabel(levelNames, program, level)`
  -> `"Level 1 · Band 3.5–5.0"` hoặc `"Level 1"`, `namedLevelsOf`.
- `lib/curriculumServer.js`: `workspaceLevelNames(ws)`, `levelNameFor(ws, program, level)` (đọc theo `ws.workspaceId`).

## 3. API

| Route | Thay đổi |
|---|---|
| `GET /api/teacher/workspace` | thêm `levelNames` và `usedLevels` (`{ ielts: [1,2], toeic: [1] }`: level đang được Lớp/Unit/Test dùng, theo chương trình) |
| `PUT /api/teacher/workspace` | nhận `levelNames` (chỉ owner, như các cài đặt khác); sai -> 400 |
| `GET /api/teacher/me` | thêm `levelNames` để mọi trang giáo viên dán nhãn không cần gọi thêm |
| `GET /api/units` (học sinh) | `levelName` (+ `level`) ở danh sách và ở chi tiết |
| `GET /api/tests` (học sinh) | `levelName` (+ `level`) ở danh sách và ở chi tiết |
| `GET /api/student/dashboard` | `classLevelName` |

Học sinh chỉ đọc, luôn theo workspace của request.

## 4. Giao diện

- **Cài đặt Workspace** (`/teacher/settings/workspace#levels`): thẻ **Levels**. Mỗi chương trình workspace đang dùng một bảng
  (chỉ một chương trình thì không có tiêu đề chương trình). Dòng: số level (chỉ đọc), ô Name, nút xoá. "Add level" thêm số kế tiếp.
  Luôn hiện các level đang được Lớp/Unit/Test dùng dù chưa có tên (nút xoá của dòng đó chỉ xoá tên). Lưu bằng nút "Save level names" + toast.
  Chỉ owner sửa được.
- **Form lớp** (tạo ở Classes, sửa ở chi tiết lớp): component `LevelField`. Chương trình đang chọn có level được đặt tên ->
  `<select>` "Level N · Tên" + "Other…" (hiện ô số) + link "Edit level names". Chưa có tên -> đúng ô số cũ.
  Đổi Program ở form tạo thì danh sách tự đổi.
- **Nhãn level** (`usePrograms().levelLabel(program, level)`): danh sách và chi tiết Classes, Lessons (nhóm level + tiêu đề trang level,
  nhiều chương trình thì "TOEIC · Level 1 · 300–450"), header Unit editor, danh sách và bộ lọc Mock Tests, màn Submissions của Mock Test,
  chọn lớp ở trang Students, thẻ lớp ở Overview (chỉ khi level có tên). Học sinh: trang Lessons, trang Unit, trang Mock Tests,
  ô "Units for your level" ở Dashboard (chỉ khi có tên).
- **AI**: ở trang sửa Unit, nếu ô "Students' level" của tuỳ chọn AI còn trống thì lấy tên level của Unit làm mặc định
  (Vocab Review, Grammar dialog, Vocab dialog). Không đè giá trị giáo viên đã gõ hoặc đã nhớ, và không ghi mặc định này vào bộ nhớ.

## 5. Sửa lỗi kèm theo

Ô "N Students (Level X)" ở header Unit editor đếm mọi học sinh có cùng số level, kể cả học sinh của chương trình khác
(Unit TOEIC Level 1 đếm cả học sinh IELTS Level 1). Nay đếm theo **cùng level và cùng chương trình** (`programOf`).
Cùng lỗi ở server: `pages/api/admin/unit-submissions.js` và `test-submissions.js` lấy "lớp cùng level" không lọc chương trình
-> danh sách học sinh và số đếm ở màn Submissions của Unit/Test bị lẫn lớp chương trình khác khi chưa giao lớp nào. Đã thêm `programFilter`.

## 6. Đã làm

- Model, `lib/levelNames.js`, helper server, các API ở mục 3, `usePrograms()` thêm `levelNames`, `levelLabel`, `levelName`, `namedLevels`.
- Thẻ Levels, `LevelField`, nhãn ở các trang nêu trên, mặc định AI, sửa lỗi đếm học sinh.
- `tests/levelNames.test.js`: bộ làm sạch, `levelLabel`/`levelNameOf`/`namedLevelsOf`, validate schema Workspace.
- `node scripts/check-tenant-scope.js --strict` đạt; `npm test` đạt.

File mới: `lib/levelNames.js`, `components/teacher/LevelField.js`, `tests/levelNames.test.js`. **Cần restart dev server** để nhận file client mới.

## 7. Chưa kiểm

- Chưa mở trình duyệt: thẻ Levels (thêm, xoá, lưu, tải lại), `LevelField` ở hai form lớp, cuộn tới `#levels`, nhãn ở từng trang,
  trang học sinh khi có tên.
- Chưa chạy `next build`. Chỉ kiểm bằng `curl` (trang 200, API 401 khi chưa đăng nhập) và log dev server.
- Mặc định AI: ô "Students' level" ở tuỳ chọn Vocab Review không xoá trống được khi level của Unit có tên (xoá xong tự điền lại tên level);
  gõ khác đi thì giữ giá trị gõ.
- Level > 50 (nếu có lớp đặt tay) hiện ở thẻ Levels nhưng đặt tên sẽ bị server từ chối (trần 50).
- Trang admin hệ thống (`/admin/classes`, sysadmin) và trang cài đặt giáo viên (`L{level}`) chưa dùng nhãn tên.
