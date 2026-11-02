# PLAN — Phase 12 · G5: Writing / Speaking thang 10

> Tài liệu thi hành cho đợt **G5** của [PLAN-PHASE12-GENERAL-ENGLISH.md](PLAN-PHASE12-GENERAL-ENGLISH.md) (mục 5-G5, Q8).
> Toàn bộ code do Sonnet viết, Claude Code (lead) review + merge từng bước (không dùng Antigravity nữa).

Trạng thái: ◐ code xong trên `phase-12-general-g5`, đã kiểm, chưa merge · Ngày lập: 2026-10-30
Tiền đề: G0, G1, G3, G2 đã vào nhánh gom. Branch `phase-12-general-g5` cắt từ `phase-12-general-g0`. Xong → PR vào nhánh
gom (cách gộp: mục 5 plan tổng).

---

## 0. Luật chơi

### 0.1 G5 làm gì

Mở Writing và Speaking cho General, chấm **thang 10**, không dùng rubric IELTS:

1. Hai rubric mới `general.writing`, `general.speaking`: 4 tiêu chí, mỗi tiêu chí 0–2,5 (bước 0,25), tổng = điểm /10.
2. AI chấm nháp theo khối lớp (kỳ vọng theo lớp 6–12), giáo viên xem lại và xuất bản như IELTS/TOEIC.
3. Giáo viên chấm tay theo 4 tiêu chí; học sinh xem điểm "/10" và nhận xét.
4. Mở tab Writing/Speaking ở Unit và Mock Test của General.

### 0.2 Bất biến — quan trọng nhất của đợt này

G5 sửa đường chấm dùng chung với khách đang trả tiền, nên:

1. **Bài IELTS/TOEIC đã có và sẽ nộp chấm y như cũ:** cùng variant, cùng thang, cùng chữ hiển thị ("Band 6.5", "Score 2/3"),
   cùng prompt AI. `aiPromptPin`, `ieltsAiRequestPin`, `programBranches`, `toeicSpeakingFlow` xanh **không UPDATE_PIN**.
2. **Không đụng dữ liệu cũ:** `resolveVariant` của IELTS/TOEIC trả đúng như trước; Submission cũ không đổi.
3. Mọi nhánh General đọc registry / `isGeneralVariant`, không viết `=== "general"`.
4. Điểm /10 lưu ở `manualScore` (khác IELTS 0–9) nên **mọi chỗ cộng, so, quy đổi `manualScore` phải biết thang** — xem 2.4.
   Không chỗ nào được hiện "Band" cho General (R1 plan tổng).
5. Câu chấm máy, điểm thang 10 của bài tự động: không đổi.

### 0.3 G5 KHÔNG làm

- Luồng Speaking kiểu thi thật (TOEIC 8B). General dùng luồng ghi âm như IELTS.
- Thêm Writing/Speaking vào khuôn đề (G2) — giáo viên tự thêm prompt vào tab.
- Quy đổi điểm Writing vào điểm Written paper; mỗi kỹ năng hiện điểm riêng.

---

## 1. Quyết định (đề xuất của lead, đổi được)

| # | Câu hỏi | Chốt |
|---|---|---|
| D1 | Tiêu chí | Writing: Content · Organisation · Vocabulary · Grammar & mechanics. Speaking: Content · Fluency · Pronunciation · Language use. Mỗi tiêu chí 0–2,5, bước 0,25. |
| D2 | Điểm tổng | **Tổng 4 tiêu chí** (0–10, bước 0,25), không phải trung bình; không cho ghi đè tổng khác tổng tiêu chí (như TOEIC). |
| D3 | Thang chữ | Hiện "8.5 / 10" (dùng chung cách viết với `formatTenPoint`). |
| D4 | Kỳ vọng theo khối | Prompt nhận khối của Unit/Test: lớp 6–7 ≈ A1, 8–9 ≈ A2, 10–12 ≈ B1. Bài đạt đúng kỳ vọng của khối được điểm cao, không so với chuẩn IELTS. |
| D5 | Ngôn ngữ nhận xét | Tiếng Việt đơn giản, trích tiếng Anh khi sửa lỗi; học sinh phổ thông đọc được. |
| D6 | Prompt Writing | Không có Task 1/Task 2 (ẩn ô này với General; lưu mặc định, bị bỏ qua khi chọn rubric). |
| D7 | Bảng xếp hạng | Quy về cùng thang như TOEIC đang làm (`/10 × 9`) để không lệch khi trộn. |

---

## 2. Thiết kế

### 2.1 Registry

- `lessonSkills` / `testSkills` của General thêm `writing`, `speaking` (**bước 3 mới mở**, để hai bước đầu không lộ UI dở);
  `defaultDurations` thêm writing 30, speaking 10.
- Key mới `rubricVariants`: General `{ writing: "general.writing", speaking: "general.speaking" }`; IELTS/TOEIC `null`.

### 2.2 `lib/grading/rubric.js`

- `VARIANTS["general.writing"|"general.speaking"]`: `{ label, criteria: [{ key, label, bands }] }`, descriptor tiếng Anh ở
  các mức 2.5 / 2 / 1.5 / 1 / 0.5 / 0 — đặt ở `lib/grading/generalRubric.js`, **không** sửa `rubrics.json`.
