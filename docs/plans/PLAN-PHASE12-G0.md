# PLAN — Phase 12 · G0: Nền chương trình General English

> Tài liệu thi hành cho đợt **G0** của [PLAN-PHASE12-GENERAL-ENGLISH.md](PLAN-PHASE12-GENERAL-ENGLISH.md).
> File kia là bộ não (nghiên cứu, quyết định Q1–Q10). File này là tay chân: làm gì, ở file nào, đổi thành gì.
>
> **Người thi hành đọc kỹ mục 0 và mục 2 trước khi gõ dòng code đầu tiên.**

Trạng thái: ☐ chưa làm · Ngày lập: 2026-10-26
Tiền đề: **Phase 8 (TOEIC 8A + 8B) đã merge vào `main`.** Branch `phase-12-general-g0` cắt từ `main` sau khi merge.
Số dòng trong file này lấy theo `phase-8-toeic` @ `6be9d50`; sau merge có thể lệch vài dòng, tìm theo đoạn code trích.

---

## 0. Luật chơi

### 0.1 G0 làm gì

Thêm chương trình `general` ("General English", lớp 6–12) vào registry, sao cho một giáo viên tạo được lớp
General Grade 7, soạn Unit Grammar/Vocabulary/Listening/Reading bằng các dạng câu hỏi **đang có**, giao bài, học
sinh làm và thấy **điểm thang 10**. Đồng thời **dọn hết các nhánh "TOEIC thì A, còn lại là IELTS"** để General
không rơi vào nhánh IELTS.

### 0.2 Bất biến

1. **IELTS và TOEIC không đổi một chữ.** Prompt AI, nhãn, placeholder, danh sách dạng câu hỏi, điểm, level của
   hai chương trình này phải y hệt trước G0. Kiểm bằng test pin prompt (bước 6) và so màn hình.
2. Workspace không có lớp General thấy app **y hệt hôm nay** — kể cả workspace đang có IELTS + TOEIC (chip lọc
   không được tự mọc thêm "General English", xem 3.6).
3. Không đổi `CATEGORY_KEYS` (Q3). Không thêm model. Không đổi luật chấm (`lib/grade.js`).

### 0.3 G0 KHÔNG làm gì

- Không làm dạng câu hỏi mới (gạch chân, sắp xếp từ, viết lại câu khoan dung) — đó là G1.
- Không làm khuôn đề, đánh số 1–40 — G2. Không làm import Word — G3.
- **Không mở Writing/Speaking cho General** (Q8). Registry không liệt kê hai kỹ năng này; server đã chặn nộp vào kỹ
  năng bị ẩn (`lessonSkillAllowed`, `testSkillAllowed`), `lib/completion.js` đã chỉ đếm `lessonSkills` (Phase 8
  bước 5.1b). Rubric, `scoreLabel`, leaderboard, dashboard band — để nguyên, G5 xử lý.

---

## 1. Registry — `lib/curriculum.js`

```js
general: {
  key: "general",
  label: "General English",
  lessonSkills: ["grammar", "vocabulary", "listening", "reading"],   // G5: + writing, speaking
  testSkills: ["listening", "reading"],                              // G5: + writing, speaking
  defaultDurations: { listening: 15, reading: 45 },
  scoring: "ten-point",
  levelWord: "Grade",
  fixedLevels: [6, 7, 8, 9, 10, 11, 12],
  skillLabels: { vocabulary: "Vocabulary & Pronunciation" },
  testSkillLabels: { reading: "Written paper" },
  excelImport: true,
  legacyFormatGuess: false,
  formatPlaceholder: "Choose a question type…",
  aiLevel: {
    label: "Students' level (grade or CEFR)",
    placeholder: "e.g. Grade 7, A2",
    suggestions: ["Grade 6", "Grade 7", "Grade 8", "Grade 9", "Grade 10", "Grade 11", "Grade 12", "A1", "A2", "B1"],
  },
  levelNamePlaceholder: "e.g. Grade 10 entrance prep",
},
```

Thêm vào **cả `ielts` và `toeic`** các key mới với giá trị **đúng như code đang viết cứng** (để chỗ gọi đọc
registry mà IELTS/TOEIC không đổi):

