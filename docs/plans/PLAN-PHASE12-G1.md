# PLAN — Phase 12 · G1: Đủ dạng bài tiếng Anh phổ thông

> Tài liệu thi hành cho đợt **G1** của [PLAN-PHASE12-GENERAL-ENGLISH.md](PLAN-PHASE12-GENERAL-ENGLISH.md) (mục 1.5,
> 3, 5-G1). Chia việc + prompt Antigravity: [PLAN-PHASE12-G1-PROMPTS.md](PLAN-PHASE12-G1-PROMPTS.md).
>
> **Người thi hành đọc kỹ mục 0 và mục 2 trước khi gõ dòng code đầu tiên.**

Trạng thái: ◐ code xong trên branch `phase-12-general-g1`, đã kiểm (probe + trình duyệt), chưa merge · Ngày lập: 2026-10-26
Tiền đề: G0 xong (PR #20). Branch `phase-12-general-g1` cắt từ `phase-12-general-g0` (PR #20 chưa merge thì vẫn cắt
từ đó; merge `main` vào sau).

---

## 0. Luật chơi

### 0.1 G1 làm gì

Giáo viên General soạn được **20 dạng bài** ở mục 1.5 của plan tổng (trừ Writing đoạn văn và Speaking — G5), cả trong
**Grammar, Vocabulary & Pronunciation** (hôm nay hai tab này không có ô chọn dạng) lẫn Reading, Listening, Mock Test.
Ba thứ engine còn thiếu:

1. **Gạch chân** trong đề và trong lựa chọn (phát âm, tìm lỗi sai, từ đồng nghĩa).
2. **Sắp xếp từ thành câu** — học sinh bấm chọn từng mảnh, không phải gõ.
3. **Viết lại câu chấm được nhiều đáp án đúng** — so khớp khoan dung + nút "Accept this answer" để giáo viên duyệt
   thêm đáp án và chấm lại cả lớp.

### 0.2 Bất biến

1. **IELTS và TOEIC không đổi.** Danh sách dạng câu hỏi, cách chấm, cách hiển thị của hai chương trình này y như cũ.
   `tests/aiPromptPin.test.js` và `tests/programBranches.test.js` phải xanh.
2. **Luật chấm cũ không đổi** với câu không có `matchMode` (mọi câu hiện có trong DB). Chỉ câu mới có
   `matchMode: "sentence"` mới đi luật khoan dung.
3. **Đáp án không lộ.** Học sinh không bao giờ nhận `answers`, và các mảnh của câu sắp xếp phải ở thứ tự đã xáo.
4. Gạch chân chỉ được hiểu khi câu thuộc một dạng General có cờ gạch chân (theo `formatLabel`), nên chuỗi "____" (chỗ
   trống) trong dữ liệu IELTS cũ không bao giờ bị biến thành gạch chân.

### 0.3 G1 KHÔNG làm

- Khuôn đề, đánh số 1–40 liền (G2). Import Word (G3). Ngân hàng câu hỏi, nhãn chủ điểm ngữ pháp (G4).
- Chấm câu tự luận bằng AI.
- Bôi đen (highlight) trên chữ có gạch chân — xem 3.1.

---

## 1. Bảng dạng bài General

`questionFormatsFor(subject, "general")` (`lib/teacher/questionFormats.js`) trả danh sách theo **subject**:

