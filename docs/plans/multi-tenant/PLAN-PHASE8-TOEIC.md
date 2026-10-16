# PLAN — Phase 8: Chương trình TOEIC (taxonomy Program) + UX chuyển chương trình

> Tài liệu thi hành cho **Phase 8** của [PLAN-MULTI-TENANT.md](PLAN-MULTI-TENANT.md).
> File kia là bộ não (bối cảnh, tiến độ). File này là tay chân: làm gì, ở file nào, đổi thành gì.
>
> **Người thi hành đọc kỹ mục 0 và mục 2 trước khi gõ dòng code đầu tiên.**

Trạng thái: ☐ plan xong, chưa code · Ngày lập: 2026-10-08 · Sửa: 2026-10-16 (C4: bỏ nút bật chương trình) · Branch: `phase-8-toeic`
Tiền đề: Phase 1–7 + 10/10B đã merge vào `main`. `Workspace.programs` có sẵn trong schema (default `["ielts"]`,
chưa ai dùng) — **sau C4 không dùng field này nữa**, xem 2.1.

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

Workspace chỉ có nội dung IELTS (tức **mọi workspace hiện tại**, kể cả Ms Nhi và demo) phải thấy app **y hệt
hôm nay**: không nút chuyển, không nhãn, không đổi chữ, không đổi luồng. Mọi thứ của Phase 8 chỉ hiện khi
workspace **đang dùng ≥ 2 chương trình** (`isMulti`, suy ra từ dữ liệu — mục 3.5), hoặc khi đang mở một nội dung TOEIC.

**Ngoại lệ duy nhất (C4):** form tạo/sửa lớp luôn có ô **Program** (mặc định IELTS) — đây là cửa vào TOEIC.

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
- **C2 (sửa 2026-10-16).** UX: **không có màn chọn chương trình lúc đăng nhập, và không có nút chuyển chung trên
  thanh trên cùng.** Chương trình là **bộ lọc trong từng trang** (mục 4.1): Lessons chia nhóm IELTS/TOEIC; Classes,
  Mock Tests, Grading Queue, Students có chip `All · IELTS · TOEIC` (mặc định All, nằm trên URL `?program=`).
  Tất cả chỉ hiện khi workspace đang dùng ≥ 2 chương trình (`isMulti`, mục 3.5). Lý do: nút chuyển chung tạo
  "chế độ ẩn" — giáo viên quên đang ở TOEIC và tưởng mất bài; dữ liệu mỗi workspace ít nên chia nhóm + nhãn là đủ.
  Nút chuyển chung chỉ cân nhắc lại khi có nhiều giáo viên/1 workspace (Phase 9), và khi đó nên gắn theo tài khoản.
- **C3.** Level tính **riêng theo từng chương trình**: Level 1 IELTS và Level 1 TOEIC là hai nhóm khác nhau.
- **C4 (2026-10-16, thay D1).** **Không có nút "bật chương trình" cho workspace.** Giáo viên chọn Program ngay khi
  tạo/sửa lớp ở trang Classes (mặc định IELTS). Workspace có lớp TOEIC là đang dạy TOEIC. Danh sách chương trình
  của workspace được **suy ra từ dữ liệu** (mục 3.5), không lưu, không ai phải bật/tắt. Hệ quả:
  - `Workspace.programs` không dùng (để nguyên trong schema, không validate, không đọc).
  - Bỏ luật "program phải được workspace bật" (3.4.2) — chỉ cần `program ∈ PROGRAM_KEYS`.
  - Bỏ phần admin bật/tắt ở `/admin/workspaces` (4.5, bước 7) — chỉ còn cột hiển thị.
  - Đánh đổi: không còn chỗ chặn TOEIC theo gói tính tiền. Khi cần thì thêm lại một cờ ở Workspace sau.
- **C5 (2026-10-16, thay D3).** **Điểm quy đổi TOEIC chỉ tính cho Mock Test.** Listening/Reading: mỗi kỹ năng
  5–495, tổng **990**, hiện kèm số câu đúng: "38/50 correct · ≈ 385 / 495 (estimated)". Speaking/Writing (8B):
  mỗi kỹ năng 0–200, tổng **400**. Bài tập trong Lesson **chỉ** hiện "x/y correct", không quy đổi (6 câu quy ra
  thang 495 là sai lệch).
