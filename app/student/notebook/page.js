"use client";

import { useNotes } from "@/lib/client/useNotes";
import NotebookPanel from "@/components/student/NotebookPanel";

export default function NotebookPage() {
  const { notes, loading, error, create, update, remove } = useNotes();

  return (
    <section>
      <div className="card">
        <div className="page-head">
          <h2>
            <svg className="icon"><use href="#icon-notebook" /></svg> My Notebook
          </h2>
          <p className="page-sub">
            Everything you highlight and note across lessons and mock tests, in one place. Synced to your account.
          </p>
        </div>
        {error && <div className="notice error">{error}</div>}
        <NotebookPanel
          notes={notes}
          loading={loading}
          onCreate={create}
          onUpdate={update}
          onDelete={remove}
          grouped
        />
      </div>
    </section>
  );
}
