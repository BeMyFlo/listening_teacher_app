# Phase 12 G2 — chia việc và prompt cho Antigravity

Plan thi hành: [PLAN-PHASE12-G2.md](PLAN-PHASE12-G2.md). Quy ước như G3: Antigravity làm trên branch
`g2-<bước>-antigravity` cắt từ `phase-12-general-g2`, commit ở đó, xong nhắn Claude Code "review g2-<bước>-antigravity".
Claude Code review, sửa hoặc trả lại, rồi merge vào `phase-12-general-g2`. **Dán lần lượt**, prompt sau chỉ dán khi
bước trước đã merge. **Mỗi prompt mở trong một cuộc trò chuyện MỚI của Antigravity.** Xong bước 5: PR
`phase-12-general-g2` → nhánh gom `phase-12-general-g0` (không vào `main`).

| Bước | Ai | Prompt |
|---|---|---|
| 1 — chương trình mặc định khi workspace 1 chương trình | Sonnet (Claude Code) | — |
| 2 — dữ liệu khuôn, kiểm câu dở, chặn publish (server) | Antigravity | A |
| 3 — builder: khung từ khuôn, chặn publish (client) | Antigravity | B |
| 4 — học sinh + giáo viên: tiêu đề phần, kết quả theo phần | Antigravity | C |
| 5 — kiểm tổng | Claude Code | — |

**Thư mục:** repo chính `D:\Project\listening_teacher_app` (Next.js 15, React 19). Next 15: `headers()`/`cookies()` phải
`await`; ref callback không được trả về giá trị. Sau khi đổi nhánh hoặc `npm install`, dev server phải được khởi động
lại (tiến trình cũ có thể còn module cũ → lỗi 500 giả).

Luật chung (đã ghi trong từng prompt): không tự bật/tắt dev server; không `next build` khi dev server đang chạy; IELTS
và TOEIC không đổi; `npm test` + `node scripts/check-tenant-scope.js --strict` phải qua; comment tiếng Việt ngắn, UI
tiếng Anh; không commit `scripts/_*-TMP.js`; không gọi Gemini thật trong test; chỉ `git add` đúng file mình sửa.

---

## Prompt A — Bước 2: dữ liệu khuôn, kiểm câu dở, chặn publish (server)

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g2 đã có bước 1. Chạy: git switch phase-12-general-g2 && git switch -c g2-step2-antigravity
- Đọc kỹ docs/plans/PLAN-PHASE12-G2.md: mục 0, 1, 2.1, 2.2, 2.4 (phần server), 2.5 (hai hàm của partGroups), 4.
- Đọc: lib/curriculum.js, lib/generalFormats.js (GENERAL_LABELS), lib/teacher/questionFormats.js
  (GENERAL_ALL_FORMATS: kind/presetOptions/matchMode của từng format), lib/testSections.js, lib/partGroups.js,
  lib/models/Test.js, pages/api/admin/tests.js, tests/curriculum.test.js, tests/programEnforce.test.js (cách gọi
  handler thật với model giả).

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build` khi dev server đang chạy.
- IELTS/TOEIC không đổi: không thêm `=== "general"`, đọc registry. aiPromptPin, ieltsAiRequestPin, programBranches
  xanh không UPDATE_PIN. IELTS/TOEIC publish đề như cũ (không áp kiểm câu dở).
- Không nới luật validateSections hiện có.
- Comment tiếng Việt ngắn theo phong cách file xung quanh. Thông báo lỗi tiếng Anh. Không commit scripts/_*-TMP.js.
  Chỉ git add đúng file mình sửa.

VIỆC CẦN LÀM:
1. lib/curriculum.js: thêm testTemplates, publishCheck, sectionRanges, partResults cho cả 3 chương trình (mục 2.1).
   Cập nhật tests/curriculum.test.js.
2. lib/generalTemplates.js (CommonJS, không React/DB): PASSAGE_PLACEHOLDER, TEMPLATES (thpt, hcm10, school — đúng
   bảng mục 2.2, ghi source + năm), templatesFor(program), resolveTemplate(key, { counts, includeListening }),
   incompleteQuestions(skills) (nhận shape server; đủ các lý do ở mục 2.2; trả theo thứ tự câu). Mọi format key trong
   khuôn phải tồn tại trong GENERAL_LABELS — viết test chặn.
3. lib/partGroups.js: fieldRangeLabel(fields), partBreakdown(sections, detailById) (mục 2.5).
4. lib/models/Test.js: templateKey { type: String, default: "" }. pages/api/admin/tests.js:
   - POST nhận templateKey chỉ khi thuộc templatesFor(program) (lạ -> bỏ qua, không lỗi); PUT không sửa được.
   - PUT đổi status sang "published" + PROGRAMS[programOf(test)].publishCheck -> incompleteQuestions(test.skills)
     có lỗi -> 400 "Question N is not finished: <reason>". Nháp không bị chặn.
5. Test (tests/generalG2.test.js, tách file nếu dài) — đủ các ca ở mục 4 của plan phần "khuôn", "incompleteQuestions",
   "server", "fieldRangeLabel/partBreakdown".
6. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g2-step2-antigravity, message "Phase 12 G2 step 2: test templates data, unfinished-question check,
publish guard on the server". Báo lại: file đổi, số test, chỗ lệch plan (trích code).
```

