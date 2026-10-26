# PLAN — Phase 8B: TOEIC Speaking & Writing

> Đợt 2 của [PLAN-PHASE8-TOEIC.md](PLAN-PHASE8-TOEIC.md) (thay mục 7 "plan sơ bộ" ở file đó).
> Nền `program`, registry, bộ lọc, Part 1–7 Nghe/Đọc đã có từ 8A — file này chỉ nói phần Nói + Viết.
>
> **Người thi hành đọc kỹ mục 0 và mục 1 trước khi gõ dòng code đầu tiên.**

Trạng thái: ○ plan, chưa code · Ngày lập: 2026-10-22 · Branch: `phase-8-toeic` (cùng PR với 8A — chủ dự án muốn
xong cả 8A + 8B mới mở PR)

---

## 0. Luật chơi

### 0.1 8B làm gì

Mở **Writing** và **Speaking** cho chương trình TOEIC, ở cả Lesson lẫn Mock Test: dạng đề TOEIC, đồng hồ chuẩn bị/nói,
audio câu hỏi, rubric + chấm AI riêng theo thang TOEIC, và mọi chỗ đang hiện "Band" đổi thành điểm TOEIC.

### 0.2 Bất biến — IELTS không đổi gì (giữ nguyên luật 0.2 của 8A)

- Mọi nhánh mới gated bởi `program === "toeic"` hoặc `taskType` bắt đầu bằng `toeic.`. Prompt IELTS (không có
  `taskType`) đi đúng đường cũ, từng chữ.
- `lib/grading/prompts/writingSystem.js`, `speakingSystem.js`, `rubrics.json` (phần IELTS), `overallBand` **không đổi
  một ký tự**. `tests/aiGrade.test.js` đang ghim chúng — phải qua nguyên vẹn.
- Hai "bất thường" của IELTS tìm thấy khi khảo sát (Speaking AI không nhận đề; `runAiGrade` đọc `s.writingTask` không
  tồn tại) **không sửa ở 8B**. Ghi vào mục 8 "Để sau".

### 0.3 8B KHÔNG làm gì

- Không làm học sinh nhiều lớp / nhiều chương trình (phase riêng, sau 8B).
- Không bật điểm quy đổi 0–200 (giống L&R: có code, tắt bằng `SCALE_SOURCE` rỗng cho tới khi chủ dự án chọn bảng).
- Không làm AI sinh đề Writing/Speaking (hiện IELTS cũng chưa có).
- Không đổi cách tính ngân sách AI (vẫn toàn nền tảng, `lib/ai/budget.js`).
- Không làm thang điểm "Pronunciation / Intonation" tách riêng cho Q1–2 — chấm 1 điểm tổng 0–3 như các câu khác.

---

## 1. Quyết định (chủ dự án, 2026-10-22)

- **E1. Điểm thô từng câu.** Mỗi câu chấm theo thang TOEIC của câu đó (bảng 2.1). Hiện "Score 2/3". Mock Test hiện tổng
  điểm thô từng kỹ năng: "Speaking: 27/35 points", "Writing: 22/28 points". Ước tính 0–200 có hàm nhưng **tắt**
  (`SCALE_SOURCE` rỗng → `null` → không hiện), y như L&R.
- **E2. Mock Test Speaking như thi thật.** Từng câu: (phát audio câu hỏi nếu có) → đếm ngược chuẩn bị → **tự bắt đầu
  ghi** → đếm ngược nói → **tự dừng** → tự nộp → sang câu sau. Không ghi lại.
- **E3. Lesson = luyện tập tự do.** Có đồng hồ chuẩn bị/nói để tham khảo nhưng học sinh tự bấm, được ghi lại như hiện
  nay. Writing có đếm từ và kiểm 2 từ bắt buộc (Q1–5).
- **E4. Đề được gắn audio.** Giáo viên chọn audio từ thư viện cho đề (Speaking Q5–10). Phát xong mới đếm giờ. Không có
  audio thì hiện chữ như hiện nay.
- **E5 (mặc định của người lập plan, đổi được).** Mỗi câu vẫn là **một bài nộp** (`Submission`) như IELTS — chấm AI
  từng câu, giáo viên duyệt từng câu. Writing Q1–5 là 5 bài nộp ngắn → 5 lần gọi AI nhỏ. Chấp nhận ở V1.
- **E6 (mặc định).** Khi tải lại trang giữa Mock Test Speaking: câu đã nộp giữ nguyên, **câu đang dở làm lại từ đầu
  phần chuẩn bị** (không tính là bỏ lỡ). Lý do: rớt mạng/đóng nhầm tab không nên mất điểm; vẫn không cho ghi lại câu
  đã nộp.

---

## 2. Cấu trúc đề TOEIC S&W và cách map vào app

### 2.1 Registry dạng đề — `lib/toeicTasks.js` (mới, CommonJS, client-safe)

| `taskType` | Kỹ năng | Câu trong đề thật | Chuẩn bị | Trả lời | Thang | Cần | 
|---|---|---|---|---|---|---|
| `toeic.s.read` | speaking | Q1–2 Read a text aloud | 45s | 45s | 0–3 | đoạn văn (instructions) |
| `toeic.s.picture` | speaking | Q3–4 Describe a picture | 45s | 30s | 0–3 | ảnh |
| `toeic.s.respond` | speaking | Q5–7 Respond to questions | 3s | 15s / 15s / 30s | 0–3 | audio (khuyến nghị) |
| `toeic.s.info` | speaking | Q8–10 Respond using information | 45s đọc + 3s | 15s / 15s / 30s | 0–3 | ảnh/bảng + audio; Q10 phát 2 lần |
| `toeic.s.opinion` | speaking | Q11 Express an opinion | 45s | 60s | 0–5 | |
| `toeic.w.picture` | writing | Q1–5 Sentence about a picture | — | (8 phút cho cả 5) | 0–3 | ảnh + 2 từ bắt buộc |
| `toeic.w.email` | writing | Q6–7 Respond to a written request | — | 10 phút/câu | 0–4 | |
| `toeic.w.essay` | writing | Q8 Opinion essay (~300 từ) | — | 30 phút | 0–5 | |

Mỗi entry: `{ key, skill, label, shortLabel, maxScore, prepSeconds, responseSeconds, needsImage, needsAudio,
needsRequiredWords, wordTarget, aspects }`. `aspects` = các khía cạnh để giáo viên/AI nhận xét (không chấm điểm riêng),
ví dụ `toeic.w.email`: `["task", "organization", "vocabulary", "grammar"]`. Nguồn: các link ETS/IIBC ở mục 1.2 của
plan 8A. **Mô tả từng mức điểm (descriptor) tự viết lại bằng lời mình, không chép nguyên văn ETS**, en + vi như
`rubrics.json`, ghi URL nguồn tham khảo trong comment đầu file. Chủ dự án đọc duyệt descriptor trước khi merge.

