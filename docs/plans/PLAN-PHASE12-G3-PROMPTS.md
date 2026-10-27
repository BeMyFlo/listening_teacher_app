# Phase 12 G3 — chia việc và prompt cho Antigravity

Plan thi hành: [PLAN-PHASE12-G3.md](PLAN-PHASE12-G3.md). Quy ước như G0/G1: Antigravity làm trên branch
`g3-<bước>-antigravity` cắt từ `phase-12-general-g3`, commit ở đó, xong nhắn Claude Code "review g3-<bước>-antigravity".
Claude Code review, sửa hoặc trả lại, rồi merge vào `phase-12-general-g3`. **Dán lần lượt**, prompt sau chỉ dán khi
bước trước đã merge. Xong bước 6: PR `phase-12-general-g3` → nhánh gom `phase-12-general-g0` (không vào `main`).

| Bước | Ai | Prompt |
|---|---|---|
| 1 — zipRead + docxRead | Sonnet (Claude Code) | — |
| 2 — bộ chuyển + AI soạn theo dạng + Textbook (server) | Antigravity | A |
| 3 — UI AI + cờ vàng | Antigravity | B |
| 4 — Import Word (server) | Antigravity | C |
| 5 — Import Word (UI) | Antigravity | D |
| 6 — kiểm tổng | Claude Code | — |

**Thư mục:** repo chính `D:\Project\listening_teacher_app` (Next 15.5 + React 19 — đã merge bản vá bảo mật PR #22
qua G0 → G1 → G3). Next 15: `headers()`/`cookies()` phải `await`; ref callback không được trả về giá trị (React 19 coi
đó là cleanup). Mỗi prompt bắt đầu bằng `git switch phase-12-general-g3` rồi `git switch -c g3-stepN-antigravity`.

Luật chung (đã ghi trong từng prompt): không tự bật/tắt dev server; không `next build` khi dev server đang chạy; IELTS
và TOEIC không đổi; `npm test` + `node scripts/check-tenant-scope.js --strict` phải qua; comment tiếng Việt ngắn, UI
tiếng Anh; không commit `scripts/_*-TMP.js`; không gọi Gemini thật trong test.

---

