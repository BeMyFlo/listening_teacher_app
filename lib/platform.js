// Nhận diện của NỀN TẢNG (không thuộc workspace nào): trang đăng nhập, tab
// trình duyệt, admin, và chỗ dự phòng khi workspace chưa đặt tên/logo riêng.
// Đổi tên bằng biến môi trường NEXT_PUBLIC_PLATFORM_NAME; đổi logo bằng cách
// thay public/platform-logo.svg (và app/icon.svg cho favicon).
const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "IELTS LMS";
const PLATFORM_LOGO = "/platform-logo.svg";

module.exports = { PLATFORM_NAME, PLATFORM_LOGO };