Thời gian trong bảng là **mặc định** điền sẵn khi giáo viên chọn dạng đề; giáo viên sửa được từng đề.

### 2.2 Field mới trên `PromptSchema` (`lib/models/schemas/promptSchema.js`)

| Field | Kiểu | Default | Dùng cho |
|---|---|---|---|
| `taskType` | String, enum `TOEIC_TASK_KEYS` + `""` | `""` | `""` = IELTS (như cũ) |
| `requiredWords` | [String], tối đa 2 | `[]` | `toeic.w.picture` |
| `audioId` | ObjectId ref Audio | `null` | `toeic.s.respond`, `toeic.s.info` (cho phép mọi dạng speaking TOEIC) |
| `audioPlays` | Number 1–2 | `1` | Q10 phát 2 lần |
| `prepSeconds` | Number 0–600 | `null` | null = lấy mặc định của `taskType` |
| `responseSeconds` | Number 5–3600 | `null` | như trên. Writing: giây cho câu đó (Lesson chỉ để tham khảo) |

Prompt IELTS không có các field này (hoặc giá trị default) → mọi chỗ đọc phải coi như không có.

**Chỗ phải thêm field (khảo sát đã tìm ra, đừng bỏ sót):** `lib/testSections.js` `normalizePrompts` (~166) và
`validatePrompts`; `pages/api/admin/units.js` map prompt (~296–302) + kiểm ảnh tồn tại (~125); thêm kiểm **audio tồn tại
và thuộc workspace** giống ảnh; `lib/teacher/testBuilder.js` round-trip (~67–73, ~111–117); payload học sinh
`pages/api/units.js` (~125) và `pages/api/tests.js` (~49) trả thêm `taskType, requiredWords, audioUrl, audioPlays,
prepSeconds, responseSeconds` **chỉ khi `taskType` có** (prompt IELTS giữ đúng shape cũ `{id,title,instructions,imageUrl}`).

### 2.3 Luật server

- Prompt Writing/Speaking của Unit/Test **TOEIC** bắt buộc có `taskType` khớp kỹ năng (`toeic.w.*` cho writing,
  `toeic.s.*` cho speaking) → không thì 400. Prompt của Unit/Test **IELTS** gửi `taskType` khác `""` → 400.
  Live chưa có dữ liệu TOEIC (8A chưa deploy) nên không cần migration. Dev có vài prompt TOEIC bị ẩn từ đợt test —
  probe dọn đi.
- `toeic.w.picture` phải có đúng 2 `requiredWords` không rỗng và ảnh. `toeic.s.picture`/`toeic.s.info` phải có ảnh.
  `toeic.s.respond`/`toeic.s.info` không bắt buộc audio (E4: không có thì hiện chữ).
- `lib/curriculum.js`: TOEIC `lessonSkills` + `writing`, `speaking`; `testSkills` + `writing`, `speaking`;
  `defaultDurations` thêm `writing: 60, speaking: 20`. Bỏ các comment "8B: …".
- Lúc nộp bài (`pages/api/submissions.js` ~274, ~372): `rubricVariant` = `prompt.taskType` nếu có, không thì
  `resolveVariant(kind, prompt.writingTask)` như cũ.

---

## 3. Chấm điểm

### 3.1 `lib/grading/rubric.js` — tổng quát hoá, IELTS giữ nguyên

- `VARIANTS` thêm 8 key `toeic.*`. Helper mới: `isToeicVariant(v)`, `scoreRange(v)` → IELTS `{min:1,max:9}` mỗi
  criterion; TOEIC `{min:0,max:maxScore}`.
- Rubric TOEIC có **đúng 1 criterion chấm điểm**: key `"score"`, mức 0..maxScore, descriptor từ `lib/toeicTasks.js`
  (không nhét vào `rubrics.json` để file IELTS không đổi). `getRubric(v)` trả cùng shape cho cả hai.
- `validateCriteria(v, criteria)`: TOEIC → đúng 1 criterion `score`, số nguyên trong `[0, maxScore]`.
- Điểm tổng câu: IELTS `overallBand` (không đổi). TOEIC: `taskScore(v, criteria)` = điểm criterion `score`.
- `manualScore` vẫn là điểm tổng của bài nộp: IELTS band 0–9 step .5; TOEIC số nguyên 0..maxScore. Validate theo
  variant trong `pages/api/admin/submissions.js` PUT (~28–31 `validOverride`, ~162–179).

### 3.2 Hiển thị điểm — thay mọi chỗ "Band" khi variant là TOEIC

Helper chung `lib/scoreLabel.js` (client-safe): `formatScore(sub)` → IELTS `"Band 6.5"` (đúng chữ cũ), TOEIC
`"Score 2/3"`; `scorePct(sub)` → IELTS `band/9*100` (như cũ), TOEIC `score/max*100`. Thay ở:

- `app/student/lessons/[unitId]/page.js:623, :667`; `app/student/tests/page.js:126, :176`
- `lib/student/dashboard.js:29` (pct), `:109`, `:153`; `lib/student/skillBar.js` (TOEIC đã là %, giữ)
- `lib/notifications/student.js:12, :31, :33`
- `components/RubricResult.js:90, :101` + bảng criteria (TOEIC: 1 dòng "Score", descriptor của mức đạt được)
- `components/teacher/RubricGrader.js` (Task 1/Task 2 switch ẩn với TOEIC; select điểm 0..max; nhãn "Score" thay
  "Overall band"; override ẩn với TOEIC vì chỉ có 1 criterion)
- `app/admin/page.js:115`; `app/teacher/tests/[testId]/submissions/page.js:29` + `lib/teacher/testSubmissions.js:81,:92`
  (avgScore TOEIC = tổng điểm thô / tổng max của kỹ năng, hiện "22/28")
- `lib/student/leaderboard.js:19–23`: TOEIC cộng `score/max*9` (giữ cùng cỡ với band để bảng xếp hạng một lớp không lệch;
  IELTS không đổi). Ghi chú: một lớp chỉ có một chương trình nên không trộn.
- `lib/teacher/dashboard.js:145–159` (luật "điểm tụt"): so theo `scorePct` khi TOEIC; IELTS giữ nguyên phép so band.

Mock Test TOEIC: tổng kỹ năng = Σ điểm câu / Σ max, chỉ khi **mọi câu của kỹ năng đã chấm**; chưa đủ thì "x/y graded".
Ước tính 0–200: `lib/toeicScale.js` thêm `estimateToeicSW(skill, raw, max)` → `null` khi `SCALE_SOURCE` rỗng.

### 3.3 Annotation / nhận xét

- `lib/grading/annotate.js` `CRITERIA` thêm key khía cạnh TOEIC (vd `TK` task/relevance, `OR` organization, `VO`
  vocabulary, `GR` grammar, `PN` pronunciation, `IN` intonation & stress, `FL` fluency, `CT` content). Màu nhóm theo
  cách đang làm. Danh sách IELTS giữ nguyên thứ tự.
