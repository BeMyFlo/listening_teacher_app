// Kiểm tra dữ liệu do client gửi lên, dùng chung cho mọi API route.
//
// Hai thứ ở đây vì trước đó mỗi route tự làm một kiểu:
//   - asObjectId: id sai định dạng từng ném CastError -> 500 kèm stack, thay
//     vì 404 gọn gàng. Route nào cũng phải lọc trước khi đưa vào query.
//   - cloudinaryUrl: URL ảnh/audio do client gửi kèm khi tạo bài nộp / phiếu
//     hỗ trợ. Chỉ nhận đúng tài khoản Cloudinary của mình — URL ngoài sẽ khiến
//     trình duyệt người xem (thường là admin/giáo viên) tự gọi tới server lạ.

const mongoose = require("mongoose");

// "abc" -> null (không ném). ObjectId hợp lệ -> chính chuỗi đó.
// Dùng: `const id = asObjectId(req.query.id); if (!id) return 404;`
function asObjectId(value) {
  if (!value) return null;
  const s = String(value);
  return mongoose.Types.ObjectId.isValid(s) ? s : null;
}

// Cloud name lấy từ env; fallback là cloud name đang dùng trong
// lib/client/api.js để bản deploy chưa kịp set env vẫn chạy đúng.
const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "oqczcg2z";

// https://res.cloudinary.com/<cloud>/... — chỉ đúng host, đúng tài khoản.
const CLOUDINARY_URL_RE = new RegExp(
  "^https://res\\.cloudinary\\.com/" + CLOUD_NAME.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "/"
);

function isCloudinaryUrl(url) {
  return typeof url === "string" && CLOUDINARY_URL_RE.test(url);
}

// Rút publicId ra TỪ CHÍNH URL thay vì tin giá trị client gửi kèm — publicId
// là thứ dùng để xoá file trên Cloudinary, không được để client tự khai.
//   https://res.cloudinary.com/<cloud>/image/upload/v123/tickets/abc.png
//   -> "tickets/abc"
function publicIdFromUrl(url) {
  if (!isCloudinaryUrl(url)) return "";
  const m = String(url).match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return m ? m[1] : "";
}

module.exports = { asObjectId, isCloudinaryUrl, publicIdFromUrl };
