# PLAN — Grammar & Vocabulary: bài học có cấu trúc + flashcard + import

Trạng thái: **ĐÃ CHỐT — đang làm Đợt 1**. Nhánh: `phase3-teacher` (nối tiếp Next.js migration).

### Quyết định đã chốt (2026-08-27)
1. **Chấm điểm: TỰ CHẤM (fill)** — theo đúng ý cô: file mẫu ghi `Dap_an_dung` nhiều cách cách nhau `/` ⇒ cô thiết kế để auto-grade. Tách đáp án theo `/` và `;`. "Tìm-sửa lỗi" / "Paraphrase" chấp nhận sai lệch, cô xem lại ở Submissions.
2. **"Lý thuyết chung" của category Grammar/Vocab: BỎ** khỏi UI. Category = chỉ danh sách chủ điểm/nhóm từ. (Field `theory` giữ trong schema để không mất data Unit cũ, nhưng không hiện/sửa cho grammar+vocab.)
3. **Video: chỉ YouTube** (`youtube.com` / `youtu.be`, whitelist host, nhúng iframe).
4. **Re-import: ghi đè theo `extId`** (Grammar_ID/Unit_ID), giữ `_id`, chủ điểm không có trong file mới thì giữ nguyên.

---

## 1. Mục tiêu

Cô giáo có bộ 4 file mẫu:

| File | Tab | Nội dung |
|---|---|---|
| `IELTS_Grammar_BaiHoc.xlsx` | `Grammar_LyThuyet` | `Grammar_ID, Ten_chu_diem, Cong_thuc, Khi_nao_dung, Loi_thuong_gap, Vi_du, Link_video` |
| `IELTS_Grammar_BaiTap.xlsx` | `Grammar_BaiTap` | `Grammar_ID, Dang_bai, So_thu_tu, Noi_dung_cau_hoi, Goi_y, Dap_an_dung, Giai_thich` |
| `IELTS_Vocab_BaiHoc.xlsx` | `Tu_vung` | `Unit_ID, Tu_vung, Loai_tu, Phien_am, Nghia, Dinh_nghia_TA, Vi_du, Collocation, Dong_nghia, Chu_de` |
| `IELTS_Vocab_BaiTap.xlsx` | `Tu_vung_BaiTap` | `Unit_ID, Nhom_cau, Dang_bai, So_thu_tu, Noi_dung_cau_hoi, Lua_chon_A..D, Tu_khoa_goi_y, Muc_do_paraphrase, Dap_an_dung, Giai_thich` |

Bài học nối bài tập qua `Grammar_ID` / `Unit_ID`.

**Kết quả mong muốn:** trong 1 Unit, category **Grammar** và **Vocabulary** trở thành danh sách **chủ điểm / nhóm từ**; mỗi cái có lý thuyết (grammar) hoặc flashcard (vocab) + bài tập riêng. Import cả 2 file 1 lần là đầy đủ.

---

## 2. Hiện trạng & khoảng trống

Model hiện tại (`lib/models/Unit.js`): mỗi category =
```
{ key, theory: { html, audioId, imageId }, exercises: [{ title, sections[] }], prompts: [...] }
```
Phẳng — 1 ô lý thuyết văn bản, không có:
- Nhiều chủ điểm grammar riêng biệt (công thức / khi nào dùng / lỗi / ví dụ / video)
- Danh sách từ vựng có cấu trúc / flashcard
- Field video (YouTube) cho lý thuyết
- Liên kết "chủ điểm ↔ bài tập của chủ điểm đó"

Import hiện tại (`lib/csvImport.js` + `xlsxRead.js`): chỉ xử lý Reading/Listening (đoạn văn/audio + câu hỏi). Các `Dang_bai` grammar/vocab ("Chia dong tu", "Tim va sua loi", "Matching nghia"…) chưa nhận diện.

---

## 3. Thiết kế data model

> Chỉ **Grammar** và **Vocabulary** category đổi. Listening/Reading/Writing/Speaking **giữ nguyên**.

