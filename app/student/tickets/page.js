"use client";

import { Suspense } from "react";
import ReporterTickets from "@/components/tickets/ReporterTickets";

export default function StudentTicketsPage() {
  return (
    <Suspense fallback={<div className="notice info">Loading…</div>}>
      <ReporterTickets role="student" />
    </Suspense>
  );
}
