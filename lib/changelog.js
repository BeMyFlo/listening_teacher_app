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