## Prompt A — Bước 2: bộ chuyển chung, AI soạn theo dạng, Textbook (server)

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g3 đã có bước 1. Chạy: git switch phase-12-general-g3 && git switch -c g3-step2-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G3.md: mục 0, 1, 2 (toàn bộ), 3.1–3.6.
- Đọc để bắt chước: lib/ai/grammarLesson.js (giao diện module, toSections, checkQuestions), lib/ai/common.js,
  pages/api/admin/ai-lesson.js, lib/generalFormats.js, lib/teacher/questionFormats.js (GENERAL_ALL_FORMATS),
  lib/teacher/sectionTransforms.js (fieldToServer/fieldFromServer, kind reorder), lib/testSections.js,
  components/teacher/SectionsEditor.js (nút "Build options from underlines", cách builder lưu câu phát âm và
  Sentence transformation với `pre`), tests/aiGeneral.test.js, tests/aiPromptPin.test.js, tests/ieltsAiRequestPin.test.js.

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build` khi dev server đang chạy.
- IELTS/TOEIC không đổi một byte: aiPromptPin, ieltsAiRequestPin, programBranches phải xanh KHÔNG dùng UPDATE_PIN.
  Nếu một pin đỏ nghĩa là bạn đã đổi prompt IELTS/TOEIC — sửa code, không sửa fixture.
- Không viết `program === "general"`; đọc registry. Không gọi Gemini thật trong test.
- Comment tiếng Việt ngắn theo phong cách file xung quanh. UI tiếng Anh. Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM:
1. lib/curriculum.js: thêm aiExercise, wordImport, textbook cho cả 3 chương trình (IELTS/TOEIC false, general true)
   — mục 2.1. Cập nhật tests/curriculum.test.js.
2. lib/generalFormats.js:
   - hàm thuần optionLettersFromUnderlines(label) -> ["A","B",...] (hoặc lỗi khi < 2 hoặc > 4 phần); SectionsEditor
     gọi lại hàm này thay cho code inline hiện tại, hành vi giữ y nguyên.
   - AI_FORMATS + danh sách key format General theo subject (CommonJS) — mục 3.1/3.2. Test so khớp với
     questionFormatsFor(subject, "general") của lib/teacher/questionFormats.js.
3. lib/ai/generalSections.js: toGeneralSection(...) đúng bảng mục 2.2 + quy ước <u>…</u> mục 2.4. Trả
   { section, flags, warnings, removed }. Câu lỗi: option `strict: true` (luồng AI) bỏ câu + removed; `strict: false`
   (luồng Word) giữ câu + flag.
4. lib/ai/generalExercise.js theo mục 3.1–3.5 (giao diện giống grammarLesson). FORMAT_GUIDE và SECTION_NAME cho
   đủ 14 format ở bảng 3.2. g-pron/g-stress luôn có flag "Pronunciation/stress — please double-check".
5. pages/api/admin/ai-lesson.js: MODULES thêm exercise: require("../../../lib/ai/generalExercise"). Không đổi gì
   khác của route (nếu buộc phải đổi, giải thích trong báo cáo).
6. Textbook — mục 3.6: Unit model, pages/api/admin/units.js (chỉ lưu khi registry textbook true), parseInput +
   buildPrompt của grammarLesson/vocabLesson thêm dòng Textbook CHỈ khi program có textbook và giá trị không rỗng.
7. Test (tests/generalG3Ai.test.js, tách file nếu dài):
   - toGeneralSection: mỗi format trong bảng 2.2 ít nhất 1 ca; output qua normalizeSections và generalQuestionError
     trả null; reorder tokens đã xáo khác thứ tự đáp án; error options = số phần gạch chân; <u> chỉ thành __ ở format
     gạch chân; passage chỉ giữ khi subject reading; strict true/false.
   - generalExercise: parseInput lọc format theo subject, 0 hoặc > 3 format -> lỗi, program khác general -> lỗi;
     buildPrompt có Grade/Textbook/Unit/Focus; checkQuestions gộp altAnswers, bỏ câu mcq có 2 đáp án đúng, reorder
     key sai bị bỏ; finalizeTopic cắt đúng questionCount.
   - route ai-lesson kind "exercise" với generateJSON giả (theo cách tests/aiGeneral.test.js mock): trả
     exerciseSections + flags.
   - grammarLesson/vocabLesson General có textbook -> prompt có dòng Textbook; IELTS/TOEIC có textbook gửi lên ->
     prompt y như cũ.
   - fieldToServer không mang aiFlag lên server.
8. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g3-step2-antigravity, message "Phase 12 G3 step 2: shared General section converter, AI exercise
generator by question type, unit textbook". Báo lại: file đổi, số test, chỗ lệch plan (trích code).
```

---

## Prompt B — Bước 3: UI "Generate with AI", ô Textbook, cờ vàng

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g3 đã có bước 2. Chạy: git switch phase-12-general-g3 && git switch -c g3-step3-antigravity
- Đọc docs/plans/PLAN-PHASE12-G3.md mục 0, 1, 2.3, 3.6 (phần form), 3.7.
- Đọc: components/teacher/SectionsEditor.js, AiGrammarDialog.js (QuestionPreview, cách gọi api + sectionsToEditor),
  AiVocabOptions.js (LevelLanguageFields), GrammarTopicsEditor.js (aiContext), VocabGroupsEditor.js,
  components/student/UnderlinedText.js, lib/client/api.js, form tạo/sửa Unit (tìm nơi dùng LevelField), các trang
  dùng SectionsEditor (Unit editor các tab, Mock Test editor) để truyền aiContext.

LUẬT:
- KHÔNG tự chạy/tắt dev server (:3000 có thể đang chạy — chỉ dùng nó để xem nếu đang chạy sẵn). KHÔNG `next build`.
- Nút và ô mới chỉ hiện theo registry (aiExercise, textbook). IELTS/TOEIC: UI y như cũ.
- Không đổi hành vi AiGrammarDialog/AiVocabDialog ngoài việc tách QuestionPreview ra file dùng chung.
- Comment tiếng Việt ngắn. UI tiếng Anh. Mobile 375px không tràn ngang.

