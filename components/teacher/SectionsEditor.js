"use client";

import { useRef, useState } from "react";
import {
  QUESTION_KINDS,
  QUESTION_KIND_LABELS,
  emptySection,
  emptyField,
  newOptionId,
  nextFieldId,
  tfngOptions,
  ynngOptions,
  isFixedChoiceShape,
} from "@/lib/teacher/sectionTransforms";
import SpreadsheetImport from "./SpreadsheetImport";

// Trình soạn "section + câu hỏi" dùng chung cho Exercise (Unit) và Mock
// Test. Controlled; markup khớp renderSectionsEditor của legacy.
export default function SectionsEditor({ sections, subject, media, onChange }) {
  const [importing, setImporting] = useState(false);

  function patch(mut) {
    const draft = structuredClone(sections);
    mut(draft);
    onChange(draft);
  }

  return (
    <>
      {sections.length === 0 && (
        <div className="empty-state">No sections added — click &quot;Add Section&quot; to start.</div>
      )}
      {sections.map((sec, si) => (
        <SectionCard
          key={si}
          sec={sec}
          si={si}
          subject={subject}
          media={media}
          allSections={sections}
          patch={patch}
        />
      ))}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
        <button
          type="button"
          className="dashed-add-btn"
          style={{ flex: 1 }}
          onClick={() => onChange([...sections, emptySection()])}
        >
          <svg className="icon"><use href="#icon-plus" /></svg> Add Section
        </button>
        <button
          type="button"
          className="btn secondary"
          style={{ padding: "8px 14px", fontSize: ".85rem" }}
          onClick={() => setImporting(true)}
        >
          <svg className="icon"><use href="#icon-upload" /></svg> Import from spreadsheet
        </button>
      </div>

      {importing && (
        <SpreadsheetImport
          existingSections={sections}
          onImport={(imported) => onChange([...sections, ...imported])}
          onClose={() => setImporting(false)}
        />
      )}
    </>
  );
}

