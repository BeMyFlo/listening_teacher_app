# PLAN — Phase 12: Chương trình General English (tiếng Anh phổ thông lớp 6–12)

> Tài liệu **phân tích + định hướng**, chưa phải tài liệu thi hành từng dòng như PLAN-PHASE8-TOEIC.md.
> Quyết định ở mục 6 đã chốt. Bước tiếp theo: viết bản thi hành chi tiết cho từng đợt, bắt đầu từ G0.

Trạng thái: ☐ chưa code · Q1–Q10 **đã chốt** (chủ dự án, 2026-10-26) · Ngày lập: 2026-10-26
Tiền đề: **Phase 8 (TOEIC) merge vào `main` trước.** General dùng lại toàn bộ hạ tầng `program` của Phase 8
(registry `lib/curriculum.js`, `programFilter`, chip lọc, nhãn, level theo chương trình, C7 khoá đổi chương trình).
Branch mới cắt từ `main` sau khi merge, không cắt từ `phase-8-toeic`.

---

## 0. Tóm tắt một đoạn

Thêm chương trình thứ ba `general` ("General English") cho học sinh **lớp 6–12** học theo **chương trình GDPT 2018**.
Khác IELTS/TOEIC ở 4 điểm: (1) **level = khối lớp** và bài học bám **Unit của sách giáo khoa**; (2) phần lớn bài tập
là **kiến thức ngôn ngữ** (ngữ âm, trọng âm, từ vựng, ngữ pháp, giao tiếp, viết lại câu, sắp xếp) chứ không phải
bài đọc/nghe dài; (3) đề kiểm tra là **một tờ đề trộn mọi dạng**, chấm **thang 10**; (4) giáo viên đã có sẵn rất nhiều
**đề Word** và cần **in đề ra giấy**. Engine câu hỏi hiện tại làm được ~70% các dạng; phần thiếu chủ yếu là
**gạch chân trong đề**, **sắp xếp từ thành câu**, **viết lại câu chấp nhận nhiều đáp án**, và **khuôn đề theo kỳ thi**.

---

## 1. Nghiên cứu: tiếng Anh phổ thông ở Việt Nam hiện nay

### 1.1 Chương trình và sách

- **Chương trình GDPT 2018** (Thông tư 32/2018) đã áp dụng đủ lớp 6–12 từ năm học 2024–2025.
- Chuẩn đầu ra theo Khung năng lực ngoại ngữ 6 bậc: hết lớp 9 ≈ **bậc 2 (A2)**, hết lớp 12 ≈ **bậc 3 (B1)**.
- Nhiều bộ sách cùng lưu hành, mỗi trường chọn một bộ. Phổ biến nhất là **Global Success** (NXB Giáo dục); ngoài ra
  Friends Plus / Friends Global, i-Learn Smart World, Right On!, English Discovery, Bright, Explore English...
- **Global Success THCS**: 12 Unit/năm, cứ 3 Unit có 1 Review. Mỗi Unit: Getting Started → A Closer Look 1
  (từ vựng + **phát âm**) → A Closer Look 2 (**ngữ pháp**) → Communication → Skills 1 (đọc + nói) → Skills 2
  (nghe + viết) → Looking Back → Project.
- **Global Success THPT**: 10 Unit/năm. Mỗi Unit: Getting Started → Language (phát âm, từ vựng, ngữ pháp) →
  Reading → Speaking → Listening → Writing → Communication & Culture / CLIL → Looking Back → Project.

→ **Hệ quả cho app:** một Unit của app nên ứng với **một Unit sách**, và 6 tab hiện có (Grammar, Vocabulary,
Listening, Reading, Writing, Speaking) khớp gần đúng các mục của sách. Chỉ thiếu chỗ cho **phát âm** (mục 6, Q3).

### 1.2 Các kỳ kiểm tra, thi giáo viên phải luyện

| Kỳ | Ai ra đề | Hình thức thường gặp |
|---|---|---|
| Kiểm tra thường xuyên (15 phút, miệng, bài tập) | Giáo viên | Bài ngắn theo Unit, rất đa dạng |
| Giữa kỳ / cuối kỳ (Thông tư 22/2021) | Trường, theo ma trận + bản đặc tả (Nhận biết – Thông hiểu – Vận dụng – Vận dụng cao) | Trộn trắc nghiệm + tự luận; Nghe – Ngôn ngữ – Đọc – Viết; **Nói thường kiểm tra riêng** |
| Thi vào lớp 10 | Sở GD&ĐT từng tỉnh, **mỗi tỉnh một khuôn** | Xem 1.3 |
| Tốt nghiệp THPT (từ 2025) | Bộ GD&ĐT | 40 câu trắc nghiệm, 50 phút, **chủ yếu đọc** — xem 1.4 |
| Học sinh giỏi, chuyên Anh | Sở / trường chuyên | Khó hơn: word formation, open cloze, guided cloze, viết luận |