- `components/teacher/EssayAnnotator.js:33`, `SpeakingReview.js:13`, `RubricResult.js:45`: lấy danh sách criterion
  theo variant (TOEIC → `aspects` của `taskType`), không hard-code.

### 3.4 Chấm AI

- Prompt hệ thống mới: `lib/grading/prompts/toeicWritingSystem.js`, `toeicSpeakingSystem.js` — giám khảo TOEIC, nhận
  `taskType`, thang `0..maxScore`, descriptor từng mức, `aspects`. Writing gửi kèm đề (title, instructions), ảnh, 2 từ
  bắt buộc (`toeic.w.picture`: kiểm có dùng đúng cả 2 từ — thiếu thì tối đa 1 điểm, giống luật ETS), số từ mục tiêu.
  Speaking gửi audio bài nói + **đề (title, instructions, taskType)** — khác IELTS (IELTS không gửi đề; không sửa).
  Audio câu hỏi không gửi (chỉ gửi chữ của đề).
- Schema output TOEIC (`lib/grading/aiGradeSchema.js`, hàm riêng `toeicGradeSchema(variant)`): `{ score (int 0..max),
  comment, aspects:[{key, comment}], annotations (criterion ∈ aspects), priorities, improvedSample (writing),
  transcript + speakingNotes (speaking) }`. `validateToeicGrade` kiểm `score` trong khoảng; server không tin số ngoài
  khoảng.
- `lib/grading/runAiGrade.js`: rẽ nhánh theo `isToeicVariant(s.rubricVariant)` → prompt/schema TOEIC; `persistDraft`
  ghi `criteria=[{key:"score", band:score}]`, `manualScore=score`. Ngân sách, AiLog (`purpose` `"grading.toeic.writing"`
  / `"grading.toeic.speaking"`), GradingJob, demo-block: dùng chung đường cũ.
- Test: `tests/toeicGrade.test.js` — schema/validate/normalise TOEIC, rubric TOEIC, `formatScore`; `aiGrade.test.js`
  không sửa.

---

## 4. Giáo viên — soạn đề

- `components/teacher/PromptsEditor.js` nhận thêm `program` (truyền từ `app/teacher/lessons/[unitId]/page.js:817` và
  `app/teacher/tests/[testId]/page.js:298`). IELTS: y như cũ (Task 1/Task 2). TOEIC:
  - Select **Task type** (chỉ các dạng của kỹ năng đang mở). Chọn xong điền sẵn thời gian (sửa được), hiện field cần
    theo registry: ảnh (bắt buộc với picture/info), 2 ô **Required words** (w.picture), chọn **audio** từ thư viện
    (s.respond/s.info, có "Play twice" cho Q10), Prep / Response (giây).
  - Đề chưa chọn task type → báo lỗi ngay ở form, không cho lưu.
- `lib/teacher/useMediaLibraries.js` / `MediaLibrary`: kiểm PromptsEditor có lấy được danh sách audio (Listening đã dùng).
- Mock Test builder TOEIC: nút **"Add standard TOEIC set"** ở Writing (8 đề: 5 picture + 2 email + 1 essay) và Speaking
  (11 đề: 2 read + 2 picture + 3 respond + 3 info + 1 opinion, câu 10 `audioPlays: 2`), đề rỗng đúng `taskType` +
  thời gian, đánh tiêu đề "Question N". Chỉ hiện khi kỹ năng đang trống. Thời lượng kỹ năng mặc định 60 / 20 phút.
- Unit editor TOEIC: bỏ dòng "Writing content is hidden for TOEIC" (8A), mở tab Writing/Speaking.

## 5. Học sinh

### 5.1 Lesson (E3 — luyện tập tự do), `components/student/PromptBlock.js`

- Prompt có `taskType` TOEIC:
  - Speaking: hiện nhãn dạng đề, nút phát audio đề (nếu có, `audioPlays` lần), **đồng hồ tham khảo** "Prep 0:45 ·
    Speak 0:45" có nút Start (đếm prep rồi đếm speak, đổi màu khi hết giờ), ghi âm vẫn bấm tay, **không tự dừng**,
    ghi lại được như hiện nay.
  - Writing: **đếm từ** dưới ô viết (+ mục tiêu ~300 với essay), `toeic.w.picture` hiện 2 chip từ bắt buộc, chip
    chuyển ✓ khi bài có từ đó (so khớp không phân biệt hoa thường, chấp nhận biến thể -s/-ed/-ing đơn giản; chỉ để
    gợi ý, không chặn nộp).
- Prompt IELTS: DOM không đổi.

### 5.2 Mock Test Writing TOEIC — `app/student/tests/[testId]/[skill]/page.js`

- Giữ `Countdown` cấp kỹ năng (60 phút) + force-submit khi hết giờ như IELTS. Mỗi đề có đếm từ + chip từ bắt buộc
  như 5.1. Tiêu đề nhóm "Questions 1–5 · Write a sentence based on a picture" (dùng lại ý `partHeadings` của 8A).

### 5.3 Mock Test Speaking TOEIC (E2 — như thi thật) — component mới `components/student/ToeicSpeakingRunner.js`

1. Màn bắt đầu: kiểm micro (`getUserMedia`), thử ghi 3 giây phát lại; micro bị chặn → báo lỗi, không cho bắt đầu.
2. Lần lượt từng đề: hiện đề (+ ảnh) → phát audio đề (`audioPlays` lần, không tua) → đếm ngược **prep** (beep khi
   hết) → **tự bắt đầu ghi** → đếm ngược **response** + thanh tiến độ → **tự dừng** → upload + nộp ở nền (dùng
   `api.student.uploadSpeakingAudio` + submit như `SpeakingPrompt`) → đề sau. Không có nút ghi lại; có nút "Finish
   early" để dừng sớm phần nói.
3. Tiến độ lưu `localStorage` (key theo test + học sinh): chỉ số đề hiện tại + các đề đã nộp. Tải lại → đề đã nộp bỏ
   qua, đề đang dở làm lại từ prep (E6).
4. Upload lỗi → thử lại 2 lần; vẫn lỗi → giữ blob trong bộ nhớ, hiện "Retry upload" ở cuối, không chặn các đề sau.
5. `Countdown` cấp kỹ năng: **ẩn** với TOEIC Speaking (thời gian do từng đề quyết định); `durationMinutes` chỉ làm mốc
   an toàn — hết thì force-submit những gì đã ghi.
6. Kết thúc: "Speaking submitted — x/11 recorded", về danh sách Mock Test.

- Ghi âm: tách logic MediaRecorder của `SpeakingPrompt` thành hook `lib/client/useRecorder.js` để Runner và PromptBlock
  dùng chung; `SpeakingPrompt` IELTS dùng hook nhưng hành vi/DOM giữ nguyên.

---

## 6. Các bước thi hành

