# Phase 12 G0 — chia việc và prompt cho Antigravity

Plan thi hành: [PLAN-PHASE12-G0.md](PLAN-PHASE12-G0.md). File này chỉ ghi **ai làm bước nào** và **prompt dán vào
Antigravity**.

## Chia việc

| Bước (plan G0 mục 4) | Ai làm | Lý do |
|---|---|---|
| 1 — Registry key + helper + test pin prompt AI | Sonnet (Claude Code) | Nhỏ, là nền cho mọi bước sau |
| 2 — Thêm `general`, level cố định 6–12, server chặn level | **Antigravity — Prompt A** | Vừa, nhiều file server + test |
| 3 — Rà nhánh UI, nhãn "Grade", chip, badge, test chặn tái phát | **Antigravity — Prompt B** | Lớn, nhiều trang |
| 4 — Prompt AI General | **Antigravity — Prompt C** | Lớn, nhiều chuỗi prompt |
| 5 — Điểm thang 10 | Sonnet (Claude Code) | Nhỏ-vừa, 1 helper + 6 chỗ hiển thị |
| 6 — Kiểm thử tổng (probe + trình duyệt) | Claude Code | Cần dev DB + trình duyệt |

**Thứ tự:** 1 → A → B → C → 5 → 6. Mỗi prompt bắt đầu khi bước trước đã được Claude Code review và merge vào
`phase-12-general-g0`.

**Quy ước branch (giống Phase 8B):** Antigravity làm trên branch `g0-<bước>-antigravity` cắt từ
`phase-12-general-g0`, commit ở đó. Xong thì nhắn Claude Code "review g0-<bước>-antigravity". Claude Code review, sửa
hoặc trả lại, rồi merge vào `phase-12-general-g0`.

---

## Prompt A — Bước 2: thêm General, level cố định, server

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g0 && git pull (nếu có remote) && git switch -c g0-step2-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G0.md: mục 0 (luật chơi, bất biến), mục 1 (registry), mục 3.1 (level cố định),
  và "Bước 2" ở mục 4. Đọc lib/curriculum.js (bước 1 đã thêm các key levelWord, fixedLevels, skillLabels,
  testSkillLabels, excelImport, legacyFormatGuess, formatPlaceholder, aiLevel, levelNamePlaceholder và helper
  skillLabel, testSkillLabel, levelWordOf, levelAllowed).

LUẬT:
- KHÔNG tự chạy hoặc tắt dev server (chủ dự án đang chạy :3000). KHÔNG chạy `next build` khi dev server đang chạy.
- IELTS và TOEIC không được đổi hành vi. `npm test` phải xanh, kể cả tests/aiPromptPin.test.js.
- Comment trong code viết tiếng Việt, ngắn, theo phong cách file xung quanh. UI chỉ tiếng Anh.
- Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM (đúng mục 1 + 3.1 + Bước 2 của plan):
1. lib/curriculum.js: thêm chương trình `general` đúng như khối code ở mục 1 của plan (lessonSkills/testSkills CHƯA
   có writing/speaking, scoring "ten-point", levelWord "Grade", fixedLevels [6..12], skillLabels
   { vocabulary: "Vocabulary & Pronunciation" }, testSkillLabels { reading: "Written paper" }, excelImport true,
   legacyFormatGuess false, formatPlaceholder "Choose a question type…", aiLevel, levelNamePlaceholder).
   Kiểm Class/Unit/Test/Submission dùng PROGRAM_KEYS cho enum nên tự nhận `general`.
2. lib/levelsAdmin.js + pages/api/admin/levels.js theo mục 3.1:
   - mergeLevels: chương trình có fixedLevels luôn trả đủ các dòng 6..12 (name "" nếu chưa đặt), cộng level đang
     dùng nằm ngoài danh sách.
   - planCreate cho chương trình có fixedLevels -> 400 "General English uses grades 6–12; rename a grade instead."
   - planDelete level cố định -> 400 "Grades can't be deleted."
   - planRename giữ nguyên.
3. pages/api/admin/classes.js, pages/api/admin/units.js, pages/api/admin/tests.js: ở POST và PUT, ngay cạnh chỗ
   đang kiểm `program`, gọi levelAllowed(program, level). Sai -> 400 "Choose a grade from 6 to 12." (chỉ dùng
   câu này khi program có fixedLevels; chương trình khác giữ thông báo lỗi level cũ). PUT đổi program sang general
   mà level hiện tại không hợp lệ -> cũng 400.