| key | Nhãn (UI tiếng Anh) | kind | Cờ | grammar | vocabulary | reading | listening |
|---|---|---|---|---|---|---|---|
| `g-mcq` | Multiple choice | mcq | | ✓ | ✓ | ✓ | ✓ |
| `g-pron` | Pronunciation — odd one out | mcq | `underline: "options"` | | ✓ | | |
| `g-stress` | Word stress | mcq | | | ✓ | | |
| `g-comm` | Communication — best response | mcq | | ✓ | ✓ | | ✓ |
| `g-error` | Error identification | mcq | `underline: "label"`, `errorLetters: true` | ✓ | | | |
| `g-syn` | Synonym / Antonym | mcq | `underline: "label"` | | ✓ | ✓ | |
| `g-sign` | Signs & notices | mcq | `needsFieldImage` | | ✓ | ✓ | |
| `g-verb` | Verb form | fill | `matchMode: "sentence"` | ✓ | | | |
| `g-wform` | Word form | fill | `matchMode: "sentence"` | ✓ | ✓ | ✓ | |
| `g-cloze` | Cloze — multiple choice | mcq | | ✓ | ✓ | ✓ | |
| `g-ocloze` | Open cloze | fill | `noteMode`, `matchMode: "sentence"` | ✓ | | ✓ | |
| `g-tf` | True / False | mcq | `presetOptions: ["True","False"]` | | | ✓ | ✓ |
| `g-tfng` | True / False / Not Given | tfng | | | | ✓ | ✓ |
| `g-rq` | Answer the questions | fill | `matchMode: "sentence"` | | | ✓ | ✓ |
| `g-insert` | Sentence insertion [I]–[IV] | mcq | `presetOptions: ["[I]","[II]","[III]","[IV]"]` | | | ✓ | |
| `g-arrange` | Arrange sentences into a text | mcq | `arrange: true` (3.5) | ✓ | | ✓ | |
| `g-reorder` | Sentence building (reorder words) | reorder | `matchMode: "sentence"` | ✓ | ✓ | | |
| `g-rewrite` | Sentence transformation | fill | `matchMode: "sentence"`, câu mở đầu ở `pre` | ✓ | | | |
| `g-combine` | Sentence combination | fill | `matchMode: "sentence"` | ✓ | | | |
| `g-closest` | Closest meaning | mcq | | ✓ | | ✓ | |
| `g-phrase` | Guided phrase writing | fill | `matchMode: "sentence"` | | ✓ | | |
| `g-gap` | Gap fill | fill | `matchMode: "sentence"` | ✓ | ✓ | ✓ | ✓ |

- Mock Test General: ô `reading` ("Written paper") dùng **hợp của mọi cột** (tờ đề trộn mọi dạng); ô `listening` dùng
  cột listening.
- Nhãn ở cột "Nhãn" được lưu vào `formatLabel` như IELTS/TOEIC. Hằng số tên nhãn đặt trong `lib/generalFormats.js`
  (3.1) để server, builder và học sinh dùng chung.
- Danh sách IELTS tạm dùng cho General ở G0 bị thay hẳn. Câu General soạn ở G0 có `formatLabel` IELTS vẫn chấm đúng
  (chấm theo `type`), ô dropdown hiện "Choose a question type…" (`formatPlaceholder`, G0).

---

## 2. Thay đổi dữ liệu

### 2.1 `FieldSchema` (`lib/models/schemas/questionSchema.js`) — thêm 2 field, đều có default

| Field | Kiểu | Ý nghĩa |
|---|---|---|
| `matchMode` | `String`, enum `["", "sentence"]`, default `""` | `""` = luật chấm cũ. `"sentence"` = so khớp khoan dung (3.3) |
| `tokens` | `[String]`, default `[]` | Chỉ dạng `reorder`: các mảnh để học sinh sắp xếp, **lưu ở thứ tự đã xáo** |

Không backfill (default rỗng = hành vi cũ). Không đổi `type` enum: câu `reorder` lưu `type: "fill"`.

### 2.2 Đi trọn đường (round-trip) — mọi chỗ phải mang 2 field mới

- `lib/testSections.js` `normalizeSections`: giữ `matchMode` (chỉ nhận `""`/`"sentence"`) và `tokens` (mảng chuỗi đã
  trim, bỏ rỗng, tối đa 30 mảnh, mỗi mảnh ≤ 80 ký tự). **Chống lộ đáp án:** nếu `tokens.join(" ")` chuẩn hoá bằng
  đúng một đáp án trong `answers` (tức là chưa xáo), server tự xáo lại trước khi lưu (`shuffleTokens` ở 3.4).
  `validateSections`: câu có `tokens` phải là `type: "fill"`, có ≥ 2 mảnh và ≥ 1 đáp án.
- `lib/teacher/sectionTransforms.js`: `emptyField` (`matchMode: ""`, `tokens: []`), `fieldToServer` /
  `fieldFromServer` mang 2 field; editor kind mới `reorder` ↔ server `type: "fill"` + `tokens.length > 0`.
- `pages/api/units.js` `toPublicUnit` và `pages/api/tests.js` (hàm public tương ứng): danh sách field gửi học sinh
  **thêm `tokens`** (đã xáo). **Không** gửi `matchMode` (học sinh không cần) và tất nhiên không gửi `answers`.

