"use client";

import { useState } from "react";
import { api } from "@/lib/client/api";

// "Print / export" cho 1 đề đã lưu (G4 bước 4): chọn số mã đề 1–4, tải Word từng mã, đáp án, mở trang in.
// Dùng ở builder và danh sách đề. Chỉ hiện với chương trình có `questionBank` (nơi gọi quyết định).
export default function ExamExportPanel({ testId }) {
  const [codes, setCodes] = useState(2);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState({ tone: "", text: "" });

  async function download(code, kind) {
    const key = kind + code;
    setBusy(key);
    setMsg({ tone: "", text: "" });
    try {
      const { blob, filename, warnings } = await api.teacher.downloadTestExport(testId, code, kind);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (warnings) setMsg({ tone: "warn", text: "Downloaded, but: " + warnings });
    } catch (e) {
      setMsg({ tone: "error", text: e.message });
    } finally {
      setBusy("");
    }
  }

  const list = [];
  for (let c = 1; c <= codes; c++) list.push(c);
  const btn = { padding: "6px 12px", fontSize: ".8rem" };

  return (
    <div className="exam-export-panel" style={{ marginTop: 10 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 }}>
        <label style={{ fontSize: ".85rem" }}>
          Number of exam codes{" "}
          <select className="select-inline" value={codes} onChange={(e) => setCodes(Number(e.target.value))}>
            {[1, 2, 3, 4].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </label>
        <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>
          Codes 101–{100 + codes} shuffle the questions and options the same way every time you export.
        </span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {list.map((c) => (
          <div key={c} style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <b style={{ minWidth: 70 }}>Code {100 + c}</b>
            <button type="button" className="btn secondary" style={btn} disabled={!!busy} onClick={() => download(c, "exam")}>
              {busy === "exam" + c ? "Preparing…" : "Word (.docx)"}
            </button>
            <button type="button" className="btn secondary" style={btn} disabled={!!busy} onClick={() => download(c, "key")}>
              {busy === "key" + c ? "Preparing…" : "Answer key (.docx)"}
            </button>
            <a className="btn secondary" style={btn} href={`/teacher/tests/${testId}/print?code=${c}`} target="_blank" rel="noreferrer">
              Print view
            </a>
          </div>
        ))}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <b style={{ minWidth: 70 }}>Original</b>
          <button type="button" className="btn secondary" style={btn} disabled={!!busy} onClick={() => download(0, "exam")}>
            {busy === "exam0" ? "Preparing…" : "Word (.docx)"}
          </button>
          <button type="button" className="btn secondary" style={btn} disabled={!!busy} onClick={() => download(0, "key")}>
            {busy === "key0" ? "Preparing…" : "Answer key (.docx)"}
          </button>
          <a className="btn secondary" style={btn} href={`/teacher/tests/${testId}/print?code=0`} target="_blank" rel="noreferrer">
            Print view
          </a>
        </div>
      </div>
      {msg.text && <div className={"notice " + (msg.tone === "error" ? "error" : "info")} style={{ marginTop: 8 }}>{msg.text}</div>}
    </div>
  );
}
