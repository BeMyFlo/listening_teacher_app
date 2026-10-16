# PLAN — Tên cho từng Level (theo trung tâm và theo chương trình)

Trạng thái: ◐ code xong trên branch `phase-8-toeic`, chưa kiểm bằng trình duyệt, chưa merge · Ngày lập: 2026-10-16 · Sửa chỗ quản lý level: 2026-10-16

Liên quan: [PLAN-PHASE8-TOEIC.md](multi-tenant/PLAN-PHASE8-TOEIC.md) (mục 2 C3: level tính riêng theo chương trình).

## 1. Mục tiêu

Lớp, Unit và Mock Test đều có `level` là số (1, 2, 3...) dùng để xếp thứ tự và để khớp nội dung với học sinh.
Giáo viên cần thêm **tên dễ hiểu** cho từng level, ví dụ IELTS Level 1 = "Band 3.5–5.0", TOEIC Level 1 = "300–450".
Tên khác nhau theo trung tâm (workspace) và theo chương trình. Số vẫn là khoá thật; tên chỉ là nhãn hiển thị.

**Chủ trung tâm góp ý (bản sửa):** level thuộc về **Lớp**, không phải Cài đặt Workspace. Luồng đúng: *tạo level trước, rồi form lớp chọn level*.
Vì vậy chỗ quản lý level nằm ở trang **Classes > tab Levels**, không còn thẻ Levels trong Cài đặt Workspace.

## 2. Dữ liệu

- `Workspace.levelNames: [{ program, level, name }]`, mặc định `[]`. `program` thuộc `PROGRAM_KEYS`, `level` là số nguyên >= 1,
  `name` trim, tối đa 60 ký tự. Không cần migrate, không có index. Đây vẫn là **nguồn duy nhất** của danh sách tên.
- **Duy nhất theo (program, level)** do bộ làm sạch ép, không dùng index: `sanitizeLevelNames` trong `lib/levelNames.js`
  (program hợp lệ, level nguyên 1–50, tên trim và cắt 60, bỏ tên rỗng, trùng thì giữ dòng cuối; sai thì trả lỗi 400).
- `lib/levelNames.js` (dùng chung server + client): `sanitizeLevelNames`, `levelNameOf`, `formatLevelLabel(level, name)`,
  `levelLabel(levelNames, program, level)` -> `"Level 1 · Band 3.5–5.0"` hoặc `"Level 1"`, `namedLevelsOf`.
- `lib/levelsAdmin.js` (thuần, không mongoose, có test): `mergeLevels`, `nextLevelNumber`, `planCreate`, `planRename`, `planDelete`, `cleanName`.
- `lib/curriculumServer.js`: `workspaceLevelNames(ws)`, `levelNameFor(ws, program, level)` (đọc theo `ws.workspaceId`).

Một level "tồn tại" khi **đã có tên** (có dòng trong `levelNames`) **hoặc đang được dùng** (có Lớp/Unit/Test cùng chương trình mang số đó).
Level đang dùng mà chưa có tên vẫn hiện, ở dạng "Level N (no name)", để giáo viên đặt tên.

## 3. API

| Route | Nội dung |
|---|---|
| `GET /api/admin/levels` | `{ levels: { ielts: [{level, name, classCount, inUse}], toeic: [...] } }`. Gộp `Workspace.levelNames` với level mà Lớp/Unit/Test dùng (lọc workspace + `programFilter`), tăng dần. `classCount` = số lớp dùng; `inUse` = Lớp **hoặc** Unit **hoặc** Test dùng |
| `POST /api/admin/levels` `{program, name}` | tạo level số kế tiếp = (lớn nhất đã tên hoặc đang dùng) + 1, chưa có gì -> 1. Trả `201 { level: {program, level, name} }`. Tên bắt buộc, <= 60 ký tự; level vượt 50 -> 400 |
| `PUT /api/admin/levels` `{program, level, name}` | đổi tên (tên bắt buộc). Level chưa có tên nhưng đang dùng thì đây là lần đặt tên đầu. Level không tồn tại -> 404 |
| `DELETE /api/admin/levels?program=&level=` | **409** nếu Lớp/Unit/Test của chương trình đó đang dùng; không tồn tại -> 404; còn lại xoá dòng tên |
| `GET /api/teacher/workspace` | **không còn** `levelNames` / `usedLevels` |
| `PUT /api/teacher/workspace` | **không còn** nhận `levelNames` |
| `GET /api/teacher/me` | vẫn trả `levelNames` để mọi trang giáo viên dán nhãn không cần gọi thêm |
| `GET /api/units`, `/api/tests` (học sinh) | `levelName` (+ `level`) ở danh sách và chi tiết |
| `GET /api/student/dashboard` | `classLevelName` |

