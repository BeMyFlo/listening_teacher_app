"use client";

import { useEffect, useState } from "react";
import { currentRole } from "@/lib/client/session";
import { NAV } from "@/lib/nav";

// Nút đăng nhập ở thanh trên. Render phía server là "Đăng nhập"; sau khi trang tải, nếu trình duyệt
// đã có phiên thì đổi thành "Vào ứng dụng" (không ép chuyển hướng để Google/người mới vẫn đọc được trang).
export default function SessionCta({ className = "" }) {
  const [role, setRole] = useState(null);
  useEffect(() => {
    try {
      setRole(currentRole());
    } catch {
      setRole(null);
    }
  }, []);
  return role ? (
    <a className={className} href={NAV[role].home}>Vào ứng dụng</a>
  ) : (
    <a className={className} href="/login">Đăng nhập</a>
  );
}