---

## Prompt B — Bước 3: builder dựng khung từ khuôn, chặn publish (client)

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g2 đã có bước 2. Chạy: git switch phase-12-general-g2 && git switch -c g2-step3-antigravity
- Đọc docs/plans/PLAN-PHASE12-G2.md mục 0, 1, 2.3, 2.4 (client).
- Đọc: components/teacher/SectionsEditor.js (addQuestionWithFormat, changeFormat), lib/teacher/sectionTransforms.js
  (emptyField, appendAiSections — mẫu hàm thuần có test), lib/teacher/questionFormats.js, lib/teacher/testBuilder.js,
  app/teacher/tests/[testId]/page.js (save, findGeneralSectionError + cuộn tới câu), app/teacher/tests/page.js,
  lib/generalTemplates.js (bước 2), lib/client/program.js (usePrograms).

LUẬT:
- KHÔNG tự chạy/tắt dev server (chỉ dùng nếu đang chạy sẵn). KHÔNG `next build`.
- Tách applyFormat KHÔNG được đổi hành vi builder hiện có (IELTS/TOEIC/General) — viết test so sánh trước/sau.
- Nút/khối mới chỉ hiện theo registry (testTemplates, publishCheck). IELTS/TOEIC UI y như cũ.
- Comment tiếng Việt ngắn. UI tiếng Anh. Mobile 375px không tràn ngang. Chỉ git add đúng file mình sửa.

VIỆC CẦN LÀM:
1. lib/teacher/sectionTransforms.js: hàm thuần applyFormat(field, fmt) (gom logic set kind/formatLabel/matchMode/
   tokens/options của addQuestionWithFormat + changeFormat). SectionsEditor gọi lại. Export GENERAL_ALL_FORMATS từ
   lib/teacher/questionFormats.js.
2. lib/teacher/templateSkeleton.js: buildSkeleton(resolvedTemplate) đúng mục 2.3 (shape editor, id 1..N liền, passage
   giữ chỗ, 4 option trống theo D9).
3. app/teacher/tests/[testId]/page.js: khối "Start from a template" khi isNew + chương trình có testTemplates
   (mở sẵn khi URL ?template=1): chọn khuôn, bảng phần + ô số câu, "Include listening", note/source, nút "Use this
   template" (xác nhận nếu builder đã có câu). Gửi templateKey khi tạo. save("published"): incompleteQuestions khi
   publishCheck -> danh sách tối đa 10 dòng + chuyển tab + cuộn tới câu đầu; "Save" nháp không chặn.
4. app/teacher/tests/page.js: nút "New test from template" -> /teacher/tests/new?program=<p>&template=1 khi chương
   trình đang xem (hoặc chương trình duy nhất) có testTemplates.