| Key | `ielts` | `toeic` |
|---|---|---|
| `levelWord` | `"Level"` | `"Level"` |
| `fixedLevels` | `null` | `null` |
| `skillLabels`, `testSkillLabels` | `{}` | `{}` |
| `excelImport` | `true` | `false` |
| `legacyFormatGuess` | `true` | `false` |
| `formatPlaceholder` | `null` | `"Choose a Part…"` |
| `aiLevel.label` | `"Students' level (IELTS band or CEFR)"` | `"Students' level (TOEIC score)"` |
| `aiLevel.placeholder` | `"e.g. 6.5, 5.0–5.5, B1"` | `"e.g. 550, 450–600, 750+"` |
| `aiLevel.suggestions` | `LEVEL_SUGGESTIONS` hiện tại (3.0 … 8.0, A1 … C1) | `TOEIC_LEVEL_SUGGESTIONS` hiện tại (300 … 850) |
| `levelNamePlaceholder` | `"e.g. Band 3.5–5.0"` | `"e.g. 300–450"` |

Helper mới trong cùng file (export, có test ở `tests/curriculum.test.js`):

```js
function skillLabel(program, key, fallback)      // PROGRAMS[p].skillLabels[key] || fallback
function testSkillLabel(program, key, fallback)
function levelWordOf(program)                    // "Grade" | "Level"
function levelAllowed(program, level)            // fixedLevels ? fixedLevels.includes(level) : validLevel
```

`fallback` = nhãn đang hiện hôm nay (vd "Vocabulary"), để chỗ gọi không phải biết nhãn mặc định nằm ở đâu.

---

## 2. Danh sách 27 chỗ `=== "toeic"` và cách xử lý

Lệnh tìm: `grep -rn --include=*.js '=== "toeic"' lib components app pages` → **27 dòng** (25 dòng code + 2 dòng
chú thích). Mỗi chỗ thuộc một trong ba loại:

- **ĐỔI → registry**: thay bằng đọc `PROGRAMS[program].…` (mục 1). IELTS/TOEIC ra đúng giá trị cũ.
- **ĐỔI → bảng tra**: thay ternary bằng object `{ ielts, toeic, general }`, `|| <giá trị IELTS>` cho key lạ.
- **GIỮ**: nhánh này đúng cho General (General đi nhánh "không phải TOEIC" là đúng ý), ghi lý do.