- **C6 (2026-10-16, = D4).** Lesson TOEIC đợt 8A có 4 tab: **Grammar, Vocabulary, Listening, Reading**. 8B mở thêm
  Writing, Speaking. Không dùng tạm rubric IELTS.
- **C7 (2026-10-16, thay D5).** **Chỉ cho đổi chương trình khi chưa có gì:**
  - **Lớp:** đổi được khi chưa có Unit/Test nào giao cho lớp (`classIds`, `deadlines`, `skillLocks` của mọi
    Unit/Test trong workspace không nhắc tới lớp).
  - **Unit/Test:** đổi được khi chưa giao cho lớp nào **và** chưa có bài nộp nào.
  - Không thoả → server trả **409** kèm lý do ("This class already has lessons or tests assigned…"). UI khoá ô
    Program kèm một dòng giải thích. Không có nhánh "đổi rồi gỡ phần không khớp" nữa (bỏ 3.4.5 cũ).
- **C8 (2026-10-16).** Thêm **dạng câu hỏi "Nghe và chọn đáp án — không in đề"** (mục 5.3a) cho Part 1/Part 2.
  Dùng được cho cả IELTS.
- **C9 (2026-10-16).** Đánh số câu: bài tập trong Lesson đánh lại từ 1; **Mock Test TOEIC đánh như đề thật**
  (Listening 1–100, Reading 101–200), có tiêu đề từng Part ("Part 1 — Photographs").
- **C10 (2026-10-16).** **Vocab Review** (`docs/plans/PLAN-UNIT-VOCAB-REVIEW.md`, nhánh `feature/vocab-review`)
  **áp dụng cho Lesson TOEIC**: prompt nhận `program`, TOEIC thì ngữ cảnh công sở/kinh doanh và mức "TOEIC 450–600"
  (bước 5.6).

### 2.2 Mặc định còn lại — người thi hành làm theo nếu không có chỉ đạo khác

| # | Câu hỏi | Mặc định | Lý do |
|---|---|---|---|
| ~~D1~~ | ~~Ai bật chương trình cho workspace?~~ | **Bỏ — thay bằng C4** | |
| ~~D2~~ | ~~Có chế độ "All" không?~~ | **Bỏ — thay bằng C2 mới** (chip lọc mặc định All) | |
| ~~D3~~ | ~~Điểm hiện thế nào?~~ | **Thay bằng C5** | |
| ~~D4~~ | ~~Tab Lesson TOEIC~~ | **= C6** | |
| ~~D5~~ | ~~Đổi chương trình?~~ | **Thay bằng C7** | |
| D6 | Tên lớp TOEIC | Không thêm field. Giáo viên tự đặt tên kiểu "TOEIC 450+", trang Lessons hiện tên lớp thay cho "1 class" | Không phình schema |
| D7 | Nguồn bảng quy đổi 5–495 | Người thi hành chọn **một** bảng tham khảo công khai, ghi URL trong `lib/curriculum/toeicScale.js`, báo chủ dự án trước khi merge | ETS không công bố bảng chính thức |

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
| `Workspace` | `programs` (đã có) | **Không dùng (C4).** Không validate, không đọc, không ghi. Chương trình của workspace suy ra từ dữ liệu (3.5) |
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
2. **Program phải hợp lệ.** `program ∉ PROGRAM_KEYS` → 400. Không kiểm "workspace có bật không" (C4).
   Unit/Test mới mà body không gửi `program` → mặc định `"ielts"` (giữ hành vi cũ cho client cũ).
3. **Học sinh: lọc thêm theo chương trình (phòng thủ nhiều lớp).** `pages/api/units.js`, `pages/api/tests.js`,
   `pages/api/student/dashboard.js` thêm `...programFilter(programOf(cls))` cạnh `level` + `classFilter`.
4. **Bài nộp mang chương trình của bài gốc.** Cả 4 chỗ `Submission.create` trong `pages/api/submissions.js` gán
   `program: programOf(unitOrTest)`. Không lấy từ client.