Route `levels` là route giáo viên (`requireAuth` + `withTenant`), nằm trong `pages/api/admin/` nên đã được `scripts/check-tenant-scope.js` quét.
Mọi giáo viên của workspace đều tạo/sửa được (không chỉ owner), vì form lớp phải tạo được level ngay tại chỗ.
Ghi vào `Workspace.levelNames` của `req.ws.workspaceId` (đọc-sửa-lưu cả document; hai giáo viên tạo cùng lúc có thể trùng số, xem mục 7).
Học sinh chỉ đọc, luôn theo workspace của request.

## 4. Giao diện

- **Classes > tab Levels** (`/teacher/classes?tab=levels`, link thẳng được): hai tab `Classes | Levels` dùng style `unit-subtab`, tab nằm trên URL.
  Tab Levels (`components/teacher/LevelsManager.js`): mỗi chương trình workspace đang dùng một nhóm (chỉ một chương trình thì không có tiêu đề).
  Dòng: "Level N", tên (hoặc "(no name)"), số lớp dùng, nút sửa (hộp thoại nhập tên), nút xoá. Xoá **bị khoá** khi level đang được
  Lớp/Unit/Test dùng, tooltip "Used by N classes" (hoặc "Used by lessons or mock tests"). "Add level" mỗi nhóm: hộp thoại nhập tên, số level tự tính.
  Nhóm trống: "No levels yet — add the first one."
- **Form lớp** (tạo ở Classes, sửa ở chi tiết lớp): `LevelField` là `<select>` các level của chương trình đang chọn
  ("Level 1 · Band 3.5–5.0", chưa tên thì "Level 2") + dòng cuối **"+ New level…"** (hộp thoại nhập tên -> POST -> tải lại -> chọn level vừa tạo).
  Chương trình chưa có level nào: select chỉ có "+ Create the first level"; nút Create Class bị khoá cho tới khi chọn được level.
  Đổi Program thì danh sách đổi theo (level không còn hợp lệ -> chọn level đầu tiên, hoặc chưa chọn nếu chương trình trống).
  Trang sửa lớp: level hiện tại của lớp luôn có trong danh sách. Đã bỏ ô số "Other…" (level chỉ được tạo qua hộp thoại / tab Levels).
- **Nguồn dữ liệu cho giao diện**: hook `useLevels()` (`lib/client/levels.js`) gọi `/api/admin/levels` và sau mỗi thay đổi gọi `usePrograms().refresh()`
  để nhãn ở mọi trang cập nhật. `usePrograms()` vẫn là nơi duy nhất cấp `levelNames` / `levelLabel` cho các trang.
- **Lessons**: nút "Manage levels" ở đầu trang -> `/teacher/classes?tab=levels`.
- **Cài đặt Workspace**: đã **bỏ** thẻ Levels.
- **Nhãn level** (`usePrograms().levelLabel(program, level)`): giữ nguyên như bản đầu — danh sách và chi tiết Classes, Lessons (nhóm level + tiêu đề),
  header Unit editor, Mock Tests, Submissions của Mock Test, chọn lớp ở Students, thẻ lớp ở Overview (chỉ khi level có tên).
  Học sinh: Lessons, Unit, Mock Tests, ô "Units for your level" ở Dashboard (chỉ khi có tên).