4. Test:
   - tests/levelsAdmin.test.js: mergeLevels general trả 6..12; planCreate general 400; planDelete grade 400;
     planRename general OK; ielts/toeic không đổi.
   - tests/programEnforce.test.js: tạo lớp/unit/test general level 7 -> OK; level 3 -> 400; ielts level 3 -> OK;
     PUT đổi program lớp ielts level 1 sang general -> 400.
   - tests/curriculum.test.js: general có đủ key; parseProgramParam("general") hợp lệ; programFilter("general").
5. Chạy `npm test` và `node scripts/check-tenant-scope.js --strict`, cả hai phải qua.

KHÔNG LÀM trong bước này: mọi thay đổi UI (bước 3), prompt AI (bước 4), điểm thang 10 (bước 5).

XONG: commit trên g0-step2-antigravity với message "Phase 12 G0 step 2: General program, fixed grades 6–12, server
level checks". Báo lại: danh sách file đổi, số test pass, mọi chỗ code khác với plan (trích code).
```

---

## Prompt B — Bước 3: rà nhánh UI, nhãn, chip, badge

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g0 && git switch -c g0-step3-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G0.md: mục 0, mục 2 (bảng 27 chỗ === "toeic", cột "Xử lý"), mục 2.1 (A1–A12),
  mục 2.2, mục 3.1 (phần LevelField/LevelsManager), 3.2, 3.3, 3.6, và "Bước 3".

LUẬT:
- KHÔNG tự chạy hoặc tắt dev server. KHÔNG chạy `next build` khi dev server đang chạy.
- IELTS và TOEIC phải hiện Y HỆT trước (chữ, placeholder, gợi ý, nút, DOM). Mọi giá trị IELTS/TOEIC lấy từ
  registry đã được điền đúng chuỗi cũ ở bước 1 — chỉ thay chỗ đọc, không đổi chuỗi.
- Workspace có IELTS + TOEIC KHÔNG được thấy chip "General English" (A9).
- Comment tiếng Việt ngắn; UI tiếng Anh. Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM — chỉ các dòng trong mục 2 / 2.1 có xử lý "ĐỔI" thuộc phần UI, KHÔNG đụng lib/ai/* (bước 4):
1. Mục 2: #13 (lib/teacher/questionFormats.js — nhánh general rõ ràng, tạm trả danh sách IELTS), #14–16
   (AiGrammarDialog.js đọc PROGRAMS[program].aiLevel, xoá 2 hằng cục bộ), #17 (AiVocabOptions.js đọc aiLevel;
   grep chỗ import LEVEL_SUGGESTIONS/TOEIC_LEVEL_SUGGESTIONS trước khi xoá), #18 (LevelField.js
   levelNamePlaceholder), #20 (thêm comment "// G5: general.writing"), #21 (SectionsEditor.js dùng
   legacyFormatGuess), #22 (SectionsEditor.js render placeholder khi formatPlaceholder khác null).
2. Mục 2.1: A2 (canImport -> excelImport ở 3 file), A5 (lib/teacher/useVocabReviewAi.js gửi
   `${levelWordOf(program)} ${level}`), A6 (lib/student/skillBar.js chỉ hiện "Band" khi scoring === "ielts-band"),
   A9 (components/teacher/ProgramChips.js lấy chip từ `programs` của usePrograms(), không từ PROGRAM_KEYS; kiểm
   cả trang app/teacher/lessons/page.js chia nhóm theo programs), A10 (styles/legacy.css thêm --program-general,
   --program-general-bg, --program-general-border cho light và dark + class .program-badge.program-general; màu
   #2E8B57 / #E6F4EC / #C3E3D0, bản dark tự chọn cho dịu theo cách --program-toeic làm), A12 (sửa comment
   lib/ai/common.js:46 — chỉ comment).
3. Mục 3.1: LevelField — chương trình có fixedLevels thì dropdown 6..12, KHÔNG có "+ New level…". LevelsManager —
   nhóm có fixedLevels không có nút thêm/xoá, chỉ đổi tên.
4. Mục 3.2: lib/levelNames.js formatLevelLabel(level, name, word = "Level"), levelLabel truyền levelWordOf(program).
   Sửa 6 chỗ viết cứng "Level {n}" liệt kê trong 3.2. Sau khi sửa chạy lại lệnh grep trong 3.2 và báo kết quả.
5. Mục 3.3: nhãn tab kỹ năng (Unit editor, Unit học sinh, Test builder, thẻ kỹ năng Mock Test học sinh) bọc bằng
   skillLabel/testSkillLabel với fallback = nhãn cũ. Không đổi key.
6. Mục 2.2: tests/programBranches.test.js quét lib components app pages tìm === "toeic", !== "toeic",
   === "ielts", !== "ielts"; so với danh sách cho phép (theo file + đoạn code, KHÔNG theo số dòng). Danh sách cho
   phép = các dòng GIỮ ở mục 2 và 2.1, CỘNG TẠM các dòng ĐỔI #2–#12 trong lib/ai/* (bước 4 sẽ gỡ), đánh dấu rõ
   "TODO bước 4" trong danh sách.
7. Chạy `npm test` + `node scripts/check-tenant-scope.js --strict`.

XONG: commit trên g0-step3-antigravity, message "Phase 12 G0 step 3: program branches read the registry, Grade
labels, chips show active programs". Báo lại: file đổi, kết quả grep "Level", số test, chỗ lệch plan (trích code),
và danh sách cho phép của programBranches.test.js.
```