5. Test (tests/generalG2Ui.test.js): applyFormat cho mọi format General + vài format IELTS/TOEIC (khớp hành vi cũ);
   buildSkeleton THPT/HCM/School: số câu, id, kind, options, passage giữ chỗ; khung vừa dựng đưa qua
   builderToPayload rồi validateSections (giả lập ws) -> lưu nháp hợp lệ; incompleteQuestions của khung -> đủ 40 câu.
6. Kiểm bằng tay nếu dev server đang chạy sẵn (tài khoản probe; không gọi Gemini): tạo đề THPT từ khuôn, Save nháp,
   mở lại, thử Publish -> bị chặn đúng câu.
7. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g2-step3-antigravity, message "Phase 12 G2 step 3: build a test from a template in the builder,
block publishing unfinished questions". Báo lại: file đổi, mô tả màn hình, chỗ lệch plan.
```

---

## Prompt C — Bước 4: tiêu đề phần cho học sinh, kết quả theo phần

```
Bạn làm việc trong repo D:\Project\listening_teacher_app (Next.js 15, React 19).

TRƯỚC KHI CODE:
- Nhánh phase-12-general-g2 đã có bước 3. Chạy: git switch phase-12-general-g2 && git switch -c g2-step4-antigravity
- Đọc docs/plans/PLAN-PHASE12-G2.md mục 0, 1 (D10), 2.5, 2.6 (lỗi 2).
- Đọc: app/student/tests/[testId]/[skill]/page.js (làm bài + màn kết quả, chỗ in {f.label} thô),
  components/student/questions.js (UnderlinedText theo underlineModeOf/isErrorIdFormat), components/student/
  UnderlinedText.js, lib/partGroups.js (fieldRangeLabel, partBreakdown — bước 2), lib/tenPoint.js,
  app/teacher/tests/[testId]/submissions/[studentId]/page.js (AutoSkillPanel, FormatStatsPanel), lib/teacher/
  testSubmissions.js.

LUẬT:
- KHÔNG tự chạy/tắt dev server. KHÔNG `next build`.
- Chỉ hiện theo registry sectionRanges / partResults. IELTS/TOEIC: màn làm bài + kết quả y như cũ (TOEIC vẫn dùng
  groupFieldsByPart như hiện tại).
- Không dùng regex lookbehind trong code phía học sinh (có test chặn).
- Comment tiếng Việt ngắn. UI tiếng Anh. Mobile 375px không tràn ngang. Chỉ git add đúng file mình sửa.

VIỆC CẦN LÀM:
1. Tiêu đề phần: khi sectionRanges -> "{section.name} · Questions a–b" ở màn làm bài (components/student/questions.js
   và trang skill) và màn kết quả.
2. Màn kết quả học sinh: khi partResults -> bảng "By part" (Part · Questions · Correct/Total · /10 của phần) dưới điểm
   thang 10; dùng partBreakdown.
3. Sửa lỗi 2.6.2: màn kết quả Mock Test in label/đáp án qua UnderlinedText (label theo underlineModeOf, chữ cái theo
   isErrorIdFormat, lựa chọn/đáp án theo chế độ options) như questions.js.
4. Giáo viên (AutoSkillPanel): khi partResults -> cùng bảng "By part" (dữ liệu: sections của skill + detail). Nếu cần,
   lib/teacher/testSubmissions.js trả thêm danh sách section (name + field ids) — không lộ đáp án vì đây là trang giáo viên.
5. Test: render-free — test hàm dữ liệu mới (nếu thêm), và một test chặn "IELTS/TOEIC không có sectionRanges/
   partResults".
6. Kiểm bằng tay nếu dev server đang chạy sẵn: học sinh probe làm đề General từ khuôn (375px), xem kết quả theo phần;
   một đề IELTS không đổi.
7. npm test + node scripts/check-tenant-scope.js --strict.

XONG: commit trên g2-step4-antigravity, message "Phase 12 G2 step 4: part headings with question ranges, results by
part, underlined text on the mock test result screen". Báo lại: file đổi, mô tả màn hình, chỗ lệch plan.
```