5. **Đổi chương trình chỉ khi chưa có gì (C7).** Helper `assertProgramChangeable(ws, kind, doc)` trong
   `lib/curriculum.js` (server):
   - Lớp: `Unit.exists` / `Test.exists` với `$or: [{ classIds: id }, { "deadlines.classId": id },
     { "skillLocks.classId": id }]` trong workspace → có thì 409.
   - Unit/Test: `classIds.length` hoặc `deadlines.length` hoặc `skillLocks.length` > 0, hoặc
     `Submission.exists({ unitId | testId })` → 409.
   - PUT có `program` mà **giá trị không đổi** thì bỏ qua kiểm tra (client gửi lại cả form khi Save).
   GET của lớp/Unit/Test trả thêm `programLocked: boolean` để UI khoá ô Program mà không phải đoán.

### 3.5 Chương trình đang dùng của workspace — suy ra, không lưu (C4)

```js
// lib/curriculum.js (server) — gọi trong pages/api/teacher/me.js
async function activePrograms(ws) {
  const seen = new Set();
  for (const M of [Class, Unit, Test]) {
    for (const p of await M.distinct("program", tenantFilter(ws))) seen.add(p || DEFAULT_PROGRAM);
  }
  // Workspace mới tinh chưa có gì → coi như IELTS.
  return PROGRAM_KEYS.filter((k) => seen.has(k)).concat(seen.size ? [] : [DEFAULT_PROGRAM]);
}
```

- Tính từ **Lớp + Unit + Test** (không chỉ Lớp): lớp TOEIC cuối cùng bị xoá nhưng còn bài TOEIC thì giáo viên vẫn
  thấy nhóm/chip TOEIC để tìm lại bài.
- `distinct` trên index `{ workspaceId, program, … }` (3.2) nên rẻ. `null`/thiếu field tính là IELTS.
- `isMulti = activePrograms.length >= 2`. Client lấy qua hook `usePrograms()` (`lib/client/program.js`, đọc
  `/api/teacher/me`, có `refresh()`). Trang Classes gọi `refresh()` sau khi tạo/sửa lớp, nên lớp TOEIC đầu tiên vừa
  lưu là nhóm/chip TOEIC hiện luôn. Không có context/state chương trình toàn cục (C2).

---

## 4. UX

### 4.1 Lọc theo chương trình trong từng trang (C2) — chỉ khi `isMulti`

Không có nút chuyển chung, không lưu "chương trình đang chọn" ở đâu cả. Mỗi trang tự lọc, bộ lọc nằm trên URL
(`?program=ielts|toeic`, không có = All) nên reload/chia sẻ link giữ đúng, sang trang khác thì không "dính" theo.
Component chung `components/teacher/ProgramChips.js`: `All · IELTS · TOEIC`, đổi chip = `router.replace` cập nhật
`?program=`. Workspace chỉ 1 chương trình (`isMulti=false`) → **không render gì**, các trang y như hôm nay.

### 4.2 Từng trang

| Trang | Khi `isMulti` |
|---|---|
| Lessons (`/teacher/lessons`) | **Không có chip.** Chia **2 nhóm có tiêu đề** "IELTS" và "TOEIC", mỗi nhóm là danh sách Level như hôm nay. Nút "New unit" nằm **trong từng nhóm** → Unit mới mang chương trình của nhóm đó. Dòng mô tả của nhóm liệt kê kỹ năng theo registry |
| Lessons → 1 Level (`?level=`) | URL thêm `&program=` (Level 1 IELTS ≠ Level 1 TOEIC — C3). Tiêu đề "TOEIC · Level 1" |
| Classes | Chip lọc phía trên danh sách. Mỗi lớp có nhãn chương trình. Form tạo lớp: 4.3 |
| Mock Tests | Chip lọc. Mỗi đề có nhãn. Lọc level/lớp chỉ liệt kê lớp của chương trình đang lọc (All → mọi lớp) |
| Students | Chip lọc (học sinh thuộc lớp của chương trình đó; học sinh chưa xếp lớp luôn hiện). Mỗi dòng có nhãn theo lớp |
| Grading Queue, Submissions | Chip lọc, server lọc bằng `Submission.program` (`?program=`). Mỗi dòng có nhãn |
| Overview | **Không lọc.** Gộp như hôm nay, mỗi lớp có nhãn chương trình |
| Số đếm trên sidebar (`shellBadges`) | Không đổi (tổng) |
| Audio / Image Library | Không lọc — media dùng chung |

