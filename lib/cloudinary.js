const cloudinary = require("cloudinary").v2;

let configured = false;
function getCloudinary() {
  if (!configured) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET
    });
    configured = true;
  }
  return cloudinary;
}

// Uploading now happens client-side straight to Cloudinary (see
// assets/api.js Api.uploadToCloudinary) to stay under Vercel's ~4.5MB
// Serverless Function request body cap — these two just delete by
// public id, which has no such size concern.
async function deleteAudioFile(publicId) {
  const c = getCloudinary();
  return c.uploader.destroy(publicId, { resource_type: "video" });
}

async function deleteImageFile(publicId) {
  const c = getCloudinary();
  return c.uploader.destroy(publicId, { resource_type: "image" });
}

// Dung lượng / băng thông Cloudinary đang dùng (cho trang admin Storage).
// Trả null nếu chưa cấu hình API secret / gọi lỗi.
async function getUsage() {
  if (!process.env.CLOUDINARY_API_SECRET) return null;
  try {
    return await getCloudinary().api.usage();
  } catch (err) {
    return { error: String((err && err.message) || err) };
  }
}

// Audio Listening chỉ cần ~128 kbps. Giáo viên hay tải mp3 320 kbps hoặc wav (nặng gấp 2-10 lần),
// nên server tự nén lại thay vì bắt giáo viên tự xuất file:
// Cloudinary tạo bản mp3 128 kbps rồi GHI ĐÈ lên chính public_id vừa tải.
// Trả { cloudinaryUrl, cloudinaryPublicId, bytesBefore, bytesAfter } khi đã nén, null khi không cần
// (đã nhẹ, không đọc được độ dài). Lỗi thì ném ra để người gọi giữ file gốc.
const AUDIO_TARGET_KBPS = 128;
const AUDIO_SHRINK_ABOVE_KBPS = 160;

// uploadedWithinMs: chỉ nén file vừa mới tải (không để request cũ/giả ghi đè file đã có từ lâu).
async function shrinkAudioFile(publicId, { uploadedWithinMs } = {}) {
  const c = getCloudinary();
  // media_metadata: không có thì Cloudinary không trả `duration`.
  const info = await c.api.resource(publicId, { resource_type: "video", media_metadata: true });
  if (uploadedWithinMs && !(Date.now() - new Date(info.created_at).getTime() < uploadedWithinMs)) return null;
  const seconds = Number(info.duration) || 0;
  if (!seconds || !info.bytes) return null;
  const kbps = (info.bytes * 8) / 1000 / seconds;
  if (kbps <= AUDIO_SHRINK_ABOVE_KBPS) return null;

  // Bước 1: tạo bản nén bằng eager (đồng bộ). Không lấy thẳng URL biến đổi on-the-fly được:
  // gói Free trả HTTP 420 cho file audio vài MB trở lên.
  const tr = { audio_codec: "mp3", bit_rate: `${AUDIO_TARGET_KBPS}k`, format: "mp3" };
  const ex = await c.uploader.explicit(publicId, { type: "upload", resource_type: "video", eager: [tr] });
  const derived = ex.eager && ex.eager[0];
  if (!derived || !derived.secure_url) throw new Error("Cloudinary did not return the compressed audio");
  if (derived.bytes && derived.bytes >= info.bytes) return null;

  // Bước 2: ghi đè file gốc bằng bản nén (cùng public_id), rồi xoá bản nén trung gian
  // để không bị tính dung lượng 2 lần.
  const up = await c.uploader.upload(derived.secure_url, {
    resource_type: "video",
    public_id: publicId,
    overwrite: true,
    invalidate: true,
  });
  await c.api.delete_derived_by_transformation([publicId], [tr], { resource_type: "video" }).catch(() => {});
  return { cloudinaryUrl: up.secure_url, cloudinaryPublicId: up.public_id, bytesBefore: info.bytes, bytesAfter: up.bytes };
}

module.exports = { deleteAudioFile, deleteImageFile, getUsage, shrinkAudioFile };