---

## Prompt C — Bước 4: prompt AI cho General

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g0 && git switch -c g0-step4-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G0.md: mục 0, mục 2 (#2–#12), mục 3.4, 3.5, và "Bước 4". Đọc
  tests/aiPromptPin.test.js + tests/fixtures/aiPromptPin.json (ghim TOÀN VĂN prompt IELTS/TOEIC hiện tại).

LUẬT CỨNG:
- KHÔNG đổi một ký tự nào trong SYSTEM, TOEIC_SYSTEM, TIER_GUIDE, TOEIC_TIER_GUIDE và mọi chuỗi IELTS/TOEIC khác.
  tests/aiPromptPin.test.js phải xanh mà KHÔNG được chạy chế độ cập nhật fixture (UPDATE_PIN). Nếu test pin đỏ,
  sửa code, không sửa fixture.
- KHÔNG gọi Gemini thật. KHÔNG tự chạy/tắt dev server, KHÔNG next build khi dev đang chạy.
- Comment tiếng Việt ngắn. Chuỗi prompt viết tiếng Anh.

VIỆC CẦN LÀM:
1. lib/ai/common.js (mục 3.4): gradeOf(raw), gradeTier(grade), nhánh general của levelTier (CEFR -> tier như
   CEFR_BAND; không thì gradeTier(gradeOf(raw)); TUYỆT ĐỐI không gọi bandOf cho general), nhánh general của
   describeStudentLevel(raw, program, fallbackGrade), hằng DEFAULT_STUDENT_LEVEL_GENERAL, hàm
   fourOptions(program, band) (nhánh IELTS giữ đúng biểu thức cũ). Truyền fallbackGrade = input.level ở chỗ gọi
   (pages/api/admin/ai-lesson.js đã có input.level — kiểm luồng truyền xuống builder).
2. lib/ai/grammarLesson.js, lib/ai/vocabLesson.js, lib/ai/vocabReview.js: thay mọi ternary `program === "toeic" ?`
   (mục 2 #4–#12) bằng bảng tra { ielts, toeic, general } với `|| <giá trị IELTS>` cho key lạ. Thêm GENERAL_SYSTEM
   (theo khuôn ở mục 3.5: 5 dòng PLAIN TEXT/accuracy/pitch CHÉP NGUYÊN VĂN từ SYSTEM của chính file đó), và
   GENERAL_TIER_GUIDE 4 mức theo mô tả 3.5. vocabLesson #10: ví dụ tên nhóm general
   "'Hobbies' or 'Healthy living'". vocabReview #12: general ưu tiên từ theo chủ đề Unit sách giáo khoa, bỏ từ quá
   khó so với khối lớp. optCount ở #6/#9 dùng fourOptions.
3. tests/programBranches.test.js: gỡ các dòng "TODO bước 4" khỏi danh sách cho phép; test phải xanh.
4. Test mới (tests/aiGeneral.test.js): prompt general (system + user) không chứa "IELTS" hay "TOEIC";
   levelTier("Grade 7","general")="foundation", "Grade 9"="core", "Grade 11"="upper", "B2"="advanced",
   "lớp 8"="core", ""="core"; describeStudentLevel("", "general", 8) chứa "Grade 8"; general luôn 4 lựa chọn;
   levelTier("Grade 7","ielts") vẫn ra đúng như trước (ghi chú: đó là hành vi cũ của IELTS, không sửa).
5. Chạy `npm test`.

XONG: commit trên g0-step4-antigravity, message "Phase 12 G0 step 4: AI prompts for General English". Báo lại: file
đổi, toàn văn GENERAL_SYSTEM của 3 module, bảng 4 mức GENERAL_TIER_GUIDE, số test.
```