| # | Chỗ | Hôm nay | General đi vào | Xử lý |
|---|---|---|---|---|
| 1 | `lib/curriculum.js:6` | Chú thích luật "không viết `if (program === "toeic")`" | — | **GIỮ** (chú thích) |
| 2 | `lib/ai/common.js:62` `levelTier` | TOEIC đọc điểm, còn lại `tierOf(bandOf(raw))` | **SAI**: `bandOf("Grade 7")` = 7 → tier `advanced` (C1–C2) | **ĐỔI → bảng tra**, thêm `gradeTier(raw)` — mục 3.4 |
| 3 | `lib/ai/common.js:75` `describeStudentLevel` | Trống → "IELTS band 4.0–5.0"; "6.5" → "IELTS band 6.5" | **SAI**: prompt General ghi "IELTS band" | **ĐỔI → bảng tra**, thêm nhánh general — mục 3.4 |
| 4 | `lib/ai/grammarLesson.js:50` `tierGuideFor` | `TOEIC_TIER_GUIDE : TIER_GUIDE` | **SAI**: ví dụ "IELTS-style", "IELTS Task 2" | **ĐỔI → bảng tra** `{ ielts: TIER_GUIDE, toeic: TOEIC_TIER_GUIDE, general: GENERAL_TIER_GUIDE }` |
| 5 | `lib/ai/grammarLesson.js:89` `systemFor` | `TOEIC_SYSTEM : SYSTEM` | **SAI**: "experienced IELTS … teacher" | **ĐỔI → bảng tra**, thêm `GENERAL_SYSTEM` — mục 3.5 |
| 6 | `lib/ai/grammarLesson.js:114` `optCount` | TOEIC 4, IELTS band ≥ 6 → 4, còn lại 3 | **SAI**: 3 hoặc 4 tuỳ số lớp gõ vào | **ĐỔI**: general luôn **4** (đề phổ thông luôn A–D). Viết `program === "toeic" \|\| program === "general" \|\| …` qua hàm `fourOptions(program, band)` dùng chung ở `common.js` |
| 7 | `lib/ai/vocabLesson.js:58` `tierGuideFor` | như #4 | **SAI** | **ĐỔI → bảng tra**, thêm `GENERAL_TIER_GUIDE` của vocab |
| 8 | `lib/ai/vocabLesson.js:85` `systemFor` | như #5 | **SAI** | **ĐỔI → bảng tra**, thêm `GENERAL_SYSTEM` của vocab |
| 9 | `lib/ai/vocabLesson.js:107` `optCount` | như #6 | **SAI** | **ĐỔI**: `fourOptions(program, band)` |
| 10 | `lib/ai/vocabLesson.js:190` ví dụ tên nhóm | TOEIC "Meetings & Appointments", còn lại "Environment / Education & Careers" | Tạm được nhưng lệch chủ đề sách | **ĐỔI → bảng tra**, general: `'Hobbies' or 'Healthy living'` |
| 11 | `lib/ai/vocabReview.js:57` `systemFor` | như #5 | **SAI**: "from the text of an IELTS exercise" | **ĐỔI → bảng tra**, thêm `GENERAL_SYSTEM` của vocab review |
| 12 | `lib/ai/vocabReview.js:133` dòng "Prefer …" | TOEIC từ công sở, còn lại "academic … IELTS paraphrase" | **SAI**: chọn từ học thuật quá khó | **ĐỔI → bảng tra**, general: từ theo chủ đề Unit sách, bỏ từ quá khó so với khối lớp |
| 13 | `lib/teacher/questionFormats.js:84` | TOEIC → danh sách Part, còn lại → danh sách IELTS | Ra danh sách IELTS | **ĐỔI**: thêm nhánh `general` rõ ràng. **G0 trả tạm danh sách IELTS** (MCQ, T/F/NG, matching, completion dùng được cho phổ thông); G1 thay bằng danh sách General |
| 14 | `components/teacher/AiGrammarDialog.js:173` nhãn | ternary TOEIC/IELTS | **SAI**: "IELTS band or CEFR" | **ĐỔI → registry** `aiLevel.label` |
| 15 | `components/teacher/AiGrammarDialog.js:177` placeholder | như trên | **SAI** | **ĐỔI → registry** `aiLevel.placeholder` |
| 16 | `components/teacher/AiGrammarDialog.js:182` gợi ý | `TOEIC_LEVEL_SUGGESTIONS : LEVEL_SUGGESTIONS` | **SAI**: gợi ý band 3.0–8.0 | **ĐỔI → registry** `aiLevel.suggestions`. Xoá 2 hằng số cục bộ trong file |
| 17 | `components/teacher/AiVocabOptions.js:47` | như #14–16 | **SAI** | **ĐỔI → registry** `aiLevel`. Hai hằng `LEVEL_SUGGESTIONS`/`TOEIC_LEVEL_SUGGESTIONS` đang `export` → grep chỗ import trước khi xoá, chuyển hết sang registry |
| 18 | `components/teacher/LevelField.js:45` placeholder tên level | ternary | General không tạo level (3.1) | **ĐỔI → registry** `levelNamePlaceholder` (dùng khi đổi tên level trong LevelsManager) |
| 19 | `components/teacher/PromptsEditor.js:6` | Chú thích Phase 8B | — | **GIỮ** (chú thích) |
| 20 | `components/teacher/PromptsEditor.js:18` | TOEIC → ô chọn dạng đề TOEIC, còn lại → Task 1/Task 2 IELTS | Không tới được: General chưa có Writing/Speaking (0.3) | **GIỮ**. Ghi `// G5: general.writing` cạnh dòng |
| 21 | `components/teacher/SectionsEditor.js:754` đoán dạng theo `kind` | TOEIC không đoán, còn lại đoán | General đoán như IELTS → câu chưa có `formatLabel` bị nhận bừa | **ĐỔI → registry** `legacyFormatGuess` (chỉ IELTS `true` — dữ liệu IELTS cũ có trước `formatLabel`) |
| 22 | `components/teacher/SectionsEditor.js:856` "Choose a Part…" | chỉ TOEIC có dòng placeholder | General không có placeholder | **ĐỔI → registry** `formatPlaceholder` (render khi khác `null`) |
| 23 | `app/student/tests/[testId]/[skill]/page.js:42` TOEIC Speaking runner | chỉ TOEIC | Đúng: General không có runner | **GIỮ** |
| 24 | `app/student/tests/[testId]/[skill]/page.js:129` nhóm đề Writing TOEIC | chỉ TOEIC | Đúng | **GIỮ** |
| 25 | `app/teacher/lessons/[unitId]/page.js:395` kiểm prompt TOEIC trước khi lưu | chỉ TOEIC | Đúng | **GIỮ** |
| 26 | `app/teacher/tests/[testId]/page.js:107` kiểm prompt TOEIC trước khi lưu | chỉ TOEIC | Đúng | **GIỮ** |
| 27 | `app/teacher/tests/[testId]/page.js:301` Reading TOEIC bắt đầu từ 101 | chỉ TOEIC | Đúng: General đánh từ 1 (G2 làm đánh số liền 1–40) | **GIỮ** |