VIỆC CẦN LÀM:
1. components/teacher/AiQuestionPreview.js: tách QuestionPreview từ AiGrammarDialog (AiGrammarDialog import lại),
   thêm hiển thị gạch chân (label/options theo underlineModeOf), mảnh sắp xếp (chip), passage thu gọn, và props
   flag (nền vàng + lý do).
2. components/teacher/AiExerciseDialog.js theo mục 3.7: chọn tối đa 3 dạng (lọc theo subject từ AI_FORMATS ở
   lib/generalFormats.js), Focus, số câu, level (gợi ý từ PROGRAMS.general.aiLevel), explanation language, notes;
   POST api ai-lesson kind "exercise" kèm subject, level, unitName, textbook, program; xem trước theo section, số câu
   bị loại, dạng lỗi (failed); "Not verified" khi check.verified false; tick section -> "Add to exercise".
3. SectionsEditor: prop aiContext (optional); nút "Generate with AI" cạnh "Add Section" khi
   PROGRAMS[program].aiExercise và subject có format AI; thêm section đánh số tiếp bằng nextFieldId, gán aiFlag theo
   flags. Truyền aiContext từ mọi trang/khối dùng SectionsEditor cho General (Grammar topic, Vocab group, Reading
   lesson, Mock Test Written paper).
4. Cờ vàng mục 2.3: FieldRow viền vàng + "⚠ reason" + "Mark as checked"; dải "N questions need checking" + "Next".
   CSS trong styles/legacy.css dùng token màu có sẵn (warn), có dark mode nếu file đang có.
5. Form Unit: ô "Textbook (optional)" + datalist gợi ý (D10) khi PROGRAMS[program].textbook; gửi textbook khi lưu;
   aiContext của Grammar/Vocab AI dialog cũng mang textbook.
6. Kiểm bằng tay nếu dev server đang chạy sẵn: tạo Unit General có Textbook, Generate with AI 3 dạng ở Grammar
   (Gemini thật được phép gọi ở bước này, tối đa vài lần), xem builder có cờ vàng, Save, mở lại.
7. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g3-step3-antigravity, message "Phase 12 G3 step 3: Generate with AI dialog, unit textbook field,
flagged questions in the builder". Báo lại: file đổi, ảnh chụp/ mô tả màn hình, chỗ lệch plan.
```

---

## Prompt C — Bước 4: Import Word (server)

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g3 đã có bước 3. Chạy: git switch phase-12-general-g3 && git switch -c g3-step4-antigravity
- Đọc docs/plans/PLAN-PHASE12-G3.md mục 0, 1, 2.2–2.4, 4.1–4.4.
- Đọc: lib/zipRead.js, lib/docxRead.js (+ test, tests/helpers/makeDocx.js) — đã có từ bước 1;
  lib/ai/generalSections.js (bước 2); pages/api/admin/import.js (formidable, xoá file tạm);
  pages/api/admin/ai-lesson.js (demo 403, 503, ngân sách 429, log); lib/gemini.js; tests/aiGeneral.test.js (mock).

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build`. Không gọi Gemini thật trong test.
- Không thêm thư viện npm. Không ghi DB, không tải gì lên Cloudinary ở server.
- Route mới: requireAuth(withTenant(...)); check-tenant-scope --strict phải 0 vi phạm.
- Comment tiếng Việt ngắn. Thông báo lỗi tiếng Anh dễ hiểu cho giáo viên.

VIỆC CẦN LÀM:
1. lib/wordImport.js:
   - splitForAi(text) -> { chunks: [string], keyText, error? } đúng mục 4.3 (khối đáp án, tiêu đề phần, cắt theo
     câu khi phần quá dài kèm lặp hướng dẫn + đoạn văn, tối đa 6 khúc).
   - WORD_IMPORT_SYSTEM, buildWordPrompt(chunk, keyText, ctx), WORD_SCHEMA — mục 4.3. Bảng nhận diện format lấy
     từ GENERAL_LABELS, không chép tay nhãn.
   - buildImport(chunkResults, { subject, images }) -> { sections, flags, imageLinks, warnings, stats } dùng
     toGeneralSection(..., { strict: false }).
