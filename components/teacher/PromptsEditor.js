"use client";

// Trình soạn "prompts" (Writing/Speaking) — markup khớp renderPromptsEditor.
export default function PromptsEditor({ prompts, media, onChange }) {
  function patch(mut) {
    const draft = structuredClone(prompts);
    mut(draft);
    onChange(draft);
  }

  return (
    <>
      {prompts.map((p, i) => (
        <div className="builder-section" key={i}>
          <div className="builder-section-head">
            <input
              type="text"
              className="p-title"
              placeholder="Prompt Title (e.g. Task 1)"
              style={{ flex: 1 }}
              value={p.title}
              onChange={(e) => patch((d) => (d[i].title = e.target.value))}
            />
            <button
              type="button"
              className="icon-btn danger"
              title="Delete prompt"
              onClick={() => {
                if (window.confirm("Delete this prompt?")) patch((d) => d.splice(i, 1));
              }}
            >
              <svg className="icon"><use href="#icon-trash" /></svg>
            </button>
          </div>
          <div className="form-row" style={{ marginBottom: 10 }}>
            <label>Instructions / Prompt details</label>
            <textarea
              className="p-instructions"
              rows={4}
              placeholder="Prompt details and instructions for students..."
              value={p.instructions}
              onChange={(e) => patch((d) => (d[i].instructions = e.target.value))}
            />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>Image Illustration (optional)</label>
            <select
              className="select-inline section-image-select"
              style={{ width: "100%" }}
              value={p.imageId || ""}
              onChange={(e) => patch((d) => (d[i].imageId = e.target.value))}
            >
              <option value="">— No diagram/map image —</option>
              {media.images.map((im) => (
                <option key={im._id} value={im._id}>
                  {(im.unit ? im.unit + " · " : "") + im.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="dashed-add-btn"
        style={{ marginTop: 10 }}
        onClick={() => onChange([...prompts, { title: "", instructions: "", imageId: "" }])}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Add Prompt
      </button>
    </>
  );
}