**Tổng: 18 ĐỔI, 9 GIỮ** (2 chú thích + 7 nhánh TOEIC thuần mà General không được đi vào).

### 2.1 Các nhánh liên quan khác (không phải `=== "toeic"` nhưng cùng bản chất)

| # | Chỗ | Hôm nay | Xử lý |
|---|---|---|---|
| A1 | `lib/testSections.js:192` `promptTaskError`: `program !== "toeic"` → cấm `taskType` | General cấm `taskType` — đúng | **GIỮ** |
| A2 | `components/teacher/SectionsEditor.js:130`, `GrammarTopicsEditor.js:28`, `VocabGroupsEditor.js:17`: `canImport = program !== "toeic"` | General được import | **ĐỔI → registry** `excelImport` (general `true`). Kiểm: import file mẫu Grammar/Vocab/Reading vào Unit General chạy đúng |
| A3 | `app/teacher/lessons/[unitId]/page.js:280` `aiScope`: `!== "ielts"` → thêm `":" + program` | General nhớ tuỳ chọn AI riêng — đúng | **GIỮ** |
| A4 | `pages/api/admin/ai-lesson.js:52`, `ai-vocab-review.js:56`, `lib/teacher/useVocabReviewAi.js:28`: chỉ gửi/ghi `program` khi `!== "ielts"` | General có `program` trong request + AI Log — đúng | **GIỮ** |
| A5 | `lib/teacher/useVocabReviewAi.js:30` `level: "Level " + ctx.level` | General gửi "Level 7" cho AI | **ĐỔI**: `levelWordOf(program) + " " + level` → "Grade 7" |
| A6 | `lib/student/skillBar.js:15` "Band" khi `scoring !== "toeic-scaled"` | General có `band` thì hiện "Band" | **ĐỔI**: chỉ hiện "Band" khi `scoring === "ielts-band"` (G0 General không có band nên chưa lộ, nhưng sửa luôn) |
| A7 | `lib/toeicScale.js:88` `usesToeicScale` đọc `scoring` | General không quy đổi TOEIC — đúng | **GIỮ** |
| A8 | `lib/grading/rubric.js`, `lib/scoreLabel.js`, `lib/student/dashboard.js:31`, `lib/student/leaderboard.js:25`, `lib/teacher/dashboard.js:154`, `lib/grading/runAiGrade.js:231`, `pages/api/admin/submissions.js:172–205`, `components/RubricResult.js`, `components/teacher/RubricGrader.js` — rẽ nhánh theo `rubricVariant` | Chỉ chạm Writing/Speaking | **GIỮ** ở G0 (Writing/Speaking General ẩn). G5 thêm variant `general.*` |
| A9 | `components/teacher/ProgramChips.js:33` chip = mọi `PROGRAM_KEYS` | Thêm `general` → workspace IELTS + TOEIC mọc chip "General English" | **ĐỔI**: chip = `programs` từ `usePrograms()` (chương trình **đang dùng**). Vi phạm bất biến 0.2.2 nếu không sửa |
| A10 | `styles/legacy.css:35–40, 1355–1356, 1384…` token màu badge | Chưa có màu General | **ĐỔI**: thêm `--program-general*` (sáng + tối) + class `.program-badge.program-general`. Màu đề xuất: xanh lá `#2E8B57` / nền `#E6F4EC` / viền `#C3E3D0` |
| A11 | `components/teacher/ProgramField.js`, `app/teacher/lessons/[unitId]/page.js:675`, `app/teacher/tests/[testId]/page.js:176` — chọn program bằng `PROGRAM_KEYS.map` | General tự xuất hiện trong ô chọn | **GIỮ** (đúng ý: ô Program là cửa vào General, như C4 của Phase 8) |
| A12 | `lib/ai/common.js:46` chú thích "chỉ ielts \| toeic" | — | **ĐỔI** chú thích |

