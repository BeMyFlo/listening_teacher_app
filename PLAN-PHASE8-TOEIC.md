# PLAN — Phase 8: Chương trình TOEIC (taxonomy Program) + UX chuyển chương trình

> Tài liệu thi hành cho **Phase 8** của [PLAN-MULTI-TENANT.md](PLAN-MULTI-TENANT.md).
> File kia là bộ não (bối cảnh, tiến độ). File này là tay chân: làm gì, ở file nào, đổi thành gì.
>
> **Người thi hành đọc kỹ mục 0 và mục 2 trước khi gõ dòng code đầu tiên.**

Trạng thái: ☐ plan xong, chưa code · Ngày lập: 2026-10-08 · Branch: `phase-8-toeic`
Tiền đề: Phase 1–7 + 10/10B đã merge vào `main`. `Workspace.programs` đã có sẵn (default `["ielts"]`, chưa ai dùng).

---

## 0. Luật chơi — đọc trước

### 0.1 Phase 8 làm gì

Thêm khái niệm **chương trình** (`program`: `ielts` | `toeic`) cho Lớp, Unit, Mock Test và bài nộp, để một
workspace dạy được cả IELTS lẫn TOEIC mà **hai bên không lẫn vào nhau**. Chương trình đầu tiên mở thêm là TOEIC.

Chia 2 đợt, **mỗi đợt deploy độc lập được**:

| Đợt | Nội dung | Ghi chú |
|---|---|---|
| **8A** | Nền `program` + UX chuyển chương trình + **TOEIC Listening & Reading** (Part 1–7, điểm ước tính 10–990) | Phần lớn dùng lại engine câu hỏi sẵn có. Làm trước. |
| **8B** | **TOEIC Speaking & Writing** (dạng đề, đồng hồ chuẩn bị/nói, rubric + chấm AI riêng) | Plan sơ bộ ở mục 7, viết chi tiết khi 8A xong |

### 0.2 Bất biến số 1 — IELTS không được đổi gì

Workspace chỉ bật 1 chương trình (tức **mọi workspace hiện tại**, kể cả Ms Nhi và demo) phải thấy app **y hệt
hôm nay**: không nút chuyển, không nhãn, không đổi chữ, không đổi luồng. Mọi thứ của Phase 8 chỉ hiện khi
`Workspace.programs.length >= 2`, hoặc khi đang mở một nội dung TOEIC.

### 0.3 Phase 8 KHÔNG làm gì

- Không đổi `CATEGORY_KEYS` của `Unit` (vẫn 6 key). Program chỉ quyết định **hiện tab nào**, không đổi schema.
- Không làm bảng Skill/Program động trong DB. Registry là **file code** (`lib/curriculum.js`).
- Không làm môn khác (Toán, Lý...). `subject` vẫn chỉ có `english`.
- Không cho học sinh thuộc 2 chương trình cùng lúc (V1: 1 học sinh ∈ 1 lớp ∈ 1 chương trình).
- 8A **không** mở Writing/Speaking cho TOEIC. Lý do: rubric và AI chấm hiện là IELTS band 1–9, mở ra sẽ chấm
  sai thang điểm.
- Không làm template import Excel cho TOEIC (để sau). 8A ẩn nút import với nội dung TOEIC.

---

## 1. Nghiên cứu: cấu trúc kỳ thi TOEIC

TOEIC gồm **2 bài thi tách riêng**.

### 1.1 TOEIC Listening & Reading — 200 câu, 2 giờ, thang 10–990 (mỗi kỹ năng 5–495)

**100% trắc nghiệm 1 đáp án.**

| Part | Tên | Số câu | Lựa chọn | In trong đề? | Cách làm |
|---|---|---|---|---|---|
| 1 | Photographs | 6 | A–D | Chỉ có ảnh | Nghe 4 câu mô tả, chọn câu đúng với ảnh |
| 2 | Question–Response | 25 | A–C | Không in gì | Nghe 1 câu hỏi và 3 câu đáp |
| 3 | Conversations | 39 | A–D | Câu hỏi và lựa chọn | 13 hội thoại × 3 câu, một số câu kèm biểu đồ/bảng |
| 4 | Talks | 30 | A–D | Câu hỏi và lựa chọn | 10 bài nói × 3 câu, một số câu kèm biểu đồ |
| 5 | Incomplete Sentences | 30 | A–D | Có | Điền từ vào câu |
| 6 | Text Completion | 16 | A–D | Có | 4 đoạn × 4 chỗ trống, có dạng chèn cả câu |
| 7 | Reading Comprehension | 54 | A–D | Có | 29 câu đọc 1 bài, 25 câu đọc 2–3 bài. Có dạng "câu này nên đặt ở vị trí [1]–[4]" |

Thời gian: Listening khoảng 45 phút (audio chạy liền), Reading 75 phút.

### 1.2 TOEIC Speaking & Writing — mỗi kỹ năng thang 0–200 (dùng ở 8B)