Mỗi bước là một commit. Sau mỗi bước: `npm test` qua, `check-tenant-scope --strict` qua. Không chạy `next build` khi dev
server đang chạy. **Sonnet code, Opus review từng bước** (memory: delegate-coding-to-sonnet).

1. **Registry + schema + server** — `lib/toeicTasks.js` (kèm descriptor en/vi), field 2.2, normalizer/validator 2.2–2.3,
   payload học sinh, mở skill trong `lib/curriculum.js`, `rubricVariant` lúc nộp. Sửa test đang ghim TOEIC không có
   writing/speaking (`curriculum.test.js:126–133`, `toeicBuilder.test.js:188–223`, `programEnforce.test.js` phần
   completion). Test mới cho validator.
2. **Rubric + điểm + hiển thị** — mục 3.1–3.3, `lib/scoreLabel.js`, mọi chỗ ở 3.2, RubricGrader/RubricResult/annotator.
3. **Chấm AI TOEIC** — mục 3.4 + `tests/toeicGrade.test.js`. Gọi Gemini thật **một lần mỗi loại** (1 writing, 1 speaking)
   trên dev để kiểm schema — chủ dự án đồng ý trước vì tốn tiền AI.
4. **Soạn đề** — mục 4.
5. **Học sinh Lesson + Mock Writing** — 5.1, 5.2, hook `useRecorder`.
6. **Mock Speaking như thi thật** — 5.3.
7. **Kiểm thử tổng** — mở rộng `scripts/_probe-phase8-TMP.js`: validator 2.3, nộp bài TOEIC S/W lấy đúng variant,
   chấm tay qua PUT (điểm ngoài khoảng → 400), IELTS PUT không đổi; fixture `--keep` thêm Unit + Mock Test TOEIC S/W
   (audio giả). Trình duyệt: giáo viên soạn đề + bộ chuẩn, học sinh Lesson + Mock Speaking chạy hết 11 câu (micro giả
   của trình duyệt nếu được), chấm tay, kết quả "Score x/y". Workspace IELTS-only: Writing/Speaking/Grading y như cũ.
   Rồi mới: backfill dev, `next build`, dọn probe, xoá script tạm, mở PR 8A+8B.

## 7. Rủi ro

| # | Rủi ro | Chặn bằng |
|---|---|---|
| S1 | Đổi rubric/grading làm lệch điểm IELTS | Mọi nhánh theo variant; `aiGrade.test.js` ghim IELTS; probe PUT IELTS trước/sau |
| S2 | Ghi âm tự động lỗi trên iOS Safari (MediaRecorder, autoplay audio) | Màn kiểm micro trước khi bắt đầu; audio đề phát sau một lần chạm của học sinh; kiểm trên điện thoại ở bước 7 |
| S3 | Mất bài nói khi rớt mạng giữa Mock | Upload nền + thử lại + "Retry upload"; tải lại trang làm lại đề đang dở (E6) |
| S4 | Chi phí AI tăng (19 bài nộp / 1 Mock S+W) | Chấm AI vẫn do giáo viên bấm; budget chung chặn như cũ; ghi rõ trong log để theo dõi |
| S5 | Descriptor tự viết bị hiểu là rubric ETS chính thức | Ghi "based on the public TOEIC scoring guides" + chủ dự án duyệt nội dung |
| S6 | Học sinh hiểu điểm thô là điểm TOEIC 0–200 | Luôn hiện dạng "x/y points"; 0–200 tắt |

## 8. Để sau

- Speaking IELTS: gửi đề cho AI; dọn `s.writingTask` không tồn tại trong `runAiGrade.js:164`.
- Bảng quy đổi 0–200 (cùng lúc với bảng 5–495 của L&R).
- Chấm AI hàng loạt cả Mock Test một nút.
- Pronunciation / Intonation tách điểm cho Q1–2.
- Học sinh nhiều lớp / nhiều chương trình (phase riêng).

## 9. Nhật ký thi hành

> Người thi hành ghi vào đây sau mỗi bước: đã làm gì, lệch gì so với plan, kiểm chứng bằng gì.

### 2026-10-22 — Bước 1: registry + schema + server

- `lib/toeicTasks.js` (client-safe): 8 dạng đề, thời gian mặc định, `aspects` (mã TK/OR/VO/GR/PN/IN/FL/CT + `ASPECT_LABELS`), descriptor en/vi từng mức
  0..max (tự viết lại, **chờ chủ dự án đọc duyệt**, nguồn ghi trong comment đầu file), helper `toeicTask`, `isToeicTaskType`, `tasksForSkill`,
  `effectivePrep/Response`, `publicTaskFields`. `s.respond`/`s.info` mặc định nói 15s (giáo viên đặt 30s cho câu cuối; bộ đề chuẩn bước 4 làm hộ);
  `s.info` prep = 45 (phần đọc, 3s sau bỏ qua); `w.picture` = 96s/câu (8 phút / 5).
- `PromptSchema` thêm 6 field (mục 2.2). `lib/testSections.js`: `promptTaskFields` (chỉ thêm field khi `taskType` có -> prompt IELTS giữ shape cũ),
  `promptTaskError` (luật 2.3, không chạm DB), `validatePrompts(ws, prompts, { program, skill })` kiểm thêm audio thuộc workspace. `admin/tests.js`
  truyền `program` (POST: program của request; PUT: `programOf(test)` sau khi áp đổi chương trình); `admin/units.js` `validateCategories` nhận
  `program`, kiểm taskType + audio tồn tại/thuộc workspace và map prompt qua `promptTaskFields`. Lỗi trả `400 { ok:false, error }` dạng
  `"<skill>: Prompt N: ..."`.
- Payload học sinh (`api/units.js`, `api/tests.js`): populate `audioId`, thêm field TOEIC qua `publicTaskFields` chỉ khi có `taskType`.
- `lib/curriculum.js`: TOEIC mở writing/speaking (lesson + test), `defaultDurations` 60/20. `testBuilder.js` round-trip field task; `submissions.js`
  `rubricVariant = prompt.taskType || resolveVariant(...)`.
- **Lệch/ghi chú:** (a) `audioPlays` yêu cầu số nguyên; giây chỉ kiểm khoảng (không bắt nguyên). (b) `builderToPayload` / unit editor vốn đã đọc
  registry nên không phải sửa logic, chỉ sửa comment. (c) Các test "kỹ năng ẩn" (completion/deadlines/streak) vẫn giữ để bảo vệ logic lọc: chúng tạm sửa
  `PROGRAMS.toeic.lessonSkills` trong `withHiddenWritingSpeaking` rồi khôi phục. (d) Unit/Test TOEIC có prompt cũ không `taskType` giờ bị 400 khi lưu
  (đúng plan 2.3; UI soạn đề TOEIC chưa có tới bước 4, nên tạm thời chưa thể tạo prompt TOEIC từ giao diện).