### 2.2 Chặn tái phát

Thêm `tests/programBranches.test.js`: quét `lib components app pages` tìm `=== "toeic"`, `!== "toeic"`,
`=== "ielts"`, `!== "ielts"`, so với **danh sách cho phép** (file:đoạn code, các dòng GIỮ ở mục 2 và 2.1). Có
chỗ mới ngoài danh sách → test fail kèm thông báo "đọc registry hoặc thêm vào danh sách cho phép kèm lý do". So
theo đoạn code chứ không theo số dòng, để sửa file khác không làm test vỡ.

---

## 3. Thiết kế từng phần

### 3.1 Level cố định = khối lớp

Hôm nay level **tự đánh số** từ 1 (`nextLevelNumber` trong `lib/levelsAdmin.js`) — lớp General đầu tiên sẽ là
"Level 1", sai Q2. Với chương trình có `fixedLevels`:

- `mergeLevels(levelNames, program, usage)`: **luôn** có đủ các dòng 6…12 (tên `""` nếu chưa đặt), cộng thêm level
  đang dùng nằm ngoài danh sách (dữ liệu lỗi — vẫn hiện để giáo viên thấy mà sửa).
- `planCreate` → **400** "General English uses grades 6–12; rename a grade instead."
- `planDelete` level cố định → **400** "Grades can't be deleted." (level ngoài danh sách thì luật cũ).
- `planRename` giữ nguyên: tên là **phụ đề tuỳ chọn**, vd Grade 9 · "Entrance prep".
- **Server chặn level sai**: `pages/api/admin/classes.js`, `units.js`, `tests.js` (POST + PUT) gọi
  `levelAllowed(program, level)` ngay cạnh chỗ kiểm `program`. Sai → **400** "Choose a grade from 6 to 12."
  PUT đổi `program` sang general mà level cũ (vd 3) không hợp lệ → cũng 400; UI đổi Program thì `LevelField` tự
  chọn lại level đầu tiên (đã có, dòng ~33).
- `LevelField`: program có `fixedLevels` → dropdown 6…12, **không** có nút "New level".
- `LevelsManager`: nhóm General không có nút thêm/xoá, chỉ đổi tên.

**Làm rõ Q2:** tên level gắn với **khối**, dùng chung mọi lớp cùng khối. Giáo viên có cả lớp 9 thường lẫn lớp 9
ôn thi vào 10 thì phân biệt bằng **tên lớp** ("9 — Entrance prep"), không bằng tên level.

### 3.2 Nhãn level "Grade 7"

- `lib/levelNames.js`: `formatLevelLabel(level, name, word = "Level")`; `levelLabel(levelNames, program, level)`
  truyền `levelWordOf(program)`. IELTS/TOEIC vẫn "Level 1 · Band 3.5–5.0".
- Sửa các chỗ viết cứng "Level {n}" sang `levelLabel`/`levelWordOf`:
  `components/teacher/LevelsManager.js:114`, `app/student/lessons/[unitId]/page.js:155`,
  `app/teacher/lessons/page.js:250`, `app/teacher/lessons/[unitId]/page.js:602`,
  `app/teacher/tests/page.js:60`, `app/teacher/tests/[testId]/page.js:216`.
- Chạy lại `grep -rn 'Level \${\|"Level "\|>Level {\|Level {' app components lib` sau khi sửa; chỗ nào còn lại phải
  là IELTS-only có lý do.

### 3.3 Nhãn kỹ năng

- Tab Unit editor + Unit học sinh: `skillLabel(program, key, <nhãn cũ>)` → General hiện "Vocabulary &
  Pronunciation".
- Tab Test builder + thẻ kỹ năng Mock Test học sinh: `testSkillLabel(program, key, <nhãn cũ>)` → General hiện
  "Written paper" cho ô `reading`.
- Grep nhãn kỹ năng đang lấy từ đâu (`CATEGORY_LABELS`, `TEST_SKILLS`...) và chỉ bọc ở chỗ hiển thị; **không đổi
  key**.

