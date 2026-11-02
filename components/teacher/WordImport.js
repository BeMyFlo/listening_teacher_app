"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/client/api";
import { uploadImportImages } from "@/lib/client/wordImportImages";
import { usePrograms } from "@/lib/client/program";
import { PROGRAMS } from "@/lib/curriculum";
import BankLabelFields from "./BankLabelFields";
import { importedSectionsToBankItems, chunkItems, offsetItemError } from "@/lib/teacher/sectionToBankItems";
import { useDialog } from "@/components/ui/Dialog";
import { useBranding } from "@/lib/client/branding";
import { appendImportedSections } from "@/lib/teacher/sectionTransforms";
import AiQuestionPreview from "./AiQuestionPreview";

export default function WordImport({
  existingSections = [],
  onImport,
  onClose,
  subject = "grammar",
  program = "general",
  aiContext = {},
  firstId = 1,
  onMediaChanged,
  target = "builder", // "builder" = đổ vào builder; "bank" = lưu vào ngân hàng câu hỏi
  initialLevel = "", // bank: khối gợi ý ban đầu
  onSaved, // bank: gọi sau khi lưu xong để trang tải lại danh sách
}) {
  const isBank = target === "bank";
  const { levelLabel } = usePrograms();
  const dialog = useDialog();
  const brand = useBranding();
  const fileRef = useRef(null);

  const [busy, setBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const [err, setErr] = useState("");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(null); // { sections, flags, imageLinks, images, warnings, stats }
  // Chỉ dùng khi target="bank": bước nhãn + kết quả lưu.
  const [step, setStep] = useState("preview"); // preview | labels | done
  const [labels, setLabels] = useState({ level: initialLevel ? String(initialLevel) : "", textbook: "", unitLabel: "", difficulty: "" });
  const [result, setResult] = useState(null); // { saved, items, skipped, error }

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
      const unitName = aiContext?.unitName || "";
      const { uploadedMap, failedImageRefs } = await uploadImportImages(preview, {
        fileName,
        unitName,
        brandSlug: brand?.slug,
      });

      if (failedImageRefs.size > 0 && dialog?.toast) {
        dialog.toast(`Failed to upload ${failedImageRefs.size} image(s). Flagged in builder.`);
      }

      // Đánh số tiếp từ nextFieldId, gán imageId và cờ vàng qua appendImportedSections
      const nextSections = appendImportedSections(existingSections, preview.sections, {
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

  // 3b. Lưu vào ngân hàng: tải ảnh, đổi từng phần thành mục (nhóm / câu lẻ), gửi theo lượt ≤100 mục.
  async function handleSaveToBank() {
    const level = Number(labels.level);
    if (!level) {
      setErr("Choose a grade first.");
      return;
    }
    setImporting(true);
    setErr("");
    try {
      const { uploadedMap, failedImageRefs } = await uploadImportImages(preview, { fileName, brandSlug: brand?.slug });
      if (typeof onMediaChanged === "function") onMediaChanged();
      const editorSections = appendImportedSections([], preview.sections, {
        flags: preview.flags,
        imageLinks: preview.imageLinks,
        imageMap: uploadedMap,
        failedImageRefs,
        firstId: 1,
      });
      const conv = importedSectionsToBankItems(editorSections, {
        level,
        textbook: labels.textbook.trim(),
        unitLabel: labels.unitLabel.trim(),
        difficulty: labels.difficulty,
        sourceRef: ("Word: " + fileName).slice(0, 200),
      });
      let saved = 0;
      let error = "";
      for (const batch of chunkItems(conv.items)) {
        try {
          const r = await api.teacher.createQuestionItems(program, batch);
          saved += r.created || batch.length;
        } catch (e) {
          error = offsetItemError(e.message, saved);
          break;
        }
      }
      setResult({ saved, total: conv.items.length, questions: conv.questionCount, skipped: conv.skipped, names: conv.names, error });
      setStep("done");
      if (saved > 0 && typeof onSaved === "function") onSaved();
    } catch (e) {
      setErr(e.message || "Failed to save to the question bank");
    } finally {
      setImporting(false);
    }
  }

  // Xem trước số câu sẽ lưu / bị bỏ (chưa tính ảnh lỗi): dùng cho bước nhãn.
  const bankPreview = isBank && preview && step === "labels"
    ? importedSectionsToBankItems(
        appendImportedSections([], preview.sections, { flags: preview.flags, imageLinks: [], imageMap: {}, failedImageRefs: new Set(), firstId: 1 }),
        { level: Number(labels.level) || 0 }
      )
    : null;
  const bankLevels = (PROGRAMS[program] && PROGRAMS[program].fixedLevels) || [];

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
          <h3>{isBank ? "Import into question bank" : "Import from Word"}</h3>
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
          ) : isBank && step === "labels" ? (
            <>
              <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>
                Choose the labels for every question in this file. You can change them one by one later on the Question Bank page.
              </p>
              <BankLabelFields
                value={labels}
                onChange={setLabels}
                levels={bankLevels}
                levelText={(l) => levelLabel(program, l)}
                show={{ level: true, textbook: true, unitLabel: true, difficulty: true }}
                idPrefix="wi"
              />
              {bankPreview && (
                <div className={"notice " + (bankPreview.skipped.length ? "warn" : "info")} style={{ marginTop: 6 }}>
                  {bankPreview.questionCount} question{bankPreview.questionCount === 1 ? "" : "s"} will be saved in{" "}
                  {bankPreview.items.length} item{bankPreview.items.length === 1 ? "" : "s"} (a part with a passage becomes one group).
                  {bankPreview.skipped.length > 0 && (
                    <> {bankPreview.skipped.length} will be skipped because they need checking or have no answer.</>
                  )}
                </div>
              )}
              {err && <div className="notice error" style={{ marginTop: 12 }}>{err}</div>}
              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button type="button" className="btn secondary" disabled={importing}
                  onClick={() => { setStep("preview"); setErr(""); }}>
                  Back
                </button>
                <button type="button" className="btn" disabled={importing || !bankPreview || !bankPreview.items.length}
                  onClick={handleSaveToBank}>
                  {importing ? "Uploading images & saving…" : "Save to question bank"}
                </button>
              </div>
            </>
          ) : isBank && step === "done" && result ? (
            <>
              <div className={"notice " + (result.error ? "error" : "info")} style={{ marginTop: 0 }}>
                Saved {result.questions} question{result.questions === 1 ? "" : "s"} in {result.saved} item
                {result.saved === 1 ? "" : "s"}
                {result.error ? "" : "."}
                {result.error && <> before an error stopped the import: {result.error}</>}
              </div>
              {result.skipped.length > 0 && (
                <div className="notice warn" style={{ marginTop: 10 }}>
                  <b>{result.skipped.length} question{result.skipped.length === 1 ? " was" : "s were"} not saved.</b>{" "}
                  Fix them in the Word file (or add them from the builder) and import again:
                  <ul style={{ margin: "4px 0 0", paddingLeft: 18, maxHeight: 160, overflowY: "auto" }}>
                    {result.skipped.slice(0, 20).map((k, i) => (
                      <li key={i} style={{ fontSize: ".82rem" }}>Part {k.section + 1}, question {k.id}: {k.reason}</li>
                    ))}
                    {result.skipped.length > 20 && <li style={{ fontSize: ".82rem" }}>and {result.skipped.length - 20} more</li>}
                  </ul>
                </div>
              )}
              <div style={{ marginTop: 16, textAlign: "right" }}>
                <button type="button" className="btn" onClick={onClose}>Done</button>
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

              <div style={{ marginTop: 16, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn secondary"
                  disabled={importing}
                  onClick={() => {
                    setPreview(null);
                    setStep("preview");
                    setErr("");
                  }}
                >
                  Choose another file
                </button>
                {isBank ? (
                  <button
                    type="button"
                    className="btn"
                    disabled={!totalQuestions}
                    onClick={() => { setStep("labels"); setErr(""); }}
                  >
                    Next: labels
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn"
                    disabled={importing || !totalQuestions}
                    onClick={handleConfirmImport}
                  >
                    {importing ? "Uploading images & importing…" : "Import into builder"}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