| Kỹ năng | Câu | Dạng | Thời gian |
|---|---|---|---|
| Speaking (11 câu, ~20 phút) | 1–2 | Read a text aloud | 45s chuẩn bị / 45s nói |
| | 3–4 | Describe a picture | 45s / 30s |
| | 5–7 | Respond to questions (câu hỏi phát bằng audio) | 3s / 15s, 15s, 30s |
| | 8–10 | Respond using information provided (lịch, bảng) | đọc 45s, 3s / 15s, 15s, 30s (câu 10 nghe 2 lần) |
| | 11 | Express an opinion | 45s / 60s |
| Writing (8 câu, ~60 phút) | 1–5 | Write a sentence based on a picture (bắt buộc dùng 2 từ cho sẵn) | 8 phút cho cả 5 câu |
| | 6–7 | Respond to a written request (email) | 10 phút mỗi câu |
| | 8 | Write an opinion essay (~300 từ) | 30 phút |

Nguồn: [ETS — TOEIC Speaking & Writing](https://www.ets.org/toeic/about/speaking-writing.html) ·
[IIBC — TOEIC L&R format](https://www.iibc-global.org/english/toeic/test/lr/about/format.html) ·
[IIBC — TOEIC Speaking format](https://iibc-global.org/english/toeic/test/speaking/about/format.html) ·
[ETS India — TOEIC L&R](https://www.in.ets.org/toeic/test-takers/about/listening-reading.html)

### 1.3 Đối chiếu với engine hiện tại

| Phần TOEIC | Làm bằng gì | Thiếu gì |
|---|---|---|
| Part 2, 3, 4, 5 | `mcq` + audio/ảnh của section | Không thiếu |
| Part 1 | `mcq` | Mỗi câu cần **ảnh riêng**. Hiện ảnh chỉ gắn ở section → thêm `field.imageId` (bước 5.4) |
| Part 3/4 có biểu đồ | `mcq` | Như trên, dùng `field.imageId` |
| Part 1/2 lựa chọn không in chữ | `mcq` với nhãn "A", "B", "C" (, "D") | Preset tự điền lựa chọn chỉ có chữ cái (bước 5.3) |
| Part 6 | Đoạn văn + `mcq`, giáo viên gõ "-- 131 --" vào đoạn văn | Không thiếu |
| Part 7 | Đoạn văn hoặc ảnh (form, bảng, email chụp lại) + `mcq` | Đoạn văn chỉ là chữ thường. Bài 2–3 đoạn gộp chung, form/bảng dùng ảnh. **Chấp nhận cho V1** |
| Điểm 5–495 / 10–990 | — | Bảng quy đổi ước tính, chỉ hiển thị (bước 6.3) |

---

## 2. Quyết định

### 2.1 Đã chốt (chủ dự án, 2026-10-08)

- **C1.** Làm TOEIC trước, chia **8A (Nghe + Đọc) rồi 8B (Nói + Viết)**.
- **C2.** UX: **không có màn chọn chương trình lúc đăng nhập**. Chương trình là **bộ lọc chung trên thanh trên
  cùng** (`All | IELTS | TOEIC`), chỉ hiện khi workspace bật ≥ 2 chương trình (mockup ở mục 4).
- **C3.** Level tính **riêng theo từng chương trình**: Level 1 IELTS và Level 1 TOEIC là hai nhóm khác nhau.

### 2.2 Mặc định đề xuất — chủ dự án chưa trả lời, người thi hành làm theo nếu không có chỉ đạo khác

| # | Câu hỏi | Mặc định | Lý do |
|---|---|---|---|
| D1 | Ai bật chương trình cho workspace? | **Admin nền tảng** bật ở `/admin/workspaces`. Giáo viên chỉ xem được trong Workspace Settings | Khách hàng ký hợp đồng (không có tự đăng ký). Giữ đường cho TOEIC thành gói tính tiền riêng |
| D2 | Có chế độ "All" không? | **Có**, và là mặc định lần đầu | Chấm bài và xem tổng quan gộp hai chương trình |
| D3 | Điểm Nghe/Đọc TOEIC hiện thế nào? | **Hiện cả hai:** "38/50 đúng" và "≈ 385 / 495 (estimated)" | Học sinh TOEIC quen nghĩ theo thang 990. Chữ "estimated" tránh hiểu nhầm là điểm chính thức |
| D4 | Bài học TOEIC có những tab nào? | 8A: **Grammar, Vocabulary, Listening, Reading**. 8B mở thêm Writing, Speaking | Writing/Speaking chưa có rubric TOEIC (xem 0.3) |
| D5 | Đổi chương trình của một Unit/Test/Lớp đã tạo? | **Được**, có hộp xác nhận. Server gỡ các lớp được giao, deadline và skill-lock không còn khớp | Giống hệt logic `levelChanged` đang có ở `admin/units.js` |
| D6 | Tên lớp TOEIC | Không thêm field. Giáo viên tự đặt tên kiểu "TOEIC 450+", trang Lessons hiện tên lớp thay cho "1 class" | Không phình schema |

**Q4 cũ ở PLAN-MULTI-TENANT mục 11** ("TOEIC chưa có rubric — dùng tạm rubric IELTS hay ẩn?") được trả lời bằng
D4 + 8B: **ẩn ở 8A, làm rubric TOEIC thật ở 8B.** Không dùng tạm rubric IELTS.

---

## 3. Mô hình dữ liệu

### 3.1 Registry — `lib/curriculum.js` (mới, dùng chung server + client, CommonJS như `lib/theme.js`)

```js
const PROGRAMS = {
  ielts: {
    key: "ielts", label: "IELTS",
    lessonSkills: ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"],
    testSkills: ["listening", "reading", "writing", "speaking"],
    defaultDurations: { listening: 30, reading: 60, writing: 60, speaking: 14 },
    scoring: "ielts-band",
  },
  toeic: {
    key: "toeic", label: "TOEIC",
    lessonSkills: ["grammar", "vocabulary", "listening", "reading"],   // 8B: + writing, speaking
    testSkills: ["listening", "reading"],                              // 8B: + writing, speaking
    defaultDurations: { listening: 45, reading: 75 },
    scoring: "toeic-scaled",
  },
};
const PROGRAM_KEYS = Object.keys(PROGRAMS);
const DEFAULT_PROGRAM = "ielts";
// isProgram(k), programOf(doc) => doc.program || DEFAULT_PROGRAM, programFilter(p) (mục 3.3)
```

Mọi chỗ cần biết "chương trình này có kỹ năng gì" **đọc registry**, không viết `if (program === "toeic")`
rải rác. Ngoại lệ duy nhất: danh sách dạng câu hỏi (`questionFormats.js`) và thang điểm.

### 3.2 Field mới

| Model | Field | Ghi chú |
|---|---|---|
| `Class` | `program: { type: String, enum: PROGRAM_KEYS, default: "ielts", required: true }` | **Nguồn sự thật** cho học sinh: học sinh thuộc chương trình của lớp mình |
| `Unit` | `program` (giống trên) | |
| `Test` | `program` (giống trên) | |
| `Submission` | `program` (giống trên) | Gán lúc nộp, lấy từ Unit/Test. Để Grading Queue/Overview lọc được mà không phải join |
| `Workspace` | `programs` (đã có) | Thêm validate: mỗi phần tử ∈ `PROGRAM_KEYS`, không rỗng, không trùng |
| `FieldSchema` (`questionSchema.js`) | `imageId: { type: ObjectId, ref: "Image" }` | Ảnh riêng cho từng câu (Part 1, Part 3/4 có biểu đồ). **Dùng được cho cả IELTS**, không gắn với TOEIC |

Index mới:
- `Class { workspaceId: 1, program: 1, level: 1, name: 1 }` (thay index cũ)
- `Unit { workspaceId: 1, program: 1, status: 1, level: 1 }`
- `Test { workspaceId: 1, program: 1, status: 1, level: 1 }` (thay index cũ)
- `Submission { workspaceId: 1, program: 1, gradingStatus: 1, submittedAt: -1 }`

### 3.3 Dữ liệu cũ — chịu được cả khi chưa backfill

`{ program: "ielts" }` trong Mongo **không khớp** document thiếu field. Vì vậy mọi truy vấn lọc theo chương
trình đi qua **một helper duy nhất**:

```js
function programFilter(p) {
  return p === DEFAULT_PROGRAM ? { program: { $in: [DEFAULT_PROGRAM, null] } } : { program: p };
}
```

(`null` trong `$in` khớp cả field thiếu.) Nhờ vậy **thứ tự deploy và backfill không quan trọng**.

Backfill vẫn chạy cho sạch: `scripts/backfill-program.js` gán `program: "ielts"` cho Class/Unit/Test/Submission
thiếu field. Bắt buộc chọn DB qua `scripts/dbTarget.js` (`--dev` | `--live`, không có mặc định), không có
`--apply` thì chỉ in số lượng — giống `scripts/migrate-workspace.js`. **Chạy trên dev trước, live chỉ khi chủ dự án đồng ý.** Sau backfill, chạy
`scripts/check-orphans.js` (hoặc thêm một kiểm tra tương tự) để chắc còn 0 doc thiếu `program`.

### 3.4 Luật nhất quán (server enforce, không tin client)

1. **Lớp ↔ nội dung cùng chương trình.** `sanitizeClassIds`, `sanitizeDeadlines`, `sanitizeSkillLocks` ở
   `pages/api/admin/units.js` và `sanitizeClassIds` ở `pages/api/admin/tests.js` hiện lọc lớp theo
   `level`. Đổi thành lọc theo **`level` + `program`** (và vẫn trong workspace).
   → Đây là **rủi ro thật** cần chặn. Hôm nay học sinh chỉ thấy Unit/Test khi được giao **đúng lớp**
   (`classIds: cls._id`), nên không tự lộ chéo. Nhưng ô chọn lớp và bộ sanitize đang chỉ so level. Không sửa thì
   giáo viên giao được Unit IELTS Level 1 cho lớp TOEIC Level 1. *(Tin nhắn trước nói "học sinh TOEIC sẽ thấy
   bài IELTS" là nói quá: phải có bước giao nhầm thì mới lộ. Bản chất vẫn phải chặn.)*
2. **Program phải được workspace bật.** Tạo hoặc đổi sang chương trình ∉ `Workspace.programs` → 400.
3. **Học sinh: lọc thêm theo chương trình (phòng thủ nhiều lớp).** `pages/api/units.js`, `pages/api/tests.js`,
   `pages/api/student/dashboard.js` thêm `...programFilter(programOf(cls))` cạnh `level` + `classFilter`.
4. **Bài nộp mang chương trình của bài gốc.** Cả 4 chỗ `Submission.create` trong `pages/api/submissions.js` gán
   `program: programOf(unitOrTest)`. Không lấy từ client.
5. **Đổi chương trình (D5):** giống nhánh `levelChanged` hiện có. Khi `program` đổi thì chạy lại 3 sanitize với
   `(level, program)` mới, gỡ phần không khớp. Bài nộp cũ **giữ nguyên** `program` cũ (là lịch sử).

---

## 4. UX

### 4.1 Nút chuyển chương trình (chỉ khi workspace bật ≥ 2 chương trình)

```
┌──────────────────────────────────────────────────────────────────────┐
│ ≡  [ Search students, mock tests…  ]   Program [ All | IELTS | TOEIC ]  🔔  TE │
└──────────────────────────────────────────────────────────────────────┘
```

- Nằm trong `components/Shell.js` (`header.topbar-v2`), giữa ô tìm kiếm và chuông. Chỉ có ở vai trò giáo viên.
- Giá trị lưu `localStorage` theo khoá `bmf.program.<workspaceId>`. Đọc/ghi bọc `try/catch`, lỗi thì về `"all"`.
  Giá trị không còn hợp lệ (admin vừa tắt chương trình) → về `"all"`.
- State dùng chung qua `ProgramProvider` (React context, file mới `lib/client/program.js`, đặt trong
  `app/teacher/layout.js`). Hook `useProgram()` trả `{ programs, current, setCurrent, isMulti }`.
- Workspace chỉ 1 chương trình: `isMulti=false`, `current` luôn là chương trình đó, **không render gì thêm**.

### 4.2 Trang giáo viên lọc theo nút chuyển

| Trang | Khi chọn 1 chương trình | Khi chọn All |
|---|---|---|
| Overview (`/teacher/overview`) | Thống kê lớp, bài, hạn nộp của chương trình đó | Như hôm nay, mỗi lớp có nhãn chương trình |
| Lessons (`/teacher/lessons`) | Level của chương trình đó. Tiêu đề "Lessons · TOEIC", dòng mô tả liệt kê kỹ năng theo registry | Chia nhóm theo chương trình, mỗi nhóm một danh sách Level |
| Lessons → 1 Level (`?level=`) | Thêm `&program=` vào URL để link chia sẻ được và reload không lạc | — |
| Mock Tests | Lọc như trên. Lọc level/lớp chỉ hiện lớp của chương trình đó | Nhãn chương trình trên từng dòng |
| Classes | Lọc. Form tạo lớp tự chọn chương trình đang chọn | Form tạo lớp có ô chọn chương trình |
| Students | Học sinh thuộc lớp của chương trình đó (học sinh chưa xếp lớp luôn hiện) | Như hôm nay |
| Grading Queue, Submissions | Lọc bằng `Submission.program` (server, tham số `?program=`) | Như hôm nay, kèm nhãn |
| Audio / Image Library | **Không lọc** — media dùng chung | — |
| Số đếm trên sidebar (`shellBadges`) | Đếm theo chương trình đang chọn | Tổng |

Mockup trang Lessons đã duyệt với chủ dự án ngày 2026-10-08 (3 trạng thái All / IELTS / TOEIC).

**Trạng thái trống phải nói rõ đang lọc.** Ví dụ: "No TOEIC units yet. Create one, or switch to All." Tránh
trường hợp giáo viên tưởng mất bài vì quên đang ở TOEIC.

**Nhãn chương trình** (component mới `components/ProgramBadge.js`): pill nhỏ, IELTS dùng màu brand hiện tại,
TOEIC dùng một màu phụ cố định. Hai màu là token CSS mới trong `styles/legacy.css` và có bản dark mode. **Chỉ
render khi `isMulti`.**

### 4.3 Tạo và sửa nội dung

- **New unit / New test / New class:** chương trình = nút chuyển đang chọn. Nếu đang ở All → form có ô chọn
  bắt buộc. Workspace 1 chương trình → không có ô nào.
- **Unit editor** (`app/teacher/lessons/[unitId]/page.js`): tab kỹ năng = `PROGRAMS[program].lessonSkills`. Phần
  meta có ô chương trình (chỉ khi `isMulti`). Đổi chương trình → `useDialog()` xác nhận: "Classes, deadlines and
  skill locks that don't match will be removed" (không dùng `confirm()` của trình duyệt).
- **Test builder** (`app/teacher/tests/[testId]/page.js`): tab = `testSkills`, thời lượng mặc định lấy từ
  `defaultDurations` khi tạo mới. Ô chọn lớp chỉ hiện lớp cùng chương trình và cùng level.
- **Dropdown dạng câu hỏi** đổi theo chương trình (mục 5.3).
- **Tạo bằng AI** (grammar/vocab) và **Import Excel**: xem bước 5.6.

### 4.4 Học sinh

- **Không có nút chuyển.** Chương trình = chương trình của lớp mình.
- Tab trong Unit và ô kỹ năng trong Mock Test theo registry. Học sinh TOEIC ở 8A **không thấy** Writing/Speaking.
- Kết quả Listening/Reading TOEIC hiện "38/50 correct · ≈ 385 / 495 (estimated)" (D3).
- Thanh kỹ năng trên Dashboard (`app/student/page.js:180`): TOEIC chỉ hiện %, không hiện "Band".

### 4.5 Admin nền tảng

- `/admin/workspaces`: thêm cột "Programs" + nút sửa (checkbox IELTS/TOEIC, ít nhất 1). API:
  `pages/api/sysadmin/workspaces.js` PUT nhận `programs`.
- **Tắt** một chương trình mà workspace còn lớp/bài thuộc chương trình đó → **không xoá gì**, chỉ ẩn khỏi nút
  chuyển. Hộp xác nhận báo số lớp/bài sẽ bị ẩn. Học sinh của lớp đó vẫn học bình thường (dữ liệu là của họ).
- `/admin/classes`: thêm cột chương trình.
- Workspace Settings của giáo viên: hiện danh sách chương trình đang bật (chỉ đọc, ghi "Contact support to add a
  program").

---

## 5. Các bước thi hành — Đợt 8A

Mỗi bước là một commit. Sau mỗi bước: `next build` sạch. Workspace IELTS-only không đổi gì (bất biến 0.2).
**Không tự chạy/tắt dev server** — chủ dự án tự chạy `:3000`. Kiểm bằng build, script
probe gọi handler thật trên **dev DB**, và trình duyệt khi chủ dự án đã bật server.

### Bước 1 — Registry + schema + backfill (không đổi hành vi)

1. Tạo `lib/curriculum.js` (mục 3.1) + `programFilter`, `programOf`, `isProgram`.
2. Thêm `program` vào `Class`, `Unit`, `Test`, `Submission`. Thêm `imageId` vào `FieldSchema`. Thêm index (3.2).
   Thêm validate cho `Workspace.programs`.
3. `scripts/backfill-program.js` (3.3). Chạy dry-run và `--apply` **trên dev**.
4. `pages/api/teacher/me.js`: thêm `programs` vào `.select(...)` của workspace.

Kiểm: build sạch. Đếm doc thiếu `program` trên dev = 0. App không đổi gì.

### Bước 2 — Server enforce

1. `pages/api/admin/classes.js`: POST nhận `program` (mặc định `programs[0]` của workspace, phải ∈ programs).
   PUT cho đổi `program` → gỡ lớp khỏi `classIds`/`deadlines`/`skillLocks` của Unit/Test khác chương trình (cùng
   cách mã hiện tại đang gỡ khi xoá lớp). GET trả `program`.
2. `pages/api/admin/units.js`, `pages/api/admin/tests.js`: POST/PUT nhận `program`. Sanitize theo
   `(level, program)`, nhánh `programChanged` giống `levelChanged` (3.4.5). GET trả `program`.
3. `pages/api/units.js`, `pages/api/tests.js`, `pages/api/student/dashboard.js`: thêm `programFilter` (3.4.3).
4. `pages/api/submissions.js`: 4 chỗ `Submission.create` gán `program` (3.4.4).
5. `pages/api/admin/grading-queue.js`, `pages/api/admin/submissions.js`, `pages/api/admin/dashboard.js`
   (+ `lib/teacher/dashboard.js`), `pages/api/admin/students.js`: nhận `?program=` (bỏ trống/`all` = không lọc),
   lọc bằng `programFilter`. Students: lọc theo `classId ∈` lớp của chương trình, cộng học sinh chưa xếp lớp.
6. `pages/api/sysadmin/workspaces.js`: GET trả `programs`, PUT nhận `programs` (validate, ít nhất 1).
7. Chạy `scripts/check-tenant-scope.js`, phải vẫn qua. Không thêm route mới.

Kiểm (script probe trên dev DB, gọi handler thật như Phase 10 đã làm):
- Tạo lớp TOEIC L1 + Unit IELTS L1. Giao Unit IELTS cho lớp TOEIC → `classIds` bị gỡ.
- Học sinh lớp TOEIC không lấy được Unit/Test IELTS, kể cả gọi thẳng `?id=`.
- Workspace chỉ bật IELTS tạo lớp TOEIC → 400.
- Bài nộp mới có đúng `program`. Grading Queue `?program=toeic` chỉ ra bài TOEIC.
- Doc cũ thiếu `program` vẫn hiện đúng ở bộ lọc IELTS (`programFilter`).

### Bước 3 — Khung UX: ProgramProvider + nút chuyển + nhãn

1. `lib/client/program.js`: `ProgramProvider`, `useProgram()` (4.1). Lấy `programs` từ `/api/teacher/me`.
2. `app/teacher/layout.js` bọc `ProgramProvider`.
3. `components/Shell.js`: render nút chuyển khi `isMulti` (segmented control, class mới trong `styles/legacy.css`,
   không inline màu cứng — theo token theme Phase 6).
4. `components/ProgramBadge.js` + token màu.
5. `lib/client/shellBadges.js` + `lib/client/api.js`: truyền `program` khi lấy số đếm và danh sách.

Kiểm: workspace demo bật 2 chương trình → nút hiện, đổi qua lại, reload giữ lựa chọn. Workspace Ms Nhi (1
chương trình) → DOM topbar **giống hệt** trước (so `outerHTML` của `header.topbar-v2`).

### Bước 4 — Các trang giáo viên lọc theo chương trình (bảng 4.2)

`app/teacher/{overview,lessons,tests,classes,students,grading,submissions}/page.js`.
- `lessons/page.js`: `levels` (dòng ~46) tính từ lớp + unit **đã lọc chương trình**. Chế độ All nhóm theo
  chương trình. "1 class" → tên lớp khi có đúng 1 lớp (D6). Mô tả trang lấy từ `lessonSkills`. Thêm `program`
  vào query `?level=`.
- `tests/page.js`: bộ lọc level/lớp (dòng ~29–60) chỉ dùng lớp của chương trình đang chọn.
- `classes/page.js`: form tạo lớp có ô chương trình khi đang ở All. Danh sách lớp có nhãn khi `isMulti`.
- Trạng thái trống nói rõ đang lọc (4.2).

### Bước 5 — Builder: Unit editor, Test builder, dạng câu hỏi TOEIC, ảnh riêng cho từng câu

**5.1 Unit editor** (`app/teacher/lessons/[unitId]/page.js`): tab theo `lessonSkills`. Ô chương trình + hộp xác
nhận khi đổi (D5). Ô chọn lớp/deadline/skill-lock chỉ liệt kê lớp cùng `(level, program)`. Dữ liệu của tab bị ẩn
(vd unit đổi IELTS → TOEIC còn nội dung Writing) **giữ nguyên trong DB**, chỉ ẩn. Hiện cảnh báo nhỏ nếu tab bị ẩn
còn nội dung.

**5.2 Test builder** (`lib/teacher/testBuilder.js`, `app/teacher/tests/[testId]/page.js`):
`emptyBuilder(program)` dùng `defaultDurations`. Tab = `TEST_SKILLS` lọc theo `testSkills`. Payload các kỹ năng
bị ẩn để rỗng như hôm nay đang làm với đề "1 to 4 skills".

**5.3 Dạng câu hỏi TOEIC** (`lib/teacher/questionFormats.js`): `questionFormatsFor(subject, program)`.
Program `ielts` (hoặc không truyền) trả **đúng danh sách cũ**. Thêm cờ mới `letterOptions: n` (tự tạo n lựa chọn
nhãn "A".."D", không có chữ) và `needsFieldImage: true` (cuộn tới ô ảnh của câu).

| key | Nhãn | kind | Cờ |
|---|---|---|---|
| `tl-p1` | Part 1 — Photographs | mcq | `letterOptions: 4`, `needsFieldImage` |
| `tl-p2` | Part 2 — Question–Response | mcq | `letterOptions: 3` |
| `tl-p3` | Part 3 — Conversations | mcq | |
| `tl-p3g` | Part 3 — Conversation with graphic | mcq | `needsFieldImage` |
| `tl-p4` | Part 4 — Talks | mcq | |
| `tl-p4g` | Part 4 — Talk with graphic | mcq | `needsFieldImage` |
| `tr-p5` | Part 5 — Incomplete Sentences | mcq | |
| `tr-p6` | Part 6 — Text Completion | mcq | |
| `tr-p6s` | Part 6 — Sentence insertion | mcq | |
| `tr-p7` | Part 7 — Single passage | mcq | |
| `tr-p7m` | Part 7 — Multiple passages | mcq | |
| `tr-p7i` | Part 7 — Insert a sentence [1]–[4] | mcq | tự tạo 4 lựa chọn "[1]".."[4]" |

Nhãn dropdown viết **tiếng Anh** (UI chỉ dùng tiếng Anh). Chú ý: danh sách IELTS cũ còn chữ Việt ("1 đáp án")
nhưng không sửa trong phase này để giữ bất biến 0.2 — ghi lại làm việc dọn sau. `formatLabel` lưu như cũ.

**5.4 Ảnh riêng cho từng câu** (`field.imageId`) — dùng chung cho mọi chương trình:
- `lib/testSections.js`: normalize giữ `imageId`. `validateSections` kiểm ảnh thuộc workspace (giống
  `s.imageId`, dòng ~137).
- `pages/api/tests.js` (~dòng 17) và `pages/api/units.js` (~dòng 31): populate + trả `imageUrl` cho từng field.
- `lib/teacher/sectionTransforms.js`: `fieldToServer`/`fieldFromServer`/`emptyField` mang `imageId`.
- `components/teacher/SectionsEditor.js`: ô "Question image" (dùng `useMediaLibraries`) trên dòng câu hỏi
  `mcq`, luôn có nhưng thu gọn. Mở sẵn khi format có `needsFieldImage`.
- `components/student/questions.js`: render ảnh phía trên câu hỏi khi có `field.imageUrl`. Dùng lại style ảnh
  của `DiagramImage`. Có ở cả chế độ làm bài và xem lại.
- Kiểm tra trang review của giáo viên (`app/teacher/tests/[testId]/submissions/...`) có hiện ảnh.

**5.5 Luật media của section:** `sectionMediaError` (`lib/testSections.js:103`) giữ nguyên. Listening bắt buộc
có audio mỗi section → giáo viên TOEIC tạo **1 section mỗi Part** (hoặc mỗi hội thoại), mỗi section một file
audio. Việc cho cả bài Listening dùng **một** file audio liền thì để sau (ghi ở mục 8).

**5.6 Tạo bằng AI + Import:**
- `lib/ai/common.js`, `lib/ai/grammarLesson.js`, `lib/ai/vocabLesson.js`, `pages/api/admin/ai-lesson.js`: nhận
  `program`. TOEIC → câu mở đầu prompt đổi thành giáo viên TOEIC, ngữ cảnh ví dụ là công sở/kinh doanh, mức mặc
  định "TOEIC 450–600" thay cho "IELTS band 4.0–5.0". Chuỗi IELTS cũ **giữ nguyên từng chữ** khi program là
  `ielts`. Prompt ghi vào AI Log như cũ.
- `components/teacher/SpreadsheetImport.js` + `LessonImport.js`: ẩn nút với Unit/Test TOEIC. Template TOEIC
  để sau.

### Bước 6 — Phía học sinh

1. `app/student/lessons/[unitId]/page.js`: tab theo `lessonSkills` của `unit.program`. API `units.js` trả
   `program`.
2. `app/student/tests/page.js` + `app/student/tests/[testId]/[skill]/page.js`: ô kỹ năng theo `testSkills`.
   Countdown dùng `durationMinutes` như cũ.
3. **Điểm ước tính TOEIC** — `lib/curriculum/toeicScale.js` (mới):
   - Dữ liệu là bảng quy đổi số câu đúng (0–100) → điểm 5–495, mỗi kỹ năng một bảng. Lấy từ **bảng tham khảo
     công khai, không chính thức** (ETS không công bố). **Ghi nguồn URL trong file.**
   - `estimateToeic(skill, correct, total)`: `total ≠ 100` thì quy theo tỉ lệ `round(correct × 100 / total)`
     trước khi tra bảng. Làm tròn tới bội số 5. `total = 0` → `null`.
   - **Chỉ hiển thị, không lưu DB**, nên đổi bảng sau này không cần migrate.
   - Hiện ở: hộp kết quả sau khi nộp, danh sách Mock Tests của học sinh, trang bài nộp của giáo viên. Luôn kèm
     chữ "estimated". Có đủ L+R của cùng một đề → hiện thêm tổng "≈ 785 / 990".
4. `app/student/page.js` + `lib/student/dashboard.js`: thanh kỹ năng TOEIC chỉ hiện %.
5. Chữ "Band" chỉ xuất hiện ở Writing/Speaking. 8A không mở hai kỹ năng này cho TOEIC nên không cần đổi. 8B
   sẽ xử lý.

### Bước 7 — Admin nền tảng

`app/admin/workspaces/page.js` (cột + sửa programs, hộp xác nhận khi tắt có lớp/bài), `app/admin/classes`
(cột program), `app/teacher/settings/workspace/page.js` (hiện programs, chỉ đọc).

### Bước 8 — Kiểm thử tổng + dữ liệu demo

1. Script probe end-to-end trên **dev DB** (giống Phase 10): workspace thử bật 2 chương trình, tạo lớp TOEIC +
   học sinh, Unit/Test TOEIC có Part 1 (ảnh từng câu) + Part 5 + Part 7, nộp bài, kiểm điểm ước tính, kiểm
   Grading Queue/Overview lọc đúng. Kiểm toàn bộ checklist ở bước 2. Dọn sạch sau khi chạy.
2. Nhờ chủ dự án bật dev server → kiểm bằng trình duyệt: workspace 1 chương trình (không đổi gì), workspace 2
   chương trình (nút chuyển, các trang, builder, học sinh). Kiểm cả dark mode và màn hình điện thoại.
3. (Tuỳ chủ dự án) Thêm một lớp + đề TOEIC mẫu vào `scripts/seed-demo-workspace.js` để demo cho khách.

### Thứ tự deploy 8A

1. Merge PR `phase-8-toeic` → deploy. Nhờ `programFilter`, app chạy đúng cả khi live chưa backfill.
2. Chạy `scripts/backfill-program.js --live` (dry-run rồi `--apply`) — **chủ dự án duyệt trước**.
3. Admin bật TOEIC cho workspace cần dùng. Trước khi bật, mọi workspace vẫn y như cũ.

**Rollback:** tắt TOEIC ở workspace (ẩn ngay, không mất dữ liệu) → nếu cần thì revert PR. Field `program` có
default nên code cũ đọc dữ liệu mới không lỗi.

---

## 6. Rủi ro

| # | Rủi ro | Chặn bằng |
|---|---|---|
| R1 | Giao nhầm nội dung khác chương trình cho lớp | Sanitize theo `(level, program)` ở server (3.4.1), UI chỉ liệt kê lớp khớp |
| R2 | Doc cũ thiếu `program` biến mất khỏi bộ lọc IELTS | `programFilter` chịu được field thiếu + backfill |
| R3 | Giáo viên quên đang ở TOEIC, tưởng mất bài | Nút chuyển luôn thấy, tiêu đề trang có tên chương trình, trạng thái trống nói rõ đang lọc |
| R4 | Workspace IELTS-only bị đổi giao diện | Mọi UI mới gated bởi `isMulti`. So `outerHTML` topbar trước/sau. Dropdown IELTS trả đúng danh sách cũ |
| R5 | Học sinh hiểu điểm ước tính là điểm thật | Luôn ghi "estimated", ký hiệu "≈", chỉ hiển thị không lưu |
| R6 | Đổi chương trình làm rụng lớp/deadline | Hộp xác nhận nói rõ. Server chỉ gỡ phần không khớp, bài nộp cũ giữ nguyên |
| R7 | Prompt AI IELTS bị đổi chữ, chất lượng tụt | Nhánh `ielts` giữ nguyên từng chữ. So prompt trước/sau trong AI Log |
| R8 | Admin tắt chương trình đang có học sinh dùng | Tắt chỉ ẩn ở phía giáo viên, không xoá. Học sinh vẫn học. Hộp xác nhận đếm số lớp/bài |

---

## 7. Đợt 8B — TOEIC Speaking & Writing (plan sơ bộ, viết chi tiết sau khi 8A xong)

1. **Loại đề** — `PromptSchema` thêm `taskType` (thay dần `writingTask` cho chương trình mới):
   `toeic.w.picture | toeic.w.email | toeic.w.essay | toeic.s.read | toeic.s.picture | toeic.s.respond |
   toeic.s.info | toeic.s.opinion`. Đề IELTS giữ `writingTask` như cũ.
2. **Writing Q1–5:** đề có ảnh + 2 từ bắt buộc (`requiredWords: [String]`). Kiểm có dùng đủ 2 từ ngay trên
   client. Chấm 0–3.
3. **Speaking:** mỗi đề có `prepSeconds`, `responseSeconds`. Học sinh có đồng hồ chuẩn bị → tự ghi âm → tự
   dừng (sửa `components/student/PromptBlock.js`, hiện chưa có hẹn giờ). Đề thêm `audioId` (Q5–7 câu hỏi phát
   bằng audio) và ảnh/bảng thông tin (Q8–10).
4. **Rubric TOEIC** trong `lib/grading/rubrics.json` + `rubric.js` (thang 0–3 / 0–4 / 0–5 theo từng câu).
   `Submission.rubricVariant` thêm biến thể TOEIC. Quy về thang 0–200 = ước tính, chỉ hiển thị.
5. **Chấm AI:** prompt hệ thống riêng cho TOEIC trong `lib/grading/prompts/`, schema output riêng. Ghi AI Log và
   tính ngân sách AI như IELTS.
6. **Chữ "Band" → "Score"** cho TOEIC ở mọi chỗ (danh sách ở `app/student/tests/page.js:110,156`,
   `app/student/lessons/[unitId]/page.js:582,626`, `lib/student/dashboard.js`, leaderboard).
7. Mở `writing`/`speaking` trong `lessonSkills`/`testSkills` của TOEIC trong registry.

---

## 8. Để sau (không thuộc Phase 8)

- Cả bài Listening dùng một file audio liền, các section chỉ đánh dấu mốc thời gian.
- Đoạn văn Reading có định dạng (bảng, nhiều tài liệu tách khung) cho Part 7. V1 dùng ảnh.
- Template import Excel cho TOEIC.
- Dọn chữ Việt còn sót trong `READING_FORMATS`/`LISTENING_FORMATS` (UI chỉ dùng tiếng Anh).
- Môn khác ngoài tiếng Anh (`subject`).

---

## 9. Nhật ký thi hành

> Người thi hành ghi vào đây sau mỗi bước: đã làm gì, lệch gì so với plan, kiểm chứng bằng gì.

*(chưa có)*