**Trạng thái trống khi đang lọc** nói rõ lý do: "No TOEIC classes yet." kèm link "Show all".

**Nhãn chương trình** (component mới `components/ProgramBadge.js`): pill nhỏ, IELTS dùng màu brand hiện tại,
TOEIC dùng một màu phụ cố định. Hai màu là token CSS mới trong `styles/legacy.css` và có bản dark mode. **Chỉ
render khi `isMulti`.**

### 4.3 Tạo và sửa nội dung

- **New class / Sửa lớp (C4 — cửa vào TOEIC):** form **luôn** có ô Program, kể cả workspace chỉ có IELTS:
  ```
  Name     [ TOEIC 450+ — Sat/Sun ]
  Program  (•) IELTS   ( ) TOEIC
  Level    [ 1 ]
  ```
  Mặc định = chip đang lọc trên trang Classes (`?program=`), không có thì IELTS. Lưu xong gọi `usePrograms().refresh()`
  → lớp TOEIC đầu tiên làm nhóm/chip TOEIC hiện ngay. **Sửa lớp:** ô Program **bị khoá** khi `programLocked` (C7),
  kèm dòng "This class already has lessons or tests assigned, so its program can't be changed."
- **New unit:** tạo từ nút "New unit" trong nhóm IELTS/TOEIC của trang Lessons → mang chương trình của nhóm.
  **New test:** chương trình = chip đang lọc; đang ở All mà `isMulti` → form có ô chọn bắt buộc. Workspace chỉ có
  IELTS → không có ô nào, bài mới là IELTS.
- **Unit editor** (`app/teacher/lessons/[unitId]/page.js`): tab kỹ năng = `PROGRAMS[program].lessonSkills`. Phần
  meta hiện chương trình (chỉ khi `isMulti`); đổi được khi `!programLocked` (C7), khoá thì ghi lý do.
  Ô chọn lớp/deadline/skill-lock chỉ liệt kê lớp cùng `(level, program)`.
- **Test builder** (`app/teacher/tests/[testId]/page.js`): tab = `testSkills`, thời lượng mặc định lấy từ
  `defaultDurations` khi tạo mới. Ô chọn lớp chỉ hiện lớp cùng chương trình và cùng level.
- **Dropdown dạng câu hỏi** đổi theo chương trình (mục 5.3).
- **Tạo bằng AI** (grammar/vocab) và **Import Excel**: xem bước 5.6.

### 4.4 Học sinh

- **Không có bộ lọc.** Chương trình = chương trình của lớp mình.
- Tab trong Unit và ô kỹ năng trong Mock Test theo registry. Học sinh TOEIC ở 8A **không thấy** Writing/Speaking.
  Server (`pages/api/units.js` `toPublicUnit`) **không gửi** category ngoài `lessonSkills` (không chỉ ẩn ở client).
- Điểm (C5): **Mock Test** TOEIC Listening/Reading hiện "38/50 correct · ≈ 385 / 495 (estimated)", đủ cả hai kỹ
  năng của một đề thì thêm tổng "≈ 785 / 990". **Bài tập Lesson** chỉ hiện "x/y correct".
- Đánh số (C9): bài tập Lesson đánh từ 1; Mock Test TOEIC đánh 1–100 (Listening), 101–200 (Reading), mỗi nhóm câu
  có tiêu đề Part lấy từ `formatLabel` của câu đầu nhóm ("Part 1 — Photographs").
- Câu dạng "chọn đáp án không in đề" (C8, mục 5.3a): chỉ có số câu + hàng nút chữ cái, Part 1 có ảnh phía trên.
- Thanh kỹ năng trên Dashboard (`app/student/page.js:180`): TOEIC chỉ hiện %, không hiện "Band".
- Vocab Review (C10) có ở tab Listening/Reading của Lesson TOEIC như IELTS.

### 4.5 Admin nền tảng

Sau C4 không còn bật/tắt chương trình, admin chỉ **xem**:
- `/admin/workspaces`: cột "Programs" = `activePrograms` (3.5), chỉ đọc.
- `/admin/classes`: thêm cột chương trình.
- Workspace Settings của giáo viên: không đổi gì.

