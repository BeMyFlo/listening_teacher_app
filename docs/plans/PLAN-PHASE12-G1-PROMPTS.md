# Phase 12 G1 — chia việc và prompt cho Antigravity

Plan thi hành: [PLAN-PHASE12-G1.md](PLAN-PHASE12-G1.md). Quy ước giống G0: Antigravity làm trên branch
`g1-<bước>-antigravity` cắt từ `phase-12-general-g1`, commit ở đó, xong nhắn Claude Code "review g1-<bước>-antigravity".
Claude Code review, sửa hoặc trả lại, rồi merge vào `phase-12-general-g1`. **Dán lần lượt**, prompt sau chỉ dán khi
bước trước đã merge.

| Bước | Ai | Prompt |
|---|---|---|
| 1 — helper thuần | Sonnet (Claude Code) | — |
| 2 — dữ liệu + chấm + danh sách dạng | Antigravity | A |
| 3 — builder | Antigravity | B |
| 4 — học sinh | Antigravity | C |
| 5 — Accept this answer | Antigravity | D |
| 6 — kiểm tổng | Claude Code | — |

Luật chung (đã ghi trong từng prompt): không tự bật/tắt dev server; không `next build` khi dev server đang chạy; IELTS
và TOEIC không đổi; `npm test` + `node scripts/check-tenant-scope.js --strict` phải qua; comment tiếng Việt ngắn, UI
tiếng Anh; không commit `scripts/_*-TMP.js`.

---

## Prompt A — Bước 2: dữ liệu, chấm khoan dung, danh sách dạng General

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g1 && git switch -c g1-step2-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G1.md: mục 0, 1, 2, 3.3, 3.4 và "Bước 2" ở mục 4.
- Đọc các helper bước 1 đã có: lib/underline.js, lib/sentenceMatch.js, lib/generalFormats.js (+ test của chúng).

LUẬT:
- KHÔNG tự chạy/tắt dev server (:3000 đang chạy). KHÔNG `next build` khi dev server đang chạy.
- IELTS/TOEIC không đổi: questionFormatsFor(subject, "ielts"|"toeic"|undefined) trả ĐÚNG danh sách cũ; câu không có
  matchMode chấm y như cũ. tests/aiPromptPin.test.js và tests/programBranches.test.js phải xanh.
- Comment tiếng Việt ngắn theo phong cách file xung quanh. UI tiếng Anh. Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM:
1. lib/models/schemas/questionSchema.js: FieldSchema thêm matchMode (enum ["", "sentence"], default "") và
   tokens ([String], default []) — mục 2.1.
2. lib/testSections.js: normalizeSections giữ matchMode/tokens theo mục 2.2 (giới hạn số mảnh/độ dài; nếu tokens ghép
   lại khớp một đáp án sau chuẩn hoá thì xáo lại bằng shuffleTokens). validateSections: tokens chỉ với type "fill",
   >= 2 mảnh, >= 1 đáp án. Câu formatLabel "Error identification" phải có số lựa chọn = số phần gạch chân trong
   label (underlinedParts), 2–4, sai thì báo lỗi rõ.
3. lib/teacher/sectionTransforms.js: emptyField thêm matchMode "" và tokens []; kind editor mới "reorder" <-> server
   type "fill" + tokens; fieldToServer/fieldFromServer mang matchMode, tokens. QUESTION_KIND_LABELS thêm
   reorder: "Sentence building (reorder words)" Ở CUỐI.
4. pages/api/units.js (toPublicUnit) và pages/api/tests.js (hàm public tương ứng): field gửi học sinh thêm `tokens`.
   KHÔNG gửi matchMode, KHÔNG gửi answers.
5. lib/grade.js: isCorrect + pointsEarned dùng normalizeSentence(normalize(x)) ở cả hai vế KHI
   field.matchMode === "sentence"; ngược lại giữ đúng code cũ.
6. lib/teacher/questionFormats.js: thay nhánh general tạm (danh sách IELTS) bằng danh sách General theo bảng mục 1,
   chia theo subject grammar / vocabulary / reading / listening (Mock Test reading = hợp mọi cột). Lấy nhãn từ hằng
   số trong lib/generalFormats.js. Cờ mới trên format: underline ("label"|"options"), errorLetters, arrange,
   matchMode ("sentence"); dùng lại presetOptions, needsFieldImage, noteMode sẵn có. Builder (bước 3) sẽ đọc các cờ
   này — bước này chỉ khai báo, và khi chọn dạng có matchMode thì field nhận matchMode (nếu chỗ đó nằm trong
   changeFormat ở SectionsEditor thì để bước 3).
