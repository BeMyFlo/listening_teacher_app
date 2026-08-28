"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Shell from "./Shell";
import { DialogProvider } from "./ui/Dialog";
import { readSession } from "@/lib/client/session";

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
    }
  }, [role, router]);

  if (session === undefined || session === null) {
    return null;
  }

  const userSub = role === "student" ? "" : "Administrator";

  return (
    <DialogProvider>
      <Shell role={role} userName={session.name} userSub={userSub}>
        {children}
      </Shell>
    </DialogProvider>
  );
}