- **Cần lưu ý cho bước 2/3:** `rubricVariant` kiểu `toeic.w.email` chưa có trong `VARIANTS` -> `getRubric` trả `null`. Đường đọc an toàn
  (`RubricResult` dùng `rubric?.`, `RubricGrader` hiện "Grading rubric not found."). Đường ghi: `PUT admin/submissions` trả 400 "Unknown grading rubric";
  `runAiGrade` (bấm chấm AI) sẽ đưa rubric rỗng vào prompt IELTS -> chưa dùng được cho bài TOEIC tới bước 2–3.
- Kiểm: `npm test` (139 test, qua), `check-tenant-scope --strict` qua, nạp `PromptSchema` bằng mongoose (default, enum, tối đa 2 từ).
  **Chưa kiểm:** chưa chạy với DB/route thật (không động tới MongoDB), chưa kiểm UI.

### 2026-10-22 — Bước 2: rubric + điểm + hiển thị

- **Rubric/điểm:** `lib/grading/rubric.js` thêm 8 variant `toeic.*` (dựng từ `lib/toeicTasks.js`, 1 criterion `score` mức 0..max, không đụng `rubrics.json`),
  `isToeicVariant`, `scoreRange`, `taskScore`, `annotationCriteria`; `validateCriteria` TOEIC = đúng 1 criterion `score`, số nguyên 0..max. IELTS giữ nguyên
  (`getRubric` chỉ đổi sang `hasOwnProperty` để `"constructor"`... không lọt). `pages/api/admin/submissions.js` PUT: bài TOEIC luôn chấm theo `rubricVariant` đã nộp,
  điểm ngoài khoảng -> 400 (cả bản nháp, trừ để trống), overall = `taskScore`, bỏ qua `manualScore` override; luồng "chấm nhanh" (không `criteria`) cũng kiểm khoảng với bài TOEIC.
- **Hiển thị:** `lib/scoreLabel.js` (`formatScore`, `scorePct`, `scoreMax`, `toeicTotals`, `toeicSkillSummary`). Thay "Band" ở student lessons/tests, `lib/student/dashboard.js`
  (TOEIC: pct = trung bình % điểm thô, không có band), `notifications/student.js`, `RubricResult` ("Score x/max", 1 dòng), `RubricGrader` (ẩn Task 1/2 + override, select 0..max),
  `app/admin/page.js`, bảng giáo viên Mock Test **và** Lesson (`testSubmissions.js`/`unitSubmissions.js` thêm `toeic/scoreSum/maxSum` chỉ khi có bài TOEIC; UI "22/28" khi mọi đề đã chấm,
  không thì "x/y graded"), `leaderboard.js` (TOEIC `score/max*9`, làm tròn 2 số lẻ), `teacher/dashboard.js` (luật tụt: TOEIC so `scorePct`, ngưỡng = 0.5/9*100 ≈ 5.6%, nhãn "Score ↓ 3/4 → 2/4").
  Mock Test student: "Speaking: 27/35 points" / "x/y graded" ở dòng Results và ô kỹ năng. `estimateToeicSW` trong `toeicScale.js` luôn `null` (gate `SCALE_SOURCE`, TODO bảng).
  API: `pages/api/student/dashboard.js` và `admin/dashboard.js` select thêm `rubricVariant` (và `recent` trả `rubricVariant`); các API còn lại đã trả full row.
- **Annotation:** `annotate.js` tách `IELTS_CRITERIA` (thứ tự cũ) + `TOEIC_CRITERIA`, `CRITERIA` = nối cả hai; `aiGradeSchema.js` ghim enum/fallback IELTS vào `IELTS_CRITERIA` (output schema IELTS không đổi).
  `EssayAnnotator`/`SpeakingReview` nhận `variant`; `RubricResult` lấy khía cạnh từ variant TOEIC. Màu tô theo *category* chứ không theo criterion nên không có "nhóm màu" mới để thêm.
- Dọn comment "TOEIC 8A: không có Writing/Speaking" (6 chỗ trong plan + vài chỗ tương tự: `lessons/page.js`, `api/units.js`, `curriculum.js`).
- **Lệch plan:** (a) đổi cả bảng Lesson (`unitSubmissions`) không chỉ Mock Test vì cùng bất hợp lý khi trộn thang 0–3/0–5; (b) chưa làm gì cho AI (`runAiGrade` vẫn rẽ IELTS cho variant TOEIC — bước 3);
  (c) ngưỡng "điểm tụt" TOEIC theo % là lựa chọn của người thi hành, chủ dự án có thể chỉnh.
- Kiểm: `tests/toeicScore.test.js` (13 test mới), `npm test` 150 pass / 0 fail, `check-tenant-scope --strict` qua; các trang đổi biên dịch được trên dev server (HTTP 200, không lỗi module).
  **Chưa kiểm:** UI chấm/hiển thị TOEIC bằng mắt (dev không có bài TOEIC S&W đã nộp), IELTS "Band …" trên trình duyệt (dev không có bài Writing/Speaking đã chấm), không chạy với DB (PUT chấm tay).

### 2026-10-23 — Bước 3: chấm AI TOEIC

- **Đã làm:** `lib/grading/prompts/toeicWritingSystem.js` / `toeicSpeakingSystem.js` (`buildSystem(variant)` + `buildPrompt(...)`) và `toeicShared.js` (thang điểm + descriptor en từng mức, khía cạnh,
  `neutralise`). Writing gửi đề (title/instructions), ảnh (inline như IELTS), 2 từ bắt buộc + luật "thiếu từ nào -> tối đa 1 điểm, chấp nhận biến thể -s/-ed/-ing", `wordTarget` khi có.
  Speaking gửi audio bài nói (Cloudinary -> mp3, như IELTS) + đề (title, instructions, tên dạng đề); không gửi audio câu hỏi. `aiGradeSchema.js` thêm `toeicGradeSchema(variant)` (Writing/Speaking, enum
  khía cạnh theo dạng đề), `toeicFieldSpec`, `validateToeicGrade`, `normaliseToeicGrade`, `normaliseToeicSpeaking` (quote -> offset bằng `resolveAnnotationsFromQuotes`/`reconcileAnnotations`, cap 12 như IELTS).
  `runAiGrade.js`: nếu `isToeicVariant(s.rubricVariant)` -> `runToeicGrade` (AiLog `purpose` `grading.toeic.writing|speaking`; `generateJSON` — ngân sách, chuỗi model, AiLog — và GradingJob/demo-block
  dùng chung đường cũ); nhánh IELTS không đụng. Điểm ngoài 0..max / không nguyên / khía cạnh lạ = lỗi validate -> `flagAiLog` + throw giống IELTS (job báo lỗi), **không kẹp**.