---

## 3. Thiết kế từng phần

### 3.1 Gạch chân — `lib/underline.js` (mới, CommonJS thuần, dùng chung server + client)

- Cú pháp: `__chữ__` = gạch chân. Phần bên trong phải có ít nhất một ký tự không phải `_` và không xuống dòng.
  `____` (4+ gạch dưới liền, chỗ trống) **không** khớp.
- API: `parseUnderline(text)` → `[{ text, u: boolean }]`; `stripUnderline(text)` → chuỗi bỏ dấu `__`;
  `underlinedParts(text)` → mảng phần gạch chân (dùng cho tìm lỗi sai).
- `lib/generalFormats.js` (mới): hằng số nhãn General (bảng mục 1) + `underlineModeOf(formatLabel)` → `"label"`,
  `"options"` hoặc `null`; `isErrorIdFormat(formatLabel)`. Phía học sinh nhận diện theo `formatLabel` (giống cách
  `lib/letterQuestion.js` nhận diện dạng chữ cái), không cần biết chương trình.
- **Học sinh** (`components/student/questions.js`): câu có `underlineModeOf(field.formatLabel)` thì phần tương ứng
  (đề hoặc từng lựa chọn) render bằng component mới `UnderlinedText` (`<u>` cho phần gạch chân, escape như React
  mặc định — không dùng `dangerouslySetInnerHTML`). Những chữ này **không** đi qua `HL` (bôi đen) — đánh đổi chấp
  nhận được: đề phát âm / tìm lỗi rất ngắn. Chế độ xem lại cũng render gạch chân.
- **Tìm lỗi sai** (`errorLetters`): đề `My mother __usually go__ to __the__ market __every__ day __.__` → học sinh thấy
  mỗi phần gạch chân kèm chữ nhỏ (A)(B)(C)(D) theo thứ tự xuất hiện; lựa chọn là A–D.
- **Builder:** ô đề/lựa chọn của dạng có gạch chân hiện dòng gợi ý "Wrap underlined text in double underscores:
  `h__ea__d`" và một dòng **xem trước** render gạch chân. Dạng tìm lỗi sai: nút **"Build options from underlines"**
  sinh đúng N lựa chọn A, B, C… (N = số phần gạch chân, 2–4; khác số đó thì báo lỗi ngay ở builder) — giáo viên chỉ
  tick đáp án đúng. Server kiểm lại: câu `Error identification` phải có số lựa chọn = số phần gạch chân.
- **Giáo viên xem bài nộp** (unit-submissions, test-submissions): đề/đáp án hiện gạch chân bằng cùng `UnderlinedText`.

### 3.2 Sắp xếp từ thành câu — kind `reorder`

- **Builder** (`SectionsEditor` → `QuestionDetail`): ô "Correct sentence" (một câu đúng, có thể thêm câu đúng khác,
  mỗi dòng một câu → `answers`), nút **"Split into pieces"**: tách câu đầu theo `/` nếu giáo viên có dùng `/`, không
  thì theo khoảng trắng; dấu câu cuối (`.?!`) dính vào mảnh cuối; xáo bằng `shuffleTokens`. Danh sách mảnh sửa tay
  được (sửa chữ, gộp, thêm, xoá, xáo lại). `matchMode` tự đặt `"sentence"`.
- **Học sinh:** hai hàng — "Your sentence" (các mảnh đã chọn, theo thứ tự) và "Pieces" (mảnh chưa dùng). Bấm mảnh ở
  dưới → lên cuối câu; bấm mảnh ở trên → trả xuống. Nút "Clear". Giá trị nộp = các mảnh đã chọn nối bằng một khoảng
  trắng (string, đúng shape câu `fill`). Nút to, xuống dòng được, dùng tốt ở bề rộng 375px. Mảnh trùng chữ (vd hai
  chữ "the") vẫn là hai chip riêng (theo vị trí, không theo chữ).
- **Xem lại:** câu đã nộp + đúng/sai + "Correct answer: …" như câu `fill`.

### 3.3 So khớp câu khoan dung — `lib/sentenceMatch.js` (mới, CommonJS thuần)

`normalizeSentence(s)` áp **sau** `normalize` cũ của `lib/grade.js`:

