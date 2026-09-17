// Nhật ký cập nhật hiển thị 1 lần cho giáo viên/học sinh sau khi đăng nhập
// lại (xem components/ChangelogModal.js + pages/api/changelog.js).
//
// SỬA FILE NÀY mỗi khi deploy 1 đợt thay đổi người dùng nên biết:
//   - Thêm 1 entry MỚI lên ĐẦU mảng — đừng sửa/xoá entry cũ (đã có người xem).
//   - `version`: chuỗi tăng dần dạng "YYYY-MM-DD.N" (N = lần thứ mấy trong
//     ngày đó), so sánh bằng string nên luôn phải giữ đúng định dạng này.
//   - `audience` mỗi dòng: "all" | "teacher" | "student".
const CHANGELOG = [
  {
    version: "2026-09-17.1",
    date: "2026-09-17",
    items: [
      {
        audience: "teacher",
        text: "MỚI — \"Create by AI\" cho Grammar: bấm nút ✨ cạnh \"Import from file\" khi soạn chủ điểm ngữ pháp, mô tả lớp + trình độ (band IELTS hoặc CEFR) + chủ đề, tick phần muốn AI viết (Form, When to use, Common mistakes, Examples và/hoặc bài tập trắc nghiệm/điền từ) — AI soạn xong cho xem trước, chọn giữ chủ đề nào rồi mới thêm vào bài, chưa lưu gì cho tới khi bấm Save.",
      },
      {
        audience: "teacher",
        text: "MỚI — \"Create by AI\" cho Vocabulary: tương tự Grammar — AI soạn bảng từ (chọn cột: từ loại, IPA, nghĩa, định nghĩa, ví dụ, collocation, từ đồng nghĩa) và/hoặc bài tập (chọn từ đúng, chọn nghĩa đúng, điền từ trong khung). Từ đã có sẵn trong bài sẽ không bị AI lặp lại.",
      },
      {
        audience: "teacher",
        text: "Đáp án bài tập do AI soạn (Grammar & Vocabulary) được 1 lượt AI thứ hai kiểm tra lại độc lập trước khi đưa ra — câu nào đáp án sai hoặc có nhiều hơn 1 lựa chọn đúng sẽ tự bị loại, phần xem trước có ghi rõ đã loại câu nào và vì sao. Vẫn nên đọc lại trước khi Publish cho học sinh.",
      },
      {
        audience: "teacher",
        text: "AI Grading: khi model đang quá tải (\"high demand\") thì tự động chuyển sang model dự phòng thay vì báo lỗi ngay — ít bị gián đoạn hơn khi chấm bài hoặc soạn bài bằng AI.",
      },
      {
        audience: "all",
        text: "Admin có thêm mục \"AI Log\" theo dõi mọi lượt gọi AI (ai dùng, dùng cho bài nào, tốn bao nhiêu tiền, có lỗi không) và cài đặt giới hạn chi phí AI theo tháng — vượt giới hạn thì các tính năng AI tạm khoá, giáo viên sẽ được nhắc liên hệ admin để mở lại.",
      },
    ],
  },
  {
    version: "2026-09-16.1",
    date: "2026-09-16",
    items: [
      {
        audience: "teacher",
        text: "MỚI — Thống kê theo dạng bài: xem chi tiết bài làm của 1 học sinh (cả Lesson lẫn Mock Test) giờ có tab \"Thống kê\" ở đầu, hiện tỉ lệ % đúng của từng dạng bài Reading/Listening (True/False/Not Given, Matching Headings, Table Completion...) — dạng yếu nhất xếp lên trước để biết ngay em đó cần luyện gì.",
      },
      {
        audience: "teacher",
        text: "Trang chấm bài theo Unit giờ chia tab (Thống kê, Grammar, Vocabulary, Listening, Reading, Writing, Speaking) thay vì cuộn 1 trang dài.",
      },
      {
        audience: "teacher",
        text: "Soạn câu hỏi dạng Completion (Note/Table/Flow-chart/Summary): mỗi bảng giờ là 1 KHUNG RIÊNG — bấm \"Add Question\" chọn dạng Completion là ra 1 khung mới, các câu hỏi và đáp án của bảng đó nằm gọn trong khung, không còn phải tự chèn Divider để tách và không bị lẫn lộn giữa các bảng nữa.",
      },
      {
        audience: "teacher",
        text: "Import đề: 1 file có mấy bảng (cách nhau bởi dấu ---) thì ra đúng bấy nhiêu khung. Import thêm vào bài đã soạn KHÔNG còn xoá mất bảng cũ, và số thứ tự câu tự đánh nối tiếp thay vì quay về 1.",
      },
      {
        audience: "teacher",
        text: "Từ vựng & Ngữ pháp: mỗi nhóm từ / chủ đề giờ có nút \"Import\" riêng để nạp file thẳng vào nhóm đó. Trước đây chỉ có nút Import chung ở trên, và nhóm tự tạo tay không bao giờ nhận được dữ liệu import.",
      },
      {
        audience: "teacher",
        text: "Sửa lỗi: xoá 1 câu hỏi trong bài Completion giờ xoá luôn ô trống tương ứng trong đề — không còn bị kẹt không lưu được với thông báo \"chỗ trống chưa có câu hỏi/đáp án tương ứng\".",
      },
      {
        audience: "teacher",
        text: "Sửa lỗi: bài Writing/Speaking nộp lần 2 đã chấm điểm nhưng không hiện bài làm của học sinh (chỉ thấy điểm và nhận xét). Nay luôn hiện đầy đủ bài viết, kể cả khi chưa gắn ghi chú sửa lỗi nào.",
      },
      {
        audience: "teacher",
        text: "Bảng điểm theo tiêu chí (Writing/Speaking) dễ đọc hơn: tên tiêu chí đổi màu xanh, dòng \"Note\" đậm màu hơn thay vì xám nhạt khiến học sinh bỏ qua. Danh sách lỗi sửa chi tiết giờ chỉ giáo viên thấy, học sinh không thấy nữa.",
      },
    ],
  },
  {
    version: "2026-09-14.3",
    date: "2026-09-14",
    items: [
      {
        audience: "teacher",
        text: "Chấm Writing/Speaking: gõ/xoá THẲNG trong bài như 1 ô văn bản thật — bấm vào đâu, con trỏ hiện ở đó; Backspace/Delete gạch đỏ ngay ký tự đó, gõ thêm hiện chữ xanh ngay, không cần mở toolbar cho các sửa nhanh. Bôi đen 1 đoạn vẫn mở toolbar để gắn tiêu chí + ghi chú khi cần.",
      },
    ],
  },
  {
    version: "2026-09-14.2",
    date: "2026-09-14",
    items: [
      {
        audience: "teacher",
        text: "Chấm Writing/Speaking: bỏ ô \"Sửa nhanh\" tách riêng bên cạnh — giờ chỉ còn 1 khung, bấm thẳng vào chữ đã gạch/tô (kể cả do AI chấm) để sửa hoặc xoá ngay tại chỗ.",
      },
      {
        audience: "teacher",
        text: "Mock Test Results: sửa lỗi Writing/Speaking không hiện dù học sinh đã nộp — xảy ra khi đề bị chỉnh sửa lại sau khi học sinh nộp bài.",
      },
    ],
  },
  {
    version: "2026-09-14.1",
    date: "2026-09-14",
    items: [
      {
        audience: "teacher",
        text: "Mock Test Results được sắp xếp lại: vào từng bài test (nút \"Submissions\") → chọn lớp → chọn học sinh, thay vì 1 bảng phẳng lẫn lộn mọi bài/mọi kỹ năng khó hiểu như trước.",
      },
      {
        audience: "teacher",
        text: "Trang chi tiết bài làm của học sinh giờ có 4 tab riêng cho Listening/Reading/Writing/Speaking, mỗi tab xem đầy đủ điểm số, câu đúng/sai và chấm bài.",
      },
      {
        audience: "teacher",
        text: "Phần review Listening/Reading có thêm vòng tròn điểm số, thẻ thống kê Đúng/Sai/Bỏ trống/Độ chính xác, bộ lọc theo trạng thái và ô tìm câu hỏi.",
      },
    ],
  },
  {
    version: "2026-09-13.1",
    date: "2026-09-13",
    items: [
      {
        audience: "teacher",
        text: "Soạn câu hỏi: chỉ cần bấm \"+ Add Question\" rồi chọn đúng dạng bài (Note/Flow-chart/Table Completion...) là tự hiện khung nhập phù hợp — không cần bấm nhiều nút như trước.",
      },
      {
        audience: "teacher",
        text: "Sửa đáp án của 1 bài tập/bài thi sẽ TỰ ĐỘNG chấm lại toàn bộ bài học sinh đã nộp theo đáp án mới; có thêm nút \"Re-grade all\" ở trang Submissions để chấm lại bất cứ lúc nào.",
      },
      {
        audience: "teacher",
        text: "Câu hỏi \"chọn N trong M đáp án\" giờ chấm điểm từng phần — chọn đúng 1 trong 2 vẫn được nửa điểm, thay vì mất trắng.",
      },
      {
        audience: "student",
        text: "Bài nghe Mock Test giờ đúng kiểu thi thật: mỗi Part chỉ nghe được 1 lần, không tua lại được.",
      },
      {
        audience: "student",
        text: "Sửa lỗi bàn phím tự tắt sau khi gõ 1 chữ và lỗi bôi đen (highlight) không hoạt động trên điện thoại.",
      },
    ],
  },
];

module.exports = { CHANGELOG };