- **Draft trả về:** `criteria:[{key:"score", band:score, comment}]`, `suggestedOverall = score` (persistDraft ghi `manualScore`), `overallFeedback = comment` tổng, `annotations`, `priorities`, `topicVocabulary`
  (0–5, có thể rỗng), `improvedSample`; Speaking thêm `transcript`, `speakingNotes`, `mainIssue`. **Nhận xét từng khía cạnh:** RubricGrader/RubricResult chỉ có ô ghi chú cho criterion `score` nên
  gộp vào `criteria[0].comment`, mỗi khía cạnh một dòng "Nhãn: nhận xét" (`Task / relevance: ...`); mảng `aspects:[{key,comment}]` còn trong draft/GradingJob.result nhưng không lưu thành field riêng của Submission.
  `persistDraft` và `ai-grade.js` không có kiểm tra IELTS-only nên không phải sửa.
- **Lệch/ghi chú:** (a) Speaking có ảnh (`s.picture`/`s.info`) thì gửi kèm ảnh (plan chỉ nói audio + chữ) — không có ảnh thì không chấm "mô tả tranh" được. (b) Thêm `topicVocabulary` tuỳ chọn (plan không liệt kê) để
  UI Suggested Actions hiện như IELTS. (c) `mainIssue` chỉ có ở Speaking, như IELTS. (d) Luật "thiếu từ bắt buộc -> ≤1" chỉ nằm trong prompt, server không kiểm lại bằng so khớp chuỗi (chưa có quyết định cho việc đó).
  (e) `loadToeicTaskPrompt` mới (đọc theo `s.kind`, trả `requiredWords`) thay vì sửa `loadTaskPrompt` IELTS (giữ nguyên bất biến); hai bất thường IELTS ở mục 8 vẫn chưa sửa.
- **IELTS không đổi, chứng minh bằng:** `tests/ieltsAiRequestPin.test.js` — chạy `runAiGrade` thật với DB/Gemini/fetch giả (`tests/helpers/runAiGradeHarness.js`), ghim sha256 của request gửi Gemini
  (system prompt + user prompt + responseSchema + mimeType audio/ảnh + model chain + purpose) cho 5 ca: Writing Task 1 có ảnh / không ảnh có số liệu / không ảnh không số liệu, Task 2, Speaking. Hash lấy từ code TRƯỚC
  khi sửa `runAiGrade`/`aiGradeSchema` rồi vẫn khớp sau khi sửa. `aiGrade.test.js` không sửa, vẫn qua.
- **Kiểm chứng:** `tests/toeicGrade.test.js` (15 test: prompt, schema, validate nhận/từ chối, normalise, `runAiGrade` TOEIC end-to-end với model giả cho Writing + Speaking trong Mock Test + điểm sai -> flag/lỗi + từ chối
  bài rỗng/thiếu audio/lệch kỹ năng); `npm test` 166 pass / 0 fail (2 skip có sẵn); `check-tenant-scope --strict` qua. Script tay `scripts/_ai-toeic-smoke-TMP.js --dev --submission <id>` (chỉ DB dev, in kết quả, không ghi
  bài nộp; vẫn ghi AiLog/AiSpend vì đi qua `generateJSON`) — xoá cùng đợt dọn probe bước 7.
- **Chưa kiểm:** **chưa gọi Gemini thật** (cả Writing lẫn Speaking) — schema Gemini nhận hay không, chất lượng chấm, định dạng audio mp3 cho bài TOEIC chưa biết, chờ chủ dự án đồng ý chạy smoke script; chưa chạy với DB/route thật
  (job -> persistDraft); chưa xem UI RubricGrader nạp draft TOEIC bằng mắt (dòng nhận xét khía cạnh hiển thị trong ô note có xuống dòng hay không).

### 2026-10-23 — Bước 4: soạn đề TOEIC S&W

- **Đã làm:** `lib/toeicStandardSet.js` (thuần, client-safe): `standardSet(skill)` (Writing 8 đề, Speaking 11 đề, "Question N", thời gian mặc định, 15/15/30 cho câu 5–7 và 8–10, câu 10 `audioPlays: 2`),
  `taskDefaults` (điền giây mặc định khi chọn dạng đề, không đè giá trị đã sửa; đổi dạng đề thì giá trị còn đúng bằng mặc định của dạng cũ mới đổi theo), `blankToeicPrompt`, `promptCues` / `toeicPromptsError`
  (field thiếu theo registry, câu lỗi dạng "Writing: Prompt 3: choose a task type."). `PromptsEditor` nhận `program` + `standardSet`: TOEIC có ô Task type (bắt buộc, kèm dòng gợi ý "Write 10 min · scored 0–4 …" và
  "Still needed: …" màu đỏ), ảnh (required/optional), 2 ô Required words, audio + "Play twice", Prep/Speak (placeholder = mặc định); Task 1/2 radio ẩn với TOEIC; IELTS giữ nguyên DOM. Nút "Add standard TOEIC set"
  chỉ ở Mock Test builder khi kỹ năng đang trống. `testBuilder.js` export `taskFieldsToBuilder/Payload`; unit editor dùng chúng (trước đó bị bỏ rớt field khi load/save unit). Cả hai trang chặn lưu phía client khi
  prompt TOEIC thiếu dạng đề / tiêu đề / đề / ảnh / từ bắt buộc (nhảy tới tab lỗi) trước khi gọi server.
- **Lệch/ghi chú:** (a) dòng "Writing content is hidden for TOEIC" không còn là chuỗi cố định mà là thông báo chung `hiddenWithContent` (chỉ hiện khi kỹ năng ẩn có dữ liệu) — Writing/Speaking đã mở nên tự biến mất, không phải sửa.
  (b) `useMediaLibraries` đã có audio; admin GET units/tests không populate `audioId` của Writing (không cần) — Speaking của test đã populate, unit trả id thô nên `refId` đủ dùng. (c) Kiểm client không chặn khoảng giây — server trả
  "Prompt N: Response time must be between 5 and 3600 seconds." (đã thử, hiện đúng trong khung lỗi). (d) `scripts/_probe-phase8-TMP.js`: prompt Writing ẩn của unit TOEIC thêm `taskType: "toeic.w.essay"` vì bước 1 đã chặn prompt không taskType.
- **Kiểm chứng:** `tests/toeicSet.test.js` (7 test), `npm test` qua, `check-tenant-scope --strict` qua. Trình duyệt (workspace Probe P8): unit TOEIC thấy tab Writing/Speaking; thêm prompt email, lưu thiếu dạng đề -> lỗi rõ; lưu OK, tải lại giữ nguyên;
  Mock Test mới: Speaking "Add standard TOEIC set" -> 11 đề đúng, điền ảnh/audio, lưu, tải lại giữ nguyên (kể cả Play twice câu 10); Writing 8 đề, 5 picture + 2 từ bắt buộc lưu/tải lại đúng. Workspace IELTS-only: Writing/Speaking
  trong unit và Mock Test y như cũ (radio Task 1/2, không có field/nút TOEIC).
- **Chưa kiểm:** ảnh/audio trong thư viện probe là giả (không xem/nghe được); chưa kiểm trên điện thoại; tải lại dữ liệu Writing/Speaking của Unit với nhiều prompt (chỉ thử 2 prompt).

