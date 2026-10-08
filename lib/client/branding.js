// Tên + logo đang hiển thị ở thanh bên. Mặc định là nền tảng; khi giáo viên/học
// sinh đăng nhập, ThemeLoader nạp thương hiệu của workspace vào đây. Là store
// nhỏ dùng chung để Shell (xa ThemeLoader trong cây) đọc được mà không phải
// truyền props.
import { useSyncExternalStore } from "react";
import { PLATFORM_NAME, PLATFORM_LOGO } from "@/lib/platform";

const DEFAULT = { name: PLATFORM_NAME, logoUrl: PLATFORM_LOGO, slug: "", isWorkspace: false };
let current = DEFAULT;
const listeners = new Set();

// Chỉ nhận đường dẫn cùng site ("/x.svg") hoặc https — dữ liệu lạ (kể cả từ
// cache localStorage bị sửa) thì quay về logo nền tảng.
function safeLogo(url) {
  if (typeof url !== "string") return PLATFORM_LOGO;
  if (/^\/(?!\/)[^\s"'<>]*$/.test(url) || /^https:\/\/[^\s"'<>]+$/.test(url)) return url;
  return PLATFORM_LOGO;
}

export function setBranding(b) {
  const next = b && typeof b.name === "string" && b.name
    ? { name: b.name, logoUrl: b.logoUrl ? safeLogo(b.logoUrl) : PLATFORM_LOGO, slug: String(b.slug || ""), isWorkspace: true }
    : DEFAULT;
  if (next.name === current.name && next.logoUrl === current.logoUrl && next.slug === current.slug) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(l) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useBranding() {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT);
}

// Logo đang áp (đã qua safeLogo) — để nạp trước khi hiện trang.
export function currentLogoUrl() {
  return current.logoUrl;
}