---

## 5. Các bước thi hành — Đợt 8A

Mỗi bước là một commit. Sau mỗi bước: `next build` sạch. Workspace IELTS-only không đổi gì (bất biến 0.2).
**Chỉ chạy `next build` khi dev server đã tắt** — build ghi đè `.next` của dev server đang chạy và làm nó trả 404
cho mọi chunk JS (đã gặp 2026-10-15; phải xoá `.next` rồi chạy lại dev). Dev server đang chạy thì kiểm bằng
`curl` + trình duyệt thay cho build.
**Không tự chạy/tắt dev server** — chủ dự án tự chạy `:3000`. Kiểm bằng build, script
probe gọi handler thật trên **dev DB**, và trình duyệt khi chủ dự án đã bật server.

### Bước 1 — Registry + schema + backfill (không đổi hành vi)

1. Tạo `lib/curriculum.js` (mục 3.1) + `programFilter`, `programOf`, `isProgram`.
2. Thêm `program` vào `Class`, `Unit`, `Test`, `Submission`. Thêm `imageId` vào `FieldSchema`. Thêm index (3.2).
   **Không** đụng `Workspace.programs` (C4).
3. `scripts/backfill-program.js` (3.3). Chạy dry-run và `--apply` **trên dev**.
4. `activePrograms(ws)` (3.5). `pages/api/teacher/me.js` trả thêm `programs: await activePrograms(req.ws)`.

Kiểm: build sạch. Đếm doc thiếu `program` trên dev = 0. App không đổi gì.

### Bước 2 — Server enforce

1. `pages/api/admin/classes.js`: POST nhận `program` (mặc định `"ielts"`, phải ∈ `PROGRAM_KEYS` — C4).
   PUT đổi `program` chỉ khi `assertProgramChangeable` qua (C7, 3.4.5), không thì 409. GET trả `program` +
   `programLocked`.
2. `pages/api/admin/units.js`, `pages/api/admin/tests.js`: POST nhận `program` (mặc định `"ielts"`). PUT đổi
   `program` chỉ khi `assertProgramChangeable` qua (C7), không thì 409 — **không** có nhánh "đổi rồi gỡ".
   Sanitize lớp/deadline/skill-lock theo `(level, program)`. GET trả `program` + `programLocked`.
3. `pages/api/units.js`, `pages/api/tests.js`, `pages/api/student/dashboard.js`: thêm `programFilter` (3.4.3).
4. `pages/api/submissions.js`: 4 chỗ `Submission.create` gán `program` (3.4.4).
5. `pages/api/admin/grading-queue.js`, `pages/api/admin/submissions.js`, `pages/api/admin/dashboard.js`
   (+ `lib/teacher/dashboard.js`), `pages/api/admin/students.js`: nhận `?program=` (bỏ trống/`all` = không lọc),
   lọc bằng `programFilter`. Students: lọc theo `classId ∈` lớp của chương trình, cộng học sinh chưa xếp lớp.
6. `pages/api/sysadmin/workspaces.js`: GET trả thêm `programs` = `activePrograms` (chỉ đọc, C4).
7. Chạy `scripts/check-tenant-scope.js`, phải vẫn qua. Không thêm route mới.

Kiểm (script probe trên dev DB, gọi handler thật như Phase 10 đã làm):
- Tạo lớp TOEIC L1 + Unit IELTS L1. Giao Unit IELTS cho lớp TOEIC → `classIds` bị gỡ.
- Lớp chưa được giao gì → đổi IELTS ↔ TOEIC được. Giao 1 Unit cho lớp → đổi → 409. Unit đã có bài nộp → đổi → 409.
  PUT gửi lại đúng `program` cũ (Save cả form) → không 409.
- Học sinh lớp TOEIC không lấy được Unit/Test IELTS, kể cả gọi thẳng `?id=`.
- Tạo lớp với `program: "abc"` → 400. Tạo lớp không gửi `program` → lớp IELTS.
- Workspace chỉ có IELTS: `/api/teacher/me` trả `programs: ["ielts"]`. Tạo 1 lớp TOEIC → trả `["ielts","toeic"]`.
  Xoá lớp đó (không còn bài TOEIC) → lại `["ielts"]`.
