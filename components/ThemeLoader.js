"use client";

import { useEffect } from "react";
import { request } from "@/lib/client/api";
import { themeToCss } from "@/lib/theme";
import { setBranding, currentLogoUrl } from "@/lib/client/branding";

// Tải trước logo để lúc trang hiện ra logo đã sẵn sàng. Lỗi/chậm quá thì bỏ qua
// (tối đa timeoutMs) — không bao giờ giữ người dùng ở màn chờ vì một ảnh.
function preloadLogo(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const url = currentLogoUrl();
    if (!url || typeof Image === "undefined") return resolve();
    const img = new Image();
    const done = () => resolve();
    img.onload = done;
    img.onerror = done;
    setTimeout(done, timeoutMs);
    img.src = url;
  });
}

const STYLE_ID = "ws-theme";
const cacheKey = (role) => "wsTheme:" + role;
const brandKey = (role) => "wsBranding:" + role;

// Áp (hoặc gỡ, khi theme rỗng) CSS ghi đè màu của workspace. themeToCss tự
// kiểm tra lại từng giá trị nên dữ liệu lạ (kể cả từ localStorage) không lọt vào CSS.
export function applyTheme(theme) {
  if (typeof document === "undefined") return;
  const css = themeToCss(theme || {});
  let el = document.getElementById(STYLE_ID);
  if (!css) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement("style");
    el.id = STYLE_ID;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

export function cacheBranding(role, branding) {
  try {
    if (branding && branding.name) localStorage.setItem(brandKey(role), JSON.stringify(branding));
    else localStorage.removeItem(brandKey(role));
  } catch {
    /* localStorage có thể bị chặn */
  }
}

export function cacheTheme(role, theme) {
  try {
    if (theme && Object.keys(theme).length) localStorage.setItem(cacheKey(role), JSON.stringify(theme));
    else localStorage.removeItem(cacheKey(role));
  } catch {
    /* localStorage có thể bị chặn — chỉ mất bản cache */
  }
}

// Đặt trong khu vực đã đăng nhập (giáo viên / học sinh). Áp bản cache ngay để
// không nháy màu mặc định, rồi lấy bản mới từ server. Rời khỏi khu vực (đăng
// xuất) thì gỡ theme để trang đăng nhập luôn dùng màu mặc định.
export default function ThemeLoader({ role, onReady }) {
  useEffect(() => {
    if (role !== "teacher" && role !== "student") {
      if (onReady) onReady();
      return undefined;
    }
    let cancelled = false;
    let hadCache = false;
    try {
      const cached = localStorage.getItem(cacheKey(role));
      if (cached) {
        applyTheme(JSON.parse(cached));
        hadCache = true;
      }
      const cachedBrand = localStorage.getItem(brandKey(role));
      if (cachedBrand) {
        setBranding(JSON.parse(cachedBrand));
        hadCache = true; // workspace không đổi màu vẫn có cache thương hiệu -> không phải chờ
      }
    } catch {
      /* cache hỏng -> bỏ qua */
    }
    // Có bản cache -> hiện trang ngay với màu đó. Chưa có (đăng nhập lần đầu trên
    // máy này) -> RoleGate giữ trang trắng tới khi theme về, để không nháy màu mặc định.
    if (hadCache && onReady) {
      preloadLogo().then(() => {
        if (!cancelled) onReady();
      });
    }
    request("/api/workspace/theme", { auth: role })
      .then((d) => {
        if (cancelled) return;
        applyTheme(d.theme);
        cacheTheme(role, d.theme);
        setBranding(d.branding);
        cacheBranding(role, d.branding);
      })
      .catch(() => {
        /* workspace bị khoá hoặc lỗi mạng: giữ nguyên bản đang hiển thị */
      })
      .then(() => preloadLogo())
      .finally(() => {
        if (!cancelled && onReady) onReady();
      });
    return () => {
      cancelled = true;
      applyTheme(null);
      setBranding(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);
  return null;
}
