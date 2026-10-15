"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentRole } from "@/lib/client/session";
import { NAV } from "@/lib/nav";

// Hành vi cũ của "/": đã đăng nhập thì vào trang chính của vai trò, chưa thì sang /login.
// Hiện chỉ còn dùng trên subdomain của trung tâm (domain gốc hiện trang giới thiệu).
export default function SessionRedirect() {
  const router = useRouter();
  useEffect(() => {
    const role = currentRole();
    router.replace(role ? NAV[role].home : "/login");
  }, [router]);
  return null;
}