### 3.1 Grammar category
```js
{
  key: "grammar",
  theory: { html, audioId, imageId },   // giữ — phần "giới thiệu chung" tuỳ chọn
  exercises: [...],                       // giữ — bài tập lẻ không thuộc chủ điểm nào (tuỳ chọn)
  topics: [                               // MỚI
    {
      _id,
      extId: "G1",                        // Grammar_ID từ file, để nối khi re-import
      name: "Câu điều kiện loại 2",
      lesson: {
        formula: "If + S + Ved/V2...",    // Cong_thuc
        whenToUse: "- Tình huống không có thật...",  // Khi_nao_dung
        commonMistakes: "Nhầm 'will'...",  // Loi_thuong_gap
        examples: "If I had more time...", // Vi_du
        videoUrl: "https://youtube.com/watch?v=..."   // Link_video
      },
      exercises: [ { _id, title, sections: [ SectionSchema ] } ]   // dùng lại question engine
    }
  ]
}
```

### 3.2 Vocabulary category
```js
{
  key: "vocabulary",
  theory: { html, audioId, imageId },   // giữ
  exercises: [...],                       // giữ
  groups: [                               // MỚI
    {
      _id,
      extId: "U1",                        // Unit_ID từ file
      name: "Environment",               // lấy từ Chu_de (hoặc extId nếu trống)
      words: [
        {
          word: "sustainable",
          partOfSpeech: "Tính từ",        // Loai_tu
          ipa: "/sə'steɪnəbl/",           // Phien_am
          meaning: "bền vững",            // Nghia
          definitionEn: "able to continue...",  // Dinh_nghia_TA
          example: "Urban gardening promotes...", // Vi_du
          collocation: "sustainable development / ...", // Collocation
          synonyms: "eco-friendly, viable"  // Dong_nghia
        }
      ],
      exercises: [ { _id, title, sections: [...] } ]
    }
  ]
}
```

### 3.3 Schema mới cần thêm (`lib/models/schemas/`)
- `GrammarTopicSchema` — name, extId, lesson{5 field String}, exercises:[ExerciseSchema]
- `VocabGroupSchema` — name, extId, words:[VocabWordSchema], exercises:[ExerciseSchema]
- `VocabWordSchema` — 8 field String, `_id: false`
- `CategorySchema` thêm `topics: [GrammarTopicSchema]`, `groups: [VocabGroupSchema]` (default [])

Không xoá gì → dữ liệu Unit cũ vẫn đọc được (topics/groups rỗng).

---

## 4. Import parser

### 4.1 `lib/csvImport.js` — `classifyQuestionType` thêm các dạng grammar/vocab
| `Dang_bai` (file) | → kind | Ghi chú |
|---|---|---|
| Chia động từ / Điền vào chỗ trống | `fill` | `Goi_y` (động từ gốc) → `hint` |
| Tìm và sửa lỗi (Error correction) | `fill` | đáp án = câu đã sửa; nhiều cách chấp nhận cách nhau `/` |
| Viết lại câu (Sentence transformation / Paraphrase) | `fill` | `Goi_y`/`Tu_khoa_goi_y` → `hint` ("If...", "It is said that...") |
| Điền từ vào chỗ trống | `fill` | `Tu_khoa_goi_y` → `hint` |
| Chia dạng từ (word form) | `fill` | |
| Matching nghĩa | `matching` hoặc `mcq` | có `Lua_chon_A..D` → dùng làm option/bank |

- `splitList` thêm tách theo `/` (đáp án paraphrase nhiều cách).
- Header alias thêm: `grammar_id`/`unit_id` → `section`, `goi_y`/`tu_khoa_goi_y` → `word limit`(hint), `ten_chu_diem` → (dùng cho lesson).

### 4.2 `lib/lessonImport.js` — MỚI, đọc file "Bài học"
- `parseGrammarLesson(rows) → Map<Grammar_ID, {name, lesson:{formula,whenToUse,commonMistakes,examples,videoUrl}}>`
- `parseVocabList(rows) → Map<Unit_ID, {name, words:[...]}>`

### 4.3 `lib/csvImport.js` — `workbookToGrammar(wbLesson, wbExercise)` / `workbookToVocab(...)`
Nhận 1–2 workbook (bài học + bài tập), trả:
```
{ topics: [{ extId, name, lesson, exercises:[{title, sections}] }], warnings }
{ groups: [{ extId, name, words, exercises }], warnings }
```
Nối theo ID. Bài tập của cùng `Grammar_ID` gộp vào 1 exercise (title = tên chủ điểm), 1 section.

### 4.4 `pages/api/admin/import.js` — thêm `mode`
- `mode=grammar` / `mode=vocab` → dùng `workbookToGrammar/Vocab`, nhận field `file` (bài tập) + `lessonFile` (bài học).
- `mode` mặc định (không truyền) → luồng Reading/Listening như hiện tại.

