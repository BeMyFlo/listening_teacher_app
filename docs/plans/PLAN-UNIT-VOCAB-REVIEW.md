# PLAN — Vocab Review theo từng skill (Reading / Listening)

Trạng thái: **ĐÃ CHỐT — đang thi hành** · Ngày lập: 2026-10-14 · Sửa: 2026-10-14 (đổi từ "cả Unit" sang "từng skill")

## Mục tiêu

Trong **mỗi skill Reading và Listening** của một Unit có thêm phần **Vocab Review**: danh sách từ vựng
đáng học lấy từ chính các bài tập của skill đó. Reading và Listening có hai danh sách riêng, độc lập nhau.

- **Giáo viên**: trong tab Reading (hoặc Listening) của trang sửa Unit có thêm sub-tab **Vocab Review**,
  nằm cạnh Theory / Exercises. Sub-tab gồm:
  - công tắc "Show to students";
  - nút **Generate with AI**: AI đọc bài của skill đó và đề xuất từ. Giáo viên sửa, thêm, xoá trước khi Save. AI chỉ trả bản nháp, không ghi DB;
  - bảng nhập tay, dùng được cả khi không dùng AI.
- **Học sinh**: trong tab Reading (hoặc Listening) có thêm sub-tab **Review**, cạnh Learn / Practice. Sub-tab
  mở ngay khi học sinh làm xong các bài tập của skill đó. Nội dung gồm flashcard, bảng từ, và câu gốc trong bài
  nơi từ xuất hiện.

Ngoài phạm vi V1: bài tập ôn từ sinh từ danh sách này, lưu từ vào Notebook, Vocab Review cho Mock Test và cho
các skill khác.

---

## 0. Quyết định đã chốt (2026-10-14: theo cột "Đề xuất")

| # | Câu hỏi | Đề xuất |
|---|---------|---------|
| 0.1 | "Làm xong" nghĩa là xong **tất cả** bài tập của skill, hay mỗi bài xong là thấy luôn từ của bài đó? | Xong **tất cả** bài tập của skill thì mở cả danh sách. Trước đó sub-tab hiện ổ khoá và tiến độ "2/3 exercises". Phương án kia (mở dần theo từng bài) cần gắn mỗi từ với `exerciseId`, giáo viên soạn tay sẽ phức tạp hơn. |
| 0.2 | Listening chỉ có audio, không có lời thoại. AI lấy từ ở đâu? | Lấy từ câu hỏi, note/summary và đáp án đúng (đáp án điền từ thường là từ khoá). Thêm ô **Transcript** tuỳ chọn cho section Listening, học sinh không thấy ô này; có transcript thì AI dùng thêm. **Không** gửi audio lên Gemini vì đắt, chậm và dễ vượt giới hạn 60s. |

---

## 1. Hiện trạng codebase (đã đọc)

- `lib/models/Unit.js` `CategorySchema`: mỗi skill có `theory`, `exercises`, `prompts`, `topics`, `groups`.
  Reading/Listening dùng `exercises[].sections[]`. Section có `passageText`, `noteText`, `fields[]`
  (label/pre/post/options/answers), `matchOptions`. **Chưa có transcript.**
- `lib/models/schemas/lessonSchema.js`: `VocabWordSchema` đã có. **Tái dùng.**
- `pages/api/admin/units.js` PUT **dựng lại toàn bộ `categories` từ body** (các dòng ~248–297). Field mới
  trong category **phải được map thêm ở đây**, nếu không mỗi lần Save sẽ xoá mất.
- `app/teacher/lessons/[unitId]/page.js`: với skill không thuộc `LESSON_LIST_CATS` đã có sub-tab
  `Theory | Exercises` (`subTab` = `"theory" | "practice"`). `toEditorUnit` / `toPayload` chuyển dữ liệu qua lại.
- `app/student/lessons/[unitId]/page.js`: Reading/Listening đã có sub-tab `Learn | Practice` và
  `categoryStats(cat, subs)` (đếm số bài đã làm của skill), nên có sẵn tiến độ để khoá/mở.
- `pages/api/units.js` `toPublicUnit()`: chọn từng field gửi cho học sinh; skill bị khoá trả rỗng.
- `lib/ai/vocabLesson.js`, `lib/ai/common.js`, `pages/api/admin/ai-lesson.js`: khuôn AI soạn từ (cột tick,
  ngôn ngữ, trình độ, `normalizeWords`, `AiLog`, chặn demo, ngân sách). **Tái dùng phần chung.**
- `components/teacher/VocabWordTable.js`, `components/teacher/AiVocabDialog.js`,
  `components/student/VocabFlashcards.js` (`VocabFlashcards`, `VocabWordList`). **Tái dùng.**