- Bài nộp mới có đúng `program`. Grading Queue `?program=toeic` chỉ ra bài TOEIC.
- Doc cũ thiếu `program` vẫn hiện đúng ở bộ lọc IELTS (`programFilter`).

### Bước 3 — Khung UX: usePrograms + chip lọc + nhãn + ô Program của lớp

1. `lib/client/program.js`: hook `usePrograms()` → `{ programs, isMulti, refresh }` (đọc `/api/teacher/me`). Không
   context toàn cục, không `localStorage` (C2).
2. `components/teacher/ProgramChips.js` (4.1): đọc/ghi `?program=` bằng `useSearchParams` + `router.replace`.
   Không render khi `!isMulti`. Class CSS mới trong `styles/legacy.css`, dùng token theme Phase 6.
3. `components/ProgramBadge.js` + token màu (IELTS = brand, TOEIC = màu phụ cố định, có dark mode). Chỉ render khi
   `isMulti`.
4. **Ô Program trong form tạo/sửa lớp** (`app/teacher/classes/page.js`, `app/teacher/classes/[classId]/page.js`) —
   cửa vào TOEIC (C4), luôn hiện. Khoá khi `programLocked` (C7). Lưu xong `refresh()`.
5. `lib/client/api.js`: truyền `program` khi lấy danh sách. `shellBadges` **không đổi**.

Kiểm: workspace thử (dev DB) chưa có TOEIC → không chip/nhãn nào, chỉ có ô Program ở form lớp. Tạo 1 lớp TOEIC →
chip + nhãn hiện ngay không cần reload. Workspace Ms Nhi → thanh trên cùng và các trang **giống hệt** trước.

### Bước 4 — Các trang giáo viên lọc theo chương trình (bảng 4.2)

`app/teacher/{overview,lessons,tests,classes,students,grading,submissions}/page.js`.
- `lessons/page.js`: khi `isMulti`, chia **2 nhóm** IELTS/TOEIC (không chip); `levels` (dòng ~46) tính riêng từng
  nhóm từ lớp + unit cùng chương trình. "New unit" trong từng nhóm. "1 class" → tên lớp khi có đúng 1 lớp (D6).
  Mô tả nhóm lấy từ `lessonSkills`. Thêm `program` vào query `?level=`.
- `classes`, `tests`, `students`, `grading`, `submissions`: `ProgramChips` + nhãn từng dòng. `tests/page.js`: bộ lọc
  level/lớp (dòng ~29–60) chỉ dùng lớp của chương trình đang lọc.
- `overview`: chỉ thêm nhãn chương trình cho từng lớp, không lọc.
- Trạng thái trống khi đang lọc nói rõ lý do + link "Show all" (4.2).

### Bước 5 — Builder: Unit editor, Test builder, dạng câu hỏi TOEIC, ảnh riêng cho từng câu

**5.1 Unit editor** (`app/teacher/lessons/[unitId]/page.js`): tab theo `lessonSkills`. Ô chương trình khoá theo
`programLocked` (C7). Ô chọn lớp/deadline/skill-lock chỉ liệt kê lớp cùng `(level, program)`. Unit chưa giao lớp,
chưa có bài nộp mà đổi IELTS → TOEIC khi còn nội dung Writing/Speaking: nội dung **giữ nguyên trong DB**, chỉ ẩn;
hiện cảnh báo nhỏ "Writing/Speaking content is hidden for TOEIC".

**5.1b Kỹ năng bị ẩn không được tính** — `lib/completion.js` (`countCategoryItems`, `countUnitItems`,
`isScopeComplete`) chỉ đếm category thuộc `PROGRAMS[programOf(unit)].lessonSkills`. Hàm này dùng ở nhắc hạn
(`lib/notifications/generate.js`), streak (`lib/student/streak.js`), bài về nhà khi điểm danh
(`lib/attendanceHomework.js`), dashboard giáo viên (`lib/teacher/dashboard.js`). Không lọc thì học sinh TOEIC
không bao giờ "xong" Unit còn nội dung Writing ẩn → bị nhắc mãi, đứt streak. Hạn nộp/skill-lock của kỹ năng bị
ẩn cũng bỏ qua khi nhắc hạn.

