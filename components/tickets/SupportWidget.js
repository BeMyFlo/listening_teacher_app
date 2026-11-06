"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { setBadge } from "@/lib/client/shellBadges";
import TicketDialog from "./TicketDialog";

const POLL_MS = 60000;

// Nút "?" nhỏ trên topbar để báo lỗi / góp ý (học sinh / giáo viên) + đồng bộ
// badge sidebar. Trước là nút nổi "Help" góc dưới phải — đã nhường chỗ đó cho
// trợ lý thông báo (components/assistant). Với admin: chỉ cập nhật badge, không có nút.
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

  // Đồng bộ lại mỗi lần đổi trang…
  useEffect(() => {
    sync();
  }, [sync, pathname]);

  // …nhưng interval thì giữ nguyên nhịp 60s, không bị huỷ/tạo lại theo route.
  // syncRef để interval luôn gọi bản sync mới nhất mà không cần dựng lại.
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  }, [sync]);
  useEffect(() => {
    const id = setInterval(() => syncRef.current(), POLL_MS);
    return () => clearInterval(id);
  }, []);

  if (!isReporter) return null;

  const onTicketsPage = pathname === href;

  return (
    <>
      {!onTicketsPage && (
        <button
          type="button"
          className="icon-btn topbar-help"
          title="Help — report a problem or request a feature"
          aria-label="Help"
          onClick={() => setOpen(true)}
        >
          <svg className="icon"><use href="#icon-help" /></svg>
        </button>
      )}
      {open && createPortal(
        <TicketDialog
          role={role}
          pageUrl={pathname}
          onClose={() => setOpen(false)}
          onCreated={(t) => {
            setOpen(false);
            sync();
            router.push(href + "?id=" + t._id);
          }}
        />,
        document.body
      )}
    </>
  );
}