7. Test (tests/generalG1.test.js hoặc tách file hợp lý):
   - round-trip matchMode/tokens qua normalizeSections + fieldToServer/fieldFromServer;
   - tokens chưa xáo bị xáo lại; validateSections bắt lỗi tokens và Error identification sai số lựa chọn;
   - payload học sinh có tokens, không có answers/matchMode (gọi handler thật với model giả như
     tests/programEnforce.test.js đang làm);
   - chấm sentence: "She hasn't finished it." == "she has not finished it" ; "I'm" == "I am"; câu KHÔNG có matchMode
     thì "hasn't" != "has not" (luật cũ);
   - questionFormatsFor IELTS/TOEIC deepEqual danh sách hiện tại (chụp trước khi sửa); General đúng key theo subject.
8. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g1-step2-antigravity, message "Phase 12 G1 step 2: matchMode and tokens fields, sentence matching,
General question formats". Báo lại: file đổi, số test, chỗ lệch plan (trích code).
```

---

## Prompt B — Bước 3: builder

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g1 && git switch -c g1-step3-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G1.md: mục 0, 1, 3.1 (phần Builder), 3.2 (phần Builder), 3.5, "Bước 3".
- Đọc components/teacher/SectionsEditor.js (SectionCard: chọn dạng cho câu mới; FieldRow: changeFormat, dropdown;
  QuestionDetail: phần soạn theo kind), components/teacher/GrammarTopicsEditor.js (TopicExercises dùng
  SectionsEditor với subject "grammar"/"vocabulary"), lib/teacher/questionFormats.js, lib/generalFormats.js.

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build` khi dev server đang chạy.
- Builder IELTS/TOEIC phải Y HỆT (DOM, chữ, luồng). Mọi thứ mới chỉ hiện khi format đang chọn có cờ tương ứng.
- Comment tiếng Việt ngắn. UI tiếng Anh. Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM:
1. Dropdown dạng câu hỏi hiện ở bài tập Grammar topic và Vocab group của Unit General (questionFormatsFor đã trả danh
   sách cho subject grammar/vocabulary ở bước 2). Kiểm SectionsEditor nhận đúng subject ở các chỗ đó. IELTS/TOEIC vẫn
   null -> nút "Add Question" như cũ.
2. changeFormat / tạo câu mới theo format: gán matchMode từ cờ format (format không có cờ -> ""); kind "reorder".
3. Kind reorder (mục 3.2 phần Builder): ô "Correct sentence(s)" (mỗi dòng một câu -> answers), nút
   "Split into pieces" (splitTokens + shuffleTokens), danh sách mảnh sửa được (sửa chữ, thêm, xoá, "Shuffle again").
4. Gạch chân (3.1 phần Builder): format có cờ underline -> dưới ô đề (underline "label") hoặc dưới mỗi lựa chọn
   (underline "options") hiện gợi ý "Wrap underlined text in double underscores: h__ea__d" và dòng xem trước render
   <u> (component nhỏ dùng parseUnderline, không dangerouslySetInnerHTML). Format errorLetters: nút
   "Build options from underlines" tạo đúng N lựa chọn "A".."D" theo số phần gạch chân (2–4; khác thì hiện lỗi ngay,
   không tạo).
5. Format arrange (3.5): ô "Correct order" (vd b-d-a-c-e) + nút "Generate options" (arrangeDistractors) -> 4 lựa chọn,
   đáp án đúng ở vị trí ngẫu nhiên và được tick sẵn.
6. Chặn lưu phía client (giống cách toeicPromptsError chặn): câu reorder thiếu mảnh/đáp án; Error identification sai
   số lựa chọn — báo lỗi rõ, nhảy tới câu.
7. npm test + node scripts/check-tenant-scope.js --strict. Nếu chủ dự án đang bật dev server thì tự kiểm bằng trình
   duyệt (workspace có lớp General).

XONG: commit trên g1-step3-antigravity, message "Phase 12 G1 step 3: builder for General question types". Báo lại: file
đổi, ảnh chụp/mô tả builder cho reorder, Error identification, Pronunciation, Arrange; chỗ lệch plan.
```

---

## Prompt C — Bước 4: phía học sinh

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g1 && git switch -c g1-step4-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G1.md: mục 0, 3.1 (phần Học sinh + Tìm lỗi sai + Giáo viên xem bài nộp), 3.2 (phần
  Học sinh + Xem lại), "Bước 4".
- Đọc components/student/questions.js (QuestionField, HL, cách câu letter-only được render), lib/underline.js,
  lib/generalFormats.js, styles/legacy.css (class letter-btn để tham khảo nút to).

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build` khi dev server đang chạy.
- Câu IELTS/TOEIC render Y HỆT (DOM, class, chữ). Nhánh mới chỉ chạy khi formatLabel thuộc dạng General có cờ, hoặc
  field có tokens.
- Không dangerouslySetInnerHTML. Comment tiếng Việt ngắn. UI tiếng Anh. Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM:
1. components/student/UnderlinedText.js (mới): render parseUnderline -> <u> cho phần gạch chân; prop errorLetters thì
   sau mỗi phần gạch chân thêm <sup>(A)</sup>, (B)... theo thứ tự.