---

## 2. Dữ liệu

### 2.1 `CategorySchema.vocabReview` (`lib/models/Unit.js`)

```js
// Từ vựng tổng hợp từ bài tập của skill (chỉ reading/listening dùng).
const ReviewWordSchema = new mongoose.Schema(
  {
    ...VocabWordSchema.obj,           // word, partOfSpeech, ipa, meaning, definitionEn, example, collocation, synonyms
    // Câu nguyên văn trong bài có chứa từ (AI trích, server kiểm tra có thật). Nhập tay thì có thể để trống.
    context: { type: String, default: "" },
  },
  { _id: false }
);

// trong CategorySchema:
vocabReview: {
  enabled: { type: Boolean, default: false },
  words: { type: [ReviewWordSchema], default: [] },
  // Dấu vân tay nội dung bài tập lúc tạo từ lần gần nhất (xem 4.1 "Hỏi sau khi Save").
  // Rỗng = chưa tạo bao giờ. Khác hash hiện tại = bài đã đổi kể từ lần tạo.
  sourceHash: { type: String, default: "" },
},
```

`sourceHash` tính ở **client** bằng một hàm dùng chung `lib/vocabReviewSource.js` (chạy được cả client lẫn server):
`collectSource(cat)` (mục 3.2) → chuẩn hoá khoảng trắng → hash ngắn (vd `hashStr` đã có trong
`components/student/HighlightText`, hoặc FNV-1a). Không cần mã hoá an toàn, chỉ dùng để phát hiện thay đổi.

Doc cũ không có field này → mặc định tắt, không cần migration. Bốn skill còn lại bỏ qua field này.

### 2.2 `SectionSchema.transcript` (`lib/models/schemas/questionSchema.js`)

`transcript: { type: String, default: "" }`, tuỳ chọn. Editor chỉ hiện ô này cho section Listening.
**Không** thêm vào `publicSections()` của `pages/api/units.js` / `pages/api/tests.js`.
`lib/testSections.js` `normalizeSections` phải giữ field này khi lưu.
Tuỳ chọn: map cột `Transcript` trong `lib/csvImport.js` (hiện đang bỏ qua) vào field này.

---

## 3. API

### 3.1 Lưu: `PUT /api/admin/units`

Trong đoạn map `categories` (~dòng 248), thêm `vocabReview: sanitizeVocabReview(cat.key, cat.vocabReview)`:
- `cat.key` không phải `reading` / `listening` → `{ enabled: false, words: [] }`.
- `enabled` → boolean. `words`: tối đa **60**; `trim` + cắt độ dài (word 80, cột khác 400, context 500);
  bỏ dòng `word` rỗng; bỏ trùng theo `word.toLowerCase()` (giữ dòng đầu).

### 3.2 AI: `POST /api/admin/ai-vocab-review` (route mới, cùng khuôn `ai-lesson.js`)

Body: `{ unitId, skill: "reading" | "listening", exercises, existingWords, wordCount, columns, language, studentLevel, notes }`.

1. **Nội dung bài lấy từ client** (`exercises` = state đang soạn trong editor), không đọc DB. Nhờ vậy nút
   Generate chạy được cả khi chưa Save. Không có rủi ro tenant vì đây là text của chính giáo viên: audio/ảnh không
   được dùng, chỉ lấy text. Giới hạn kích thước body (cắt nguồn ở bước 2) và ngân sách AI như route AI khác.
   `unitId` chỉ dùng để ghi log (`assertOwned` nếu có). Chặn `req.ws.demo`, kiểm tra `isEnabled()` như `ai-lesson.js`.
2. `collectSource(cat)` trong `lib/vocabReviewSource.js` (dùng chung với client để tính `sourceHash`) gom text các exercise của skill:
   - Reading: `passageText`, `noteText`, `label/pre/post`, label của `options` / `matchOptions`.
   - Listening: `transcript` (nếu có), `noteText`, `label/pre/post`, options, **đáp án đúng** của câu `fill`.
   - Cắt khoảng 30k ký tự (ưu tiên passage/transcript). Skill không có bài → 400 "No exercises to read vocabulary from".
3. **Một lần gọi Gemini** (một skill), `thinkingBudget` khoảng 1024, `maxDuration: 60`.
4. Prompt:
   - Chỉ chọn từ/cụm **có trong text nguồn**: từ học thuật/chủ đề, collocation, paraphrase giữa câu hỏi và bài
     (rất đặc trưng IELTS). Bỏ từ quá cơ bản so với trình độ (tái dùng `TIER_GUIDE`, `bandOf`,
     `describeStudentLevel`).
   - `word` ở dạng từ điển. `context` chép **nguyên văn** một câu trong nguồn.
   - Gửi kèm các từ đã có trong `vocabReview.words` của skill để AI không lặp (giống `existingWords`).
