# PLAN — Phase 12 · G3: AI soạn bài General + import đề Word

> Tài liệu thi hành cho đợt **G3** của [PLAN-PHASE12-GENERAL-ENGLISH.md](PLAN-PHASE12-GENERAL-ENGLISH.md) (mục 2.1
> mong muốn #5 và #7, mục 5-G3). Chia việc + prompt Antigravity: [PLAN-PHASE12-G3-PROMPTS.md](PLAN-PHASE12-G3-PROMPTS.md).
>
> **Người thi hành đọc kỹ mục 0 và mục 2 trước khi gõ dòng code đầu tiên.**

Trạng thái: ◐ bước 1–5 xong, còn bước 6 (đề Word thật) · Ngày lập: 2026-10-27
Tiền đề: G1 xong và đã vào nhánh gom `phase-12-general-g0` (PR #21), có Next 15.5 + React 19 (PR #22). Branch
`phase-12-general-g3` cắt từ nhánh gom. Xong G3 → PR `phase-12-general-g3` → `phase-12-general-g0` (KHÔNG vào `main`;
xem "Cách gộp nhánh" ở mục 5 của plan tổng).

---

## 0. Luật chơi

### 0.1 G3 làm gì

Giáo viên General đưa nội dung vào app **mà không gõ lại từng câu**:

1. **AI soạn bài tập theo dạng đề phổ thông.** Trong builder (Grammar, Vocabulary & Pronunciation, Reading, Mock Test
   "Written paper"), nút **"Generate with AI"**: chọn tối đa 3 dạng (vd Verb form, Error identification, Sentence
   transformation) + chủ điểm + số câu → mỗi dạng thành một section, đúng shape G1 (gạch chân, mảnh sắp xếp, chấm cả
   câu). Có lượt giám khảo AI soát đáp án như Grammar AI hiện nay.
2. **Ngữ cảnh sách giáo khoa.** Unit General có thêm ô **Textbook** (vd "Global Success 8"); prompt AI nhận "Grade 8,
   Global Success 8, Unit 5 — Our customs and traditions".
3. **Import đề Word (.docx).** Nút **"Import from Word"**: app đọc file (giữ gạch chân, đánh số tự động, bảng, ảnh), AI
   tách thành section + câu + đáp án + dạng, giáo viên xem trước rồi đưa vào builder. Câu AI không chắc hoặc đáp án do
   AI tự giải được **tô vàng** để giáo viên soát. Ảnh trong đề (biển báo) tải lên Image library và gắn vào câu.

### 0.2 Bất biến

1. **IELTS và TOEIC không đổi.** Không sửa chữ nào trong prompt AI của hai chương trình này: `tests/aiPromptPin.test.js`
   và `tests/ieltsAiRequestPin.test.js` phải xanh **không cần UPDATE_PIN**. Nút mới chỉ hiện khi registry cho phép
   (chỉ `general`). `tests/programBranches.test.js` xanh — không viết thêm `=== "general"` rải rác, đọc registry.
2. **AI không ghi DB.** Cả hai luồng chỉ trả bản nháp; giáo viên đưa vào builder rồi bấm Save như thường. Ngoại lệ duy
   nhất: ảnh của đề Word được tải lên khi giáo viên bấm "Import into builder" (D7).
3. **Section sinh ra phải qua được validation hiện có** (`normalizeSections`, `validateSections`,
   `generalQuestionError`) — không nới luật để chứa dữ liệu AI.
4. **Đáp án không lộ** (G1 bất biến 3) — G3 không đụng route học sinh.
5. Mọi route mới: `requireAuth(withTenant(...))`, workspace demo trả 403, `GEMINI_API_KEY` thiếu trả 503, hết ngân sách
   AI trả 429 (giống `pages/api/admin/ai-lesson.js`). `node scripts/check-tenant-scope.js --strict` 0 vi phạm.
6. File người dùng tải lên là dữ liệu không tin được: giới hạn kích thước trước **và** sau giải nén (chặn zip bomb),
   không dùng thư viện docx/xlsx ngoài (cùng lý do `lib/xlsxRead.js` tự đọc ZIP).

### 0.3 G3 KHÔNG làm

- Khuôn đề, đánh số 1–40 liền theo khuôn (G2). Câu import giữ thứ tự, đánh số tiếp theo câu đang có trong builder.
- Ngân hàng câu hỏi, nhãn chủ điểm, ma trận, in đề (G4). Writing/Speaking thang 10 (G5).
- File `.doc` (Word 97–2003), PDF, ảnh chụp đề — báo lỗi hướng dẫn "Save As .docx".
- Công thức (equation), header/footer, footnote, comment trong .docx.
- Template Excel riêng cho General (ưu tiên thấp, để sau).
- AI soạn bài **Listening** (cần audio) và các dạng ở mục 3.2 "không AI".
- Lưu cờ vàng vào DB (D6).

---

## 1. Quyết định đã chốt (đề xuất của Claude Code — đổi được trước khi code)

| # | Câu hỏi | Chốt |
|---|---|---|
| D1 | Sửa `grammarLesson.js` / `vocabLesson.js` để có thêm dạng, hay module mới? | **Module mới** `lib/ai/generalExercise.js`, cắm vào route `ai-lesson` với `kind: "exercise"`. Dialog Grammar/Vocab AI hiện có giữ nguyên (mcq/fill) → không rủi ro pin IELTS. |
| D2 | AI có soạn Phát âm / Trọng âm không? (LLM hay sai) | **Có**, nhưng output bắt buộc kèm IPA từng lựa chọn (đưa vào explanation), có lượt giám khảo, và **mọi câu phát âm/trọng âm luôn tô vàng** để giáo viên soát. **Bổ sung 2026-10-27 (chủ dự án chốt sau lần chạy Gemini thật):** mọi câu **Error identification do AI soạn** cũng luôn tô vàng ("Error identification — check which underlined part is wrong"). Luồng Word không áp luật này (đáp án lấy từ file). |
| D3 | Dạng nào AI không soạn? | `g-sign` (cần ảnh), `g-ocloze` (note layout), `g-insert`, `g-arrange`, `g-rq`, `g-phrase`, `g-gap`, `g-tfng` và mọi dạng Listening. Import Word thì nhận **mọi** dạng. |
| D4 | Định dạng file | Chỉ `.docx`, ≤ 4 MB. `.doc`/PDF → lỗi có hướng dẫn. |
| D5 | Đáp án của đề Word lấy ở đâu? | Ưu tiên đáp án **trong file** (bảng/khối "ĐÁP ÁN"/"KEY" cuối đề, chữ tô màu/highlight). Không có → AI tự giải, câu đó **tô vàng** ("Answer suggested by AI"). |
| D6 | Cờ vàng lưu ở đâu? | Chỉ sống trong phiên soạn (field editor `aiFlag`). Không gửi lên server, không lưu DB. Builder có dải báo "N questions to check". |
| D7 | Ảnh trong đề tải lên lúc nào? | Lúc bấm **"Import into builder"** (không lúc xem trước) — đổi file/huỷ không để rác trên Cloudinary. |
| D8 | Phần Writing đoạn văn / câu hỏi tự luận dài trong đề Word | Bỏ qua + cảnh báo "Writing tasks are not imported yet". |
| D9 | Đề Word có đoạn văn nhưng đang import vào tab Grammar/Vocabulary (không lưu `passageText`) | Vẫn import câu hỏi, cảnh báo "Passages are only kept in Reading / Mock Test". |
| D10 | Textbook | Text tự do ≤ 80 ký tự trên Unit (`Unit.textbook`), chỉ hiện ô khi program có `textbook: true` trong registry. Gợi ý sẵn "Global Success 6…12", "Friends Plus", "i-Learn Smart World", "Bright", "English Discovery". |

---

## 2. Thiết kế chung

### 2.1 Registry (`lib/curriculum.js`)

Thêm 3 key cho cả 3 chương trình (IELTS/TOEIC = `false`, General = `true`):

```js
aiExercise: true,   // nút "Generate with AI" trong SectionsEditor
wordImport: true,   // nút "Import from Word" trong SectionsEditor
textbook: true,     // ô Textbook trên Unit + đưa vào prompt AI
```

`tests/curriculum.test.js` thêm kiểm 3 key này. Không viết `program === "general"` ở UI/route.

### 2.2 Bộ chuyển chung: `lib/ai/generalSections.js`

**Cả hai luồng** (AI soạn và import Word) tạo ra cùng một dạng trung gian rồi đi qua **một** bộ chuyển duy nhất sang
section shape server (giống `toSections` của `grammarLesson.js`). Không viết hai bộ chuyển.

Câu trung gian (`GQ`):

```js
{
  format: "g-verb",          // key trong GENERAL_ALL_FORMATS (lib/teacher/questionFormats.js)
  number: 12,                // số trong đề (Word) — chỉ để báo lỗi, builder đánh số lại
  text: "...",               // đề câu; gạch chân viết <u>x</u> (KHÔNG phải __x__, xem 2.4)
  before: "", after: "",     // dạng điền: phần trước / sau chỗ trống
  hint: "",                  // từ gốc trong ngoặc: "(help)"
  start: "",                 // Sentence transformation: phần mở đầu cho sẵn ("I have ...")
  options: ["..."],          // lựa chọn (đã bỏ "A." "B."); phát âm: từ có <u>…</u>
  answer: "...",             // đáp án chính: text của lựa chọn đúng, hoặc câu/từ đúng
  altAnswers: ["..."],       // đáp án đúng khác (dạng điền / viết câu)
  pieces: ["..."],           // Sentence building: các mảnh theo đúng đề
  explanation: "",
  imageRef: "",              // "IMG3" (Word) — ảnh riêng của câu
  flag: ""                   // lý do tô vàng, "" = không
}
```

`toGeneralSection({ format, name, passage, questions }, { subject, startId })` → `{ section, flags, warnings }`:

| Format | Shape server (theo đúng cách builder G1 lưu) |
|---|---|
| `g-mcq` `g-comm` `g-closest` `g-stress` `g-cloze` | `type: "choice"`, `options: [{value, label}]` (value `ai{id}_{i}`), `answers: [value đúng]`, `selectCount: 1`. `label` = `text` (chỗ trống viết `___`). |
| `g-tf` | như trên, options đúng `presetOptions` của format (`True`, `False`). |
| `g-tfng` | như kind `tfng` hiện có (value `true/false/ng`). |
| `g-insert` | options `[I]`…`[IV]` (presetOptions). |
| `g-pron` | `choice`; label `options[i]` giữ gạch chân `__x__` (đổi từ `<u>x</u>`). `label` của câu theo cách builder G1 tạo câu phát âm (xem `_probe-g1-TMP.js` / SectionsEditor). |
| `g-error` | `label` = câu có **đúng 2–4** phần `__x__`; options = chữ cái `A`…`D` theo số phần gạch chân (giống nút "Build options from underlines"); đáp án = chữ cái của phần sai. Sai số phần → bỏ câu + cảnh báo (AI) hoặc giữ + tô vàng (Word). |
| `g-syn` | `choice`, `label` có đúng 1 phần `__x__`. |
| `g-arrange` | options = chuỗi thứ tự `b-d-a-c-e`; Word có sẵn 4 lựa chọn thì giữ, không có thì `arrangeOptions()`. |
| `g-verb` `g-wform` `g-gap` `g-rq` `g-phrase` `g-combine` | `type: "fill"`, `matchMode: "sentence"`, `label: before`, `post: after`, `hint`, `answers: [answer, ...altAnswers]` (bỏ trùng, ≤ 6). |
| `g-rewrite` | như trên + `pre` = `start` (G1: "câu mở đầu ở `pre`"); `answers` = phần học sinh gõ tiếp sau `pre`. |
| `g-reorder` | `type: "fill"`, `matchMode: "sentence"`, `tokens` = `shuffleTokens(pieces)` (hoặc `splitTokens(text)` khi không có pieces), `answers` = câu đúng. Mảnh ghép lại khớp đáp án → xáo lại (normalize cũng làm, nhưng làm luôn ở đây). |
| `g-ocloze` | Word: đoạn văn + chỗ trống → section noteMode như builder G1 tạo (nếu khó, chuyển thành các câu `g-gap` lẻ + cảnh báo — chấp nhận ở G3). |
| `g-sign` | `choice` + `imageRef` (ảnh gắn ở bước client). |

Mọi section: `name` = dòng hướng dẫn (Word: nguyên văn đề; AI: câu chuẩn ở mục 3.3), `passageText` = `passage` **chỉ khi
`subject === "reading"`** (D9), `formatLabel` = `GENERAL_LABELS[...]` của format. Sau khi chuyển, chạy
`normalizeSections([section])` + `generalQuestionError` cho từng field; field lỗi: luồng AI → bỏ + ghi `removed`;
luồng Word → giữ, ghi `flag` + warning (giáo viên sửa trong builder).

Phần gạch chân/sửa options của Error identification hiện nằm trong component → **tách hàm thuần**
`optionLettersFromUnderlines(label)` vào `lib/generalFormats.js`, SectionsEditor gọi lại hàm này (không đổi hành vi).

### 2.3 Cờ vàng (`aiFlag`) trong builder

- Server trả `flags: [{ si, fi, reason }]` (chỉ số trong mảng `sections` trả về) — **không** nhét vào field, vì
  `fieldFromServer` dựng object tường minh và sẽ bỏ key lạ.
- Client sau `sectionsToEditor` gán `field.aiFlag = reason`. `fieldToServer` dựng object tường minh nên `aiFlag` tự
  không lên server — thêm test khẳng định điều này.
- `FieldRow`: field có `aiFlag` → viền trái vàng + dòng "⚠ {reason}" + nút **"Mark as checked"** (xoá `aiFlag`). Sửa
  bất kỳ ô nào của câu **không** tự xoá cờ (giáo viên phải bấm).
- `SectionsEditor`: còn ≥ 1 cờ → dải `notice` trên cùng "N questions need checking" + nút "Next" cuộn tới câu kế tiếp.
- Lý do chuẩn (UI tiếng Anh): `"Answer suggested by AI — not found in the file"`, `"AI was unsure how to read this
  question"`, `"Pronunciation/stress — please double-check"`, `"Underlined parts do not match the options"`,
  `"Image not found in the file"`, cộng `note` của AI nếu có.

### 2.4 Gạch chân và chỗ trống — vì sao dùng `<u>…</u>` ở giữa

Đề Word đầy chuỗi `_____` (chỗ trống). Nếu `docxRead` viết gạch chân thành `__x__` thì AI và `parseUnderline` không
phân biệt được chỗ trống và chữ gạch chân. Quy ước G3:

- `docxRead` và mọi prompt AI dùng `<u>x</u>` cho chữ gạch chân; chỗ trống (≥ 3 dấu `_`, `…`, `....`, hoặc run gạch
  chân chỉ có khoảng trắng) chuẩn hoá thành `____` (4 gạch).
- Bộ chuyển 2.2 mới đổi `<u>x</u>` → `__x__`, **chỉ** với format có `underlineModeOf(...)` khác null; format khác thì
  bỏ thẻ, giữ chữ. Chỗ trống `____` trong label câu chọn đổi thành `___` như AI Grammar hiện nay.

---

## 3. AI soạn bài tập theo dạng

### 3.1 Module `lib/ai/generalExercise.js`

Cùng giao diện với `grammarLesson.js` để route `ai-lesson` dùng lại nguyên vòng "soạn → giám khảo → cắt số câu":
`PURPOSE = "generate.exercise"`, `parseInput`, `systemFor`, `buildSchema`, `buildPrompt(input, formatKey)`,
`normalizeTopic`, `buildCheckPrompt`, `checkQuestions`, `finalizeTopic`, `logContext`, `GEN_THINKING_BUDGET`.

Mẹo cắm vào route: `input.topics` = **danh sách format key** giáo viên chọn (tối đa 3). Route gọi 1 lần / format song
song như đang gọi 1 lần / chủ đề — **route không cần sửa gì ngoài thêm `exercise` vào `MODULES`**. `failed[].topic` là
format key; client đổi sang nhãn.

`parseInput(body)`:

| Field | Luật |
|---|---|
| `subject` | `grammar` \| `vocabulary` \| `reading`; khác → 400 |
| `formats` | lọc theo `AI_FORMATS ∩ questionFormatsFor(subject, "general")` (bảng 3.2), bỏ trùng, 1–3; rỗng → 400 "Choose 1 to 3 question types." |
| `focus` | chủ điểm/ngữ pháp/từ vựng, bắt buộc, ≤ 300 ("present perfect", "Unit 5 vocabulary: customs") |
| `questionCount` | 5 \| 8 \| 10 (mặc định 8); format có đoạn văn (`g-cloze`, `g-tf`) cố định 5 |
| `level` (số khối), `studentLevel`, `unitName`, `textbook` | như AI Grammar; `textbook` ≤ 80 |
| `language` | `vi` \| `en` — ngôn ngữ của **explanation** (đề luôn tiếng Anh) |
| `notes` | ≤ 1000 |
| `program` | luôn `general` (route từ chối program khác cho kind này: 400) |

Import `questionFormatsFor` từ file ESM (`lib/teacher/questionFormats.js`) vào code server CommonJS **không được** —
đưa bảng AI_FORMATS + danh sách key theo subject vào `lib/generalFormats.js` (CommonJS) và để `questionFormats.js` đọc
lại từ đó nếu cần; viết test so khớp hai nơi.

### 3.2 Dạng AI soạn (`AI_FORMATS`)

| key | grammar | vocabulary | reading | Ghi chú prompt |
|---|---|---|---|---|
| `g-mcq` | ✓ | ✓ | ✓ | 4 lựa chọn, đúng 1 |
| `g-comm` | ✓ | ✓ | | hội thoại 2 lượt, chọn câu đáp phù hợp |
| `g-verb` | ✓ | | | như fill của Grammar AI: `hint` "(go)", altAnswers đủ dạng viết tắt |
| `g-wform` | ✓ | ✓ | ✓ | `hint` là từ gốc, đáp án phải đổi dạng |
| `g-error` | ✓ | | | **đúng 4** phần `<u>…</u>`, đúng 1 phần sai |
| `g-syn` | | ✓ | ✓ | 1 phần `<u>…</u>`; tự ghi "CLOSEST/OPPOSITE in meaning" vào text |
| `g-pron` | | ✓ | | 4 từ, mỗi từ đúng 1 phần `<u>…</u>`; `ipa` từng từ; luôn tô vàng (D2) |
| `g-stress` | | ✓ | | 4 từ cùng số âm tiết; `ipa`; luôn tô vàng |
| `g-reorder` | ✓ | ✓ | | `pieces` 4–8 mảnh, mảnh có thể nhiều từ; đúng 1 câu đúng (altAnswers nếu có trật tự khác hợp lệ) |
| `g-rewrite` | ✓ | | | `text` = câu gốc, `start` = phần mở đầu, answer = phần còn lại |
| `g-combine` | ✓ | | | `text` = 2 câu, `start` có thể có từ nối cho sẵn |
| `g-closest` | ✓ | | ✓ | câu gốc + 4 câu, chọn câu gần nghĩa nhất |
| `g-cloze` | | | ✓ | 1 đoạn 120–180 từ, 5 chỗ `(1) ____`…; câu i = chỗ i |
| `g-tf` | | | ✓ | 1 đoạn 150–200 từ + 5 câu True/False |

Trong grammar/vocabulary `g-cloze` có trong danh sách builder nhưng **không** có ở AI (không lưu đoạn văn — D9).

### 3.3 Prompt

- `GENERAL_EXERCISE_SYSTEM`: giáo viên tiếng Anh THCS/THPT Việt Nam, GDPT 2018; text thuần, không markdown; gạch chân
  bằng `<u>…</u>`; chỗ trống `____`; câu và từ hợp khối lớp; không nhắc IELTS/TOEIC. Dùng lại
  `GENERAL_TIER_GUIDE` + `describeStudentLevel(raw, "general", level)` + `levelTier` ở `lib/ai/common.js`.
- Dòng ngữ cảnh: `Grade {level}` · `Textbook: {textbook}` · `Unit: {unitName}` · `Focus: {focus}`.
- Mỗi format có khối hướng dẫn riêng `FORMAT_GUIDE[key]` (bảng 3.2 viết thành câu lệnh) + câu hướng dẫn section chuẩn
  `SECTION_NAME[key]`, vd:
  - `g-pron`: "Choose the word whose underlined part is pronounced differently from the others."
  - `g-stress`: "Choose the word that differs from the other three in the position of primary stress."
  - `g-error`: "Choose the underlined part that needs correction."
  - `g-verb`: "Give the correct form of the verbs in brackets."
  - `g-wform`: "Give the correct form of the words in brackets."
  - `g-reorder`: "Rearrange the words or phrases to make complete sentences."
  - `g-rewrite`: "Rewrite the sentences without changing their meaning, beginning with the given words."
  - `g-combine`: "Combine the sentences, using the words given."
  - `g-cloze`: "Read the passage and choose the correct word for each numbered blank."
  - `g-tf`: "Read the passage and decide whether the statements are True or False."
  - (các format còn lại tương tự, tiếng Anh như đề thật)
- Sinh dư `EXTRA_QUESTIONS` câu (trừ format đoạn văn), cắt về `questionCount` sau giám khảo.
- Schema: 1 schema chung cho mọi format (các field của GQ ở 2.2 + `ipa: [string]`), `required` theo format.

### 3.4 Lượt giám khảo

Dùng `CHECK_SYSTEM`, `CHECK_SCHEMA`, `CHECK_HEADER` của `common.js`. `buildCheckPrompt` viết từng câu theo format:

- câu chọn (mcq, comm, closest, cloze, tf, syn, pron, stress, error): liệt kê lựa chọn + Key → `choiceProblem` (đúng 1
  lựa chọn được chấp nhận).
- câu điền/viết (verb, wform, rewrite, combine): như gap fill → `reviewProblem` + gộp `acceptedList` vào answers.
- reorder: "Using ALL these pieces exactly once: … Key: …" → giám khảo trả `acceptable` = mọi câu đúng; key sai → bỏ;
  câu đúng khác → thêm vào answers.
- pron/stress: kèm IPA của lượt soạn; giám khảo tự xét lại.
- format đoạn văn: gửi kèm đoạn văn.

Giám khảo lỗi/timeout → vẫn trả bài, `check.verified: false`, client hiện "Not verified — check every answer" và tô
vàng **toàn bộ** câu.

### 3.5 Kết quả trả về (qua route `ai-lesson`)

`finalizeTopic` → `{ name: SECTION_NAME[key], format: key, exerciseSections: [section], flags: [{ fi, reason }] }`.
Client gộp các topic thành sections, đổi `flags` sang index thật.

### 3.6 Textbook

- `lib/models/Unit.js`: `textbook: { type: String, default: "", maxlength: 80 }`.
- `pages/api/admin/units.js` POST/PUT: nhận `textbook` (trim, cắt 80) — chỉ lưu khi registry `textbook` true, còn lại
  ép `""`. GET trả như các field khác.
- Form tạo/sửa Unit: ô "Textbook (optional)" + `datalist` gợi ý (D10), chỉ khi `PROGRAMS[program].textbook`.
- Truyền `textbook` vào prompt: `generalExercise` (bắt buộc) **và** nhánh General của `grammarLesson`/`vocabLesson`
  (`buildPrompt` thêm dòng `- Textbook: …` **chỉ khi program general và có textbook** → prompt IELTS/TOEIC không đổi
  một byte; pin test chứng minh). `parseInput` hai module đó nhận thêm `textbook`.

### 3.7 UI — `components/teacher/AiExerciseDialog.js`

Nút **"Generate with AI"** (icon sparkles) cạnh "Add Section" trong `SectionsEditor` khi `PROGRAMS[program].aiExercise`
và subject có ≥ 1 format AI. SectionsEditor cần biết `aiContext` (level, unitName, textbook, program) — thêm prop
`aiContext` (optional; thiếu thì dialog cho gõ tay).

Dialog:
1. Checkbox các format AI của subject (tối đa 3, tick thứ 4 bị chặn kèm chữ "Up to 3 types").
2. "Focus" (textarea 2 dòng, placeholder "e.g. present perfect vs past simple; Unit 5 vocabulary").
3. Số câu 5/8/10; Students' level (dùng lại `LevelLanguageFields`/gợi ý `aiLevel` của registry); Explanation
   language Vietnamese/English; Notes.
4. "Generate" → xem trước theo section (dùng lại `QuestionPreview` — tách khỏi `AiGrammarDialog` ra file dùng chung,
   thêm hiển thị gạch chân bằng `UnderlinedText`/`UnderlinePreview` và mảnh sắp xếp), đếm câu bị loại, format lỗi.
5. Tick section muốn giữ → **"Add to exercise"** → `sectionsToEditor` + đánh số tiếp (`nextFieldId`) + gán `aiFlag`.

---

## 4. Import đề Word

### 4.1 Đọc ZIP an toàn — `lib/zipRead.js` (tách từ `lib/xlsxRead.js`)

- `listEntries(buf)` → `[{ name, method, compSize, size, offset }]` (đọc central directory, **không** giải nén).
- `readEntry(buf, entry, { maxBytes })` → Buffer; dùng `zlib.inflateRawSync(raw, { maxOutputLength: maxBytes })`, kiểm
  `size` khai báo trước khi giải nén; vượt → throw `"File is too large after decompression"`.
- Giới hạn: tối đa 2000 entry; `word/document.xml` ≤ 15 MB; mỗi ảnh ≤ 2 MB.
- `xlsxRead.js` chuyển sang dùng `zipRead` (giữ nguyên `readWorkbook` API) — vá luôn zip bomb ở import Excel.
  Test xlsx hiện có phải xanh.

### 4.2 `lib/docxRead.js` — `readDocx(buf)` → `{ text, images, warnings }`

Thuần, không AI, không DB.

- Đọc `word/document.xml`, `word/_rels/document.xml.rels`, `word/numbering.xml` (nếu có).
- **Bỏ `<mc:Fallback>…</mc:Fallback>`** trước khi duyệt (nếu không mọi textbox/ảnh bị lặp hai lần). Giữ `mc:Choice`.
- Duyệt theo thứ tự tài liệu: `w:p` → 1 dòng; `w:tbl` → mỗi `w:tr` 1 dòng, các ô nối bằng `" | "`, đoạn trong ô nối
  bằng khoảng trắng. Đoạn trong textbox (`w:txbxContent`) đưa ra như đoạn thường tại vị trí của nó.
- Run `w:r`: text `w:t`; `w:tab` → `\t`; `w:br`/`w:cr` → xuống dòng; `w:sym` bỏ.
- **Gạch chân**: `w:rPr/w:u` có `w:val` khác `none` → bọc `<u>…</u>`; các run gạch chân liền nhau gộp thành một thẻ.
  Run gạch chân chỉ có khoảng trắng → chỗ trống `____`. Chuỗi `_{3,}`, `…{2,}`, `\.{4,}` → `____`.
- **Đánh dấu đáp án**: run có `w:highlight` hoặc `w:shd` nền màu, hoặc `w:color` khác đen/auto → bọc `<mark>…</mark>`
  (AI dùng như gợi ý đáp án, D5). In đậm/nghiêng bỏ.
- **Đánh số tự động** (`w:numPr`): tra `numId` → `abstractNumId` → `w:lvl[ilvl]` (`numFmt`, `lvlText`, `start`), đếm
  theo (numId, ilvl), reset cấp dưới khi cấp trên tăng. Hỗ trợ `decimal`, `upperLetter`, `lowerLetter`,
  `upperRoman`, `lowerRoman`; `bullet`/khác → `- `. Chèn tiền tố (vd `A. `, `12. `) vào đầu dòng.
- **Ảnh**: `w:drawing` (`a:blip r:embed`) và `v:imagedata r:id` → tra rels → `word/media/...`. Chèn `[IMG1]`,
  `[IMG2]`… vào vị trí ảnh. Chỉ nhận png/jpeg/gif/webp (theo magic bytes, không theo đuôi); `emf/wmf/khác` → warning
  "Image {n} is in a format the app can't show (EMF/WMF) — add it by hand", vẫn chèn marker để AI biết câu có ảnh.
  Tối đa 20 ảnh, tổng ≤ 3 MB; vượt → bỏ ảnh sau + warning.
- Dòng trống liên tiếp gộp thành 1. `text` ≤ 60 000 ký tự; vượt → throw "This file is too long — split it into
  smaller files (about 40 questions each)".
- File không phải ZIP / thiếu `word/document.xml` → throw "This is not a .docx file. In Word choose File → Save As →
  Word Document (.docx)." (`.doc` cũ bắt đầu bằng `D0 CF 11 E0` → cùng thông báo).
- Giải mã entity bằng `decodeEntities` (export từ `xlsxRead`/`zipRead`).

Test dựng .docx trong bộ nhớ bằng `tests/helpers/makeDocx.js` (ZIP writer tối giản: `zlib.deflateRawSync` + CRC32 tự
viết), không commit file .docx nhị phân.

### 4.3 Chia khúc + AI tách đề — `lib/wordImport.js`

**Chia khúc** (`splitForAi(text)` thuần, test được):
1. Tìm khối đáp án: dòng khớp `/^\s*(ĐÁP ÁN|Đáp án|DAP AN|ANSWER KEY|ANSWERS?|KEY)\b/i` nằm ở 40% cuối → tách ra
   `keyText` (≤ 6 000 ký tự), **gửi kèm mọi khúc**.
2. Phần đề cắt tại đầu dòng tiêu đề phần: `/^\s*(PART|SECTION|PHẦN)\s+[\dIVX]+/i`, `/^\s*[IVX]{1,4}\s*[.)\-]\s+/`,
   `/^\s*(A|B|C|D|E)\s*[.)]\s+[A-ZĐ]{3,}/` (tiêu đề kiểu "A. PHONETICS"). Gom các phần liền nhau thành khúc ≤ 8 000 ký
   tự. Một phần > 8 000 → cắt tiếp tại đầu câu `/^\s*(Question|Câu)\s*\d+|^\s*\d{1,2}\s*[.)]\s/`, **lặp lại dòng hướng
   dẫn + đoạn văn của phần** ở khúc sau.
3. Tối đa 6 khúc (chạy song song, mỗi khúc < 45 s, route `maxDuration: 60`). Hơn 6 → lỗi "too long" như 4.2.

**Gọi AI** mỗi khúc: `generateJSON` với `models = lessonModels(await getGradingModels())`, `temperature: 0`,
`thinkingBudget: 512`, log `purpose: "import.word"`, context `{ fileName, chunk: i, chunks: n, subject }`.

System prompt `WORD_IMPORT_SYSTEM` (ý chính):
- "You convert a Vietnamese secondary-school English test (extracted from Word) into structured questions. Copy text
  exactly; do not rewrite, translate, fix or invent questions."
- Quy ước: `<u>…</u>` là gạch chân (giữ nguyên trong output), `____` là chỗ trống, `[IMGn]` là ảnh (đưa vào
  `imageRef`, bỏ khỏi text), `<mark>…</mark>` là chữ tô màu thường là đáp án.
- Bảng mô tả từng format key (lấy từ `GENERAL_LABELS` + 1 dòng nhận diện mỗi dạng) để AI chọn `format`.
- Đáp án: lấy từ Answer key (gửi kèm) theo số câu, hoặc `<mark>`; ghi `answerSource: "document"`. Không có → tự giải,
  `answerSource: "ai"`. Không chắc cách đọc câu → `confidence: "low"` + `note`.
- Bỏ "A." "B." khỏi lựa chọn. Phần Writing đoạn văn → `format: "writing"` (sẽ bị bỏ qua — D8). Không nhận ra →
  `format: "other"`.

Schema output mỗi khúc:

```js
{ sections: [{
    instruction: string, format: enum[...GENERAL keys, "writing", "other"], passage: string,
    questions: [{ number: integer, text, before, after, hint, start, options: [string], answer,
                  altAnswers: [string], pieces: [string], imageRef, answerSource: "document"|"ai",
                  confidence: "high"|"low", note }]
}] }
```

**Hậu xử lý** (`buildImport(chunkResults, { subject, images })` thuần):
- Ghép khúc theo thứ tự; section bị cắt đôi (cùng instruction + format liền nhau) → gộp.
- `format: "writing"` → bỏ + warning (D8); `"other"` → chuyển thành `g-gap` nếu có answer, không thì bỏ; cả hai đều
  warning có số câu.
- Mỗi câu → GQ, `flag` khi: `answerSource: "ai"`, `confidence: "low"`, format `g-pron`/`g-stress` (D2), `imageRef`
  không có trong `images`, đáp án không khớp lựa chọn nào (câu chọn: so `sameText` sau khi bỏ `<u>`; vẫn không khớp →
  để trống đáp án + flag).
- Đi qua `toGeneralSection` (2.2) → `sections`, `flags [{si, fi, reason}]`, `imageLinks [{si, fi, ref}]`.
- Trùng số câu trong đề (AI đọc lặp) → giữ câu đầu + warning.
- Khúc lỗi → các khúc khác vẫn trả, warning "Part starting with “{30 ký tự đầu}” could not be read — try again or
  add it by hand."

### 4.4 Route `pages/api/admin/import-word.js`

- `POST` multipart (formidable, `maxFileSize: 4 MB`, `bodyParser: false`) field `file` + `subject`
  (`grammar|vocabulary|reading|listening`) + `program`.
- Chặn: program không có `wordImport` → 400; demo → 403; Gemini tắt → 503; đọc file lỗi → 400 với thông báo 4.2.
- Xoá file tạm trong `finally` (như `import.js`).
- `readDocx` → `splitForAi` → AI song song → `buildImport`.
- Trả `{ ok, sections, flags, imageLinks, images: [{ ref, mimeType, base64, name }], warnings, stats: { chunks,
  failedChunks, questions, flagged, answerKeyFound } }`. Chỉ trả ảnh **được câu nào đó tham chiếu**.
  Response > ~4 MB → bỏ ảnh lớn nhất + warning (giới hạn body Vercel).
- Mọi chunk lỗi → 502 (ngân sách → 429 với thông báo budget).
- `module.exports.config = { api: { bodyParser: false }, maxDuration: 60 }`.
- Thêm vào danh sách route của `scripts/check-tenant-scope.js` nếu script yêu cầu khai báo.

### 4.5 UI — `components/teacher/WordImport.js`

Nút **"Import from Word"** (icon upload) cạnh "Import from spreadsheet" khi `PROGRAMS[program].wordImport`.

1. Chọn file `.docx` → "Read file" (busy: "Reading your file… this can take up to a minute").
2. Xem trước: thống kê ("3 parts · 40 questions · 6 to check · answer key found ✓/✗"), warnings, danh sách section →
   câu (dùng lại preview của 3.7: gạch chân, lựa chọn, ✓ đáp án; câu có flag nền vàng + lý do; câu có ảnh hiện
   thumbnail từ base64).
3. **"Import into builder"**:
   a. Tải từng ảnh được tham chiếu: base64 → `Blob` → `File` → `uploadToCloudinary(file, { resourceType: "image",
      folder })` (folder giống `MediaLibrary`) → `api` POST `/api/admin/images` `{ title: "{tên file} — image {n}",
      unit: unitName }`. Ảnh lỗi → bỏ qua + toast, câu đó thêm flag "Image could not be uploaded".
   b. `sectionsToEditor(sections)` → đánh số lại từ `nextFieldId(existingSections)` → gán `imageId` theo `imageLinks`
      (fi null = ảnh của section) → gán `aiFlag` theo `flags` → `onImport`.
   c. Báo builder tải lại danh sách media (prop/callback hiện có của trang; nếu chưa có thì thêm `onMediaChanged`).
4. "Choose another file" quay lại bước 1. Đóng dialog ở bước 2 không tải gì lên.

`lib/client/api.js`: `api.teacher.importWord(formData)`.

---

## 5. Chia bước

| Bước | Nội dung | Ai |
|---|---|---|
| 1 | `lib/zipRead.js` (+ `xlsxRead` dùng lại), `lib/docxRead.js`, `tests/helpers/makeDocx.js`, test | Sonnet (Claude Code) |
| 2 | Registry 3 key, `lib/ai/generalSections.js` (bộ chuyển 2.2), `lib/ai/generalExercise.js`, cắm route `ai-lesson`, `Unit.textbook` (model + API + prompt Grammar/Vocab General), test | Antigravity — Prompt A |
| 3 | UI AI: `AiExerciseDialog`, nút trong SectionsEditor, ô Textbook ở form Unit, `aiFlag` trong FieldRow + dải báo | Antigravity — Prompt B |
| 4 | `lib/wordImport.js` (chia khúc, prompt, schema, `buildImport`), route `import-word`, test (mock Gemini) | Antigravity — Prompt C |
| 5 | UI Word: `WordImport.js`, tải ảnh lúc import, nối `aiFlag` | Antigravity — Prompt D |
| 6 | Kiểm tổng: build trong worktree riêng, `npm test`, tenant scope, probe API, chạy Gemini thật với 3–5 đề Word thật, trình duyệt (desktop + 375px) | Claude Code |

**Cần từ chủ dự án trước bước 6:** 3–5 file đề `.docx` thật (đề kiểm tra lớp 6–9, đề vào 10, đề THPT; có ít nhất 1 đề
có bảng đáp án, 1 đề có ảnh biển báo, 1 đề đánh số tự động). Để ở `D:\Project\samples-g3\` — **không commit**.

## 6. Kiểm thử bắt buộc

- `npm test` xanh, gồm: `aiPromptPin`, `ieltsAiRequestPin`, `programBranches` **không UPDATE_PIN**; test mới cho
  zipRead (zip bomb, entry khai báo sai size), docxRead (gạch chân gộp run, run gạch chân rỗng → chỗ trống, mc:Fallback
  không lặp, numbering A./1./i., bảng, textbox, ảnh png + emf, `.doc` cũ, quá dài), generalSections (mỗi format 1 ca:
  output qua `normalizeSections` + `generalQuestionError` null; reorder tokens đã xáo; error options = số phần gạch
  chân; `<u>` chỉ thành `__` ở format gạch chân; passage chỉ giữ ở reading), generalExercise (parseInput lọc format
  theo subject, prompt có textbook/grade, check gộp altAnswers, pron luôn có flag), wordImport (chia khúc + khối đáp án
  gửi mọi khúc, gộp section bị cắt, writing/other, flag theo answerSource/confidence, trùng số câu), route import-word
  với Gemini giả (cách mock theo `tests/aiGeneral.test.js`), `fieldToServer` bỏ `aiFlag`.
- `node scripts/check-tenant-scope.js --strict` 0 vi phạm.
- Bước 6: Gemini thật — mỗi đề mẫu: ≥ 90% câu vào đúng format, đáp án khớp bảng đáp án 100% với đề có bảng; ghi số
  liệu vào mục 7.

## 7. Nhật ký

| Ngày | Bước | Ghi chú |
|---|---|---|
| 2026-10-27 | Plan | Lập plan + prompt. Branch `phase-12-general-g3` cắt từ `phase-12-general-g1`; sau đó merge nhánh gom (Next 15 + PR #21). |
| 2026-10-27 | 1 | Sonnet: `lib/zipRead.js` (chặn zip bomb, xlsxRead dùng chung + trần tổng 50 MB), `lib/docxRead.js`, `tests/helpers/makeZip.js` (makeZip/makeDocx), 22 test mới; npm test 284 pass. Chưa đọc: numbering/gạch chân khai báo trong styles.xml, ảnh r:link, chỗ trống ". . . ." có dấu cách; chữ màu (vd tiêu đề xanh) cũng thành `<mark>` — prompt bước 4 phải coi `<mark>` chỉ là gợi ý. Chưa thử với file Word thật (bước 6). |
| 2026-10-27 | 2 | Antigravity: registry 3 key, `generalSections.js` (bộ chuyển chung), `generalExercise.js` (14 dạng AI), Unit.textbook. Review (Sonnet sửa): lượt giám khảo nhận đủ đề theo từng dạng (câu điền gửi cả câu, viết lại/nối câu gửi phần mở đầu, tìm lỗi sai gắn nhãn (A)–(D), so lựa chọn bỏ thẻ `<u>`); cắt số câu SAU khi chuyển; tách chỗ trống từ `text`; Sentence combination dùng `pre` như rewrite; kiểm mảnh sắp xếp ghép ra đúng đáp án. 317 test pass. Chưa chạy Gemini thật. |
| 2026-10-27 | 2 (Gemini thật) | 2 lượt × 3 dạng (phát âm, tìm lỗi sai, viết lại câu), Grade 8 Global Success 8, ~20 s/lượt. Lượt 1 lộ 4 lỗi định dạng (gạch cả từ ở đuôi -ed; AI tự viết "(A)" sau phần gạch chân; phần mở đầu còn "____"; thiếu explanation) — đã sửa + test. Lượt 2: định dạng đúng hết, giám khảo loại đúng 2 câu hỏng. **Đáp án vẫn sai 2/15**: phát âm "v<u>i</u>llage/trad<u>i</u>tion/bel<u>ie</u>ve/d<u>i</u>fferent" chọn tradition (đúng là believe) — đã tô vàng theo D2; tìm lỗi sai "has lived … since five years" chọn "five years" thay vì "since" — lúc đó KHÔNG tô vàng → chủ dự án chốt tô vàng mọi câu Error identification do AI soạn (D2, `ALWAYS_FLAG` trong `generalExercise.js`). |
| 2026-10-27 | Review tổng | Rà lại toàn bộ Phase 12 so với `main` (80 file). Sửa: regex lookbehind trong `lib/underline.js` (Safari iOS < 16.4 không tải được trang học sinh — mọi chương trình) + test cấm lookbehind ở code phía học sinh; `formatStatsSkills` vào registry; thông báo Arrange. Probe G0 96/96, G1 94/94, Phase 8 232/232. |
| 2026-10-27 | 3 | Antigravity: AiExerciseDialog, AiQuestionPreview, ô Textbook (form Unit + tạo Unit), cờ vàng + dải "N questions need checking". Review (Sonnet sửa): tách `appendAiSections` (test gọi hàm thật), điền sẵn Focus, prompt không lặp "Grade: Grade 7", form tạo Unit General dùng ô chọn khối 6–12 (mặc định 1 bị 400). Trình duyệt: lưu Textbook, dialog 375px, IELTS không thấy nút/ô mới. 331 test pass. Lưu ý: dev server phải khởi động lại sau khi đổi nhánh / `npm install` (tiến trình cũ còn Next 14 → 500). |
| 2026-10-27 | 4 | Antigravity: `lib/wordImport.js` (chia khúc, prompt, schema, `buildImport`), route `import-word`. Review (Sonnet sửa, có file thử chứng minh): dòng "Answer the questions…" bị nhận nhầm là bảng đáp án -> mất cả phần đọc hiểu (giờ `isKeyHeading` chỉ nhận tiêu đề đứng riêng); đề đánh số lại từ 1 mỗi phần bị bỏ câu trùng số 6->3 (giờ chỉ bỏ khi trùng số + nội dung trong cùng phần); bỏ thẻ `<mark>`/`[IMGn]` còn sót; trần ảnh tính theo base64 + tô vàng câu mất ảnh; sửa lý do cờ. 350 test pass, build qua. Chưa chạy Gemini thật với file Word (bước 6). |
| 2026-10-29 | 5 | Antigravity: `WordImport.js` (chọn .docx, xem trước, tải ảnh lúc "Import into builder"), nút trong SectionsEditor, `applyImageLinks`, `media.reload`. Review chạy Gemini thật với file .docx tự soạn (gạch chân, đánh số, 1 ảnh, bảng ĐÁP ÁN): **cả 7 câu mất đáp án** vì `WORD_SCHEMA` chỉ bắt buộc `number` (lỗi của bước 4, test Gemini giả không bắt được) -> Sonnet sửa: schema bắt buộc answer/answerSource/confidence/text/options, prompt khớp đáp án theo phần + số câu, câu điền lấy chỗ trống từ `text`, nhãn phát âm luôn rỗng, không in "undefined"; tách `appendAiSections` / `appendImportedSections`. Chạy lại: 7/7 đáp án khớp bảng đáp án, ảnh tải lên + gắn đúng câu biển báo, đánh số nối tiếp; ảnh thử đã xoá khỏi Cloudinary. 357 test pass, build qua. |
