# PLAN — Phase 12 · G2: Đề thi theo khuôn

> Tài liệu thi hành cho đợt **G2** của [PLAN-PHASE12-GENERAL-ENGLISH.md](PLAN-PHASE12-GENERAL-ENGLISH.md) (mục 1.3,
> 1.4, 4.4, 5-G2). Chia việc + prompt Antigravity: [PLAN-PHASE12-G2-PROMPTS.md](PLAN-PHASE12-G2-PROMPTS.md).
>
> **Người thi hành đọc kỹ mục 0 và mục 2 trước khi gõ dòng code đầu tiên.**

Trạng thái: ☐ chưa code · Ngày lập: 2026-10-29
Tiền đề: G3 xong (bước 1–5) trên `phase-12-general-g3`. Branch `phase-12-general-g2` cắt từ `phase-12-general-g3`
(cùng sửa builder, cắt từ G3 để khỏi xung đột). Xong G2 → PR vào nhánh gom `phase-12-general-g0` (cách gộp nhánh: mục 5
plan tổng). Kiểm bằng đề thật dồn vào đợt kiểm tổng cuối Phase 12.

---

## 0. Luật chơi

### 0.1 G2 làm gì

1. **Tạo đề từ khuôn.** Giáo viên General bấm **"New test from template"**, chọn khuôn (Tốt nghiệp THPT, Vào 10
   TP.HCM, Kiểm tra trên lớp), chỉnh số câu từng phần nếu muốn → builder dựng sẵn các phần của tờ đề ("Written
   paper"), đúng tên phần, đúng dạng câu, câu đánh số **1–40 liền**, giờ làm bài theo khuôn. Giáo viên chỉ điền nội
   dung.
2. **Không cho xuất bản đề còn dở.** Câu chưa có đáp án / lựa chọn còn trống / đoạn văn còn chữ giữ chỗ → chặn
   "Save & Publish" (ở client **và** server), báo câu nào, nhảy tới câu đó. "Save" nháp vẫn được.
3. **Học sinh thấy tiêu đề phần kèm dải câu** ("Part 1 — Phonetics · Questions 1–4") khi làm bài và khi xem kết quả.
4. **Kết quả theo từng phần**: học sinh và giáo viên thấy điểm thang 10 + bảng đúng/sai theo từng phần của đề.
5. **Sửa 2 lỗi có sẵn** tìm được khi lập plan (mục 2.6): trung tâm chỉ dạy General tạo Unit/đề bị thành IELTS; màn kết
   quả Mock Test hiện nguyên `__gạch chân__`.

### 0.2 Bất biến

1. **IELTS và TOEIC không đổi.** Không thêm `=== "general"`; mọi nhánh mới đọc registry (`lib/curriculum.js`).
   `tests/aiPromptPin.test.js`, `tests/ieltsAiRequestPin.test.js`, `tests/programBranches.test.js` xanh không
   UPDATE_PIN. Payload lưu Unit/Test của IELTS giữ y nguyên (không thêm key mới khi là IELTS).
2. **Khuôn là dữ liệu trong code** (không bảng DB). Đề đã tạo không đổi khi khuôn đổi.
3. **Không nới luật validate cũ.** Đề nháp từ khuôn phải lưu được bằng chính luật hiện có (xem 2.3, chữ giữ chỗ).
4. Điểm thang 10 chỉ hiển thị, không lưu DB (như G0).
5. Mobile 375px không tràn ngang.

### 0.3 G2 KHÔNG làm

- Khuôn **vào 10 Hà Nội** — chờ giáo viên Hà Nội xác nhận khuôn 2026 (Q5 plan tổng). Khi có, chỉ thêm 1 mục dữ liệu.
- Ma trận đề / bốc câu từ ngân hàng / nhiều mã đề / in đề (G4). Writing đoạn văn, Speaking (G5).
- Trộn thứ tự câu, chấm điểm lệch trọng số giữa các phần (mọi câu 1 điểm như nhau → thang 10 đúng với đề 0,25đ/câu).

---

## 1. Quyết định đã chốt (đề xuất của Claude Code — đổi được trước khi code)

| # | Câu hỏi | Chốt |
|---|---|---|
| D1 | Khuôn nào | **THPT** (khuôn 2025, Bộ GD&ĐT), **Vào 10 TP.HCM** (đề minh hoạ 2026 của Sở), **School test** (giữa kỳ/cuối kỳ, số câu tuỳ chỉnh). Hà Nội để sau (0.3). |
| D2 | Bộ khung dựng ở đâu | **Chỉ ở client** (state của builder), chưa lưu gì cho tới khi giáo viên bấm Save. Không tạo đề rỗng trên server. |
| D3 | Lưu nháp khi chưa điền xong | Đoạn văn của phần cần đoạn văn được điền sẵn chữ giữ chỗ cố định `PASSAGE_PLACEHOLDER` = "Paste the passage here." → luật "Reading section cần passage" hiện có vẫn qua, lưu nháp được. Không đổi luật server. |
| D4 | Chặn xuất bản đề dở | Hàm thuần `incompleteQuestions(skills)` dùng chung client + server. Server chỉ áp khi chuyển `status` sang `published` **và** registry `publishCheck: true` (chỉ General). IELTS/TOEIC xuất bản như cũ. |
| D5 | Đánh số | Khuôn đánh 1..N liền qua mọi phần. Thêm câu sau đó tiếp số như hiện nay (`nextFieldId`). Không tự đánh số lại khi xoá câu (giữ hành vi builder hiện có). |
| D6 | Số câu từng phần | Hộp chọn khuôn cho sửa số câu từng phần (0 = bỏ phần đó; trần 60/phần, tổng ≤ 100). Mặc định = đúng khuôn. |
| D7 | Có lưu khuôn đã dùng không | **Có**: `Test.templateKey` (chuỗi, mặc định ""), chỉ gửi khi tạo từ khuôn. Để G4 thống kê; không dùng để lọc quyền. |
| D8 | Thời lượng | Lấy từ khuôn (THPT 50', vào 10 HCM 90', School test 45' + Listening 15' nếu có), sửa được như ô hiện có. |
| D9 | Lựa chọn trống sẵn | Câu chọn đáp án được tạo sẵn 4 ô A–D trống (trừ dạng có lựa chọn cố định: True/False, [I]–[IV]; dạng Arrange dùng nút "Generate options"; Error identification dùng "Build options from underlines"). |
| D10 | Tiêu đề phần cho học sinh | Tên section + dải câu tính tự động "Questions 1–4" (không lưu vào tên). Bật bằng registry `sectionRanges: true` (chỉ General). |

---

## 2. Thiết kế

### 2.1 Registry (`lib/curriculum.js`)

Thêm cho cả 3 chương trình (IELTS/TOEIC = `false` / `[]`, General như dưới):

```js
testTemplates: ["thpt", "hcm10", "school"], // khuôn đề có thể chọn; [] = không có nút
publishCheck: true,                          // chặn xuất bản đề còn câu dở (D4)
sectionRanges: true,                         // hiện "Questions a–b" cạnh tên phần (D10)
partResults: true,                           // bảng kết quả theo từng phần (mục 2.5)
```

### 2.2 Dữ liệu khuôn — `lib/generalTemplates.js` (CommonJS, không React, không DB)

```js
const PASSAGE_PLACEHOLDER = "Paste the passage here.";
const TEMPLATES = {
  thpt: {
    key: "thpt",
    label: "THPT graduation exam",
    note: "40 questions · 50 minutes · format used since 2025 (Bộ GD&ĐT)",
    source: "Bộ GD&ĐT — đề tham khảo 2025, giữ khuôn năm 2026",
    defaultGrade: 12,
    skills: {
      reading: {
        durationMinutes: 50,
        parts: [
          { name: "Part 1 — Notice", questions: [{ format: "g-cloze", count: 6 }], passage: true,
            instruction: "Read the following advertisement/announcement and choose the option that best fits each of the numbered blanks." },
          ...
        ],
      },
    },
  },
  hcm10: { ... }, school: { ... },
};
```

Mỗi phần có:

- `name` → thành `section.name` (vd "Part 1 — Notice"), là thứ học sinh thấy;
- `instruction` → dòng hướng dẫn tiếng Anh như đề thật. **Không** lưu vào đề (không đổi schema Section): chỉ hiện cho
  giáo viên trong hộp chọn khuôn để họ biết phần đó ra kiểu gì;
- `questions: [{ format, count }]` → một phần có thể trộn dạng (vd Phonetics = 2 phát âm + 2 trọng âm);
- `passage: true` → phần có đoạn văn, tạo `passageText` giữ chỗ (chỉ khi skill là reading).

**Bảng khuôn (số câu mặc định):**

| Khuôn | Skill | Phần (format × số câu) | Đoạn văn | Thời lượng |
|---|---|---|---|---|
| `thpt` | reading | 1 Notice (g-cloze × 6) · 2 Leaflet (g-cloze × 6) · 3 Arrangement (g-arrange × 5) · 4 Sentence/phrase completion (g-cloze × 5) · 5 Reading 1 (g-mcq × 8) · 6 Reading 2 (g-mcq × 10) | 1, 2, 4, 5, 6 | 50 |
| `hcm10` | reading | 1 Phonetics (g-pron × 2, g-stress × 2) · 2 Vocabulary, grammar & communication (g-mcq × 12) · 3 Cloze (g-cloze × 6) · 4 Reading (g-mcq × 6) · 5 Word form (g-wform × 6) · 6 Guided phrases (g-phrase × 2) · 7 Sentence writing (g-rewrite × 4) | 3, 4, 6 | 90 |
| `school` | listening (tuỳ chọn) | 1 Listening A (g-mcq × 5) · 2 Listening B (g-tf × 5) | — | 15 |
| `school` | reading | 1 Phonetics (g-pron × 2, g-stress × 2) · 2 Vocabulary & Grammar (g-mcq × 8) · 3 Cloze (g-cloze × 5) · 4 Reading comprehension (g-tf × 5) · 5 Writing (g-reorder × 3, g-rewrite × 3) | 3, 4 | 45 |

Ghi `source` + năm cho từng khuôn ngay trong file (R6 plan tổng). Đề HCM 2026: phần 6 "viết cụm từ theo thông tin cho
sẵn" dùng `g-phrase`.

**Hàm thuần trong file:**

- `templatesFor(program)` → danh sách khuôn theo `PROGRAMS[program].testTemplates`.
- `resolveTemplate(key, { counts, includeListening })` → khuôn sau khi áp số câu giáo viên sửa (validate: số nguyên
  0–60, tổng ≤ 100, ≥ 1 câu; phần 0 câu bị bỏ). Trả `{ template, error }`.
- `incompleteQuestions(skills)` → `[{ skill, fieldId, reason }]` theo thứ tự câu. "Dở" khi:
  - section reading có `passageText` trim === `PASSAGE_PLACEHOLDER`, hoặc rỗng mà section đó có câu `g-cloze`/đoạn văn
    → reason "The passage is still empty" (gắn vào câu đầu của section);
  - câu chọn đáp án: có lựa chọn label rỗng, hoặc không có đáp án đúng;
  - câu điền / viết / sắp xếp: không có đáp án; sắp xếp < 2 mảnh;
  - câu cần đề (mọi dạng trừ `g-pron`, `g-stress`, `g-cloze`) mà label rỗng.
  Nhận **shape server** (đúng thứ server lưu) — client gọi sau `builderToPayload`.

### 2.3 Dựng khung trong builder — `lib/teacher/templateSkeleton.js` (ESM, client)

- Tách logic "thêm câu theo dạng" đang nằm trong `SectionsEditor` (`addQuestionWithFormat` / `changeFormat`) thành hàm
  thuần **`applyFormat(field, fmt)`** trong `lib/teacher/sectionTransforms.js`; `SectionsEditor` gọi lại hàm này (hành
  vi y nguyên). `GENERAL_ALL_FORMATS` được export từ `lib/teacher/questionFormats.js`.
- `buildSkeleton(resolvedTemplate)` → `{ skills: { listening?, reading }, durations }` với sections **shape editor**:
  - mỗi phần 1 section: `name`, `passageText` = `PASSAGE_PLACEHOLDER` nếu `passage` và skill reading;
  - câu: `emptyField(id)` + `applyFormat(field, fmt)`; id chạy 1..N liền qua mọi section của skill;
  - câu chọn đáp án (kind `mcq`, không presetOptions, không `arrange`, không `errorLetters`): 4 option trống (D9).
- Builder (`app/teacher/tests/[testId]/page.js`): khi `isNew` và chương trình có `testTemplates.length`, hiện khối
  **"Start from a template"** phía trên (hoặc mở sẵn khi URL có `?template=1`): chọn khuôn → bảng phần + ô số câu
  (sửa được) + checkbox "Include listening" (khuôn có listening) + mô tả `note`/`source` → **"Use this template"** →
  set `skills` + `durationMinutes` + `level = defaultGrade` (nếu đang trống) + `templateKey`. Nếu builder đã có câu,
  hỏi xác nhận thay thế.
- Trang danh sách Mock Test: nút **"New test from template"** cạnh "New test" khi chương trình đang xem (hoặc chương
  trình duy nhất của workspace) có `testTemplates.length` → `/teacher/tests/new?program=general&template=1`.

### 2.4 Chặn xuất bản

- Client: trong `save("published")`, sau các kiểm tra hiện có, gọi `incompleteQuestions(builderToPayload(b).skills)`
  khi `PROGRAMS[program].publishCheck` → có lỗi: hiện danh sách tối đa 10 dòng "Question 7 — no correct answer", tab +
  cuộn tới câu đầu (dùng lại cách `findGeneralSectionError` đang cuộn). "Save" (nháp) không chặn.
- Server `pages/api/admin/tests.js` PUT: khi body đổi `status` sang `"published"` và `PROGRAMS[programOf(test)].publishCheck`
  → `incompleteQuestions(test.skills)` (đã lưu) → có lỗi: 400 `"Question 7 is not finished: no correct answer"`. Áp cả
  khi giáo viên publish từ trang danh sách (nếu trang đó có nút publish).
- `Test.templateKey`: schema `{ type: String, default: "" }`; POST nhận `templateKey` (chỉ khi là key hợp lệ của
  `templatesFor(program)`), không cho sửa qua PUT.

### 2.5 Học sinh và giáo viên xem theo phần

- `lib/partGroups.js`: `fieldRangeLabel(fields)` → "Question 5" | "Questions 1–4" (tính cả `idEnd`), và
  `partBreakdown(sections, detailById)` → `[{ name, range, correct, total, score, maxScore }]` (câu không có trong
  detail = sai, điểm theo `field.score`).
- Trang làm bài `app/student/tests/[testId]/[skill]/page.js` + `components/student/questions.js`: khi
  `PROGRAMS[program].sectionRanges` → tiêu đề section hiện "{name} · Questions a–b" (cả lúc làm và lúc xem kết quả).
- Kết quả học sinh: khi `partResults` → bảng "By part" (Phần · Questions · Đúng/Tổng · thang 10 của phần) dưới điểm
  thang 10 hiện có.
- Giáo viên `app/teacher/tests/[testId]/submissions/[studentId]/page.js` (AutoSkillPanel): cùng bảng "By part" khi
  `partResults`. Trang tổng hợp lớp (`/submissions`) **không** đổi ở G2.

### 2.6 Hai lỗi có sẵn phải sửa

1. **Workspace chỉ có General tạo Unit/đề thành IELTS.** `usePrograms()` trả `isMulti=false` khi chỉ có 1 chương trình;
   `app/teacher/lessons/page.js` (tạo Unit) và `app/teacher/tests/[testId]/page.js` (đề mới) **không gửi `program`**
   khi `!isMulti` → server mặc định IELTS, trong khi ô khối đã hiện "Grade 6–12". Sửa: khi `!isMulti` và chương trình
   duy nhất ≠ `DEFAULT_PROGRAM` → gửi `program` = chương trình đó (IELTS-only giữ payload cũ, không gửi). Builder đề mới
   cũng phải lấy chương trình đó làm `b.program` để hiện đúng kỹ năng/khuôn. Test + probe: workspace chỉ có lớp General
   → tạo Unit, tạo đề → `program === "general"`.
   (Onboarding tạo lớp đầu tiên chưa có ô chọn chương trình — ghi lại, **không** sửa ở G2.)
2. **Màn kết quả Mock Test hiện nguyên `__x__`.** `app/student/tests/[testId]/[skill]/page.js` phần kết quả in
   `{f.label}` và đáp án thô. Dùng `UnderlinedText` (label theo `underlineModeOf`, chữ cái lỗi theo `isErrorIdFormat`,
   lựa chọn/đáp án ở chế độ `options`) — như `components/student/questions.js` đang làm.

---

## 3. Chia bước

| Bước | Nội dung | Ai |
|---|---|---|
| 1 | Sửa lỗi 2.6.1 (chương trình mặc định khi workspace 1 chương trình) + test | Sonnet (Claude Code) |
| 2 | Registry 4 key, `lib/generalTemplates.js` (dữ liệu + `templatesFor`, `resolveTemplate`, `incompleteQuestions`), `partGroups` (`fieldRangeLabel`, `partBreakdown`), `Test.templateKey`, chặn publish ở server, test | Antigravity — Prompt A |
| 3 | `applyFormat` tách khỏi SectionsEditor, `templateSkeleton.js`, khối "Start from a template" trong builder, nút ở danh sách, chặn publish ở client | Antigravity — Prompt B |
| 4 | Học sinh: tiêu đề phần + dải câu, bảng "By part"; giáo viên: "By part"; sửa lỗi 2.6.2 | Antigravity — Prompt C |
| 5 | Kiểm: build trong worktree riêng, `npm test`, tenant scope, probe API (tạo đề từ khuôn, publish bị chặn/qua, nộp bài, breakdown), trình duyệt desktop + 375px | Claude Code |

## 4. Kiểm thử bắt buộc

- `npm test` xanh; pin IELTS/TOEIC không đổi; `check-tenant-scope --strict` 0 vi phạm.
- Test mới:
  - khuôn: tổng câu đúng (THPT 40, HCM 40), id 1..N liền, mỗi câu đúng `formatLabel`/kind/matchMode, passage giữ chỗ
    đúng phần, `resolveTemplate` áp số câu + chặn số sai, `includeListening`;
  - `incompleteQuestions`: từng lý do một ca; khung khuôn mới tạo → mọi câu "dở"; đề điền đủ → rỗng;
  - server: publish đề General dở → 400 kèm số câu; nháp lưu được; IELTS publish đề có câu thiếu đáp án vẫn qua như cũ;
    `templateKey` lạ bị bỏ;
  - `fieldRangeLabel`, `partBreakdown` (có `idEnd`, câu thiếu detail, trọng số);
  - 2.6.1: tạo Unit/đề ở workspace chỉ có General → program general; workspace chỉ IELTS → payload không có `program`.
- Probe (bước 5): đề từ khuôn THPT điền đủ 40 câu bằng script → publish → học sinh nộp → kết quả có 6 phần.

## 5. Nhật ký

| Ngày | Bước | Ghi chú |
|---|---|---|
| 2026-10-29 | Plan | Lập plan + prompt. Phát hiện khi lập plan: lỗi 2.6.1 (G0) và 2.6.2 (G1) — đưa vào G2. |
