"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { toEditorSections } from "@/lib/teacher/importConvert";

// mode: "grammar" | "vocab"
// onImport(items): items = editor-shape topics/groups (extId, name, lesson|words, exercises:[{title,_sections}])
export default function LessonImport({ mode, existing, onImport, onClose }) {
  const isGrammar = mode === "grammar";
  const exRef = useRef(null);
  const lessonRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null); // { topics|groups, warnings }

  async function upload() {
    const exFile = exRef.current?.files?.[0];
    if (!exFile) {
      setErr("Choose the exercise file first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("mode", mode);
      fd.append("file", exFile);
      const lf = lessonRef.current?.files?.[0];
      if (lf) fd.append("lessonFile", lf);
      const data = await api.teacher.importQuestions(fd);
      setPreview(data);
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    const raw = isGrammar ? preview.topics : preview.groups;
    const items = (raw || []).map((it) => {
      const secs = toEditorSections(it.importSections || [], existing);
      const out = {
        extId: it.extId,
        name: it.name,
        exercises: secs.length ? [{ title: it.name || "Exercise", _sections: secs }] : [],
      };
      if (isGrammar) out.lesson = it.lesson || {};
      else out.words = it.words || [];
      return out;
    });
    onImport(items);
    onClose();
  }

  const list = preview ? (isGrammar ? preview.topics : preview.groups) || [] : [];

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>Import {isGrammar ? "Grammar" : "Vocabulary"} from file</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {!preview ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Choose an <b>exercise file</b> (required) and a <b>lesson file</b> (optional). The two are matched by{" "}
                {isGrammar ? "Grammar_ID" : "Unit_ID"}.
              </p>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Exercise file ({isGrammar ? "IELTS_Grammar_BaiTap.xlsx" : "IELTS_Vocab_BaiTap.xlsx"})</label>
                <input ref={exRef} type="file" accept=".xlsx" />
              </div>
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>
                  Lesson file ({isGrammar ? "IELTS_Grammar_BaiHoc.xlsx" : "IELTS_Vocab_BaiHoc.xlsx"}) — optional
                </label>
                <input ref={lessonRef} type="file" accept=".xlsx" />
              </div>
              {err && (
                <div className="notice error" style={{ marginTop: 14 }}>
                  {err}
                </div>
              )}
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" disabled={busy} onClick={upload}>
                  {busy ? "Reading..." : "Upload & Preview"}
                </button>
              </div>
            </>
          ) : (
            <>
              {(preview.warnings || []).length > 0 && (
                <div className="notice error" style={{ marginTop: 0 }}>
                  <b>{preview.warnings.length} warning(s):</b>
                  <br />
                  {preview.warnings.map((w, i) => (
                    <span key={i}>
                      {w}
                      <br />
                    </span>
                  ))}
                </div>
              )}
              <p style={{ fontWeight: 700, color: "var(--ink)" }}>
                {list.length} {isGrammar ? "topics" : "word groups"} — ready to import.
              </p>
              <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "0 14px" }}>
                {list.length === 0 ? (
                  <div className="empty-state">Nothing to import.</div>
                ) : (
                  list.map((it, i) => {
                    const qs = (it.importSections || []).reduce((n, s) => n + (s.fields || []).length, 0);
                    return (
                      <div key={i}>
                        <div className="preview-section-title">
                          {it.name || it.extId}{" "}
                          {isGrammar ? (
                            it.lesson && it.lesson.formula ? (
                              <span className="pill pill-ok">Has theory</span>
                            ) : (
                              <span className="pill pill-warn">No theory</span>
                            )
                          ) : (
                            <span className="pill pill-info">{(it.words || []).length} words</span>
                          )}
                          {qs > 0 && <span className="pill pill-info">{qs} questions</span>}
                        </div>
                        {isGrammar && it.lesson && it.lesson.formula && (
                          <div className="preview-q">
                            <div className="pq-meta" style={{ whiteSpace: "pre-line", color: "var(--ink)" }}>
                              {it.lesson.formula}
                            </div>
                          </div>
                        )}
                        {!isGrammar &&
                          (it.words || []).slice(0, 5).map((w, wi) => (
                            <div className="preview-q" key={wi}>
                              <div className="pq-label">
                                {w.word} <span style={{ color: "var(--muted)" }}>{w.ipa}</span> — {w.meaning}
                              </div>
                            </div>
                          ))}
                      </div>
                    );
                  })
                )}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn secondary" onClick={() => setPreview(null)}>
                  Choose another file
                </button>
                <button type="button" className="btn" disabled={!list.length} onClick={confirm}>
                  Import into unit
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
