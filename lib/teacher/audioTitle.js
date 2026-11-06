// Tên mặc định của file tải lên ngay trong builder: tên file, bỏ đuôi và dấu nối.
export function mediaTitleFromFile(name, fallback) {
  const base = String(name || "").replace(/\.[a-z0-9]{1,5}$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return base.slice(0, 120) || fallback;
}

export function audioTitleFromFile(name) {
  return mediaTitleFromFile(name, "Audio track");
}

// Ảnh dán từ clipboard luôn tên "image.png" — tên đó vô nghĩa trong Image Library,
// nên đặt "Pasted image <ngày giờ>" để còn phân biệt được.
export function imageTitleFromFile(name, now = new Date()) {
  const base = mediaTitleFromFile(name, "");
  if (base && !/^image$/i.test(base)) return base;
  const pad = (n) => String(n).padStart(2, "0");
  return `Pasted image ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
