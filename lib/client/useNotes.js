"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client/api";

// Cuốn sổ tay học sinh. `filter` (optional): { unitId } | { testId } cho panel
// ghi chú nhanh; bỏ trống = toàn bộ (trang Notebook).
export function useNotes(filter, enabled = true) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState("");

  const key = filter ? JSON.stringify(filter) : "";

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = filter ? await api.student.notes.listFor(filter) : await api.student.notes.list();
      setNotes(res.notes || []);
      setError("");
    } catch (e) {
      setError(e.message || "Failed to load notes");
    } finally {
      setLoading(false);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (enabled) reload();
  }, [reload, enabled]);

  const create = useCallback(async ({ body, quote, color, source }) => {
    const res = await api.student.notes.create({ body, quote, color, source });
    setNotes((prev) => [res.note, ...prev]);
    return res.note;
  }, []);

  const update = useCallback(async (id, patch) => {
    const res = await api.student.notes.update(id, patch);
    setNotes((prev) =>
      prev
        .map((n) => (n._id === id ? res.note : n))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(b.updatedAt) - new Date(a.updatedAt))
    );
    return res.note;
  }, []);

  const remove = useCallback(async (id) => {
    await api.student.notes.remove(id);
    setNotes((prev) => prev.filter((n) => n._id !== id));
  }, []);

  return { notes, loading, error, reload, create, update, remove };
}

// Dùng khi tạo ghi chú từ chỗ bôi đen (HighlightText) — không giữ list, chỉ POST.
export async function postNote({ body, quote, source, color }) {
  const res = await api.student.notes.create({ body, quote, source, color });
  return res.note;
}