2. pages/api/admin/import-word.js đúng mục 4.4 (giới hạn kích thước, xoá file tạm, chỉ trả ảnh được tham chiếu,
   cắt ảnh khi response quá lớn, maxDuration 60). lib/client/api.js: api.teacher.importWord(formData).
3. Test (tests/wordImport.test.js):
   - splitForAi: đề 3 phần -> đúng số khúc, khối "ĐÁP ÁN" gửi kèm mọi khúc và không nằm trong khúc đề; phần quá dài
     cắt theo câu và lặp hướng dẫn; quá 6 khúc -> error.
   - buildImport: gộp section bị cắt giữa 2 khúc; writing bị bỏ + warning; other có/không answer; flag theo
     answerSource ai, confidence low, pron/stress, imageRef không tồn tại, đáp án không khớp lựa chọn; trùng số câu;
     khúc lỗi vẫn trả khúc khác + warning; passage chỉ giữ ở reading.
   - route: docx dựng bằng makeDocx + generateJSON giả -> 200 với sections/flags/images; program ielts -> 400;
     workspace demo -> 403; không phải docx -> 400 đúng thông báo; mọi khúc lỗi -> 502; budget -> 429.
4. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g3-step4-antigravity, message "Phase 12 G3 step 4: Word test import (server): chunking, AI
extraction, conversion to General sections". Báo lại: file đổi, số test, chỗ lệch plan.
```

---

## Prompt D — Bước 5: Import Word (UI)

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g3 đã có bước 4. Chạy: git switch phase-12-general-g3 && git switch -c g3-step5-antigravity
- Đọc docs/plans/PLAN-PHASE12-G3.md mục 0, 1 (D6, D7, D9), 2.3, 4.4, 4.5.
- Đọc: components/teacher/SpreadsheetImport.js (khung modal), AiQuestionPreview.js và AiExerciseDialog.js (bước 3),
  components/teacher/MediaLibrary.js (uploadToCloudinary + POST /api/admin/images, folder), lib/client/api.js,
  SectionsEditor.js (nút import, aiFlag), các trang truyền media cho SectionsEditor (để làm mới danh sách ảnh).

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build`.
- Ảnh chỉ được tải lên khi bấm "Import into builder" (D7); huỷ/đổi file không tải gì.
- Nút chỉ hiện khi PROGRAMS[program].wordImport. IELTS/TOEIC UI y như cũ.
- Comment tiếng Việt ngắn. UI tiếng Anh. Mobile 375px không tràn ngang.

VIỆC CẦN LÀM:
1. components/teacher/WordImport.js đúng mục 4.5 (chọn file .docx, busy text, xem trước có thống kê + warnings +
   câu có cờ vàng + thumbnail ảnh, "Import into builder", "Choose another file").
2. Import into builder: tải ảnh (base64 -> File -> uploadToCloudinary -> POST images), sectionsToEditor, đánh số tiếp
   bằng nextFieldId, gán imageId theo imageLinks (fi null -> ảnh section), gán aiFlag, ảnh lỗi -> flag
   "Image could not be uploaded". Làm mới danh sách media của trang (thêm callback nếu chưa có).
3. SectionsEditor: nút "Import from Word" cạnh "Import from spreadsheet".
4. Kiểm bằng tay nếu dev server đang chạy sẵn: 1 file .docx nhỏ tự soạn (gạch chân, đánh số A–D, 1 ảnh, bảng đáp
   án) import vào Mock Test General Written paper — tối đa vài lần gọi Gemini thật; KHÔNG dùng file đề thật của chủ
   dự án ở bước này (Claude Code làm ở bước 6).
5. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g3-step5-antigravity, message "Phase 12 G3 step 5: Import from Word dialog with preview, image
upload and flagged questions". Báo lại: file đổi, mô tả màn hình, chỗ lệch plan.
```