5. **Kiểm tra bám nguồn phía server**, không cần lượt AI thứ hai:
   - Từ (hoặc gốc từ, kiểu `keepCollocations`) không có trong nguồn → loại, đưa vào `removed[]`.
   - `context` không phải chuỗi con của nguồn (sau khi chuẩn hoá khoảng trắng/dấu nháy) → xoá `context`, giữ từ.
   - Chạy lại `normalizeWords` (cột không tick → rỗng, lọc collocation, bỏ trùng).
6. Trả `{ ok, words, removed, model }`. **Không ghi DB.** Ghi `AiLog` với `purpose: "generate.vocabReview"`.

`lib/client/api.js`: thêm `api.teacher.aiVocabReview(body)`.

---

## 4. Giao diện

### 4.1 Giáo viên: `app/teacher/lessons/[unitId]/page.js`

- Với `catKey` là `reading` / `listening`: sub-tab đổi thành **Theory | Exercises | Vocab Review**
  (`subTab = "vocab"`). Các skill khác giữ nguyên.
- Component mới `components/teacher/VocabReviewEditor.js` (props `review`, `onChange`, `aiContext`):
  - Công tắc **Show to students**.
  - Nút **Generate with AI** mở `AiVocabReviewDialog`. Phần form (trình độ, ngôn ngữ, tick cột, ghi chú) tách
    từ `AiVocabDialog.js` thành component dùng chung, không copy. Thêm chọn số từ (10 / 15 / 20).
    Màn xem trước: mỗi từ có checkbox (mặc định tick hết); `removed[]` hiện dạng "Suggested but not found
    in the exercises". Hai nút: **Add selected** (nối vào cuối, bỏ trùng) và **Replace list**.
  - Bảng từ: mở rộng `VocabWordTable` bằng prop `extraCols` để thêm cột **Context**. Nút "Add word" và nút xoá
    dòng đã có sẵn.
  - Listening không section nào có transcript → hiện gợi ý "Add a transcript to the listening sections for
    better results".
- `toEditorUnit` / `toPayload` mang theo `cat.vocabReview`. Save dùng nút Save hiện có.

#### Hỏi sau khi Save (flow chính, không bắt giáo viên tự nhớ vào tab)

Hiện tại `save()` lưu xong là `router.push("/teacher/lessons")`, tức rời trang editor. Flow mới:

1. Giáo viên bấm **Save** (hoặc Publish). Trước khi gọi API, với mỗi skill reading/listening tính `hash` hiện tại.
   Skill "cần hỏi" khi: có ≥ 1 exercise **và** (`words` rỗng **hoặc** `hash !== vocabReview.sourceHash`).
2. Không skill nào cần hỏi → lưu và rời trang như cũ.
3. Có → hộp thoại (dùng `useDialog`, hỏi gộp một lần cho cả hai skill):
   - Tiêu đề: "Tạo Vocab Review cho Reading?" / "…cho Reading & Listening?". Nếu đã có từ:
     "Bài Reading đã thay đổi — bổ sung từ mới?"
   - Phần "Tuỳ chọn" thu gọn (trình độ, ngôn ngữ, số từ, cột), **điền sẵn** từ lần dùng trước (`localStorage`
     theo workspace, bọc try/catch; không có thì dùng mặc định).
   - Nút **Chỉ lưu**: lưu và rời trang như cũ. Nút **Lưu & tạo từ vựng**: lưu nhưng **ở lại trang** (`save({ stay: true })`),
     chuyển `catKey` sang skill đầu tiên cần tạo, `subTab = "vocab"`, gọi AI ngay (cả hai skill thì chạy song song).
4. Tab Vocab Review hiện kết quả **ngay trong tab** (không mở modal): danh sách đề xuất với checkbox đã tick sẵn và mục
   `removed[]`. Nút **Add to list** nối vào bảng (bỏ trùng), đặt `sourceHash = hash`, và lần đầu có từ thì tự bật
   `enabled`. Giáo viên sửa tiếp nếu muốn rồi bấm Save lần nữa (lúc này hash đã khớp nên không hỏi lại).
5. Khi bài đã đổi, AI được gửi `existingWords` nên chỉ đề xuất **từ mới**; từ giáo viên đã sửa giữ nguyên.

Phụ trợ:
- Sub-tab Vocab Review có chấm nhỏ: xám "chưa có" khi `words` rỗng mà có exercise, cam "bài đã đổi" khi hash lệch.
  Giáo viên bấm "Chỉ lưu" vẫn thấy để quay lại sau.