1. Nháy cong `‘ ’ “ ”` → `' "`; gạch ngang dài `– —` → `-`.
2. Viết tắt → đầy đủ, theo bảng cố định: `n't` → ` not` (đặc biệt `won't` → `will not`, `can't` → `cannot`,
   `shan't` → `shall not`), `'m` → ` am`, `'re` → ` are`, `'ve` → ` have`, `'ll` → ` will`, `'d` → ` would`;
   `can not` → `cannot`. **Không** mở `'s` (vừa là `is`/`has` vừa là sở hữu cách — để giáo viên Accept nếu cần).
3. Bỏ mọi dấu câu ở cuối câu (`. ! ?` lặp), bỏ khoảng trắng trước dấu phẩy, chuẩn hoá khoảng trắng sau dấu phẩy.
4. Gộp khoảng trắng.

`lib/grade.js`: trong `isCorrect` và `pointsEarned`, nếu `field.matchMode === "sentence"` thì so bằng
`normalizeSentence(normalize(x))` ở cả hai vế; **không có `matchMode` thì code y như cũ** (bất biến 0.2.2).

### 3.4 Helper thuần dùng chung — `lib/generalFormats.js` / `lib/sentenceMatch.js`

- `splitTokens(sentence)` (3.2), `shuffleTokens(tokens, rng = Math.random)` — xáo đến khi khác thứ tự gốc (tối đa vài
  lần; câu 2 mảnh giống nhau thì chịu), có tham số `rng` để test được.
- `arrangeDistractors(order, n = 3, rng)` cho 3.5.

### 3.5 Sắp xếp câu thành đoạn (trắc nghiệm, `arrange`)

Builder: giáo viên gõ các câu a, b, c… vào đoạn văn của section như hôm nay, rồi ở câu hỏi gõ **thứ tự đúng**
(vd `b-d-a-c-e`) và bấm **"Generate options"** → 4 lựa chọn A–D gồm thứ tự đúng + 3 hoán vị nhiễu khác nhau, vị trí
đáp án đúng ngẫu nhiên, đáp án đúng được tick sẵn. Lưu như câu `mcq` thường — không đổi gì phía học sinh và chấm.

### 3.6 "Accept this answer" — duyệt thêm đáp án, chấm lại

- **Ở đâu:** trang giáo viên xem bài nộp của Unit (`app/teacher/lessons/[unitId]/submissions/...`) và của Mock Test
  (`app/teacher/tests/[testId]/submissions/...`), trên mỗi câu **`fill` sai** (kể cả `reorder`) có chữ học sinh gõ.
- **Bấm:** hộp xác nhận "Accept "<câu học sinh>" as a correct answer for question N? This re-grades every submission
  of this exercise (K submissions)." → gọi API.
- **API (mới, trong route sẵn có):**
  - `POST /api/admin/units?id=<unitId>&action=accept-answer` body `{ categoryKey, exerciseId, fieldId, answer }`.
  - `POST /api/admin/tests?id=<testId>&action=accept-answer` body `{ skill, fieldId, answer }`.
  - Kiểm: Unit/Test thuộc workspace (`assertOwned`), câu tồn tại, là `type: "fill"`, `answer` trim không rỗng
    (≤ 300 ký tự), chưa trùng (theo luật chấm của câu). Thêm vào `answers`, lưu, rồi chấm lại.
  - Chấm lại: Unit dùng `regradeUnitSubmissions` sẵn có. Test: thêm `regradeTestSubmissions(test, skill)` vào
    `lib/teacher/regrade.js` (Submission `kind: "test"`, `testId`, `testSkill`; dùng `gradeSubmission` như lúc nộp).
  - Ghi audit log (cùng cơ chế `lib/audit.js` các route khác đang dùng), trả `{ ok, regradedCount }`.
  - Dùng được cho **mọi chương trình** (IELTS cũng có lợi), nhưng nút chỉ hiện trên câu `fill`.
- **Bảo mật:** chỉ giáo viên của workspace; teacherScope (giáo viên bị giới hạn lớp) vẫn được thêm đáp án vì đó là
  sửa đề, giống quyền sửa Unit/Test hiện có — theo đúng luật của route PUT tương ứng.

### 3.7 Thống kê theo dạng bài

