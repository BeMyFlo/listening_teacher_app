"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function TeacherIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/teacher/overview"); }, [router]);
  return null;
}