- Nút **Generate with AI** trong tab vẫn còn để chạy thủ công bất cứ lúc nào (không cần Save trước, xem 3.2).
- Chỉ sửa Theory/deadline/lớp thì hash không đổi → không hỏi.
- Section editor Listening: thêm textarea **Transcript (optional — used by AI Vocab Review, hidden from
  students)** dưới phần chọn audio.

### 4.2 Học sinh: `app/student/lessons/[unitId]/page.js`

- `toPublicUnit()`: mỗi category trả thêm `vocabReview: { words }` **chỉ khi** `enabled && words.length`,
  ngược lại trả `null`. Skill bị khoá vẫn trả rỗng như hiện tại.
- Reading/Listening: sub-tab thành **Learn | Practice | Review**. Tab Review chỉ hiện khi `cat.vocabReview`
  khác null.
- Khoá/mở tính ở client bằng `categoryStats(cat, subs)` đã có (`completed >= topics`):
  - Chưa xong: ổ khoá và dòng "Finish all exercises to unlock (2/3)". Danh sách từ không nhạy cảm nên khoá
    phía client là đủ, không cần query Submission trong `/api/units`.
  - Xong: component mới `components/student/VocabReviewPane.js` gồm chuyển Cards / List (tái dùng `VocabFlashcards` /
    `VocabWordList`, thêm dòng **"In the text"** hiển thị `context`, từ được tô đậm).
- Học sinh nộp bài cuối cùng của skill → trong popup kết quả (`SubmissionResultModal`) hoặc ngay đầu
  tab Practice hiện nút **"Vocab Review unlocked → Review now"**, bấm vào thì chuyển sang sub-tab Review.
- Review không phải bài tập nên **không** ảnh hưởng `lib/completion.js`, streak hay nhắc hạn.

---

## 5. Các bước thi hành (mỗi bước một commit)

1. **Schema + lưu + editor nhập tay.** `vocabReview` trong CategorySchema, `sanitizeVocabReview` trong PUT,
   sub-tab Vocab Review với bảng nhập tay và công tắc. *Xong bước này là dùng được, không cần AI.*
2. **Học sinh.** `toPublicUnit`, sub-tab Review, khoá theo tiến độ, `VocabReviewPane`, nút "Review now".
3. **Transcript Listening.** Field schema, `normalizeSections`, textarea trong editor (tuỳ chọn: cột CSV).
4. **AI.** `lib/vocabReviewSource.js` (collectSource + hash), `lib/ai/vocabReview.js` (prompt, kiểm tra bám nguồn),
   route `ai-vocab-review.js`, kết quả hiện trong tab, form tuỳ chọn dùng chung tách từ `AiVocabDialog`.
5. **Hỏi sau khi Save.** `save({ stay })`, hộp thoại gộp, tự chuyển tab + chạy AI, chấm báo trên sub-tab.
6. **Test + verify** (mục 6).

## 6. Kiểm thử

- `tests/vocabReview.test.js` (`node --test`): `collectSource` theo từng skill; bộ lọc bám nguồn (từ không có
  trong bài bị loại, chấp nhận "mitigate" ↔ "mitigating", context bịa bị xoá); `sanitizeVocabReview`
  (skill khác reading/listening bị xoá, cắt độ dài, bỏ trùng, giới hạn 60).
- Chạy thật trên dev server:
  - Unit có 2 bài Reading + 1 bài Listening: Generate cho Reading → sửa → Save → reload vẫn còn. Sửa
    exercise rồi Save lại thì `vocabReview` **không mất**.
  - Học sinh: Review của Reading khoá → làm đủ 2 bài Reading → mở, trong khi Listening vẫn khoá.
  - `/api/units?id=` không trả `transcript`, trả `vocabReview: null` khi tắt.
  - Workspace demo bị chặn AI. Tắt `GEMINI_API_KEY` thì nhận 503, nhập tay vẫn chạy.
  - Flow sau Save: sửa bài Reading → Save → hộp thoại hiện. "Chỉ lưu" thì rời trang. "Lưu & tạo" thì ở lại, tự sang tab, AI chạy.
    Save lần 2 không hỏi lại. Chỉ sửa Theory thì không hỏi.
- Dọn dữ liệu test khỏi MongoDB sau khi verify (`docs/HANDOFF.md`).

## 7. Rủi ro / ghi chú

- **Listening không transcript** → từ kém hơn Reading; ô Transcript khắc phục được.
- **Sửa bài sau khi đã sinh từ**: danh sách không tự cập nhật. Giáo viên Generate lại rồi chọn "Add selected" (bỏ trùng).
- **Skill không có bài tập** (chỉ có Theory): `topics = 0`, Review mở ngay nếu giáo viên bật.
