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

// Cloudinary has no dedicated "audio" resource type — mp3/wav uploads use
// resource_type: "video", which is what the docs recommend for audio files.
async function uploadAudioFile(filePath) {
  const c = getCloudinary();
  return c.uploader.upload(filePath, {
    resource_type: "video",
    folder: "ielts-listening"
  });
}

async function deleteAudioFile(publicId) {
  const c = getCloudinary();
  return c.uploader.destroy(publicId, { resource_type: "video" });
}

async function uploadImageFile(filePath) {
  const c = getCloudinary();
  return c.uploader.upload(filePath, {
    resource_type: "image",
    folder: "ielts-images"
  });
}

async function deleteImageFile(publicId) {
  const c = getCloudinary();
  return c.uploader.destroy(publicId, { resource_type: "image" });
}

module.exports = { uploadAudioFile, deleteAudioFile, uploadImageFile, deleteImageFile };
