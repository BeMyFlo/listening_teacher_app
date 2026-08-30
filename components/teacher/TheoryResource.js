"use client";

// "Theory file" box — teacher pastes an external link (Google Docs, Drive,
// PDF, Notion...) to the theory material. Students get a button that opens it
// in a new tab. Shared across all 6 skills — stored on
// theory.resourceUrl / theory.resourceLabel.
export default function TheoryResource({ theory, onChange }) {
  const t = theory || {};
  const set = (k, v) => onChange({ ...t, [k]: v });

  return (
    <div className="theory-resource-box">
      <div className="theory-resource-head">
        <span className="theory-resource-icon">
          <svg className="icon"><use href="#icon-external" /></svg>
        </span>
        <div>
          <h4>Theory file</h4>
          <p>Paste a link to the lesson material (Google Docs, Drive, PDF…). Students see a button that opens it in a new tab.</p>
        </div>
      </div>

      <div className="theory-resource-field">
        <label>Link</label>
        <input
          type="url"
          placeholder="https://docs.google.com/..."
          value={t.resourceUrl || ""}
          onChange={(e) => set("resourceUrl", e.target.value)}
        />
      </div>

      <div className="theory-resource-field">
        <label>Display name <span className="opt">(optional)</span></label>
        <input
          type="text"
          placeholder="e.g. Unit 1 — Theory notes"
          value={t.resourceLabel || ""}
          onChange={(e) => set("resourceLabel", e.target.value)}
        />
      </div>
    </div>
  );
}