**5.2 Test builder** (`lib/teacher/testBuilder.js`, `app/teacher/tests/[testId]/page.js`):
`emptyBuilder(program)` dùng `defaultDurations`. Tab = `TEST_SKILLS` lọc theo `testSkills`. Payload các kỹ năng
bị ẩn để rỗng như hôm nay đang làm với đề "1 to 4 skills".

**5.3 Dạng câu hỏi TOEIC** (`lib/teacher/questionFormats.js`): `questionFormatsFor(subject, program)`.
Program `ielts` (hoặc không truyền) trả **đúng danh sách cũ**. Thêm cờ mới `letterOptions: n` (tự tạo n lựa chọn
nhãn "A".."D", không có chữ) và `needsFieldImage: true` (cuộn tới ô ảnh của câu).

| key | Nhãn | kind | Cờ |
|---|---|---|---|
| `tl-p1` | Part 1 — Photographs | `letter` (5.3a) | 4 lựa chọn, `needsFieldImage` |
| `tl-p2` | Part 2 — Question–Response | `letter` (5.3a) | 3 lựa chọn |
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

**5.3a Dạng câu hỏi mới "Listen and choose — no printed question" (C8)** — kind `letter` trong
`questionFormats.js`, có trong danh sách của **cả IELTS lẫn TOEIC** (IELTS thêm vào **cuối** danh sách để không
xê dịch các dạng cũ):

- **Không đổi schema chấm điểm.** Lưu như câu `choice` thường: `type: "choice"`, `label: ""`, `options` tự sinh
  `[{value:"A",label:"A"}, …]` (3 hoặc 4), `answers: ["B"]`, `formatLabel` = tên dạng. Server đã cho lưu câu
  `choice` có đề trống (`lib/testSections.js:141` chỉ đòi có options) — kiểm lại khi code.
- **Builder** (`components/teacher/SectionsEditor.js`): chọn dạng này thì dòng câu hỏi chỉ còn số câu + nút chọn
  đáp án đúng A/B/C(/D) + (Part 1) ô ảnh của câu. Không có ô đề, không có ô nhập lựa chọn. Nút "+ Add 5 questions".
  ```
  Part 2 — Question–Response        Audio: [ part2.mp3 ▾ ]
   7.  Correct answer:  (A) (•B) (C)
   8.  Correct answer:  (•A) (B) (C)
   [+ Add question]  [+ Add 5 questions]
  ```
- **Học sinh** (`components/student/questions.js`): nhận diện bằng "`choice` + `label` rỗng + mọi option là một
  chữ cái" (hoặc `formatLabel` thuộc dạng này) → render số câu + **hàng nút chữ cái to** (dễ bấm trên điện thoại),
  ảnh câu (nếu có) phía trên. Xem lại sau khi nộp: ô đúng xanh, sai đỏ kèm đáp án đúng, như các dạng khác.
  ```
   7.  [ A ]  [ B ]  [ C ]
  ```
- Transcript (nếu có, field `transcript` của section từ Vocab Review) hiện ở chế độ xem lại để học sinh biết vì
  sao đúng/sai.

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
- **Vocab Review (C10)** — `lib/ai/vocabReview.js` + `pages/api/admin/ai-vocab-review.js` (có sau khi merge
  `feature/vocab-review`): nhận `program` theo cùng quy tắc trên (SYSTEM "experienced TOEIC teacher", ưu tiên từ
  vựng công sở/kinh doanh, mức "TOEIC 450–600"). Nhánh IELTS giữ nguyên từng chữ. **Phase 8 merge sau
  `feature/vocab-review`** — nếu chưa merge thì bỏ qua mục này và ghi vào Nhật ký.
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
   - **Chỉ cho Mock Test (C5).** Hiện ở: hộp kết quả sau khi nộp Mock Test, danh sách Mock Tests của học sinh,
     trang bài nộp Mock Test của giáo viên. Luôn kèm chữ "estimated". Có đủ L+R của cùng một đề → hiện thêm tổng
     "≈ 785 / 990". **Bài tập Lesson không quy đổi**, chỉ "x/y correct".
   - Đánh số Mock Test TOEIC 1–100 / 101–200 + tiêu đề Part (C9): builder gợi ý `id` bắt đầu từ 101 cho Reading;
     player nhóm câu liên tiếp cùng `formatLabel` dưới một tiêu đề Part.
