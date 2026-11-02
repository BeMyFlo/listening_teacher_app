"use client";

// Tải ảnh của file Word lên Cloudinary + thư viện ảnh — dùng chung cho "Import into builder" và "Import into bank".
import { api, uploadToCloudinary } from "./api";

// Chuyển base64 thành File để upload lên Cloudinary
function base64ToFile(base64, mimeType, filename) {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType || "image/png" });
  return new File([blob], filename || "image.png", { type: mimeType || "image/png" });
}

// preview: { images, imageLinks }. -> { uploadedMap: { ref: imageId }, failedImageRefs: Set }
export async function uploadImportImages(preview, { fileName, unitName = "", brandSlug }) {
  // Chỉ tải những ảnh được câu hỏi hoặc section tham chiếu
  const referencedRefs = new Set((preview.imageLinks || []).map((l) => l.ref));
  const imagesToUpload = (preview.images || []).filter((img) => referencedRefs.has(img.ref));
  const uploadedMap = {};
  const failedImageRefs = new Set();
  const folder = /^[a-z0-9-]+$/.test(brandSlug) ? `workspaces/${brandSlug}/images` : "ielts-images";

  for (const img of imagesToUpload) {
    try {
      const file = base64ToFile(img.base64, img.mimeType, img.name || `${img.ref}.png`);
      const up = await uploadToCloudinary(file, { resourceType: "image", folder });
      const res = await api.teacher.createImage({
        title: `${fileName} — ${img.ref}`,
        unit: unitName,
        ...up,
      });
      const imgId = res.image?._id || res.image?.id || res._id;
      if (imgId) uploadedMap[img.ref] = String(imgId);
    } catch {
      failedImageRefs.add(img.ref);
    }
  }
  return { uploadedMap, failedImageRefs };
}
