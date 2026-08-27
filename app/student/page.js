"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export default function StudentIndex() {
  const router = useRouter();
  useEffect(() => { router.replace("/student/lessons"); }, [router]);
  return null;
}