Đã có: `aggregateByFormat` + `fieldFormatMap` (`lib/grade.js`) được dùng ở `lib/teacher/unitSubmissions.js` và
`lib/teacher/testSubmissions.js`. G1 chỉ **kiểm** bảng này hiện đúng nhãn General trên trang bài nộp Unit/Test (kể cả
bài tập trong Grammar topic / Vocab group). Thiếu chỗ nào thì thêm, không viết lại.

---

## 4. Các bước thi hành

Mỗi bước một commit (hoặc một branch Antigravity). Sau mỗi bước: `npm test` xanh, `check-tenant-scope --strict` qua.
Không chạy `next build` khi dev server đang chạy; không tự bật/tắt dev server.

| Bước | Nội dung | Ai |
|---|---|---|
| 1 | Helper thuần: `lib/underline.js`, `lib/sentenceMatch.js`, `lib/generalFormats.js` (hằng nhãn, `underlineModeOf`, `isErrorIdFormat`, `splitTokens`, `shuffleTokens`, `arrangeDistractors`) + test | Sonnet |
| 2 | Dữ liệu + chấm + danh sách dạng: 2.1, 2.2, 3.3 nối vào `lib/grade.js`, bảng mục 1 vào `questionFormats.js` | Antigravity — Prompt A |
| 3 | Builder: dropdown ở Grammar/Vocab, kind `reorder`, gạch chân (gợi ý + xem trước + "Build options from underlines"), `arrange` "Generate options" | Antigravity — Prompt B |
| 4 | Học sinh: `UnderlinedText`, chữ (A)–(D) cho tìm lỗi, chip sắp xếp từ, xem lại | Antigravity — Prompt C |
| 5 | Accept this answer (3.6) + `regradeTestSubmissions` + kiểm 3.7 | Antigravity — Prompt D |
| 6 | Kiểm tổng: probe dev DB + trình duyệt (cả điện thoại 375px), IELTS/TOEIC không đổi | Claude Code (+ Sonnet viết probe) |

### Kiểm tối thiểu từng bước

- **Bước 1:** test thuần: `"h__ea__d"` → 3 đoạn, giữa gạch chân; `"I ____ go"` không có gạch chân; `stripUnderline`;
  `normalizeSentence("She hasn't gone.")` = `normalizeSentence("she has not gone")`; `"I'm"`/`"I am"`; `"won't"`;
  `'s` không bị mở; `splitTokens("She / always / gets up / early.")`; `shuffleTokens` với `rng` cố định khác thứ tự
  gốc; `arrangeDistractors("b-d-a-c-e")` trả 3 hoán vị khác nhau, khác đáp án.
- **Bước 2:** round-trip `matchMode`/`tokens` qua normalize + transform; tokens chưa xáo bị server xáo lại; học sinh
  nhận `tokens`, không nhận `answers`/`matchMode`; câu cũ không `matchMode` chấm như trước (thêm test so sánh với vài
  câu IELTS hiện có trong `tests/`); câu `sentence` chấm đúng các biến thể; `questionFormatsFor` IELTS/TOEIC không đổi
  (so sánh sâu với danh sách hiện tại), General đúng bảng mục 1 theo từng subject.
- **Bước 3–4:** kiểm bằng trình duyệt ở bước 6 (người thi hành tự kiểm trên dev server nếu chủ dự án đang bật).
- **Bước 5:** test route: accept trên câu `choice` → 400; câu không thuộc workspace → 404; accept → `answers` có
  thêm, mọi bài nộp được chấm lại (điểm tăng), audit log có dòng mới; accept trùng → 400 (hoặc 200 không đổi gì —
  chọn một, ghi rõ).

---

## 5. Rủi ro

| # | Rủi ro | Chặn bằng |
|---|---|---|
| R1 | Câu sắp xếp lộ đáp án vì mảnh ở đúng thứ tự | Server xáo lại nếu `tokens` ghép ra đúng đáp án (2.2); test |
| R2 | Đổi `normalize` làm IELTS chấm khác | Luật mới chỉ khi `matchMode === "sentence"`; câu cũ không có field này |
| R3 | `____` (chỗ trống) bị hiểu là gạch chân | Cú pháp đòi ký tự không phải `_` bên trong; chỉ render với dạng có cờ gạch chân |
| R4 | Accept chấm lại nhầm bài khác | Chỉ bài nộp của đúng Unit+bài tập / Test+kỹ năng, trong workspace; hộp xác nhận nói rõ số bài |
| R5 | Mở `'s` sai nghĩa (sở hữu cách) | Không mở `'s`; giáo viên dùng Accept |
| R6 | Chip sắp xếp khó bấm trên điện thoại | Kiểm 375px ở bước 6 |
| R7 | Bỏ HL (bôi đen) ở chữ có gạch chân làm học sinh tưởng lỗi | Chỉ ở 3 dạng ngắn; ghi vào Nhật ký, cân nhắc lại nếu giáo viên phàn nàn |

