// Tên mặc định của audio tải lên ngay trong builder: tên file, bỏ đuôi và dấu nối.
export function audioTitleFromFile(name) {
  const base = String(name || "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base.slice(0, 120) || "Audio track";
}
