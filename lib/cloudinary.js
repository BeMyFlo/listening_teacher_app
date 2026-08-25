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

module.exports = { deleteAudioFile, deleteImageFile };