function SectionCard({ sec, si, subject, media, allSections, patch }) {
  const set = (k, v) => patch((d) => (d[si][k] = v));

  return (
    <div className="builder-section">
      <div className="builder-section-head">
        <input
          type="text"
          className="sec-name"
          placeholder="Section title (e.g. Section 1 / Paragraphs 1-5)"
          style={{ flex: 1 }}
          value={sec.name}
          onChange={(e) => set("name", e.target.value)}
        />
        <button
          type="button"
          className="icon-btn danger"
          title="Delete section"
          onClick={() => patch((d) => d.splice(si, 1))}
        >
          <svg className="icon"><use href="#icon-trash" /></svg>
        </button>
      </div>

      {subject === "listening" && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Audio track for this section</label>
          <select
            className="select-inline section-audio-select"
            style={{ width: "100%" }}
            value={sec.audioId || ""}
            onChange={(e) => set("audioId", e.target.value)}
          >
            <option value="">— Select audio track —</option>
            {media.audio.map((a) => (
              <option key={a._id} value={a._id}>
                {(a.unit ? a.unit + " · " : "") + a.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {subject === "reading" && (
        <div className="form-row" style={{ marginBottom: 10 }}>
          <label>Passage text</label>
          <textarea
            className="sec-passage-text"
            rows={5}
            placeholder="Enter reading passage text here..."
            value={sec.passageText || ""}
            onChange={(e) => set("passageText", e.target.value)}
          />
        </div>
      )}

      <NoteCompletionEditor sec={sec} si={si} allSections={allSections} patch={patch} />

      <div className="builder-2col">
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Illustration (Diagram / Map — optional)</label>
          <select
            className="select-inline section-image-select"
            style={{ width: "100%" }}
            value={sec.imageId || ""}
            onChange={(e) => set("imageId", e.target.value)}
          >
            <option value="">— No diagram/map image —</option>
            {media.images.map((im) => (
              <option key={im._id} value={im._id}>
                {(im.unit ? im.unit + " · " : "") + im.title}
              </option>
            ))}
          </select>
        </div>
        <div className="form-row" style={{ marginBottom: 0 }}>
          <label>Shared answer bank (for Matching questions — optional)</label>
          <div className="match-bank-box">
            <MatchBank sec={sec} si={si} patch={patch} />
          </div>
        </div>
      </div>

      <div className="questions-card">
        <div className="questions-card-head">
          <div className="head-left">
            <span className="icon-chip"><svg className="icon"><use href="#icon-list" /></svg></span>
            <div>
              <h4>Questions</h4>
              <div className="head-sub">Add questions and correct answers</div>
            </div>
          </div>
        </div>
        <div className="questions-card-body">
          <div className="question-grid-cols question-grid-head">
            <span />
            <span />
            <span>Question / Prompt</span>
            <span>Type</span>
            <span>Score</span>
            <span>Order</span>
            <span />
          </div>
          <div className="fields-wrap">
            {sec.fields.map((f, fi) => (
              <FieldRow key={fi} f={f} fi={fi} si={si} sec={sec} media={media} patch={patch} />
            ))}
          </div>
          <button
            type="button"
            className="btn secondary btn-add-field"
            style={{ marginTop: 10, padding: "8px 14px", fontSize: ".85rem" }}
            onClick={() => patch((d) => d[si].fields.push(emptyField(nextFieldId(allSections))))}
          >
            <svg className="icon"><use href="#icon-plus" /></svg> Add Question
          </button>
        </div>
      </div>
    </div>
  );
}

function MatchBank({ sec, si, patch }) {
  return (
    <div className="match-bank-rows">
      {(sec.matchBank || []).length === 0 ? (
        <div className="match-bank-empty">
          No shared answers yet — add them here, then pick from the list on any &quot;Matching&quot; question below.
        </div>
      ) : (
        (sec.matchBank || []).map((b, bi) => (
          <div className="option-row" key={bi}>
            <input
              type="text"
              placeholder="Answer text (e.g. Heading I, Library Hall...)"
              value={b.text}
              onChange={(e) => patch((d) => (d[si].matchBank[bi].text = e.target.value))}
            />
            <button
              type="button"
              className="icon-btn danger option-remove"
              title="Remove"
              onClick={() => patch((d) => d[si].matchBank.splice(bi, 1))}
            >
              <svg className="icon"><use href="#icon-trash" /></svg>
            </button>
          </div>
        ))
      )}
      <button
        type="button"
        className="option-add-btn"
        onClick={() => patch((d) => d[si].matchBank.push({ id: newOptionId(), text: "" }))}
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Add answer
      </button>
    </div>
  );
}

// Soạn "Note/Summary Completion" — thay vì mỗi câu hỏi 1 hàng, giáo viên gõ
// nguyên đoạn ghi chú rồi bấm "Insert blank" để chèn chỗ trống đánh số vào
// đúng vị trí con trỏ. Mỗi lần chèn tự tạo thêm 1 câu hỏi trong danh sách
// Questions bên dưới để nhập đáp án đúng/gợi ý/điểm cho số đó.
function NoteCompletionEditor({ sec, si, allSections, patch }) {
  const taRef = useRef(null);

  function insertBlank() {
    const id = nextFieldId(allSections);
    const marker = `[[${id}]]`;
    const el = taRef.current;
    // Chèn qua setRangeText của chính textarea (native) thay vì tính lại vị
    // trí rồi setSelectionRange trong requestAnimationFrame — cách cũ có độ
    // trễ 1 khung hình nên gõ tiếp ngay sau khi bấm nút có thể lọt vào sai
    // vị trí con trỏ. setRangeText cập nhật value + con trỏ đồng bộ ngay lập
    // tức, không phụ thuộc thời điểm React render lại.
    let newValue;
    if (el) {
      el.focus();
      el.setRangeText(marker, el.selectionStart, el.selectionEnd, "end");
      newValue = el.value;
    } else {
      newValue = (sec.noteText || "") + marker;
    }
    patch((d) => {
      d[si].noteText = newValue;
      d[si].fields.push(emptyField(id));
    });
  }

  return (
    <div className="form-row note-completion-editor">
      <label className="note-mode-toggle">
        <input
          type="checkbox"
          checked={!!sec.noteMode}
          onChange={(e) => {
            const on = e.target.checked;
            patch((d) => {
              d[si].noteMode = on;
              if (!on) d[si].noteText = "";
            });
          }}
        />
        Note / Summary completion layout (chỗ trống nằm trong đoạn ghi chú, giống bài thi IELTS thật)
      </label>
      {sec.noteMode && (
        <>
          <div className="note-toolbar">
            <button type="button" className="btn secondary" style={{ padding: "6px 12px", fontSize: ".82rem" }} onClick={insertBlank}>
              <svg className="icon"><use href="#icon-plus" /></svg> Insert blank
            </button>
            <span className="note-toolbar-hint">
              Dòng bắt đầu <code># </code> = tiêu đề in đậm căn giữa, <code>## </code> = tiêu đề phụ, <code>- </code> = gạch
              đầu dòng, dòng chỉ có <code>---</code> = ranh giới giữa phần hướng dẫn (nằm ngoài khung) và phần ghi chú
              (nằm trong khung). Bấm &quot;Insert blank&quot; để chèn chỗ trống tại vị trí con trỏ, rồi nhập đáp án đúng
              cho số đó trong danh sách Questions bên dưới.
            </span>
          </div>
          <textarea
            ref={taRef}
            className="note-text-editor"
            rows={10}
            placeholder={
              "Complete the notes below.\nChoose ONE WORD ONLY from the passage for each answer.\n---\n" +
              "# Gwendoline and Margaret Davies\n## Family and early life\n" +
              "- their grandfather's wealth came from [[1]] and transportation businesses"
            }
            value={sec.noteText || ""}
            onChange={(e) => patch((d) => (d[si].noteText = e.target.value))}
          />
        </>
      )}
    </div>
  );
}

function FieldRow({ f, fi, si, sec, media, patch }) {
  const setF = (k, v) => patch((d) => (d[si].fields[fi][k] = v));

  function changeKind(kind) {
    patch((d) => {
      const ff = d[si].fields[fi];
      const wasTfng = isFixedChoiceShape(ff.options, ["true", "false", "ng"]);
      const wasYnng = isFixedChoiceShape(ff.options, ["yes", "no", "ng"]);
      ff.kind = kind;
      if (kind === "tfng" && !wasTfng) {
        ff.options = tfngOptions();
        ff.correctOptionIds = [];
      }
      if (kind === "ynng" && !wasYnng) {
        ff.options = ynngOptions();
        ff.correctOptionIds = [];
      }
      if (kind === "mcq" && (!ff.options.length || wasTfng || wasYnng)) {
        ff.options = [];
        ff.correctOptionIds = [];
      }
    });
  }

  return (
    <div className="question-row">
      <div className="question-grid-cols">
        <span className="question-drag" title="Reorder by Order number">
          <svg className="icon"><use href="#icon-menu" /></svg>
        </span>
        <span className="question-num">{fi + 1}</span>
        <textarea
          className="f-label"
          rows={1}
          placeholder="Enter the question or prompt..."
          value={f.label}
          onChange={(e) => setF("label", e.target.value)}
        />
        <select className="f-kind" value={f.kind} onChange={(e) => changeKind(e.target.value)}>
          {QUESTION_KINDS.map((k) => (
            <option key={k} value={k}>
              {QUESTION_KIND_LABELS[k]}
            </option>
          ))}
        </select>
        <input
          type="number"
          className="f-score"
          min="1"
          title="Score (points)"
          value={f.score}
          onChange={(e) => setF("score", Number(e.target.value) || 1)}
        />
        <input
          type="text"
          className="f-id"
          title="Order / Question No."
          value={String(f.id)}
          onChange={(e) => setF("id", e.target.value)}
        />
        <button
          type="button"
          className="icon-btn danger f-remove"
          title="Delete question"
          onClick={() => patch((d) => d[si].fields.splice(fi, 1))}
        >
          <svg className="icon"><use href="#icon-trash" /></svg>
        </button>
      </div>
      <div className="question-hint-row">
        <input
          type="text"
          className="f-hint"
          placeholder="Hint / instruction (optional), e.g. NO MORE THAN TWO WORDS"
          value={f.hint || ""}
          onChange={(e) => setF("hint", e.target.value)}
        />
      </div>
      <div className="question-detail">
        <QuestionDetail f={f} fi={fi} si={si} sec={sec} media={media} patch={patch} />
      </div>
    </div>
  );
}

function QuestionDetail({ f, fi, si, sec, media, patch }) {
  const setF = (k, v) => patch((d) => (d[si].fields[fi][k] = v));

  if (f.kind === "fill") {
    return (
      <div className="question-row-extra">
        <div className="f-group">
          <label>Before blank</label>
          <input type="text" className="f-pre" style={{ width: 120 }} value={f.pre} onChange={(e) => setF("pre", e.target.value)} />
        </div>
        <div className="f-group">
          <label>After blank</label>
          <input type="text" className="f-post" style={{ width: 120 }} value={f.post} onChange={(e) => setF("post", e.target.value)} />
        </div>
        <div className="f-group" style={{ flex: 1, minWidth: 220 }}>
          <label>Correct answer(s) — one per line, add more if several wordings are OK</label>
          <textarea
            className="f-answers"
            rows={2}
            placeholder={"Paris\n9am"}
            value={f.answersText || ""}
            onChange={(e) => setF("answersText", e.target.value)}
          />
        </div>
      </div>
    );
  }

  if (f.kind === "tfng" || f.kind === "ynng") {
    const opts = f.kind === "tfng" ? tfngOptions() : ynngOptions();
    return (
      <>
        <div className="question-detail-inner">
          {opts.map((o) => (
            <div className="option-row" key={o.id}>
              <input
                type="radio"
                name={`fixedchoice-${si}-${fi}`}
                checked={f.correctOptionIds[0] === o.id}
                onChange={() => patch((d) => (d[si].fields[fi].correctOptionIds = [o.id]))}
              />
              <span className="tfng-label">{o.text}</span>
            </div>
          ))}
        </div>
        <div className={"kind-hint " + (f.correctOptionIds.length ? "ok" : "warn")}>
          {f.correctOptionIds.length ? "Correct answer selected." : "Pick the correct answer above."}
        </div>
      </>
    );
  }

  if (f.kind === "mcq") {
    return (
      <>
        <div className="question-detail-inner">
          {(f.options || []).map((o, oi) => (
            <div className="option-row" key={oi}>
              <input
                type="checkbox"
                title="Mark as correct answer"
                checked={f.correctOptionIds.includes(o.id)}
                onChange={(e) =>
                  patch((d) => {
                    const ff = d[si].fields[fi];
                    ff.correctOptionIds = e.target.checked
                      ? [...ff.correctOptionIds, o.id]
                      : ff.correctOptionIds.filter((x) => x !== o.id);
                  })
                }
              />
              <input
                type="text"
                placeholder={"Option " + (oi + 1) + " text"}
                value={o.text}
                onChange={(e) => patch((d) => (d[si].fields[fi].options[oi].text = e.target.value))}
              />
              <button
                type="button"
                className="icon-btn danger option-remove"
                title="Remove option"
                onClick={() =>
                  patch((d) => {
                    const ff = d[si].fields[fi];
                    const [rm] = ff.options.splice(oi, 1);
                    ff.correctOptionIds = ff.correctOptionIds.filter((x) => x !== rm.id);
                  })
                }
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="option-add-btn"
          onClick={() => patch((d) => d[si].fields[fi].options.push({ id: newOptionId(), text: "" }))}
        >
          <svg className="icon"><use href="#icon-plus" /></svg> Add option
        </button>
        <div className={"kind-hint " + (f.correctOptionIds.length ? "ok" : "warn")}>
          {f.correctOptionIds.length === 0
            ? "Tick the box next to each correct option."
            : f.correctOptionIds.length === 1
            ? "1 correct answer — students pick one."
            : f.correctOptionIds.length + " correct answers — students must pick exactly " + f.correctOptionIds.length + "."}
        </div>
      </>
    );
  }

  // matching / labelling
  const bank = sec.matchBank || [];
  return (
    <>
      {bank.length === 0 ? (
        <div className="kind-hint warn">
          This section has no shared answer bank yet — add answers above first, then come back here to pick one.
        </div>
      ) : (
        <div className="f-group">
          <label>Correct answer</label>
          <select
            className="f-matching-answer"
            style={{ minWidth: 240 }}
            value={f.matchingAnswerId || ""}
            onChange={(e) => setF("matchingAnswerId", e.target.value)}
          >
            <option value="">— Select the correct answer —</option>
            {bank.map((b) => (
              <option key={b.id} value={b.id}>
                {b.text || "(untitled)"}
              </option>
            ))}
          </select>
        </div>
      )}
      {f.kind === "labelling" && (
        <div className="label-pin-wrap">
          <LabelPinPicker f={f} fi={fi} si={si} sec={sec} media={media} patch={patch} />
        </div>
      )}
    </>
  );
}

function LabelPinPicker({ f, fi, si, sec, media, patch }) {
  const img = sec.imageId ? media.images.find((i) => i._id === sec.imageId) : null;
  if (!img) {
    return (
      <div className="kind-hint warn">
        Add a diagram/map image to this section first (see &quot;Illustration&quot; above).
      </div>
    );
  }
  return (
    <div className="f-group">
      <label>Pin position — click on the image where this question&apos;s numbered label should sit</label>
      <div
        className="label-pin-imgwrap"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          const x = Math.min(100, Math.max(0, ((e.clientX - r.left) / r.width) * 100));
          const y = Math.min(100, Math.max(0, ((e.clientY - r.top) / r.height) * 100));
          patch((d) => {
            d[si].fields[fi].pinX = x;
            d[si].fields[fi].pinY = y;
          });
        }}
      >
        <img src={img.cloudinaryUrl} draggable={false} alt="" />
        {(sec.fields || [])
          .filter((o) => o.kind === "labelling" && o.pinX != null && o.pinY != null)
          .map((o) => (
            <span
              key={o.id}
              className={"pin-marker" + (String(o.id) === String(f.id) ? " current" : "")}
              style={{ left: o.pinX + "%", top: o.pinY + "%" }}
            >
              {o.id}
            </span>
          ))}
      </div>
    </div>
  );
}
