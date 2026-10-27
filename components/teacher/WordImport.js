"use client";

import { useRef, useState } from "react";
import { api, uploadToCloudinary } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { useBranding } from "@/lib/client/branding";
import { appendAiSections } from "@/lib/teacher/sectionTransforms";
import AiQuestionPreview from "./AiQuestionPreview";

// Helper chuyển base64 thành File để upload lên Cloudinary
function base64ToFile(base64, mimeType, filename) {
  const byteChars = atob(base64);
  const byteNumbers = new Uint8Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) {
    byteNumbers[i] = byteChars.charCodeAt(i);
  }
  const blob = new Blob([byteNumbers], { type: mimeType || "image/png" });
  return new File([blob], filename || "image.png", { type: mimeType || "image/png" });
}

export default function WordImport({
  existingSections = [],
  onImport,
  onClose,
  subject = "grammar",
  program = "general",
  aiContext = {},
  firstId = 1,
  onMediaChanged,
}) {
  const dialog = useDialog();
  const brand = useBranding();
  const fileRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // { sections, flags, imageLinks, images, warnings, stats }

  // 1. Đọc file qua API server (Word -> AI -> sections)
  async function handleReadFile() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setErr("Please select a .docx file first.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("subject", subject || "grammar");
      fd.append("program", program || "general");
      const data = await api.teacher.importWord(fd);
      setFileName(file.name || "test.docx");
      setPreview({
        sections: data.sections || [],
        flags: data.flags || [],
        imageLinks: data.imageLinks || [],
        images: data.images || [],
        warnings: data.warnings || [],
        stats: data.stats || {},
      });
    } catch (e) {
      setErr(e.message || "Failed to import Word file");
    } finally {
      setBusy(false);
    }
  }

  // 2. Import vào builder: tải ảnh lên Cloudinary & Image DB, gán imageId + aiFlag
  async function handleConfirmImport() {
    if (!preview || !preview.sections || !preview.sections.length) return;
    setImporting(true);
    setErr("");

    try {
      // Chỉ tải những ảnh được câu hỏi hoặc section tham chiếu
      const referencedRefs = new Set((preview.imageLinks || []).map((l) => l.ref));
      const imagesToUpload = (preview.images || []).filter((img) => referencedRefs.has(img.ref));
      const uploadedMap = {};
      const failedImageRefs = new Set();
      const folder = /^[a-z0-9-]+$/.test(brand?.slug) ? `workspaces/${brand.slug}/images` : "ielts-images";
      const unitName = aiContext?.unitName || "";

      for (const img of imagesToUpload) {
        try {
          const file = base64ToFile(img.base64, img.mimeType, img.name || `${img.ref}.png`);
          const up = await uploadToCloudinary(file, { resourceType: "image", folder });
          const res = await api.teacher.createImage({
            title: `${fileName} — ${img.ref}`,
            unit: unitName,
            ...up,
          });
          const imgId = res.image?._id || res.image?.id || res._id;
          if (imgId) uploadedMap[img.ref] = String(imgId);
        } catch {
          failedImageRefs.add(img.ref);
        }
      }

      if (failedImageRefs.size > 0 && dialog?.toast) {
        dialog.toast(`Failed to upload ${failedImageRefs.size} image(s). Flagged in builder.`);
      }

      // Đánh số tiếp từ nextFieldId, gán imageId và cờ vàng qua appendAiSections
      const nextSections = appendAiSections(existingSections, preview.sections, {
        flags: preview.flags,
        imageLinks: preview.imageLinks,
        imageMap: uploadedMap,
        failedImageRefs,
        firstId,
      });

      onImport(nextSections);
      if (typeof onMediaChanged === "function") {
        onMediaChanged();
      }
      onClose();
    } catch (e) {
      setErr(e.message || "Failed to import sections into builder");
    } finally {
      setImporting(false);
    }
  }

  const stats = preview?.stats || {};
  const totalQuestions = stats.questions != null ? stats.questions : 0;
  const flaggedCount = stats.flagged != null ? stats.flagged : (preview?.flags || []).length;
  const answerKeyStatus = stats.answerKeyFound ? "found ✓" : "not found ✗";

  return (
    <div
      className="modal-overlay"
      onClick={(e) => e.target.classList.contains("modal-overlay") && !importing && onClose()}
    >
      <div className="modal-box" style={{ maxWidth: 760, width: "100%", margin: "0 auto" }}>
        <div className="modal-head">
          <h3>Import from Word</h3>
          <button type="button" className="icon-btn" disabled={importing} onClick={onClose}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {!preview ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Upload a <b>.docx</b> test file (Word 2007+). The app extracts questions, choices, answers,
                and images into structured sections.
              </p>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>Word document (.docx)</label>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={() => setErr("")}
                />
              </div>

              {err && (
                <div className="notice error" style={{ marginTop: 14 }}>
                  {err}
                </div>
              )}

              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" disabled={busy} onClick={handleReadFile}>
                  {busy ? "Reading your file… this can take up to a minute" : "Read file"}
                </button>
              </div>
            </>
          ) : (
            <>
              {preview.warnings && preview.warnings.length > 0 && (
                <div
                  className="notice warn"
                  style={{ marginTop: 0, marginBottom: 12, maxHeight: 120, overflowY: "auto" }}
                >
                  <b>{preview.warnings.length} notice(s):</b>
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
                    {preview.warnings.map((w, idx) => (
                      <li key={idx} style={{ fontSize: ".82rem" }}>
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <p style={{ fontWeight: 700, color: "var(--ink)", margin: "0 0 10px" }}>
                {preview.sections.length} parts · {totalQuestions} questions · {flaggedCount} to check · answer key {answerKeyStatus}
              </p>

              <div
                style={{
                  maxHeight: 380,
                  overflowY: "auto",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "8px 14px",
                }}
              >
                {preview.sections.length === 0 ? (
                  <div className="empty-state">No questions found in this document.</div>
                ) : (
                  preview.sections.map((sec, si) => (
                    <div key={si} style={{ marginBottom: 16 }}>
                      <div className="preview-section-title" style={{ fontWeight: 600, color: "var(--navy)", marginBottom: 6 }}>
                        {sec.name || "(Untitled section)"}
                        {sec.passageText && (
                          <span className="pill pill-ok" style={{ marginLeft: 6, fontSize: ".72rem" }}>
                            Has passage
                          </span>
                        )}
                      </div>
                      <ol style={{ paddingLeft: 20, margin: 0 }}>
                        {(sec.fields || []).map((f, fi) => {
                          const flagObj = (preview.flags || []).find(
                            (fl) => (fl.si == null || fl.si === si) && fl.fi === fi
                          );
                          const flag = flagObj?.reason;

                          const link = (preview.imageLinks || []).find(
                            (l) => l.si === si && l.fi === fi
                          );
                          const img = link
                            ? (preview.images || []).find((im) => im.ref === link.ref)
                            : null;
                          const imageSrc = img?.base64
                            ? `data:${img.mimeType || "image/png"};base64,${img.base64}`
                            : null;

                          return (
                            <AiQuestionPreview
                              key={fi}
                              f={f}
                              flag={flag}
                              passage={fi === 0 ? sec.passageText : undefined}
                              imageSrc={imageSrc}
                            />
                          );
                        })}
                      </ol>
                    </div>
                  ))
                )}
              </div>

              {err && (
                <div className="notice error" style={{ marginTop: 12 }}>
                  {err}
                </div>
              )}

              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={importing}
                  onClick={() => {
                    setPreview(null);
                    setErr("");
                  }}
                >
                  Choose another file
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={importing || !totalQuestions}
                  onClick={handleConfirmImport}
                >
                  {importing ? "Uploading images & importing…" : "Import into builder"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
