"use client";

import { useMemo, useState } from "react";
import NoteCard from "./NoteCard";

// Danh sách + ô soạn ghi chú, dùng chung cho trang Notebook và panel nhanh.
export default function NotebookPanel({
  notes,
  loading,
  onCreate,
  onUpdate,
  onDelete,
  defaultSource,
  grouped = false,
  showSearch = true,
}) {
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await onCreate({ body, source: defaultSource || { kind: "free" } });
      setDraft("");
    } finally {
      setBusy(false);
    }
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return notes;
    return notes.filter(
      (n) =>
        (n.body || "").toLowerCase().includes(needle) ||
        (n.quote || "").toLowerCase().includes(needle) ||
        ((n.source && n.source.contextName) || "").toLowerCase().includes(needle)
    );
  }, [notes, q]);

  const groups = useMemo(() => {
    if (!grouped) return [{ title: null, items: filtered }];
    const map = new Map();
    for (const n of filtered) {
      const title = (n.source && n.source.contextName) || (n.source && n.source.kind === "free" ? "Quick notes" : "Other");
      if (!map.has(title)) map.set(title, []);
      map.get(title).push(n);
    }
    // pinned-containing groups first, then alphabetic; "Quick notes" last
    return [...map.entries()]
      .map(([title, items]) => ({ title, items }))
      .sort((a, b) => {
        if (a.title === "Quick notes") return 1;
        if (b.title === "Quick notes") return -1;
        return a.title.localeCompare(b.title);
      });
  }, [filtered, grouped]);

  return (
    <div className="notebook-panel">
      <div className="notebook-compose">
        <textarea
          rows={2}
          placeholder="New note…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") add();
          }}
        />
        <button type="button" className="btn" disabled={!draft.trim() || busy} onClick={add}>
          <svg className="icon"><use href="#icon-plus" /></svg> Add
        </button>
      </div>

      {showSearch && notes.length > 0 && (
        <div className="notebook-search">
          <svg className="icon"><use href="#icon-search" /></svg>
          <input placeholder="Search your notes…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      )}

      {loading ? (
        <div className="notice info">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          {notes.length === 0
            ? "No notes yet. Highlight any text in a lesson or test and choose “Highlight + note”, or add one above."
            : "No notes match your search."}
        </div>
      ) : (
        groups.map((g) => (
          <div key={g.title || "_"} className="notebook-group">
            {g.title && <h4 className="notebook-group-title">{g.title}</h4>}
            {g.items.map((n) => (
              <NoteCard
                key={n._id}
                note={n}
                onUpdate={onUpdate}
                onDelete={onDelete}
                showSource={!grouped}
              />
            ))}
          </div>
        ))
      )}
    </div>
  );
}