- `isGeneralVariant(v)`, `scoreRange` (criterion 0–2.5), `validateCriteria` (đủ 4 tiêu chí, bội số 0,25), `overallScore(variant,
  criteria)` (General = tổng; IELTS = `overallBand` y cũ), `annotationCriteria`.
- `resolveVariant(kind, writingTask, program)`: thêm tham số thứ 3; có `rubricVariants` thì dùng, không thì y như cũ.
  Sửa 2 chỗ gọi ở `pages/api/submissions.js` (lấy program từ Unit/Test, không từ client).

### 2.3 AI

`lib/grading/prompts/generalShared.js`, `generalWritingSystem.js`, `generalSpeakingSystem.js`; schema + validate + normalise
trong `aiGradeSchema.js`; nhánh `runGeneralGrade` trong `runAiGrade.js` (như `runToeicGrade`). Khối lớp đọc từ Unit/Test của bài
nộp. Có khối SECURITY như TOEIC (bài làm là dữ liệu không tin được). Hậu kiểm server: mỗi criterion kẹp đúng thang + bội 0,25;
`suggestedOverall` = tổng tính lại ở server, không tin số AI cộng.

### 2.4 Mọi chỗ đọc `manualScore`

| Chỗ | Việc |
|---|---|
| `lib/scoreLabel.js` | `formatScore` "8.5 / 10", `scoreMax` 10, `scorePct` đúng |
| `pages/api/admin/submissions.js` | Khoá variant General như TOEIC; tổng lấy từ tiêu chí; chặn điểm ngoài 0–10 |
| `pages/api/admin/grading-jobs.js` | Nháp AI lưu đúng thang |
| `lib/student/dashboard.js`, `lib/student/skillBar.js` | Không trộn /10 vào trung bình band (General hiện %) |
| `lib/student/leaderboard.js` | D7 |
| `lib/teacher/dashboard.js`, `lib/teacher/testSubmissions.js`, `lib/teacher/unitSubmissions.js` | Hiện đúng thang, không tính trung bình chung với band |
| `lib/notifications/student.js` | Qua `formatScore` (kiểm) |

### 2.5 UI

`RubricGrader` (ô số 0–2,5 bước 0,25, tổng tự cộng), `RubricResult`, `SpeakingReview`, `PromptsEditor` (ẩn Task 1/2),
trang học sinh (bài Lesson + Mock Test), `EssayAnnotator` (nhãn tiêu chí). Rà mọi chữ "Band" / "IELTS" với bài General.

---

## 3. Chia bước (Sonnet code, lead review + merge từng bước)

| Bước | Nội dung |
|---|---|
| 1 | Rubric, `resolveVariant`, `scoreLabel`, route chấm tay, mọi chỗ ở 2.4 + test. Chưa mở registry `lessonSkills`. |
| 2 | AI chấm (2.3) + test với Gemini giả |
| 3 | Mở registry + UI (2.5) + test |
| 4 | Lead kiểm tổng: build, probe, Gemini thật 1 bài Writing, trình duyệt desktop + 375px, IELTS/TOEIC hồi quy |

## 4. Kiểm thử bắt buộc

- Pin IELTS/TOEIC không đổi; test "hợp đồng": `resolveVariant`, `formatScore`, `scorePct`, `validateCriteria`, `overallBand` của
  IELTS/TOEIC trả đúng giá trị cũ trên bộ mẫu.
- General: tổng đúng, chặn 2.75 / 0.1 / thiếu tiêu chí / override tổng; học sinh không thấy "Band"; bảng xếp hạng trộn thang đúng.
- Probe Phase 8 232/232, G0, G1 (các assert "General ẩn Writing/Speaking" đổi theo G5).

## 5. Nhật ký

| Ngày | Bước | Ghi chú |
|---|---|---|
| 2026-10-30 | Plan | Lập plan. PR #23 (G3 + G2) đã merge vào nhánh gom. |
| 2026-10-30 | 1–3 | Sonnet: `tests/gradingContract.test.js` khoá hành vi IELTS/TOEIC trước khi sửa (commit riêng, không sửa lại); `generalRubric.js`, `rubricVariants`, `overallScore`, 10-point ở route chấm + dashboard + bảng xếp hạng; `runGeneralGrade` + prompt theo khối, server tự cộng tổng; mở Writing/Speaking, `RubricGrader`/`RubricResult`/`PromptsEditor`. Review thêm: AI nhận ảnh đề. |
| 2026-10-30 | 4 | Kiểm tổng: 447 test pass, tenant scope sạch, build qua. Probe Phase 8 232/232, G1 94/94; G0 lệch 8 assert cũ "General ẩn Writing/Speaking" — đúng dự kiến của G5. Gemini thật 1 bài Writing lớp 7: 5,5 s, 7 / 10, tiêu chí 2+2+1,5+1,5 do server cộng, nhận xét tiếng Việt, bắt đúng lỗi; override tổng sai -> 400; publish xong học sinh thấy 7 / 10. Trình duyệt: học sinh 375px, giáo viên desktop: không có Band/IELTS/Task 1-2. Chưa kiểm: Speaking với file ghi âm thật; descriptor rubric cần giáo viên đọc lại (đợt kiểm tổng cuối). |