4. `app/student/page.js` + `lib/student/dashboard.js`: thanh kỹ năng TOEIC chỉ hiện %.
5. Chữ "Band" chỉ xuất hiện ở Writing/Speaking. 8A không mở hai kỹ năng này cho TOEIC nên không cần đổi. 8B
   sẽ xử lý.

### Bước 7 — Admin nền tảng

`app/admin/workspaces/page.js` (cột Programs = `activePrograms`, chỉ đọc), `app/admin/classes` (cột program).
Không có nút bật/tắt (C4).

### Bước 8 — Kiểm thử tổng + dữ liệu demo

1. Script probe end-to-end trên **dev DB** (giống Phase 10): workspace thử, tạo lớp TOEIC (→ thành 2 chương trình) +
   học sinh, Unit/Test TOEIC có Part 1 (ảnh từng câu) + Part 5 + Part 7, nộp bài, kiểm điểm ước tính, kiểm
   Grading Queue/Overview lọc đúng. Kiểm toàn bộ checklist ở bước 2. Dọn sạch sau khi chạy.
2. Nhờ chủ dự án bật dev server → kiểm bằng trình duyệt: workspace 1 chương trình (không đổi gì), workspace 2
   chương trình (chip lọc, nhóm Lessons, ô Program của lớp, builder, học sinh). Kiểm cả dark mode và điện thoại.
3. (Tuỳ chủ dự án) Thêm một lớp + đề TOEIC mẫu vào `scripts/seed-demo-workspace.js` để demo cho khách.

### Thứ tự deploy 8A

1. Merge PR `phase-8-toeic` → deploy. Nhờ `programFilter`, app chạy đúng cả khi live chưa backfill.
2. Chạy `scripts/backfill-program.js --live` (dry-run rồi `--apply`) — **chủ dự án duyệt trước**.
3. Không cần bật gì (C4). Workspace nào muốn dạy TOEIC thì giáo viên tạo lớp TOEIC. Chưa tạo thì app y như cũ,
   chỉ thêm ô Program trong form lớp.

**Rollback:** revert PR. Field `program` có default nên code cũ đọc dữ liệu mới không lỗi; lớp/bài TOEIC đã tạo
lúc đó sẽ hiện như IELTS (code cũ không biết `program`) — báo giáo viên tạm ngừng dùng cho đến khi deploy lại.

---

## 6. Rủi ro

| # | Rủi ro | Chặn bằng |
|---|---|---|
| R1 | Giao nhầm nội dung khác chương trình cho lớp | Sanitize theo `(level, program)` ở server (3.4.1), UI chỉ liệt kê lớp khớp |
| R2 | Doc cũ thiếu `program` biến mất khỏi bộ lọc IELTS | `programFilter` chịu được field thiếu + backfill |
| R3 | Giáo viên quên đang ở TOEIC, tưởng mất bài | Nút chuyển luôn thấy, tiêu đề trang có tên chương trình, trạng thái trống nói rõ đang lọc |
| R4 | Workspace IELTS-only bị đổi giao diện | Mọi UI mới gated bởi `isMulti`, trừ ô Program trong form lớp (C4, chủ dự án chấp nhận). So `outerHTML` topbar trước/sau. Dropdown IELTS trả đúng danh sách cũ |
| R5 | Học sinh hiểu điểm ước tính là điểm thật | Luôn ghi "estimated", ký hiệu "≈", chỉ hiển thị không lưu |
| R6 | Đổi chương trình làm rụng lớp/deadline | Hộp xác nhận nói rõ. Server chỉ gỡ phần không khớp, bài nộp cũ giữ nguyên |
| R7 | Prompt AI IELTS bị đổi chữ, chất lượng tụt | Nhánh `ielts` giữ nguyên từng chữ. So prompt trước/sau trong AI Log |
| R8 | Giáo viên lỡ chọn TOEIC khi tạo lớp IELTS | Mặc định IELTS. Lớp chưa được giao bài thì đổi lại được (C7) |
| R9 | Học sinh TOEIC bị nhắc hạn mãi vì Unit còn nội dung kỹ năng bị ẩn | `lib/completion.js` chỉ đếm `lessonSkills` (5.1b) |

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
