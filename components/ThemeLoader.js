"use client";

import { useEffect } from "react";
import { request } from "@/lib/client/api";
import { themeToCss } from "@/lib/theme";

const STYLE_ID = "ws-theme";
const cacheKey = (role) => "wsTheme:" + role;

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
export default function ThemeLoader({ role }) {
  useEffect(() => {
    if (role !== "teacher" && role !== "student") return undefined;
    let cancelled = false;
    try {
      const cached = localStorage.getItem(cacheKey(role));
      if (cached) applyTheme(JSON.parse(cached));
    } catch {
      /* cache hỏng -> bỏ qua */
    }
    request("/api/workspace/theme", { auth: role })
      .then((d) => {
        if (cancelled) return;
        applyTheme(d.theme);
        cacheTheme(role, d.theme);
      })
      .catch(() => {
        /* workspace bị khoá hoặc lỗi mạng: giữ nguyên bản đang hiển thị */
      });
    return () => {
      cancelled = true;
      applyTheme(null);
    };
  }, [role]);
  return null;
}
