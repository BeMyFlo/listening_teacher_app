// Kênh email — STUB. Chưa bật (xem CHANNEL_CONFIG trong ../index.js).
//
// Khi triển khai:
//   1. Thêm "email" vào CHANNEL_CONFIG cho loại thông báo cần gửi.
//   2. Ở đây: đọc Student.email + biến môi trường (EMAIL_API_KEY, EMAIL_FROM…),
//      render template từ notif.title/notif.body, gọi nhà cung cấp email.
//   3. Cập nhật notif.deliveries.email = { status: "sent", sentAt: new Date() }
//      (hoặc "failed" + error). Đặt "pending" trước khi gửi nếu muốn có worker
//      retry riêng.
//
// Hiện tại: no-op, deliveries.email.status giữ nguyên "none".
module.exports.deliver = async function deliver(/* notif */) {};
