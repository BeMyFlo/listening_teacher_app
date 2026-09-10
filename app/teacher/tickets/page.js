"use client";

import { Suspense } from "react";
import ReporterTickets from "@/components/tickets/ReporterTickets";

export default function TeacherTicketsPage() {
  return (
    <Suspense fallback={<div className="notice info">Loading…</div>}>
      <ReporterTickets role="teacher" />
    </Suspense>
  );
}
