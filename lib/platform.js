// Nhận diện của NỀN TẢNG (không thuộc workspace nào): trang đăng nhập, tab
// trình duyệt, admin, và logo mặc định cho workspace chưa tự upload logo.
// Đổi tên bằng biến môi trường NEXT_PUBLIC_PLATFORM_NAME; đổi logo bằng cách
// thay public/logo.svg (và app/icon.svg cho favicon).
const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "BeMyFlo";
const PLATFORM_LOGO = "/logo.svg";

module.exports = { PLATFORM_NAME, PLATFORM_LOGO };
