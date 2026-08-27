"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { toEditorSections } from "@/lib/teacher/importConvert";

const KIND_BADGE = {
  fill: "Fill",
  mcq: "MCQ",
  tfng: "TFNG",
  ynng: "YNNG",
  matching: "Matching",
  labelling: "Labelling",
};

export default function SpreadsheetImport({ existingSections, onImport, onClose }) {
  const fileRef = useRef(null);
  const contentRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [preview, setPreview] = useState(null); // { sections, warnings }
  const [isCsv, setIsCsv] = useState(false);

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Chọn file .xlsx hoặc .csv trước.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const cf = contentRef.current?.files?.[0];
      if (cf) fd.append("contentFile", cf);
      const data = await api.teacher.importQuestions(fd);
      setPreview({ sections: data.sections || [], warnings: data.warnings || [] });
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  }

  function confirm() {
    const editorSections = toEditorSections(preview.sections, existingSections);
    onImport(editorSections);
    onClose();
  }

  const totalQ = preview ? preview.sections.reduce((n, s) => n + (s.fields || []).length, 0) : 0;

  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && onClose()}>
      <div className="modal-box">
        <div className="modal-head">
          <h3>Import from spreadsheet</h3>
          <button type="button" className="icon-btn" onClick={onClose}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {!preview ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Tải lên file <b>.xlsx</b> mẫu (tab <i>Cau hoi</i> + <i>Doan van</i>) — hệ thống tự đọc cả 2 tab. Hoặc file{" "}
                <b>.csv</b> đã xuất riêng.
              </p>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>File câu hỏi (.xlsx hoặc .csv)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.csv,text/csv"
                  onChange={(e) =>
                    setIsCsv(String(e.target.files?.[0]?.name || "").toLowerCase().endsWith(".csv"))
                  }
                />
              </div>
              {isCsv && (
                <div className="form-row" style={{ marginBottom: 0 }}>
                  <label>File nội dung / đoạn văn (.csv — tuỳ chọn, chỉ khi dùng CSV)</label>
                  <input ref={contentRef} type="file" accept=".csv,text/csv" />
                </div>
              )}
              {err && (
                <div className="notice error" style={{ marginTop: 14 }}>
                  {err}
                </div>
              )}
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" disabled={busy} onClick={upload}>
                  {busy ? "Đang đọc..." : "Upload & Preview"}
                </button>
              </div>
            </>
          ) : (
            <>
              {preview.warnings.length > 0 && (
                <div className="notice error" style={{ marginTop: 0 }}>
                  <b>{preview.warnings.length} cảnh báo:</b>
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
                {preview.sections.length} section · {totalQ} câu hỏi — sẵn sàng import.
              </p>
              <div style={{ maxHeight: 340, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "0 14px" }}>
                {preview.sections.length === 0 ? (
                  <div className="empty-state">Không có gì để import.</div>
                ) : (
                  preview.sections.map((s, si) => (
                    <div key={si}>
                      <div className="preview-section-title">
                        {s.name || "(chưa đặt tên)"}{" "}
                        {s.passageText ? (
                          <span className="pill pill-ok">Đã có đoạn văn</span>
                        ) : (
                          <span className="pill pill-warn">Chưa có đoạn văn</span>
                        )}
                      </div>
                      {(s.fields || []).map((f, fi) => (
                        <div className="preview-q" key={fi}>
                          <div className="pq-label">{f.label}</div>
                          <div className="pq-meta">
                            <span className="pill pill-info">{KIND_BADGE[f.kind] || f.kind}</span>
                            <span>Score: {f.score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ))
                )}
              </div>
              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button type="button" className="btn secondary" onClick={() => setPreview(null)}>
                  Chọn file khác
                </button>
                <button type="button" className="btn" disabled={!totalQ} onClick={confirm}>
                  Import into builder
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
