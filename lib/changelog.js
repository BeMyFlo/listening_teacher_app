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