### 2026-10-23 — Bước 5: học sinh Lesson + Mock Writing TOEIC, hook useRecorder

- **Đã làm:**
  - `lib/client/useRecorder.js`: tách trọn logic `MediaRecorder` của `SpeakingPrompt` thành hook (`recording`, `blob`, `blobUrl`, `hint`, `start`, `stop`, `toggle`, `clear`, `getBlob`, dọn stream khi unmount) dùng chung cho Lesson, Mock IELTS và runner Mock Speaking TOEIC (bước 6). `SpeakingPrompt` của IELTS dùng hook nhưng DOM, chữ và luồng nộp giữ nguyên.
  - `lib/toeicTasks.js`: thêm helper thuần `countWords`, `formatTimerSec`, `hasRequiredWord` (khớp từ/cụm không phân biệt hoa thường + biến thể đơn giản `-s`/`-es`/`-ies`/`-ves`, `-ed`/`-d`/`-ied`/gấp đôi phụ âm, `-ing`/bỏ `e` câm/`-ying`/gấp đôi phụ âm/`-king`; chỉ gợi ý trên UI, không chặn nộp).
  - `lib/partGroups.js`: thêm `groupPromptsByTask(prompts)` gom các đề Writing TOEIC liền kề cùng `taskType` thành nhóm có tiêu đề `"Questions M–N · <task.label>"` hoặc `"Question N · <task.label>"` (prompt IELTS không có `taskType` trả `label: ""`).
  - `components/student/PromptBlock.js` + `styles/legacy.css`:
    - `WritingPrompt`: khi đề có `taskType` Writing TOEIC, hiện 2 chip `requiredWords` cho `toeic.w.picture` (đổi sang `✓ <word>` + `.is-used` khi bài viết có từ đó) và dòng đếm từ `.toeic-word-count` dưới ô viết (đề `toeic.w.essay` hiện thêm `· Target: ~300 words`).
    - `SpeakingPrompt`: khi đề có `taskType` Speaking TOEIC, hiện `ToeicSpeakingPracticeBar` gồm nhãn dạng đề (`task.label`), nút phát audio câu hỏi nếu có `prompt.audioUrl` (tối đa `audioPlays` lần), và đồng hồ tham khảo `"Prep 0:45 · Speak 0:45"` kèm nút `Start` / `Reset` (đếm chuẩn bị -> nói -> đổi màu khi hết giờ; học sinh vẫn tự bấm `Start Recording` / `Stop Recording`, không tự dừng).
  - `app/student/tests/[testId]/[skill]/page.js`: nhánh `!isQuestion` giữ nguyên `Countdown` cấp kỹ năng (60 phút) + `forceSubmitPrompts` khi hết giờ; với `skill === "writing" && programOf(test) === "toeic"`, gom đề bằng `groupPromptsByTask` và hiện `<h4 className="part-heading">{g.label}</h4>`, mỗi đề dùng `WritingPrompt` có đếm từ + chip từ bắt buộc.
- **Lệch/ghi chú:** (a) Các hàm thuần `countWords`, `formatTimerSec`, `hasRequiredWord` đặt ở `lib/toeicTasks.js` và `groupPromptsByTask` đặt ở `lib/partGroups.js` (thay vì trong `PromptBlock.js` vốn là ESM client component) để `tests/toeicStudent.test.js` (CommonJS `node --test`) import trực tiếp được. (b) Ngoài `hasRequiredWord` cho từ đơn với biến thể `-s/-ed/-ing`, hỗ trợ luôn cụm nhiều từ (như giới từ/liên từ kép `because of`, `in order to`) thường gặp ở TOEIC Writing Q1–5.
- **Kiểm chứng:** `tests/toeicStudent.test.js` (+3 test mới cho `countWords`/`formatTimerSec`, `hasRequiredWord`, `groupPromptsByTask`), `npm test` (178 test: 176 pass / 0 fail / 2 skip có sẵn), `node scripts/check-tenant-scope.js --strict` qua (0 vi phạm). Trình duyệt (`localhost:3000`, tài khoản `probe.p8.toeic` / `123456` và `probe.p8.ielts` / `123456`): kiểm Lesson Writing TOEIC (đếm từ nhảy theo nội dung gõ, `Target: ~300 words` ở essay, 2 chip `passenger`/`board` chuyển `✓` + `.is-used` khi gõ `"Many passengers are boarding the plane now."`), Lesson Speaking TOEIC (nhãn dạng đề, nút phát audio câu hỏi `(1/2)`, đồng hồ tham khảo `Prep 0:45 · Speak 0:45` bấm `Start`/`Reset`, bấm ghi âm / dừng ghi âm thủ công qua `useRecorder` hiện audio preview), Mock Test Writing TOEIC (3 tiêu đề nhóm `Questions 1–5 · Write a sentence based on a picture`, `Questions 6–7 · Respond to a written request`, `Question 8 · Write an opinion essay`, 10 chip từ bắt buộc và 8 bộ đếm từ), và kiểm bất biến IELTS (`0` phần tử `.toeic-*` trên Writing/Speaking IELTS).
- **Chưa kiểm:** chưa kiểm trên Safari iOS thật; runner thi tự động một mạch của Mock Test Speaking TOEIC thuộc bước 6.

### 2026-10-26 — Bước 6: Mock Speaking TOEIC

- **Đã làm:**
  - `lib/toeicSpeakingFlow.js` (CommonJS, thuần, không phụ thuộc React/DOM): máy trạng thái `intro -> mic_recording -> mic_ready -> audio -> prep -> record -> uploading -> retry -> done`, hàm tính tiến độ từ danh sách đề + bài nộp trên server (`createInitialFlowState`, bỏ qua đề đã nộp trên server và cho đề đang dở làm lại từ phần chuẩn bị theo quyết định E6), xử lý phát audio câu hỏi 1–2 lần (`onAudioEnded`) và fallback khi audio hỏng (`onAudioError`), đếm ngược theo mốc thời gian tuyệt đối (`remainingSeconds`, `progressPct`), và `uploadAndSubmitWithRetry` (thử tối đa 3 lần = 1 lần đầu + 2 retry, giữ lại kết quả upload Cloudinary nếu bước submit mạng lỗi, chống nộp trùng).
  - `lib/client/useRecorder.js`: mở rộng thêm tuỳ chọn `keepStream = false` (mặc định `false` để IELTS và Lesson giữ nguyên hành vi cũ; `keepStream = true` giữ `MediaStream` xuyên suốt 11 câu của runner), cùng `ensureStream()` và `releaseStream()` để tắt micro khi kết thúc, hết giờ hoặc rời trang.
  - `components/student/ToeicSpeakingRunner.js` + `styles/legacy.css`: giao diện thi một mạch Mock Speaking TOEIC (màn kiểm micro 3s + nghe lại; mở khoá `<audio>` dùng chung + Web Audio `AudioContext` ngay khi bấm `Start test`; phát audio đề không tua; đếm ngược chuẩn bị kèm tiếng beep Web Audio khi hết; tự ghi âm + thanh tiến độ + nút `Finish early`; upload nền + màn `Retry upload` cuối bài nếu lỗi sau 3 lần; màn kết thúc `"Speaking submitted — x/11 recorded"`; mốc an toàn `durationMinutes` ẩn và `forceSubmit` tích hợp với `useTabSwitchGuard`).
  - `app/student/tests/[testId]/[skill]/page.js`: chỉ dùng `ToeicSpeakingRunner` khi `programOf(test) === "toeic"`, `skill === "speaking"` và mọi đề có `taskType` Speaking TOEIC; ẩn `Countdown` cấp kỹ năng trên giao diện; khi học sinh vào lại sau khi đã nộp thì hiện danh sách trạng thái từng đề (`"Submitted — pending teacher review."` / kết quả đã chấm) mà không chạy lại runner và không hiện nút ghi âm lại.