---

## 5. Backend API (`pages/api/admin/units.js`)

- PUT unit: `categories[].topics` và `categories[].groups` được nhận + normalize (giống cách `exercises` đang normalize; sections trong topic.exercises dùng `normalizeSections`).
- `pages/api/units.js` (học sinh): `toPublicUnit` trả thêm `topics` (ẩn đáp án trong exercises) và `groups` (words trả nguyên — không có gì bí mật).
- Grading: `pages/api/submissions.js` kind `exercise` — hiện tìm `category.exercises.id(exerciseId)`. Thêm: tìm trong `category.topics[].exercises` và `category.groups[].exercises`. Submission thêm field `topicId`/`groupId` (tuỳ chọn) để thống kê.

---

## 6. Màn giáo viên (`app/teacher/lessons/[unitId]`)

Category Grammar/Vocab đổi từ "Theory | Exercises" sang:

```
[ Giới thiệu chung ]  [ Chủ điểm / Nhóm từ ]        ← 2 sub-tab
                                     └─ [+ Import Grammar/Vocab từ file]

Chủ điểm 1: Câu điều kiện loại 2                    [sửa] [xoá]
  ├─ Lý thuyết: Công thức / Khi nào dùng / Lỗi / Ví dụ / Video URL
  └─ Bài tập:  [SectionsEditor như cũ]
Chủ điểm 2: ...
[+ Thêm chủ điểm thủ công]
```

- **Vocab**: thay ô "Lý thuyết chủ điểm" bằng **bảng từ** (mỗi dòng: từ / phiên âm / loại / nghĩa / def EN / ví dụ / collocation / đồng nghĩa) + nút thêm/xoá dòng.
- Nút **Import**: modal chọn 2 file (Bài học + Bài tập) → preview (N chủ điểm, M từ, K câu hỏi + warnings) → "Import vào Unit" → đổ vào `topics`/`groups`.
- Component mới: `GrammarTopicsEditor.js`, `VocabGroupsEditor.js`, `VocabWordTable.js`, `LessonImport.js`.

---

## 7. Màn học sinh (`app/student/lessons/[unitId]`)

Category Grammar/Vocab: sau khi chọn category → **danh sách chủ điểm / nhóm từ** → chọn 1 cái →

### Grammar topic
```
Câu điều kiện loại 2
─────────────────────
Công thức       If + S + Ved/V2...
Khi nào dùng    - Tình huống không có thật...
Lỗi hay gặp     Nhầm 'will'...
Ví dụ           If I had more time...
▸ Xem video     [nhúng YouTube iframe]        ← tuỳ chọn
─────────────────────
Bài tập  →  [SectionBlock + chấm điểm như Reading exercise]
```

### Vocab group
```
Nhóm từ: Environment
[ Flashcard ]  [ Bảng từ ]                    ← toggle

Flashcard: thẻ lật — mặt trước: từ + phiên âm
                     mặt sau: loại từ + nghĩa + def EN + ví dụ + collocation + đồng nghĩa
           nút ◀ ▶ chuyển thẻ, đếm "3/12"
Bảng từ:   bảng đầy đủ các cột
─────────────────────
Bài tập  →  [như trên]
```

- Component mới: `GrammarTopicView.js`, `VocabFlashcards.js`, `VocabWordList.js`.
- YouTube: chỉ nhúng `<iframe>` từ URL youtube.com/youtu.be đã whitelist host (không nhúng URL bất kỳ).

---

## 8. Phân đợt (test từng đợt)

### Đợt 1 — Backend + Import parser  ✅ XONG (2026-08-27)
- [x] `lib/models/schemas/lessonSchema.js`: GrammarTopicSchema, VocabGroupSchema, VocabWordSchema; thêm `topics`/`groups` vào CategorySchema (`lib/models/Unit.js`)
- [x] `lib/lessonImport.js` (parseGrammarLesson, parseVocabList, sanitizeYouTube, youTubeId); `csvImport.js`: HEADER_ALIAS thêm grammar_id/unit_id/goi_y/tu_khoa_goi_y, classifyQuestionType thêm dạng grammar/vocab, `splitList` tách `/` và `;`
- [x] `workbookToGrammar` / `workbookToVocab` trong csvImport.js
- [x] `api/admin/import.js` mode=grammar/vocab (field `file`=bài tập, `lessonFile`=bài học) — **lưu ý: đã fix bug `[fields,files]` bị bỏ mất `fields`**
- [x] `api/admin/units.js` PUT normalize topics/groups (+ validateCategories check exercises trong topic/group); `api/units.js` toPublicUnit trả topics/groups (ẩn đáp án)
- [x] `api/submissions.js` grading tìm exercise trong category.topics[].exercises / category.groups[].exercises
- **Test XONG:** live API — grammar (1 topic, video, 3 Q), vocab (1 group, 1 word, 2 Q), reading regression (9 sec/37 Q) — 0 warnings.

