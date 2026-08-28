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

// Xoá file chat (ảnh/video) quá `maxAgeDays` ngày. Tin nhắn đã tự hết hạn
// (Mongo TTL) nên không còn publicId để tra — quét thẳng theo folder "chat/".
async function cleanupChatMedia({ maxAgeDays = 30, prefix = "chat/" } = {}) {
  const c = getCloudinary();
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  let deleted = 0;

  for (const resourceType of ["image", "video"]) {
    let nextCursor;
    do {
      const page = await c.api.resources({
        type: "upload",
        resource_type: resourceType,
        prefix,
        max_results: 500,
        next_cursor: nextCursor,
      });
      const old = (page.resources || [])
        .filter((r) => new Date(r.created_at).getTime() < cutoff)
        .map((r) => r.public_id);
      for (let i = 0; i < old.length; i += 100) {
        const batch = old.slice(i, i + 100);
        await c.api.delete_resources(batch, { resource_type: resourceType });
        deleted += batch.length;
      }
      nextCursor = page.next_cursor;
    } while (nextCursor);
  }
  return { deleted };
}

// Xoá toàn bộ media của 1 lớp (khi xoá lớp).
async function deleteClassChatMedia(classId) {
  const c = getCloudinary();
  const prefix = `chat/${classId}`;
  const out = {};
  for (const resource_type of ["image", "video"]) {
    try {
      out[resource_type] = await c.api.delete_resources_by_prefix(prefix, { resource_type });
    } catch (e) {
      out[resource_type] = { error: e.message };
    }
  }
  return out;
}

module.exports = { deleteAudioFile, deleteImageFile, cleanupChatMedia, deleteClassChatMedia };