- **Lệch/ghi chú:** (a) Thêm nút phụ `"Finish without failed items"` bên cạnh `"Retry upload"` ở màn `retry` để học sinh vẫn thoát về màn kết thúc được nếu mất mạng hẳn. (b) Khi vào lại trang Speaking TOEIC sau khi bài thi đã kết thúc (do hết giờ hoặc tab-switch guard), những câu chưa kịp ghi hiện `"Not recorded."` thay vì để trống.
- **Kiểm chứng:** `tests/toeicSpeakingFlow.test.js` (6 test mới cho máy trạng thái, kiểm micro, luồng câu hỏi, audio hỏng, tải lại giữa chừng E6, retry upload 3 lần không nộp trùng, đếm ngược theo deadline), `npm test` (184 test: 182 pass / 0 fail / 2 skip có sẵn), `node scripts/check-tenant-scope.js --strict` qua (0 vi phạm). Trình duyệt (`localhost:3000`, `probe.p8.teacher` publish bài `"Probe TOEIC SW Mock"` giao cho lớp `"Probe TOEIC L1"`, đăng nhập `probe.p8.toeic` / `123456`): kiểm chặn `Start test` khi từ chối quyền micro; kiểm thu thử 3s + phát lại + mở `Start test`; kiểm ẩn `Countdown` cấp kỹ năng; chạy qua các câu, bấm `Finish early` ở câu 1; tải lại trang giữa câu 2 -> tự bỏ qua câu 1 đã nộp và làm lại câu 2 từ `Preparation time`; câu 5–10 có audio giả/hỏng -> hiện cảnh báo và chuyển thẳng sang chuẩn bị không treo; giả lập lỗi mạng ở câu 11 -> hiện màn `Retry upload` sau 3 lần thử -> bấm `Retry upload` thành công -> màn `"Speaking submitted — 11/11 recorded"`; vào lại trang hiện 11 dòng `"Submitted — pending teacher review."` không chạy lại runner; kiểm `probe.p8.ielts` vào `"Probe IELTS Mock 1"` Speaking có `0` phần tử `.toeic-*`, console không có lỗi mới.
- **Chưa kiểm:** dùng fake media stream của Chrome headless để thu thử/ghi âm và giả lập phản hồi upload Cloudinary (tránh đẩy 11 file beep rác lên Cloudinary thật); chưa kiểm bằng micro vật lý thật và chưa kiểm trên Safari iOS thật.

### 2026-10-26 — Bước 7: kiểm thử tổng (build + probe + ghi âm Speaking IELTS)

- **`next build`:** chạy trong git worktree riêng (`D:\Project\lta-build-wt`, detached @ `6be9d50`, `.env.local` copy, `node_modules` junction) nên không đụng `.next` của dev server. **Sạch** (compiled, lint + type check qua). Worktree đã xoá.
- **Probe dev DB** (`scripts/_probe-phase8-TMP.js`): **232/232** sau khi cập nhật. Chạy lần đầu **198/205**: 7 assertion cũ của 8A khẳng định "TOEIC không có Writing/Speaking" — đó là kỳ vọng đã hết hạn (8B cố ý mở hai kỹ năng này), không phải lỗi app. Đã đổi các assertion đó sang kỳ vọng 8B (TOEIC có đủ 6 kỹ năng, nộp Writing/Speaking TOEIC -> 201, `rubricVariant` = `taskType`, `program` = `toeic`) và thêm **mục 11** (24 phép kiểm): validator 2.3 qua API (Test + Unit: thiếu `taskType`, sai kỹ năng, picture thiếu ảnh / sai số từ bắt buộc, `audioPlays` 3, `responseSeconds` 2, đề IELTS mà có `taskType` TOEIC -> 400; bộ hợp lệ lưu và tải lại đúng), chấm tay TOEIC (điểm ngoài khoảng / không nguyên / sai key tiêu chí / publish không điểm -> 400, chấm đúng -> 200 và client không đổi được `rubricVariant`), chấm IELTS không đổi (6/6/7/7 -> 6.5, band 10 vẫn bị từ chối). Dọn sạch: 0 doc còn lại.
- **`check-tenant-scope --strict`:** 0 vi phạm. **`npm test`:** 182 pass / 0 fail / 2 skip.
- **Ghi âm + nộp Speaking IELTS (trình duyệt, workspace probe, học sinh `probe.p8.ielts`):** micro giả bằng WebAudio (đi qua `MediaRecorder` thật), upload Cloudinary được chặn bằng fetch giả (không đẩy file rác lên Cloudinary). Start Recording -> "Recording..." -> Stop -> preview audio + "Record Again"/"Submit Recording" -> Submit: blob 120 KB `audio/webm;codecs=opus` gửi đúng tên `recording.webm`, modal "Assignment submitted!", dòng "Submitted — pending teacher review.". DB: `kind speaking`, `program ielts`, `rubricVariant speaking`, `gradingStatus submitted`. Giao diện IELTS không có phần tử `.toeic-*`.
- **Phát hiện (có sẵn từ `main`, không do 8B; ĐÃ SỬA ở commit kế tiếp):** `SpeakingPrompt.doSubmit` chỉ `setBusy(false)` trong nhánh lỗi. Sau khi nộp thành công, bấm "Start Recording" ghi lại thì nút nộp lại kẹt "Uploading..." (disabled) đến khi tải lại trang. Đã so với `origin/main`: đoạn mã y hệt. **Chưa sửa** (giữ bất biến IELTS); sửa là thêm `setBusy(false)` sau khi nộp thành công.
- **Chưa kiểm:** Safari iOS / iPhone thật, micro vật lý, Cloudinary thật (cố ý không đẩy file), gọi Gemini thật cho chấm AI Writing/Speaking TOEIC, bảng quy đổi điểm D7 (`SCALE_SOURCE` vẫn rỗng, điểm quy đổi tắt), backfill dev/live chưa chạy.