- **AI**: ở trang sửa Unit, ô "Students' level" của tuỳ chọn AI còn trống thì lấy tên level của Unit làm mặc định
  (Vocab Review, Grammar dialog, Vocab dialog). Không đè giá trị giáo viên đã gõ hoặc đã nhớ.

## 5. Sửa lỗi kèm theo (bản đầu)

Ô "N Students (Level X)" ở header Unit editor đếm mọi học sinh có cùng số level, kể cả học sinh của chương trình khác
(Unit TOEIC Level 1 đếm cả học sinh IELTS Level 1). Nay đếm theo **cùng level và cùng chương trình** (`programOf`).
Cùng lỗi ở server: `pages/api/admin/unit-submissions.js` và `test-submissions.js` lấy "lớp cùng level" không lọc chương trình
-> đã thêm `programFilter`.

## 6. Đã làm

- Model, `lib/levelNames.js`, helper server, các API ở mục 3, `usePrograms()` có `levelNames`, `levelLabel`, `levelName`, `namedLevels`.
- Bản sửa: `pages/api/admin/levels.js` + `lib/levelsAdmin.js`; `lib/client/levels.js` (`useLevels`); `components/teacher/LevelsManager.js`;
  `LevelField` viết lại (chọn / tạo nhanh); tab Levels ở Classes; nút "Manage levels" ở Lessons; bỏ thẻ Levels và bỏ `levelNames`/`usedLevels`
  khỏi `/api/teacher/workspace`; `api.teacher.listLevels/createLevel/renameLevel/deleteLevel`.
- `tests/levelNames.test.js` (bộ làm sạch, nhãn, schema Workspace) và `tests/levelsAdmin.test.js` (gộp tên + level đang dùng,
  số kế tiếp, tạo / đổi tên / xoá, kiểm "đang dùng -> 409").
- Đã kiểm: `npm test` đạt; `node scripts/check-tenant-scope.js --strict` đạt; `curl` các trang `/teacher/classes`, `/teacher/classes?tab=levels`,
  `/teacher/settings/workspace`, `/teacher/lessons` trả 200; `GET/POST/DELETE /api/admin/levels` và `/api/teacher/workspace` trả 401 khi chưa đăng nhập;
  log dev server không báo lỗi biên dịch.

File client mới: `lib/client/levels.js`, `components/teacher/LevelsManager.js` (và `components/teacher/LevelField.js` viết lại). **Cần restart dev server** để nhận file client mới.

## 7. Chưa kiểm / lưu ý

- Chưa mở trình duyệt để thử: tab Levels (thêm / sửa / xoá, nút xoá bị khoá, tooltip), `LevelField` ở hai form lớp (chọn, "+ New level…",
  chương trình trống), deep-link `?tab=levels`, nút "Manage levels", nhãn ở từng trang, trang học sinh khi có tên. Chưa chạy `next build`.
- Chưa gọi API có đăng nhập (không đăng nhập, không ghi DB): POST/PUT/DELETE chỉ được kiểm bằng test của logic thuần.
- Hai giáo viên bấm "New level" gần như cùng lúc có thể được cùng một số level (đọc-sửa-lưu, không khoá); người sau ghi đè tên của người trước. Hiếm, chưa xử lý.
- Workspace cũ đã đặt tên bằng thẻ Levels cũ: dữ liệu giữ nguyên, hiện đúng ở tab Levels.
- Đổi Program ở trang sửa lớp sang chương trình không có level đó: level bị bỏ chọn, phải chọn / tạo level mới mới lưu được.
- Level > 50 (nếu có lớp đặt tay) hiện ở tab Levels nhưng đặt tên sẽ bị server từ chối (trần 50).
- Mặc định AI: ô "Students' level" ở tuỳ chọn Vocab Review không xoá trống được khi level của Unit có tên (xoá xong tự điền lại tên level).
- Trang admin hệ thống (`/admin/classes`, sysadmin) và trang cài đặt giáo viên (`L{level}`) chưa dùng nhãn tên; form lớp của sysadmin vẫn nhập số level tay.
