"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { setBadge } from "@/lib/client/shellBadges";
import TicketDialog from "./TicketDialog";

const POLL_MS = 60000;

// Nút nổi "Report a problem" (học sinh / giáo viên) + đồng bộ badge sidebar.
// Với admin: chỉ cập nhật badge số phiếu chưa xem, không có nút nổi.
export default function SupportWidget({ role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const isReporter = role === "teacher" || role === "student";

  const href = role === "admin" ? "/admin/tickets" : "/" + role + "/tickets";

  const sync = useCallback(() => {
    if (role === "admin") {
      api.admin
        .tickets({})
        .then((d) => setBadge("/admin/tickets", d.summary ? d.summary.adminUnread : 0, true))
        .catch(() => {});
      return;
    }
    if (!isReporter) return;
    api.tickets
      .mine(role)
      .then((d) => setBadge(href, d.unreadCount || 0, true))
      .catch(() => {});
  }, [role, isReporter, href]);

  useEffect(() => {
    sync();
    const id = setInterval(sync, POLL_MS);
    return () => clearInterval(id);
  }, [sync, pathname]);

  if (!isReporter) return null;

  const onTicketsPage = pathname === href;

  return (
    <>
      {!onTicketsPage && (
        <button
          type="button"
          className="support-fab"
          title="Report a problem or request a feature"
          onClick={() => setOpen(true)}
        >
          <svg className="icon"><use href="#icon-inbox" /></svg>
          <span>Help</span>
        </button>
      )}
      {open && (
        <TicketDialog
          role={role}
          pageUrl={pathname}
          onClose={() => setOpen(false)}
          onCreated={(t) => {
            setOpen(false);
            sync();
            router.push(href + "?id=" + t._id);
          }}
        />
      )}
    </>
  );
}
