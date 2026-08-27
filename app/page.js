"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { currentRole } from "@/lib/client/session";
import { NAV } from "@/lib/nav";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    const role = currentRole();
    router.replace(role ? NAV[role].home : "/login");
  }, [router]);
  return null;
}