### 1.3 Thi vào lớp 10 — hai khuôn đề lớn

**TP.HCM 2026** (đề minh hoạ của Sở, 40 câu, 90 phút):

| Phần | Câu | Nội dung |
|---|---|---|
| 1 | 1–4 | Ngữ âm: phát âm nguyên âm/phụ âm, trọng âm (trắc nghiệm) |
| 2 | 5–16 | Từ vựng, ngữ pháp, giao tiếp (trắc nghiệm) |
| 3 | 17–28 | 17–22 đọc điền (cloze 80–100 từ), 23–28 đọc hiểu (bài 180–200 từ) |
| 4 | 29–40 | **Tự luận**: 29–34 viết dạng đúng của từ, 35–36 **viết cụm từ theo thông tin cho sẵn** (đọc chú thích từ điển — dạng mới), 37–40 viết câu |

**Hà Nội 2026**: 40 câu **trắc nghiệm**, gồm phát âm, trọng âm, từ vựng, ngữ pháp, chức năng giao tiếp, điền từ, đọc
hiểu, câu đồng nghĩa / viết lại câu, hoàn thành đoạn văn (các năm gần đây có thêm biển báo – thông báo và sắp xếp câu
thành đoạn/hội thoại; **cần giáo viên đối chiếu đề thật** vì nguồn công khai không thống nhất).

Các tỉnh khác hoặc theo khuôn Hà Nội (trắc nghiệm hết), hoặc trộn trắc nghiệm + tự luận như TP.HCM.

### 1.4 Tốt nghiệp THPT (từ 2025, 2026 giữ khuôn) — 40 câu, 50 phút, 0,25 điểm/câu

| Câu | Dạng |
|---|---|
| 1–6 | Đọc **quảng cáo / thông báo** ngắn, chọn từ điền chỗ trống (từ loại, giới từ, cụm động từ, collocation) |
| 7–12 | Đọc **tờ rơi (leaflet)**, chọn từ/cụm điền chỗ trống |
| 13–17 | **Sắp xếp** câu thành hội thoại / lá thư / đoạn văn (đáp án dạng "b – d – a – c – e") |
| 18–22 | **Điền câu / mệnh đề** vào chỗ trống trong đoạn văn |
| 23–30 | Đọc hiểu bài 1 (8 câu) |
| 31–40 | Đọc hiểu bài 2 (10 câu) |

