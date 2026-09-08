"use client";

import { useState } from "react";
import { useNotes } from "@/lib/client/useNotes";
import NotebookPanel from "./NotebookPanel";

// Nút nổi + panel trượt để ghi chú nhanh khi đang làm bài. `source` gắn ngữ
// cảnh hiện tại (unit/test) cho ghi chú mới; `filter` giới hạn danh sách hiển
// thị về đúng bài đang xem.
export default function NotebookFab({ source, filter }) {
  const [open, setOpen] = useState(false);
  const { notes, loading, create, update, remove } = useNotes(filter, open);

  return (
    <>
      <button
        type="button"
        className="note-fab"
        title="Notebook"
        onClick={() => setOpen(true)}
      >
        <svg className="icon"><use href="#icon-notebook" /></svg>
      </button>

      {open && (
        <div className="note-drawer-backdrop" onClick={() => setOpen(false)}>
          <div className="note-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="note-drawer-head">
              <strong>Notes for this {source && source.kind === "test" ? "test" : "lesson"}</strong>
              <a href="/student/notebook" className="note-drawer-link">Open full notebook</a>
              <button type="button" className="note-card-btn" onClick={() => setOpen(false)}>
                <svg className="icon"><use href="#icon-cross" /></svg>
              </button>
            </div>
            <NotebookPanel
              notes={notes}
              loading={loading}
              onCreate={create}
              onUpdate={update}
              onDelete={remove}
              defaultSource={source}
              showSearch={false}
            />
          </div>
        </div>
      )}
    </>
  );
}