### Đợt 2 — Màn giáo viên  ✅ XONG (2026-08-27)
- [x] `lib/teacher/importConvert.js` (`toEditorSections` tách ra dùng chung); `SpreadsheetImport.js` dùng lại
- [x] `components/teacher/{LessonImport, VocabWordTable, GrammarTopicsEditor, VocabGroupsEditor}.js`. `TopicExercises` (bài tập của 1 topic/group) export từ GrammarTopicsEditor, VocabGroupsEditor dùng lại
- [x] `app/teacher/lessons/[unitId]/page.js`: grammar → `GrammarTopicsEditor`, vocabulary → `VocabGroupsEditor`, KHÔNG có sub-tab theory/practice cho 2 category này. `toEditorUnit`/`toPayload` gánh topics/groups.
- [x] Merge re-import theo `extId` trong `applyImport` (giữ `_id`, giữ lý thuyết cũ nếu import không kèm bài học)
- **Test XONG:** browser — Grammar/Vocab category render đúng ("Chủ điểm ngữ pháp (N)" / "Nhóm từ vựng (N)"), modal import 2 file input, word table 8 cột, add/expand không lỗi. Live: import→confirm→applyImport→toPayload (Node sim) + PUT unit với 1 topic → reload thấy đủ formula/video/bài tập/đáp án. (Đã revert test data khỏi UNIT 3.)

### Đợt 3 — Màn học sinh  ✅ XONG (2026-08-27)
- [x] `components/student/GrammarTopicView.js` (công thức/khi nào dùng/lỗi/ví dụ + nhúng YouTube qua `youTubeId` — chỉ id 11 ký tự hợp lệ mới nhúng)
- [x] `components/student/VocabFlashcards.js` — `VocabFlashcards` (lật thẻ, ◀ ▶, đếm) + `VocabWordList` (bảng)
- [x] `app/student/lessons/[unitId]/page.js` — `LessonTopicPane` cho grammar/vocab: list chủ điểm/nhóm → detail (GrammarTopicView | Flashcard/Bảng từ toggle) + bài tập (dùng lại `ExerciseBlock`)
- [x] `api/units.js` list rows + populate cho topic/group exercise sections; `itemCount`/`hasContent` gồm cả topic/group
- **Test XONG (end-to-end, dữ liệu thật):** import grammar+vocab → publish → student GET (đáp án đã ẩn) → browser: topic view hiện đủ lý thuyết, exercise nộp được "Score: 1/3" (câu điền đúng, câu sửa-lỗi/viết-lại sai do so khớp — đúng như thiết kế), vocab flashcard lật + bảng từ + exercise 2 câu. Không lỗi React.

## ✅ HOÀN THÀNH cả 3 đợt. Còn optional: nút import grammar/vocab kèm CSV (hiện chỉ .xlsx), nhúng video mp4 tự host.

---

## 9. Quyết định cần chốt

1. **Bài tập grammar/vocab tự chấm hay chấm tay?**
   - Đề xuất: **tự chấm** (fill, so khớp nhiều đáp án cách nhau `/`). "Tìm và sửa lỗi" / "Paraphrase" chấp nhận sai lệch — cô xem lại ở Submissions. (Nếu muốn chấm tay → phải thêm loại câu hỏi "tự luận ngắn").
2. **"Giới thiệu chung" của category** (ô theory.html cũ) — giữ hay bỏ?
   - Đề xuất: **giữ**, làm phần dẫn nhập tuỳ chọn trước danh sách chủ điểm.
3. **Video**: chỉ YouTube, hay cả link mp4 tự host?
   - Đề xuất: YouTube + youtu.be (whitelist host). Mở rộng sau nếu cần.
4. **Re-import** (cô sửa file rồi import lại): ghi đè theo `extId` hay luôn thêm mới?
   - Đề xuất: **ghi đè theo extId** (giữ `_id` cũ để submission không mất tham chiếu), chủ điểm không có trong file mới thì giữ nguyên (không xoá).