Câu hỏi đọc hiểu gồm: ý chính, chi tiết, từ đồng nghĩa/trái nghĩa trong ngữ cảnh, quy chiếu ("the word *it* refers
to"), NOT TRUE, suy luận, **chèn câu vào vị trí [I]–[IV]**, **câu nào diễn đạt lại đúng câu gạch chân**, tóm tắt.
**Đề mới bỏ hẳn** câu phát âm/trọng âm và câu ngữ pháp đứng một mình. Bộ không công bố đề minh hoạ 2026.

### 1.5 Bảng tổng hợp mọi dạng bài giáo viên dùng

| # | Dạng (tên trong UI, tiếng Anh) | Ví dụ | Gặp ở |
|---|---|---|---|
| 1 | Pronunciation — odd one out | Chọn từ có phần **gạch chân** phát âm khác: h**ea**d / br**ea**d / m**ea**t / h**ea**vy | KT, vào 10 |
| 2 | Word stress | Chọn từ có trọng âm khác | KT, vào 10 |
| 3 | Multiple choice (vocabulary / grammar) | She ___ to school every day. A. go B. goes... | mọi nơi |
| 4 | Communication / responses | "Would you like some tea?" – "___" | KT, vào 10 |
| 5 | Error identification | Chọn phần **gạch chân** sai: My mother **usually go**(A) **to**(B)... | KT, HSG |
| 6 | Synonym / antonym | Chọn từ gần/trái nghĩa với từ **gạch chân** | KT, THPT |
| 7 | Signs & notices | Ảnh biển báo + "What does the sign mean?" | KT, vào 10 |
| 8 | Verb form | I (watch) ___ TV when she called. | KT, vào 10 |
| 9 | Word form | He is very ___ (help). | KT, vào 10, HSG |
| 10 | Cloze test — multiple choice | Đoạn văn có (1)…(6), mỗi chỗ 4 lựa chọn | mọi nơi |
| 11 | Open cloze | Đoạn văn có chỗ trống, tự điền 1 từ | KT, HSG |
| 12 | Reading — multiple choice | Bài đọc + câu hỏi A–D | mọi nơi |
| 13 | Reading — True / False | Bài đọc + câu T/F (**2** lựa chọn, không có Not Given) | KT |
| 14 | Reading — answer the questions | Trả lời câu hỏi bằng câu ngắn | KT, vào 10 |
| 15 | Sentence insertion | Câu này đặt ở [I] [II] [III] [IV] | THPT |
| 16 | Arrange sentences into a text | a–e → chọn thứ tự đúng (trắc nghiệm) | THPT, vào 10 HN |
| 17 | Sentence building (reorder words) | / always / she / early / gets up / → *She always gets up early.* | KT |
| 18 | Sentence transformation | Viết lại câu, bắt đầu bằng từ cho sẵn hoặc dùng từ trong ngoặc | KT, vào 10 |
| 19 | Sentence combination | Nối 2 câu bằng *although / which / so that...* | KT, vào 10 |
| 20 | Closest meaning (MCQ) | Chọn câu nghĩa gần nhất / câu nối đúng | vào 10 HN |
| 21 | Guided phrase writing | Viết cụm từ theo chú thích từ điển cho sẵn (dạng mới HCM 2026) | vào 10 HCM |
| 22 | Listening — T/F, MCQ, gap fill | như Skills 2 của sách | KT |
| 23 | Paragraph / email writing | 80–120 từ theo chủ đề Unit | KT |
| 24 | Speaking | Giới thiệu bản thân, nói theo chủ đề Unit | KT nói riêng |

Nguồn: [Sở GD&ĐT TP.HCM — đề minh hoạ lớp 10 2026 (VOH)](https://voh.com.vn/giao-duc/tphcm-cong-bo-de-minh-hoa-thi-lop-10-nam-2026-629666.html) ·
[Tuyển Sinh Số — điểm mới đề tiếng Anh vào 10 TP.HCM 2026](https://tuyensinhso.vn/tin-moi/nhung-diem-moi-trong-de-thi-tieng-anh-vao-lop-10-o-tphcm-nam-2026-c421071.html) ·
[Báo Lào Cai — đề tiếng Anh vào 10 Hà Nội 2026](https://baolaocai.vn/dap-an-de-thi-tieng-anh-lop-10-ha-noi-2026-ma-de-01-moi-nhat-post900676.html) ·
[PREP — các dạng bài đề tiếng Anh THPT](https://prepedu.com/vi/blog/cac-dang-bai-trong-de-thi-tieng-anh-thpt-quoc-gia) ·
[Thư viện pháp luật — đề tiếng Anh tốt nghiệp 2026 bao nhiêu câu](https://thuvienphapluat.vn/hoi-dap-phap-luat/de-tieng-anh-thi-tot-nghiep-thpt-2026-bao-nhieu-cau-138084823.html) ·
[Hoatieu — ma trận đề Tiếng Anh 7 Global Success](https://hoatieu.vn/ma-tran-de-thi-hoc-ki-1-mon-tieng-anh-7-240978) ·
[LuatVietnam — Thông tư 22/2021/TT-BGDĐT](https://luatvietnam.vn/giao-duc/thong-tu-22-2021-tt-bgddt-207846-d1.html)

---

## 2. Đóng vai: giáo viên tiếng Anh trung học dùng app

> **Cô Hạnh**, 9 năm dạy tiếng Anh ở một trường THCS công lập, buổi tối dạy thêm 3 lớp tại nhà:
> lớp 7 (Global Success), lớp 8, và lớp 9 ôn thi vào 10. Mỗi lớp 15–25 em. Máy tính có ~200 file đề Word gom
> từ đồng nghiệp và nhóm Facebook. Học sinh chủ yếu làm bài trên điện thoại.

### 2.1 Mong muốn — xếp theo mức "không có thì tôi không dùng"

**Bắt buộc phải có**

1. **Lớp theo khối, bài theo Unit sách.** Tôi mở app là thấy "Grade 7 → Unit 4: Music and Arts", không phải
   "Level 3". Bài về nhà tuần này = Unit đang dạy ở trường.
2. **Đủ dạng bài tôi vẫn ra**, nhất là: phát âm **có gạch chân**, trọng âm, tìm lỗi sai **có gạch chân**, chia
   động từ, word form, **sắp xếp từ thành câu**, **viết lại câu**, đọc hiểu True/False. Thiếu gạch chân thì
   dạng phát âm và tìm lỗi sai vô dụng.
3. **Viết lại câu phải chấm được nhiều đáp án đúng.** "She has learnt English for 3 years" và "She has learned
   English for three years" đều đúng. Máy chấm sai thì học sinh kêu, tôi phải sửa tay từng em → tôi muốn bấm
   **"Accept this answer"** một lần là cả lớp được chấm lại.
4. **Điểm thang 10**, kiểu "7,75/10" như ở trường, không phải "31/40 correct" hay band.
5. **Đưa đề Word có sẵn vào app mà không phải gõ lại.** Đề của tôi định dạng kiểu
   "Question 1. A. … B. … C. … D. …" và đáp án ở cuối. Gõ lại 200 đề là không thể.
6. **Đề thi thử theo đúng khuôn kỳ thi**: vào 10 (khuôn tỉnh tôi) và tốt nghiệp THPT, đánh số 1–40 liền mạch,
   có tiêu đề từng phần, có giờ làm bài.

**Rất muốn có**

7. **AI soạn bài theo Unit**: "Grade 8, Global Success Unit 5, present perfect, 10 câu MCQ + 5 câu viết lại câu"
   ra đúng chủ đề và đúng trình độ A2, không ra từ vựng IELTS.
8. **Thống kê theo chủ điểm**: lớp 9A sai nhiều nhất phần *câu điều kiện loại 2* và *word form* → tôi biết buổi
   sau dạy lại cái gì.
9. **In đề ra giấy** (Word/PDF) cho kiểm tra trên lớp, kèm đáp án riêng, và **2–4 mã đề** trộn câu/đáp án.
10. **Ngân hàng câu hỏi gắn nhãn** (Unit, chủ điểm, dạng, mức độ Nhận biết/Thông hiểu/Vận dụng) để **ráp đề theo
    ma trận** của trường.
11. **Writing đoạn văn chấm thang 10** (nội dung, bố cục, từ vựng, ngữ pháp), AI chấm nháp như IELTS đang có.

**Có thì tốt, chưa cần**

12. Kiểm tra nói ghi âm (trường kiểm tra nói riêng, ít khi giao về nhà).
13. Phụ huynh xem điểm. (Hỏi nhiều nhưng là sản phẩm khác — ngoài phạm vi.)
14. Gamification cho lớp 6–7 (huy hiệu, bảng xếp hạng).

### 2.2 Điều tôi KHÔNG muốn

- Không muốn thấy chữ "Band", "IELTS", "estimated score" trong lớp phổ thông.
- Không muốn tự nhớ "dạng này phải bật cái nút nào" — chọn tên dạng bài là builder tự dựng sẵn khung.
- Không muốn học sinh lớp 6 phải gõ cả câu dài trên điện thoại cho dạng sắp xếp từ → **bấm chọn từng từ**.

---

## 3. Đối chiếu dạng bài với engine hiện tại

Engine hiện có 2 kiểu chấm (`fill`, `choice`), lớp UI "định dạng" (`lib/teacher/questionFormats.js`) đặt tên dạng
lên trên, ảnh riêng từng câu (`field.imageId`), câu chữ cái không in đề (`kind: "letter"`), lựa chọn đặt sẵn
(`presetOptions`), đoạn văn có ô trống `[[n]]` (`noteMode`), chấm lại (`lib/teacher/regrade.js`).

| # | Dạng (mục 1.5) | Làm bằng gì | Thiếu gì |
|---|---|---|---|
| 3, 4, 10, 12, 20 | MCQ các loại | `mcq` (+ `passageText` có "(1)") | Không thiếu |
| 7 | Signs & notices | `mcq` + `field.imageId` (`needsFieldImage`) | Không thiếu |
| 8, 9 | Verb form, word form | `fill`, từ gốc để ở `post` "(help)" | Không thiếu |
| 11 | Open cloze | `fill` + `noteMode` | Không thiếu |
| 13 | True / False | `mcq` + `presetOptions: ["True","False"]` | Chỉ thêm format (tfng hiện là 3 lựa chọn) |
| 15 | Sentence insertion | như TOEIC `tr-p7i`, `presetOptions: ["[I]".."[IV]"]` | Chỉ thêm format |
| 16 | Arrange sentences (MCQ) | `mcq`, câu a–e trong `passageText` | Tuỳ chọn: builder tự sinh 3 thứ tự nhiễu |
| 1, 2, 5, 6 | Phát âm, trọng âm, tìm lỗi, đồng nghĩa | `mcq` | **Gạch chân** trong đề và lựa chọn (G1.1) |
| 14, 18, 19, 21 | Trả lời câu hỏi, viết lại câu, nối câu | `fill`, nhiều `answers` | **So khớp câu khoan dung** + **"Accept this answer"** (G1.3) |
| 17 | Sentence building | — | **Kiểu mới `reorder`**: bấm chọn từ (G1.2) |
| 22 | Listening | Đã có | True/False 2 lựa chọn như #13 |
| 23 | Writing đoạn văn | Prompt Writing + chấm AI | **Rubric thang 10** (G5) |
| 24 | Speaking | Prompt Speaking + chấm AI | Rubric thang 10 (G5, ưu tiên thấp) |
| — | Điểm thang 10 | — | `scoring: "ten-point"` (G0) |
| — | Đề trộn mọi dạng 1–40 | Test chỉ có 4 ô kỹ năng | Dùng ô `reading` làm "tờ đề" + khuôn đề (G2) |

**Phát hiện quan trọng khi rà code:** có **27 chỗ `=== "toeic"`** (AI prompt, builder, PromptsEditor, LevelField,
trang làm bài...). Hầu hết viết theo kiểu "TOEIC thì A, **còn lại là IELTS**" → thêm `general` mà không rà thì
General sẽ nhận prompt AI IELTS, rubric band 1–9, chữ "Band". **G0 phải rà hết 27 chỗ** và chuyển những gì đọc được
sang registry.

---

## 4. Tổ chức đề xuất

### 4.1 Registry

```js
// lib/curriculum.js
general: {
  key: "general", label: "General English",
  levelWord: "Grade",                 // "Grade 7" thay cho "Level 7" (G0)
  levelRange: [6, 12],                // gợi ý khi tạo lớp; không chặn
  lessonSkills: ["grammar", "vocabulary", "listening", "reading", "writing", "speaking"],
  skillLabels: { vocabulary: "Vocabulary & Pronunciation" },   // Q3
  testSkills: ["listening", "reading", "writing", "speaking"],
  testSkillLabels: { reading: "Written paper" },               // tờ đề trộn mọi dạng
  defaultDurations: { listening: 15, reading: 45, writing: 15, speaking: 10 },
  scoring: "ten-point",
},
```

### 4.2 Level = khối lớp

- `Class.level` / `Unit.level` / `Test.level` = **số khối** (6…12). Schema đã cho `level` 1–50, không đổi.
- Hiển thị "Grade 7" (`levelWord`). Tên level (PLAN-LEVEL-NAMES) vẫn dùng được: Grade 9 · "Ôn thi vào 10".
- Hai lớp cùng khối (7A thường, 7B nâng cao) là hai Class cùng level, khác tên — đã chạy được, giao bài theo
  `classIds` như hôm nay.

### 4.3 Unit = Unit sách giáo khoa

- Tên Unit đặt theo sách: "Unit 4 — Music and Arts". Thêm field tuỳ chọn **`Unit.textbook`** (Q4) — chỉ để hiện
  nhãn và đưa vào prompt AI ("Global Success Grade 7 Unit 4"), **không** dùng để lọc quyền.
- Map mục sách → tab:

| Mục Global Success | Tab app |
|---|---|
| A Closer Look 1 — Vocabulary, **Pronunciation** | Vocabulary & Pronunciation (nhóm từ + flashcard + bài phát âm) |
| A Closer Look 2 — Grammar | Grammar (topic: formula, when to use, common mistakes — đã có) |
| Skills 1 — Reading | Reading |
| Skills 2 — Listening | Listening |
| Skills 2 — Writing | Writing (prompt đoạn văn) |
| Communication, Speaking | Speaking |
| Looking Back, Review 1–4 | Một Unit riêng tên "Review 1" (gồm bài tập trộn) **hoặc** một Test (Q7) |

### 4.4 Test = đề kiểm tra / đề thi thử

- Ô `reading` của Test được hiện là **"Written paper"**: một tờ đề nhiều section, mỗi section là một phần của đề
  (Phonetics, Vocabulary & Grammar, Reading, Writing...). Writing tự luận chấm máy (word form, viết lại câu) nằm
  **trong** tờ đề này vì là `fill`.
- `listening` dùng khi đề có phần nghe (kiểm tra ở trường). `writing` chỉ dùng cho đoạn văn chấm tay/AI.
- Đề tốt nghiệp THPT, đề vào 10 Hà Nội = chỉ có Written paper.
- **Khuôn đề** (G2): tạo Test từ khuôn → builder dựng sẵn các section đúng tên, đúng số câu, đúng dạng, câu đánh
  số 1–40 liền. Giáo viên chỉ điền nội dung.

| Khuôn | Section dựng sẵn |
|---|---|
| School test (giữa kỳ / cuối kỳ) | Listening (tuỳ chọn) · Phonetics · Vocabulary & Grammar · Reading · Writing |
| Grade 10 entrance — HCM | Phonetics (1–4) · Vocab, grammar & communication (5–16) · Cloze (17–22) · Reading (23–28) · Word form (29–34) · Guided phrases (35–36) · Sentence writing (37–40) |
| Grade 10 entrance — Hà Nội | Theo đề năm gần nhất, giáo viên Hà Nội xác nhận (Q5) |
| THPT graduation | Notice (1–6) · Leaflet (7–12) · Arrangement (13–17) · Sentence completion (18–22) · Reading 1 (23–30) · Reading 2 (31–40) |

Khuôn là **dữ liệu trong code** (`lib/curriculum/generalTemplates.js`), không phải bảng DB. Đổi khuôn hằng năm =
sửa file.

### 4.5 Điểm thang 10 (`scoring: "ten-point"`)

- Điểm = `tổng điểm đạt / tổng điểm tối đa × 10`, làm tròn **0,25** (hoặc 0,1 — Q6). Hiện "7.75 / 10".
- Trọng số từng câu dùng `field.score` sẵn có (câu tự luận 2, trắc nghiệm 1). Chú ý `pointsEarned` đang
  `Math.max(1, score)` → không có trọng số < 1, nhưng quy về thang 10 thì không cần.
- **Bài tập Lesson cũng hiện thang 10** (khác TOEIC C5: TOEIC quy đổi 990 sai lệch với bài ngắn; thang 10 là tỉ
  lệ nên bài 10 câu vẫn đúng nghĩa) — kèm "8/10 correct".
- Chỉ hiển thị, không lưu DB (như `toeicScale.js`) → đổi cách làm tròn không cần migrate.

---

## 5. Lộ trình — mỗi đợt deploy độc lập được

> **Cách gộp nhánh (chủ dự án chốt 2026-10-27):** cả Phase 12 lên `main` bằng **một** PR — PR #20
> (`phase-12-general-g0` → `main`), để mở tới khi xong hết các đợt. `phase-12-general-g0` là **nhánh gom**: mỗi đợt
> cắt nhánh `phase-12-general-gN` từ nhánh gom và mở PR vào nhánh gom (G1 = PR #21, đã merge). `main` có bản vá thì
> merge `main` vào nhánh gom rồi vào nhánh đợt đang làm.

Bất biến xuyên suốt (như Phase 8 mục 0.2): **workspace IELTS và TOEIC không đổi gì**, mọi thứ mới gắn với
`program === "general"` qua registry; danh sách format IELTS/TOEIC trả **đúng danh sách cũ**.

### G0 — Nền chương trình General *(nhỏ, ~1 ngày)*

Bản thi hành chi tiết: [PLAN-PHASE12-G0.md](PLAN-PHASE12-G0.md).

1. Registry `general` (4.1) + `levelWord`, `skillLabels`, `testSkillLabels`, `scoring`.
2. **Rà 27 chỗ `=== "toeic"`**: chỗ nào mặc định "còn lại là IELTS" thì đổi sang đọc registry hoặc thêm nhánh
   general. Danh sách + quyết định từng chỗ ghi vào plan thi hành.
3. `formatLevelLabel` nhận `levelWord` ("Grade 7").
4. Form lớp: ô Program có thêm "General English"; chọn General thì gợi ý level 6–12.
5. Hiện điểm thang 10 (`lib/scoreLabel.js`, kết quả Lesson/Test, dashboard học sinh/giáo viên).
6. Ẩn tạm Writing/Speaking của General (như TOEIC 8A) cho tới G5 — không chấm bằng rubric IELTS.

Kiểm: tạo lớp General Grade 7, Unit có Grammar/Vocab/Reading/Listening bằng các format hiện có, học sinh làm bài
thấy "8.5 / 10". Workspace Ms Nhi không đổi gì.

### G1 — Đủ dạng bài phổ thông *(lớn nhất, ~3–4 ngày)*

`questionFormatsFor(subject, "general")` trả danh sách mới cho **cả grammar, vocabulary** (hôm nay hai tab này
không có dropdown format) lẫn reading, listening.

**G1.1 Gạch chân.** Cú pháp `__ea__` trong đề (`label`) và trong lựa chọn → render `<u>`. Render qua hàm an toàn
(escape trước, chỉ sinh đúng thẻ `<u>`), giống nguyên tắc `renderTheory`. Dùng cho: Pronunciation (gạch chân trong
lựa chọn), Error identification (gạch chân trong đề, **builder tự tạo 4 lựa chọn A–D từ 4 phần gạch chân**),
Synonym/Antonym. Chỉ bật trong format General → IELTS không đổi.

**G1.2 Kiểu mới `reorder` — Sentence building.**
- Lưu: `type: "fill"`, `answers` = câu đúng (có thể nhiều), field mới `tokens: [String]` = các mảnh đã xáo.
  **Không đổi luật chấm** (vẫn so chuỗi), chỉ thêm UI.
- Học sinh: hàng chip từ, bấm để đưa xuống ô câu, bấm lại để gỡ. Có nút "Clear". Trên điện thoại nút to.
- Builder: giáo viên gõ câu đúng, bấm "Split" → tự tách theo `/` hoặc dấu cách, tự xáo; sửa tay được.

**G1.3 So khớp câu khoan dung + Accept this answer.**
- Field mới `matchMode: "sentence"` (mặc định rỗng = luật cũ). Khi bật, `normalize` thêm: bỏ dấu câu cuối bất
  kỳ, nháy cong → nháy thẳng, khoảng trắng quanh dấu phẩy, viết tắt ↔ đầy đủ (`don't` = `do not`, `I'm` =
  `I am`...). Bật sẵn cho format: verb form, word form, sentence transformation, combination, answer the
  questions, reorder.
- Trang xem bài nộp của giáo viên: câu sai có nút **"Accept this answer"** → thêm vào `answers` của câu đó và
  chạy `regrade` cho mọi bài nộp của Unit/Test. Có ghi audit log.
- Không dùng AI chấm câu ngắn ở đợt này (chi phí, độ trễ, khó giải thích cho học sinh). Ghi lại để cân nhắc.

**G1.4 Danh sách format General** (nhãn tiếng Anh, theo mục 1.5):

| key | Nhãn | kind | Cờ |
|---|---|---|---|
| `g-pron` | Pronunciation — odd one out | mcq | underline trong lựa chọn |
| `g-stress` | Word stress | mcq | |
| `g-mcq` | Multiple choice | mcq | |
| `g-comm` | Communication — best response | mcq | |
| `g-error` | Error identification | mcq | underline trong đề, tự sinh A–D |
| `g-syn` | Synonym / Antonym | mcq | underline trong đề |
| `g-sign` | Signs & notices | mcq | `needsFieldImage` |
| `g-verb` | Verb form | fill | `matchMode: sentence` |
| `g-wform` | Word form | fill | `matchMode: sentence` |
| `g-cloze` | Cloze — multiple choice | mcq | |
| `g-ocloze` | Open cloze | fill | `noteMode` |
| `g-tf` | True / False | mcq | `presetOptions: ["True","False"]` |
| `g-rq` | Answer the questions | fill | `matchMode: sentence` |
| `g-insert` | Sentence insertion [I]–[IV] | mcq | `presetOptions` |
| `g-arrange` | Arrange sentences into a text | mcq | (tuỳ chọn) tự sinh thứ tự nhiễu |
| `g-reorder` | Sentence building (reorder words) | reorder | |
| `g-rewrite` | Sentence transformation | fill | `matchMode: sentence`, câu mở đầu ở `pre` |
| `g-combine` | Sentence combination | fill | `matchMode: sentence` |
| `g-closest` | Closest meaning | mcq | |
| `g-phrase` | Guided phrase writing | fill | `matchMode: sentence` |

**G1.5 Thống kê theo dạng bài.** `formatLabel` đã lưu sẵn trên từng câu → trang review Unit/Test thêm bảng
"% đúng theo dạng bài" cho cả lớp. Chủ điểm ngữ pháp (vd "conditional type 2") chưa có nhãn → để G4.

### G2 — Đề thi theo khuôn *(~2 ngày)*

1. `lib/curriculum/generalTemplates.js` (4.4). Nút "New test from template" trong trang Mock Tests khi lọc General.
2. Đánh số câu liền mạch qua các section, tiêu đề từng phần, như TOEIC C9.
3. Giờ làm bài theo khuôn (50 phút THPT, 90 phút vào 10 HCM...).
4. Kết quả: điểm thang 10 + bảng đúng/sai theo từng phần của đề.

### G3 — Đưa nội dung vào nhanh: AI + import Word *(~3 ngày)*

> Bản thi hành: [PLAN-PHASE12-G3.md](PLAN-PHASE12-G3.md) (+ prompt: [PLAN-PHASE12-G3-PROMPTS.md](PLAN-PHASE12-G3-PROMPTS.md)).

1. **AI soạn bài General** (`lib/ai/grammarLesson.js`, `vocabLesson.js`, thêm generator bài tập theo format):
   prompt "Vietnamese secondary school English teacher, GDPT 2018 curriculum, Grade {n}, {textbook} Unit {x},
   CEFR A1–B1". Nhánh IELTS/TOEIC giữ nguyên từng chữ (R7 của Phase 8).
2. **Import đề Word (.docx)** — giá trị lớn nhất với giáo viên phổ thông:
   - Đọc chữ từ .docx (giữ gạch chân → `__x__`, in đậm bỏ), gửi Gemini để **tách thành section + câu + đáp án +
     format** theo schema JSON cố định, server validate như `validateSections`.
   - **Luôn có màn xem trước** cho giáo viên sửa trước khi lưu; câu nào AI không chắc thì tô vàng.
   - Ảnh trong .docx (biển báo) → tải lên Image library, gắn `field.imageId`.
3. Template Excel cho General (như IELTS) cho ai đã quen Excel — ưu tiên thấp hơn Word.

### G4 — Ngân hàng câu hỏi, ma trận, in đề *(lớn, ~5 ngày, có thể tách đợt)*

1. Model mới `QuestionItem` (theo workspace): một câu hoặc một nhóm câu (bài đọc + câu hỏi), nhãn: program,
   grade, textbook unit, **chủ điểm** (danh sách cố định + tự thêm), format, **mức độ** (NB/TH/VD/VDC).
2. "Lưu vào ngân hàng" từ Unit/Test; import Word đổ thẳng vào ngân hàng.
3. **Ráp đề theo ma trận**: chọn khuôn + bảng "dạng × mức độ × số câu" → app bốc câu từ ngân hàng, giáo viên đổi
   từng câu.
4. **Nhiều mã đề**: trộn thứ tự câu trong section + thứ tự lựa chọn (không trộn câu "All of the above", câu
   sắp xếp, câu gắn đoạn văn).
5. **Xuất Word/PDF** đề + đáp án riêng để in.
6. Thống kê theo chủ điểm (mong muốn #8) dựa trên nhãn.

### G5 — Writing / Speaking thang 10 *(~2 ngày, dùng lại hạ tầng 8B)*

Rubric variant `general.writing` (Content · Organisation · Vocabulary · Grammar & mechanics, mỗi tiêu chí 0–2,5),
`general.speaking` tương tự. Prompt AI theo khối lớp, không đòi chuẩn IELTS. Mở lại tab Writing/Speaking cho General.

### Ngoài phạm vi Phase 12

Phụ huynh, gamification, đề HSG/chuyên riêng (dùng format sẵn có là làm được), chấm câu tự luận bằng AI, tiếng Anh
tiểu học (lớp 3–5: cần UI khác hẳn, nhiều hình/âm thanh).

### Thứ tự đề xuất và lý do

**G0 → G1 → G3 (import Word) → G2 → G5 → G4.** G0 + G1 là đủ để một giáo viên phổ thông dùng hằng ngày. Import Word
đặt trước khuôn đề vì không có nó giáo viên không có nội dung để đưa vào khuôn. G4 lớn nhất và cần dữ liệu thật
để thiết kế nhãn chủ điểm, nên làm sau khi đã có vài giáo viên dùng.

---

## 6. Quyết định — đã chốt (chủ dự án, 2026-10-26)

Chủ dự án chốt **toàn bộ Q1–Q10 theo đúng đề xuất** dưới đây. Người thi hành làm theo, không hỏi lại.

| # | Câu hỏi | Đã chốt |
|---|---|---|
| Q1 | Tên chương trình | Key `general`, nhãn **"General English"** (UI tiếng Anh). Không dùng "School English" vì trung tâm dạy thêm cũng dùng |
| Q2 | Level = khối lớp? | **Có.** Level 6–12, hiện "Grade 7". Lớp ôn thi vào 10 = Grade 9 có tên level riêng |
| Q3 | Phát âm để ở đâu | **Gộp vào tab Vocabulary**, đổi nhãn thành "Vocabulary & Pronunciation" cho General. Không thêm `CATEGORY_KEYS` (đổi enum chạm deadline, skillLock, completion, mọi trang) |
| Q4 | Có lưu bộ sách không | **Có, tuỳ chọn trên Unit** (`textbook`), chỉ để hiện nhãn + prompt AI. Danh sách cố định + "Other" |
| Q5 | Làm khuôn vào 10 tỉnh nào trước | **TP.HCM + Hà Nội + THPT.** Cần một giáo viên Hà Nội xác nhận khuôn 2026 |
| Q6 | Làm tròn điểm | **0,25** như cách chấm đề 40 câu; bài tập ngắn vẫn hiện số câu đúng bên cạnh |
| Q7 | Review 1–4 của sách là Unit hay Test | **Unit** (bài ôn về nhà); kiểm tra giữa kỳ/cuối kỳ mới là Test |
| Q8 | Writing/Speaking General ở đợt nào | **Ẩn ở G0–G4, mở ở G5** — không dùng tạm rubric IELTS (cùng lý do TOEIC 8A) |
| Q9 | Ngân hàng câu hỏi có làm trong Phase 12 không | **Có nhưng làm cuối (G4)**, tách plan riêng khi tới |
| Q10 | Học sinh có được thấy điểm thang 10 ngay ở bài tập Lesson không | **Có** (4.5), khác TOEIC C5 |

---

## 7. Rủi ro

| # | Rủi ro | Chặn bằng |
|---|---|---|
| R1 | General "rơi" vào nhánh IELTS ở 27 chỗ `=== "toeic"` → prompt IELTS, chữ "Band" | G0 bước 2 rà hết, probe kiểm từng màn có chữ "Band"/"IELTS" |
| R2 | Đổi `normalize` làm IELTS chấm khác | Luật mới chỉ chạy khi `matchMode === "sentence"`; IELTS không có field này |
| R3 | Gạch chân `__x__` va với dữ liệu IELTS cũ có dấu `_` (chỗ trống "____") | Chỉ render underline khi format thuộc General; quy tắc cần ít nhất 1 ký tự không phải `_` bên trong |
| R4 | "Accept this answer" chấm lại nhầm bài của lớp khác | Chỉ trong Unit/Test đó, trong workspace; ghi audit log; hiện số bài sẽ được chấm lại trước khi bấm |
| R5 | AI import Word đọc sai đáp án | Bắt buộc màn xem trước, tô vàng câu không chắc, không cho lưu thẳng |
| R6 | Khuôn đề tỉnh đổi hằng năm | Khuôn là file code, ghi năm + nguồn trong file; đề đã tạo không bị ảnh hưởng khi khuôn đổi |
| R7 | Học sinh nhỏ tuổi làm trên điện thoại khó thao tác | `reorder` dạng chip bấm, nút chữ cái to (như C8 của TOEIC), kiểm ở bề rộng 375px |