---

## 6. Nhật ký

### 2026-10-26 → 27 — G1 bước 1–6

Chia việc theo [PLAN-PHASE12-G1-PROMPTS.md](PLAN-PHASE12-G1-PROMPTS.md): bước 1 Sonnet; bước 2–5 Antigravity
(branch `g1-stepN-antigravity`, Claude Code review rồi merge `--no-ff`); bước 6 Claude Code + Sonnet viết probe.

- **Bước 1** (`552f9cf`): `lib/underline.js`, `lib/sentenceMatch.js`, `lib/generalFormats.js` + 23 test. Ghi chú:
  `'d` luôn mở thành `would` (`I'd been` cần giáo viên Accept), `'s` không mở.
- **Bước 2** (`dbb3510`, merge `4255355`): `matchMode`, `tokens`, chấm khoan dung, 22 dạng General. **Sửa khi
  review** (`cf913e4`): chỉ gửi `matchMode`/`tokens` khi có giá trị — payload IELTS giữ shape cũ.
- **Bước 3** (`f39d1a1`, merge `b5ca75e`): builder. **Sửa khi review** (`1198909`): đáp án câu sắp xếp gõ kèm `/`
  (như placeholder gợi ý) bị lưu cả dấu `/` → học sinh luôn sai; builder + server bỏ `/`. Ô "kiểu câu" của
  IELTS/TOEIC không còn lựa chọn "Sentence building".
- **Bước 4** (`a71d92a`, merge `e7b024a`): màn học sinh. **Sửa khi review** (`185064c`): mảnh nhiều từ ("gets up")
  mất khi xem lại / tải lại vì khôi phục theo từng từ → `chosenTokenIndexes`.
- **Bước 5** (`2bf05ff`, merge `08470fa`): Accept this answer. **Sửa khi review** (`23597fd`): chấm lại chỉ bài nộp
  của đúng bài tập; bảng thống kê theo dạng ở Grammar/Vocab chỉ cho Unit General.
- **Bước 6:**
  - Sửa lỗi có sẵn từ `main` (`55c02f4`): radio `name="ans-<số câu>"` trùng giữa hai bài tập cùng mở → chỉ một ô
    được chọn. Dùng `useId`. Ảnh hưởng mọi chương trình (chỉ hiển thị, dữ liệu vẫn đúng).
  - Nhãn tab trang bài nộp giáo viên theo registry (`452c6b5`).
  - `next build` sạch (worktree riêng). `npm test` 262 pass / 0 fail. `check-tenant-scope --strict` 0 vi phạm.
  - Probe `scripts/_probe-g1-TMP.js` (tạm, không commit) **94/94** trên dev DB: lưu/normalize, payload học sinh,
    chấm, Accept Unit + Test (chỉ chấm lại đúng bài tập / đúng kỹ năng, audit log, chặn chéo workspace), thống kê,
    IELTS giữ luật chấm cũ.
  - Trình duyệt (dev server khởi động lại 2026-10-27 vì bản cũ chạy route API chưa compile lại): builder Grammar
    13 dạng, Split into pieces, Build options from underlines; học sinh 375px: chip sắp xếp, gạch chân + (A)(B)(C),
    "10 / 10"; xem lại khôi phục đủ mảnh; radio hai bài cùng trang đều giữ ô đã chọn; giáo viên Accept → hộp xác
    nhận "2 submissions", toast "Accepted — 2 submissions re-graded", câu chuyển đúng.
- **Chưa kiểm:** Safari iOS thật; câu Open cloze (noteMode) với Accept; Mock Test listening General.
- **Fixture còn trên dev DB:** `probe.g0.*` (có bài "G1 demo") và `probe.g1.*`, mật khẩu `123456`. Dọn:
  `node scripts/_probe-g0-TMP.js --cleanup`, `node scripts/_probe-g1-TMP.js --cleanup`.
