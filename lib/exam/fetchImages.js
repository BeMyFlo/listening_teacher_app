// Tải byte ảnh cho file Word (Phase 12 G4 bước 4). CHỈ host Cloudinary, có hạn giờ + trần dung lượng.
// URL lấy từ Image doc của đúng workspace (route tra sẵn), không bao giờ từ client.
const HOST = "res.cloudinary.com";
const TIMEOUT_MS = 8000;
const MAX_EACH = 2 * 1024 * 1024;
const MAX_TOTAL = 8 * 1024 * 1024;

function allowedUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === HOST;
  } catch {
    return false;
  }
}

// Đọc thân phản hồi có trần; vượt trần -> ném.
async function readCapped(res, max) {
  const len = Number(res.headers && res.headers.get && res.headers.get("content-length"));
  if (len > max) throw new Error("too large");
  if (!res.body || !res.body.getReader) {
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > max) throw new Error("too large");
    return buf;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let n = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    n += value.length;
    if (n > max) {
      try {
        await reader.cancel();
      } catch {
        // bỏ qua
      }
      throw new Error("too large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

// urls: mảng URL. -> { images: { url: { buffer } }, warnings: ["..."] } (url lỗi không có trong images)
async function fetchImages(urls, { fetchImpl } = {}) {
  const f = fetchImpl || globalThis.fetch;
  const images = {};
  const warnings = [];
  let total = 0;
  for (const url of urls) {
    if (images[url]) continue;
    if (!allowedUrl(url)) {
      warnings.push("image missing (not a Cloudinary image)");
      continue;
    }
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
    try {
      const res = await f(url, { signal: ac.signal, redirect: "error" });
      if (!res.ok) throw new Error("http " + res.status);
      const buffer = await readCapped(res, Math.min(MAX_EACH, MAX_TOTAL - total));
      total += buffer.length;
      images[url] = { buffer };
    } catch (e) {
      warnings.push(e && e.message === "too large" ? "image missing (too large)" : "image missing (download failed)");
    } finally {
      clearTimeout(timer);
    }
  }
  return { images, warnings };
}

module.exports = { fetchImages, allowedUrl, HOST, MAX_EACH, MAX_TOTAL, TIMEOUT_MS };