### 3.4 Trình độ học sinh cho AI (`lib/ai/common.js`)

```js
// "Grade 7", "grade7", "lớp 7", "7" -> 7; ngoài 6..12 -> null.
function gradeOf(raw) { … }
function gradeTier(grade) {           // GDPT 2018: hết lớp 9 ≈ A2, hết lớp 12 ≈ B1
  if (grade == null) return "core";
  if (grade <= 7) return "foundation";  // A1
  if (grade <= 9) return "core";        // A2
  return "upper";                       // A2+–B1 (lớp 10–12)
}
```

- `levelTier(raw, "general")`: có CEFR (A1/A2/B1/B2) → map như `CEFR_BAND` sang tier; không thì
  `gradeTier(gradeOf(raw))`. **Không gọi `bandOf`** (lỗi "Grade 7" = band 7). `advanced` chỉ khi gõ B2+ (lớp HSG).
- `describeStudentLevel(raw, "general", fallbackGrade)`: trống → `"Grade {fallbackGrade} at a Vietnamese secondary
  school (national GDPT 2018 curriculum)"`, `fallbackGrade` = level của Unit (`input.level`, route `ai-lesson.js`
  đã có sẵn); chỉ số → "Grade N …"; còn lại giữ nguyên chữ giáo viên gõ.
- `DEFAULT_STUDENT_LEVEL_GENERAL` khi không có cả level: `"Grade 8 at a Vietnamese secondary school (CEFR A2)"`.
- `fourOptions(program, band)`: `program === "toeic" || program === "general" || (band != null && band >= 6)`.
  Nhánh IELTS giữ đúng biểu thức cũ.

### 3.5 Chuỗi prompt General (mới — viết bằng tiếng Anh, theo khuôn SYSTEM hiện có)

`GENERAL_SYSTEM` của grammarLesson (vocabLesson, vocabReview viết tương tự, thay câu nhiệm vụ):

```
You are an experienced English teacher at a lower and upper secondary school in Vietnam (grades 6–12),
following the national GDPT 2018 curriculum and textbooks such as Global Success.
You write grammar lesson content (theory and practice questions) that students use inside a learning app.
<5 dòng PLAIN TEXT / accuracy / pitch — chép NGUYÊN VĂN từ SYSTEM hiện có>
Prefer sentences on school-textbook topics (family, school life, hobbies, health, food, festivals,
environment, technology, travel, Vietnamese culture). Never mention IELTS or TOEIC.
```

`GENERAL_TIER_GUIDE` (grammar): `foundation` = lớp 6–7, A1, câu rất ngắn, đời sống học sinh; `core` = lớp 8–9, A2,
các dạng hay gặp trong đề kiểm tra và đề vào 10; `upper` = lớp 10–12, A2+–B1, thêm câu phức, bẫy thường gặp trong
đề tốt nghiệp THPT; `advanced` = B2, lớp chọn / HSG. Vocab và vocab review: cùng 4 mức, nói về chọn từ.

**Không đổi một chữ** của `SYSTEM`, `TOEIC_SYSTEM`, `TIER_GUIDE`, `TOEIC_TIER_GUIDE` hiện có — chỉ thêm bảng tra
xung quanh.

### 3.6 Chip lọc chỉ hiện chương trình đang dùng

`ProgramChips`: `[All, ...programs.map(...)]` thay cho `PROGRAM_KEYS`. `programs` là `activePrograms` (Phase 8 mục
3.5), nên workspace IELTS + TOEIC vẫn thấy đúng `All · IELTS · TOEIC`. Kiểm thêm trang Lessons (chia nhóm theo
chương trình): nhóm phải lấy từ `programs`, không từ `PROGRAM_KEYS`.

### 3.7 Điểm thang 10 — `lib/tenPoint.js` (mới, CommonJS, dùng chung server + client)

```js
function usesTenPoint(program)            // PROGRAMS[program].scoring === "ten-point"
function tenPoint(score, total)           // total > 0 ? Math.round(score / total * 40) / 4 : null  (bước 0,25 — Q6)
function formatTenPoint(score, total)     // "7.75 / 10"  ("" nếu null). Số thập phân dấu chấm (UI tiếng Anh)
```

