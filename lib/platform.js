// Nhận diện của NỀN TẢNG (không thuộc workspace nào): trang đăng nhập, tab
// trình duyệt, admin, và logo mặc định cho workspace chưa tự upload logo.
// Đổi tên bằng biến môi trường NEXT_PUBLIC_PLATFORM_NAME; đổi logo bằng cách
// thay public/logo.png (và app/icon.png, app/apple-icon.png, app/favicon.ico cho favicon).
const PLATFORM_NAME = process.env.NEXT_PUBLIC_PLATFORM_NAME || "BeMyFlo";
const PLATFORM_LOGO = "/logo.png";

module.exports = { PLATFORM_NAME, PLATFORM_LOGO };
