# PLAN — Phase 12 · G4: Ngân hàng câu hỏi, ma trận, nhiều mã đề, in đề

> Tài liệu thi hành cho đợt **G4** của [PLAN-PHASE12-GENERAL-ENGLISH.md](PLAN-PHASE12-GENERAL-ENGLISH.md) (mong muốn #8, #9,
> #10, mục 5-G4). Sonnet code, Claude Code (lead) review + merge từng bước.

Trạng thái: ◐ code xong trên `phase-12-general-g4`, đã kiểm (trừ mục ghi ở nhật ký), chưa merge · Ngày lập: 2026-10-30
Tiền đề: G5 xong. Branch `phase-12-general-g4` cắt từ `phase-12-general-g5` (chưa push). Xong → PR vào nhánh gom. G4 là đợt
cuối trước kiểm tổng Phase 12.

---

## 0. Luật chơi

### 0.1 G4 làm gì

1. **Ngân hàng câu hỏi** theo workspace: mỗi mục là 1 câu hoặc 1 nhóm (đoạn văn + các câu), gắn nhãn khối, Unit sách, chủ
   điểm, dạng, mức độ (Nhận biết / Thông hiểu / Vận dụng / Vận dụng cao).
2. **Đưa câu vào ngân hàng:** lưu từ builder (Unit, Mock Test) và từ import Word.
3. **Ráp đề theo ma trận:** chọn khuôn → điền bảng "dạng × mức độ × số câu" → app bốc câu từ ngân hàng → giáo viên đổi từng câu.
4. **Nhiều mã đề + in đề:** xuất Word (.docx) và bản in (PDF qua trình duyệt) cho 1–4 mã đề, kèm đáp án riêng.
5. **Thống kê theo chủ điểm:** lớp sai nhiều nhất chủ điểm nào.

### 0.2 Bất biến

1. **IELTS/TOEIC không đổi:** menu, builder, payload lưu, API học sinh, chấm điểm. `gradingContract`, `aiPromptPin`,
   `ieltsAiRequestPin`, `programBranches` xanh không sửa. Mọi nhánh mới đọc registry (`questionBank: true`, chỉ General).
2. **Tenant:** mọi truy vấn `QuestionItem` qua `tenantFilter`; `check-tenant-scope --strict` 0 vi phạm. Không có ngân hàng dùng
   chung giữa các trung tâm.
3. **Đáp án không lộ:** API học sinh không bao giờ trả `topic`, `difficulty`; xuất đề chỉ route giáo viên.
4. **Đề đã tạo độc lập với ngân hàng:** bốc câu = **chép** vào đề. Sửa/xoá câu trong ngân hàng không đổi đề cũ.
5. Mọi file sinh ra không chứa script; dữ liệu giáo viên được escape khi viết XML.

### 0.3 G4 KHÔNG làm

- Chia sẻ ngân hàng giữa trung tâm, kho đề mẫu của BeMyFlo.
- AI tự gắn nhãn chủ điểm/mức độ (để sau khi có dữ liệu thật).
- Mã đề làm online: học sinh làm online vẫn một đề; mã đề chỉ dùng khi in. Chấm phiếu tô giấy không có.
- PDF sinh ở server (dùng trang in + "Save as PDF" của trình duyệt, không thêm thư viện).

---

## 1. Quyết định (đề xuất của lead, đổi được)

| # | Câu hỏi | Chốt |
|---|---|---|
| D1 | Câu trong đề lưu nhãn thế nào | Thêm vào `FieldSchema` 2 chuỗi tuỳ chọn `topic`, `difficulty` (mặc định ""). `fieldToServer` chỉ gửi khi có giá trị để payload IELTS không đổi; API học sinh không trả. |
| D2 | Danh sách chủ điểm | Hằng số `lib/generalTopics.js` (ngữ pháp + từ vựng + kỹ năng thường gặp theo GDPT 2018), cho gõ thêm chủ điểm tự do. |
| D3 | Mức độ | 4 khoá `nb`, `th`, `vd`, `vdc`, nhãn tiếng Anh kèm viết tắt: Recognition (NB), Comprehension (TH), Application (VD), High application (VDC). |
| D4 | Câu gắn đoạn văn | Là 1 mục **nhóm**: bốc nguyên nhóm, không tách câu. Ma trận đếm theo số câu. |
| D5 | Bốc câu | Ngẫu nhiên trong ngân hàng cùng workspace + khối + dạng + mức độ (+ chủ điểm nếu chọn). Thiếu câu: báo "thiếu N câu" theo từng ô, vẫn bốc phần có, phần thiếu giữ ô trống của khuôn. Không bốc trùng trong một đề. |
| D6 | Mã đề | Chỉ sinh lúc xuất, không lưu DB. Trộn theo seed (`testId + mã đề`) nên xuất lại ra đúng đề cũ. |
| D7 | Luật trộn | Không đổi thứ tự phần. Trộn câu trong phần trừ phần có đoạn văn; trộn lựa chọn trừ: Error identification, True/False, [I]–[IV], Arrange, lựa chọn kiểu "All/None of the above", "Both A and B". |
| D8 | Word | Tự viết OOXML tối thiểu + ZIP writer `lib/zipWrite.js` (không thêm thư viện, cùng lý do `xlsxRead`). Giữ gạch chân, ảnh chèn thật. |
| D9 | Thống kê | "% đúng theo chủ điểm" ở trang kết quả lớp của Mock Test/Unit (đề có nhãn), tính từ `submission.detail` + nhãn hiện tại của câu; chỉ hiện với chương trình có `questionBank`. |

---

## 2. Thiết kế

### 2.1 `lib/models/QuestionItem.js`

`workspaceId` (bắt buộc), `program`, `level` (khối), `textbook`, `unitLabel`, `topic`, `difficulty`, `format` (key `g-*`), `kind`
(`single` | `group`), `passageText`, `imageId`, `fields: [FieldSchema]`, `questionCount`, `createdBy`, `sourceRef`, timestamps. Index
`{ workspaceId, program, level, format, difficulty }`. Với `group`, `format`/`difficulty` là của cả nhóm; câu trong nhóm giữ
`formatLabel` riêng. Validate bằng luật câu hỏi sẵn có: mỗi câu phải qua `incompleteQuestions` (không nhận câu dở vào ngân hàng).

### 2.2 API `pages/api/admin/question-bank.js`

`requireAuth(withTenant)`, chỉ program có `questionBank`.
- GET: lọc + phân trang (không trả toàn bộ), trả cả đếm theo ô cho ma trận (`?action=counts`).
- POST tạo (1 hoặc nhiều mục, trần 100/lần); PUT sửa nhãn/nội dung; DELETE.
- POST `?action=pick`: nhận `{ level, rows: [{ format, difficulty, topic?, count }], excludeIds }` → mục đã bốc + thiếu bao nhiêu.
- Ảnh: `imageId` phải thuộc workspace (như `validateSections`).

### 2.3 UI

- Trang `/teacher/question-bank`: bộ lọc, danh sách (dùng `AiQuestionPreview`), sửa nhãn hàng loạt, xoá, "Import from Word" (dùng
  lại `WordImport`, đích là ngân hàng). Menu LIBRARY chỉ hiện khi workspace có chương trình `questionBank`.
- Builder: mỗi section có "Save to question bank" (chọn câu + nhãn; section có đoạn văn lưu thành nhóm).
- `TemplatePicker`: sau khi chọn khuôn, tuỳ chọn "Fill from question bank" → bảng ma trận theo phần, hiện số câu sẵn có từng ô;
  dựng khung rồi đổ câu vào, câu đổ vào giữ `topic`/`difficulty`. Nút "Swap" trên câu lấy từ ngân hàng.

### 2.4 Xuất đề — `lib/exam/`

- `shuffleExam(test, { skill, code })` thuần, seed theo D6, luật D7, trả đề đã đánh số lại + bảng đáp án.
- `lib/zipWrite.js`, `lib/exam/docx.js` (`renderExamDocx`, `renderAnswerKeyDocx`): tiêu đề, tên phần, đoạn văn, câu, gạch chân,
  ảnh, ô Họ tên/Lớp/Mã đề; câu viết có dòng kẻ. Kiểm bằng cách đọc lại qua `lib/docxRead.js` trong test.
- Route `pages/api/admin/test-export.js`: tải `.docx` theo mã đề / đáp án; ảnh lấy từ Cloudinary của đúng workspace, chỉ host
  Cloudinary; trần dung lượng, thiếu ảnh thì ghi chú trong file.
- Trang in `/teacher/tests/[testId]/print?code=&answers=`: stylesheet `@media print`, cùng dữ liệu `shuffleExam`.
- Builder: nút "Print / export" (mã đề 1–4).

### 2.5 Thống kê theo chủ điểm

`aggregateByTopic(sections, submissions)` thuần trong `lib/teacher/`; hiện ở trang kết quả lớp và trang từng học sinh khi đề có nhãn.

---

## 3. Chia bước

| Bước | Nội dung |
|---|---|
| 1 | `topic`/`difficulty` trên câu, `generalTopics`, registry `questionBank`, model, API + test |
| 2 | Trang ngân hàng, menu, "Save to question bank", import Word vào ngân hàng |
| 3 | Ma trận + bốc câu + Swap trong `TemplatePicker` |
| 4 | `shuffleExam`, zipWrite, docx, route, trang in |
| 5 | Thống kê theo chủ điểm |
| 6 | Lead kiểm tổng: build, probe API thật, trình duyệt, mở file `.docx` |

## 4. Kiểm thử bắt buộc

- Pin + contract không đổi; payload IELTS không có `topic`/`difficulty`; API học sinh không trả 2 trường này.
- Tenant: workspace B không đọc/sửa/bốc được câu workspace A; `imageId` khác workspace bị từ chối.
- Ma trận: đủ câu, thiếu câu, không trùng, nhóm không bị tách.
- Trộn: cùng seed ra cùng đề; đáp án theo mã khớp đề; luật D7 từng ca; mọi lựa chọn được giữ nguyên.
- `.docx`: đọc lại bằng `docxRead` thấy đủ câu + gạch chân; ký tự `<&"` không làm hỏng XML.

## 5. Nhật ký

| Ngày | Bước | Ghi chú |
|---|---|---|
| 2026-10-30 | Plan | Lập plan. |
| 2026-10-30 | 1–5 | Sonnet code, lead review + merge từng bước: `QuestionItem` + API, trang Question Bank, lưu từ builder và Word, `fillFromBank` + Swap, `shuffleExam`, `zipWrite`, `docx`, trang in, `topicStats`. |
| 2026-10-30 | 6 | Kiểm tổng: 543 test pass, tenant scope sạch, build qua, Phase 8 232/232, G1 94/94. E2E qua handler thật trên DB dev 16/16 (đếm ô ma trận, bốc câu + thiếu, cách ly workspace, xuất docx đọc lại được, chặn học sinh lấy đáp án, thống kê chủ điểm). Trình duyệt: menu IELTS không đổi, trang ngân hàng, trang in. Xem bản in lộ 2 lỗi đã sửa: câu tìm lỗi sai thiếu chữ (A)–(D), phần chỉ có dòng hướng dẫn không được trộn câu. Chưa kiểm: mở .docx bằng Word thật (máy không có Word; XML hợp lệ); bảng ma trận và Swap trên trình duyệt với ngân hàng có dữ liệu; import Word vào ngân hàng với Gemini thật; 375px các trang mới. |