2. QuestionField: underlineModeOf(field.formatLabel) === "label" -> đề render bằng UnderlinedText (không qua HL);
   "options" -> nhãn từng lựa chọn render bằng UnderlinedText. Áp dụng ở cả chế độ làm bài và xem lại (kể cả dòng
   "Correct answer: ...").
3. Câu có tokens (reorder): UI chip theo mục 3.2 — hàng "Your sentence" + hàng "Pieces", bấm để chuyển, nút "Clear",
   giá trị = mảnh đã chọn nối bằng 1 khoảng trắng. Chip theo VỊ TRÍ (hai mảnh cùng chữ là hai chip). Xem lại: câu đã
   nộp + đúng/sai + "Correct answer". CSS mới trong styles/legacy.css dùng token theme sẵn có, chip to, xuống dòng,
   ổn ở 375px.
4. Trang giáo viên xem bài nộp (lib/teacher/unitSubmissions.js, lib/teacher/testSubmissions.js và các trang
   app/teacher/lessons/[unitId]/submissions/..., app/teacher/tests/[testId]/submissions/...): đề/đáp án của dạng gạch
   chân hiện bằng UnderlinedText thay vì chuỗi có dấu __.
5. npm test + node scripts/check-tenant-scope.js --strict. Nếu chủ dự án đang bật dev server thì tự kiểm bằng trình
   duyệt, cả bề rộng 375px.

XONG: commit trên g1-step4-antigravity, message "Phase 12 G1 step 4: student view for underline and sentence-building
questions". Báo lại: file đổi, mô tả UI, chỗ lệch plan.
```

---

## Prompt D — Bước 5: Accept this answer

```
Bạn làm việc trong repo Next.js D:\Project\listening_teacher_app.

TRƯỚC KHI CODE:
- git switch phase-12-general-g1 && git switch -c g1-step5-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G1.md: mục 0, 3.6, 3.7, "Bước 5" ở mục 4.
- Đọc pages/api/admin/units.js (nhánh action=regrade sẵn có), pages/api/admin/tests.js, lib/teacher/regrade.js,
  lib/grade.js, lib/audit.js, lib/tenant.js (assertOwned), lib/teacher/unitSubmissions.js,
  lib/teacher/testSubmissions.js và các trang xem bài nộp của giáo viên.

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build` khi dev server đang chạy.
- Mọi truy vấn đi qua tenant filter/assertOwned như các route khác. scripts/check-tenant-scope.js --strict phải qua.
- Comment tiếng Việt ngắn. UI tiếng Anh. Không commit scripts/_*-TMP.js.

VIỆC CẦN LÀM:
1. lib/teacher/regrade.js: thêm regradeTestSubmissions(test, skill) — chấm lại mọi Submission kind "test" của
   testId + testSkill bằng gradeSubmission(test.skills[skill], sub.answers), lưu score/total/detail, trả số bài.
2. API theo mục 3.6:
   - POST /api/admin/units?id=&action=accept-answer { categoryKey, exerciseId, fieldId, answer }
     (bài tập có thể nằm trong category.exercises, topics[].exercises, groups[].exercises — dùng findExerciseInUnit).
   - POST /api/admin/tests?id=&action=accept-answer { skill, fieldId, answer }.
   - Kiểm: thuộc workspace; câu tồn tại và type "fill"; answer trim 1..300 ký tự; trùng theo luật chấm của câu (dùng
     isCorrect của lib/grade.js) -> 400 "This answer is already accepted." Thêm vào answers, lưu, chấm lại, ghi audit
     log, trả { ok, regradedCount }.
3. UI: trên trang xem bài nộp Unit và Mock Test của giáo viên, câu fill sai có chữ học sinh -> nút nhỏ
   "Accept this answer"; hộp xác nhận nói rõ câu, chữ học sinh và số bài sẽ được chấm lại; xong thì tải lại dữ liệu
   trang và toast "Accepted — K submissions re-graded".
4. Kiểm bảng thống kê theo dạng bài (mục 3.7) hiện đúng nhãn General trên trang bài nộp Unit (kể cả bài tập trong
   Grammar topic / Vocab group) và Mock Test; thiếu chỗ nào thì nối thêm, không viết lại.
5. Test: accept trên câu choice -> 400; Unit/Test của workspace khác -> 404; accept thành công -> answers có thêm, bài
   nộp được chấm lại (score tăng), audit log có dòng; accept trùng -> 400; regradeTestSubmissions chỉ đụng đúng
   test + skill.
6. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g1-step5-antigravity, message "Phase 12 G1 step 5: accept an answer and re-grade". Báo lại: file đổi,
số test, chỗ lệch plan.
```