Chỉ hiển thị, không lưu DB. Chỗ hiện (cùng các chỗ đang gọi `usesToeicScale`, thêm nhánh General **bên cạnh**,
không đụng nhánh TOEIC):

| Chỗ | Hiện cho General |
|---|---|
| `components/student/SubmissionResultModal.js:131` (nộp bài tập Lesson) | Số to "8.5 / 10", dòng nhỏ "17/20 correct". Modal cần nhận `program` — truyền từ trang gọi |
| `app/student/tests/page.js:126, 178` | "Written paper: 7.75 / 10 (31/40)" |
| `app/student/tests/[testId]/[skill]/page.js:294` | hộp kết quả sau khi nộp |
| `app/teacher/tests/[testId]/submissions/page.js:165` | cột điểm |
| `app/teacher/tests/[testId]/submissions/[studentId]/page.js:534` | đầu trang bài nộp |
| `lib/student/dashboard.js:170, 179` (tiêu đề hoạt động gần đây) | "… — 8.5/10" |

Thanh kỹ năng dashboard học sinh: General giữ **%** như hôm nay (A6).

---

## 4. Các bước thi hành

Mỗi bước một commit. Sau mỗi bước `npm test` xanh và `next build` sạch (**chỉ build khi dev server đã tắt** — xem
Phase 8 mục 5). Không tự chạy/tắt dev server.

### Bước 1 — Registry + helper + test pin (không đổi hành vi)

1. **Trước khi sửa gì:** mở rộng `tests/ieltsAiRequestPin.test.js` (hoặc thêm `tests/aiPromptPin.test.js`) để pin
   **toàn văn** prompt grammar/vocab/vocab-review của **cả IELTS lẫn TOEIC** cho 2–3 input mẫu. Chạy, commit
   snapshot. Đây là lưới an toàn cho bước 4.
2. Thêm key mới cho `ielts`/`toeic` (bảng mục 1) + helper `skillLabel`, `testSkillLabel`, `levelWordOf`,
   `levelAllowed`. **Chưa** thêm `general`.
3. Test: mọi chương trình có đủ mọi key; helper trả đúng giá trị cũ cho IELTS/TOEIC.

Kiểm: app không đổi gì.

### Bước 2 — Thêm `general` + level cố định + server

1. Thêm `general` vào `PROGRAMS` (mục 1). Schema dùng `PROGRAM_KEYS` nên enum tự nhận — kiểm `Class`, `Unit`,
   `Test`, `Submission`.
2. `lib/levelsAdmin.js` + `pages/api/admin/levels.js` theo 3.1. Test trong `tests/levelsAdmin.test.js`.
3. `levelAllowed` ở `classes.js`, `units.js`, `tests.js`. Test trong `tests/programEnforce.test.js`.
4. `parseProgramParam`, `programFilter`, `activePrograms` không cần sửa — thêm test cho `general`.

Kiểm (probe trên dev DB): tạo lớp General level 7 → OK; level 3 → 400; POST level mới cho General → 400; GET levels
trả đủ 6…12; workspace IELTS-only `/api/teacher/me` vẫn `["ielts"]`.

### Bước 3 — Rà nhánh UI (mục 2 #13–22, mục 2.1 A2, A9–A12) + nhãn

1. #13 `questionFormats.js`, #14–18 dialog AI + LevelField, #21–22 SectionsEditor, A2 `canImport`.
2. A9 `ProgramChips`, A10 màu badge (sáng + tối), kiểm trang Lessons chia nhóm.
3. 3.2 nhãn "Grade", 3.3 nhãn kỹ năng.
4. `tests/programBranches.test.js` (2.2) với danh sách cho phép **đầy đủ sau bước này** (AI vẫn còn ternary — thêm
   tạm vào danh sách, bước 4 gỡ ra).

Kiểm: workspace IELTS + TOEIC: chip vẫn `All · IELTS · TOEIC`, không có badge/ô nào khác. Tạo lớp General → chip
General hiện ngay.

### Bước 4 — Prompt AI General (mục 2 #2–12, A5)

