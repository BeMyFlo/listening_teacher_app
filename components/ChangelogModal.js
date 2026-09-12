"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";

// Popup "Có gì mới" — hiện 1 lần cho mỗi bản cập nhật (lib/changelog.js),
// dựa theo lastSeenChangelogVersion lưu ở Teacher/Student. Đóng lại là coi
// như đã xem, lần đăng nhập sau không hiện lại nữa (trừ khi có bản mới hơn).
export default function ChangelogModal({ role }) {
  const [entries, setEntries] = useState(null); // null = chưa biết / không có gì mới
  const isReporter = role === "teacher" || role === "student";

  useEffect(() => {
    if (!isReporter) return;
    api.changelog
      .check(role)
      .then((d) => {
        if (d.unseen && d.entries && d.entries.length) setEntries(d.entries);
      })
      .catch(() => {});
  }, [role, isReporter]);

  if (!entries) return null;

  function dismiss() {
    setEntries(null);
    api.changelog.markSeen(role).catch(() => {});
  }

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && dismiss()}>
      <div className="modal-box changelog-modal">
        <div className="changelog-head">
          <svg className="icon"><use href="#icon-sparkles" /></svg>
          <h3>Có gì mới</h3>
        </div>
        <div className="changelog-body">
          {entries.map((e) => (
            <div key={e.version} className="changelog-entry">
              {entries.length > 1 && <div className="changelog-date">{e.date}</div>}
              <ul>
                {e.items.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="ui-dialog-actions">
          <button type="button" className="btn" onClick={dismiss}>Đã hiểu</button>
        </div>
      </div>
    </div>
  );
}
