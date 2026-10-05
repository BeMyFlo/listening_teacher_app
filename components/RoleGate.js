"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import ThemeLoader from "./ThemeLoader";
import AddressBanner from "./AddressBanner";
import { DialogProvider } from "./ui/Dialog";
import { readSession } from "@/lib/client/session";
import { api } from "@/lib/client/api";
import { parseHost } from "@/lib/host";
import { shouldAttemptHandoff } from "@/lib/client/handoffGuard";

// Bảo vệ toàn bộ khu vực /teacher hoặc /student: chưa đăng nhập đúng vai
// trò -> đá về /login. Đăng nhập rồi -> bọc nội dung trong Shell.
export default function RoleGate({ role, children }) {
  const router = useRouter();
  const [session, setSession] = useState(undefined); // undefined = đang kiểm tra

  useEffect(() => {
    const s = readSession(role);
    if (!s) {
      router.replace("/login?next=" + role);
      setSession(null);
    } else {
      setSession(s);
      // Đã đăng nhập ở domain gốc mà trung tâm có địa chỉ riêng -> chuyển sang đó (Phase 10B).
      // Không áp cho admin, phiên "đăng nhập hộ", hay khi đã ở subdomain.
      if (
        (role === "teacher" || role === "student") &&
        parseHost(window.location.host).kind === "root" &&
        !localStorage.getItem("impersonating") &&
        shouldAttemptHandoff()
      ) {
        api
          .handoffTarget(role)
          .then((t) => {
            if (t && t.origin) window.location.replace(`${t.origin}/handoff`);
          })
          .catch(() => {});
      }
    }
  }, [role, router]);

  if (session === undefined || session === null) {
    return null;
  }

  const userSub = role === "student" ? "" : role === "admin" ? "System Admin" : "Administrator";

  return (
    <DialogProvider>
      <ThemeLoader role={role} />
      <Shell role={role} userName={session.name} userSub={userSub}>
        {role !== "admin" && <AddressBanner />}
        {children}
      </Shell>
    </DialogProvider>
  );
}