1. `common.js`: `gradeOf`, `gradeTier`, `levelTier`, `describeStudentLevel`, `fourOptions` (3.4).
2. `grammarLesson.js`, `vocabLesson.js`, `vocabReview.js`: bảng tra + chuỗi General (3.5).
3. `useVocabReviewAi.js` "Grade 7" (A5).
4. Gỡ các dòng AI khỏi danh sách cho phép của `programBranches.test.js`.
5. Test: snapshot bước 1 **không đổi**; thêm test General: prompt không chứa "IELTS"/"TOEIC"; "Grade 7" → tier
   `foundation`, "Grade 9" → `core`, "Grade 11" → `upper`, "B2" → `advanced`; trống + level 8 → mô tả "Grade 8 …";
   luôn 4 lựa chọn.

Kiểm thật (dev, có key Gemini): soạn 1 topic grammar "Present perfect" cho Unit Grade 8 + 1 nhóm từ "Healthy
living" Grade 7 — ví dụ đúng chủ đề học đường, không có chữ IELTS. Xem prompt trong AI Log.

### Bước 5 — Điểm thang 10 (3.7) + A6

1. `lib/tenPoint.js` + `tests/tenPoint.test.js` (0/40 → 0; 31/40 → 7.75; 17/20 → 8.5; 1/3 → 3.25; total 0 → null).
2. Các chỗ hiện ở bảng 3.7. `SubmissionResultModal` nhận `program`.
3. `skillBar.js` (A6).

Kiểm: bài IELTS/TOEIC hiện y như cũ (so ảnh chụp trước/sau ở 3 màn: modal nộp bài, danh sách Mock Test, trang bài
nộp giáo viên).

### Bước 6 — Kiểm thử tổng

1. Script probe (`scripts/_probe-g0-TMP.js`, xoá trước khi merge) trên **dev DB**: workspace thử, lớp General
   Grade 7 + học sinh, Unit có Grammar topic + Vocab group + Reading (T/F/NG, MCQ) + Listening, Test chỉ Written
   paper, nộp bài, kiểm điểm thang 10, Grading Queue `?program=general`, học sinh General không lấy được Unit
   IELTS. Dọn sạch sau khi chạy.
2. Nhờ chủ dự án bật dev server → trình duyệt: (a) workspace Ms Nhi (IELTS-only) không đổi gì; (b) workspace
   IELTS + TOEIC: chip/badge không đổi; (c) workspace có General: form lớp chọn Grade, tab "Vocabulary &
   Pronunciation", "Written paper", "8.5 / 10", không thấy Writing/Speaking, không thấy chữ "Band"/"IELTS".
   Kiểm cả dark mode và bề rộng 375px.
3. Ghi kết quả vào Nhật ký (mục 6), cập nhật trạng thái ở PLAN-PHASE12-GENERAL-ENGLISH.md.

### Thứ tự deploy

1. Merge PR `phase-12-general-g0` → deploy. **Không cần backfill**: dữ liệu cũ không có `general`.
2. Không có gì phải bật: giáo viên chọn "General English" ở form lớp là bắt đầu dùng (như C4 Phase 8).

**Rollback:** revert PR. Lớp/Unit/Test `general` đã tạo sẽ bị Mongoose từ chối khi **ghi** (enum cũ không có
`general`); khi **đọc** thì `programOf` trả IELTS → hiện như IELTS. Báo giáo viên ngừng dùng lớp General tới khi
deploy lại.

---

## 5. Rủi ro

| # | Rủi ro | Chặn bằng |
|---|---|---|
| R1 | Sửa bảng tra AI làm đổi một chữ prompt IELTS/TOEIC | Snapshot toàn văn ở bước 1, chạy lại ở bước 4 |
| R2 | Chip "General English" mọc ra ở workspace IELTS + TOEIC | A9: chip đọc `activePrograms` |
| R3 | "Grade 7" bị hiểu là band 7 | `levelTier` General không gọi `bandOf`; test riêng |
| R4 | Level General bị tạo ngoài 6–12 qua API | `levelAllowed` ở cả 3 route + `planCreate` 400 |
| R5 | Đổi Program của lớp/Unit sang General khi level cũ không hợp lệ | 400 rõ lý do; UI tự chọn lại level đầu |
| R6 | Nhánh `=== "toeic"` mới lại được thêm sau này | `tests/programBranches.test.js` (2.2) |
| R7 | Excel import (template IELTS) tạo dữ liệu lạ cho General | Kiểm import file mẫu vào Unit General ở bước 3; lỗi thì đặt `excelImport: false` cho General và ghi Nhật ký |

---

## 6. Nhật ký

*(trống — ghi khi thi hành)*
