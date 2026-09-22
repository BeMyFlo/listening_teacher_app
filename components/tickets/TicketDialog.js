"use client";

import { useRef, useState } from "react";
import { api, uploadToCloudinary } from "@/lib/client/api";
import { KIND_LABEL } from "./ticketMeta";

const MAX_IMAGE_MB = 10;
const MAX_IMAGE_BYTES = MAX_IMAGE_MB * 1024 * 1024;

// Modal tạo phiếu hỗ trợ mới. role = "teacher" | "student".
export default function TicketDialog({ role, pageUrl, onClose, onCreated }) {
  const [kind, setKind] = useState("bug");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [images, setImages] = useState([]); // { url, publicId }
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef(null);

  async function addFiles(files) {
    setErr("");
    // Lọc file không phải ảnh / quá nặng TRƯỚC khi cắt theo số slot còn lại,
    // để file bị loại không chiếm mất chỗ của ảnh hợp lệ.
    const all = Array.from(files || []);
    const tooBig = all.filter((f) => f.size > MAX_IMAGE_BYTES);
    const list = all
      .filter((f) => f.type.startsWith("image/") && f.size <= MAX_IMAGE_BYTES)
      .slice(0, 6 - images.length);
    if (tooBig.length) {
      setErr(`Ảnh tối đa ${MAX_IMAGE_MB}MB — đã bỏ qua ${tooBig.length} ảnh quá nặng`);
    }
    if (!list.length) {
      if (fileRef.current) fileRef.current.value = "";
      return;
    }
    setUploading(true);
    try {
      // Các ảnh độc lập nhau -> upload song song thay vì chờ nối tiếp.
      const ups = await Promise.all(
        list.map((f) => uploadToCloudinary(f, { resourceType: "image", folder: "tickets" }))
      );
      setImages((prev) => [
        ...prev,
        ...ups.map((up) => ({ url: up.cloudinaryUrl, publicId: up.cloudinaryPublicId })),
      ]);
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function submit(e) {
    e.preventDefault();
    setErr("");
    setBusy(true);
    try {
      const { ticket } = await api.tickets.create(role, {
        kind,
        title: title.trim(),
        body: body.trim(),
        pageUrl: pageUrl || "",
        images,
      });
      onCreated && onCreated(ticket);
    } catch (e2) {
      setErr(e2.message || "Could not send");
    } finally {
      // Kể cả khi không có onCreated (dialog không tự đóng), nút Send phải
      // bật lại chứ không treo ở trạng thái "Sending…".
      setBusy(false);
    }
  }

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
    >
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div className="modal-head">
          <h3>Report a problem or request</h3>
          <button type="button" className="icon-btn" onClick={onClose} title="Close">
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div className="form-row">
            <label>Type</label>
            <div className="tkt-kind-seg">
              {["bug", "feature"].map((k) => (
                <button
                  type="button"
                  key={k}
                  className={"tkt-kind-btn" + (kind === k ? " active" : "")}
                  onClick={() => setKind(k)}
                >
                  {KIND_LABEL[k]}
                </button>
              ))}
            </div>
          </div>
          <div className="form-row">
            <label>Title</label>
            <input
              type="text"
              value={title}
              maxLength={140}
              placeholder={kind === "bug" ? "e.g. Mock test timer freezes on submit" : "e.g. Add dark mode"}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div className="form-row">
            <label>Details</label>
            <textarea
              rows={5}
              value={body}
              placeholder="What happened? What did you expect? Steps to reproduce if it's a bug."
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="form-row">
            <label>Screenshots (optional)</label>
            <div className="tkt-shots">
              {images.map((im, i) => (
                // key theo publicId + vị trí: upload lại đúng cùng một ảnh vẫn
                // ra 2 key khác nhau.
                <div className="tkt-shot" key={(im.publicId || im.url) + ":" + i}>
                  <img src={im.url} alt="" />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((_, j) => j !== i))}
                    title="Remove"
                  >
                    <svg className="icon"><use href="#icon-cross" /></svg>
                  </button>
                </div>
              ))}
              {images.length < 6 && (
                <button
                  type="button"
                  className="tkt-shot-add"
                  onClick={() => fileRef.current && fileRef.current.click()}
                  disabled={uploading}
                >
                  <svg className="icon"><use href="#icon-image" /></svg>
                  {uploading ? "Uploading…" : "Add"}
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
          {pageUrl && <p className="field-hint">Sent from: {pageUrl}</p>}
          {err && <div className="notice error" style={{ marginTop: 8 }}>{err}</div>}
          <div className="ui-dialog-actions" style={{ marginTop: 14 }}>
            <button type="button" className="btn secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn" disabled={busy || uploading}>
              {busy ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
