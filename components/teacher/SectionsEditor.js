"use client";

import { useState } from "react";
import RichTextEditor from "./RichTextEditor";
import { noteTextToDoc, docToNoteText, blankIdsFromDoc } from "@/lib/tiptap/noteConvert";
import { importNoteText } from "@/lib/tiptap/importText";
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
import { questionFormatsFor } from "@/lib/teacher/questionFormats";

// Chèn 1 chỗ trống mới vào cuối note-doc của section. Nếu chỗ trống NGAY
// TRƯỚC nó (câu note gần nhất) thuộc 1 dạng "Completion" KHÁC (vd vừa có
// Flow-chart Completion, giờ thêm Note Completion) thì tự chèn 1 Divider
// trước — tách thành khung riêng, khớp cách trình bày thi thật (mỗi dạng
// bài 1 khung), thay vì dồn chung vào 1 đoạn không phân biệt được ranh
// giới. Cùng 1 dạng liên tiếp (vd 2 câu Note Completion nối nhau, trường
// hợp phổ biến nhất) thì KHÔNG chèn divider — vẫn 1 đoạn liền mạch bình
// thường như thi thật.
function appendNoteBlank(s, id, fmt) {
  s.noteMode = true;
  if (!s.noteDoc || !Array.isArray(s.noteDoc.content) || !s.noteDoc.content.length) {
    s.noteDoc = s.noteText ? noteTextToDoc(s.noteText) : { type: "doc", content: [{ type: "paragraph" }] };
  }
  const blankIds = blankIdsFromDoc(s.noteDoc);
  const lastBlankId = blankIds[blankIds.length - 1];
  const lastField = lastBlankId != null ? (s.fields || []).find((x) => Number(x.id) === lastBlankId) : null;
  const startsNewBlock = !!(lastField && lastField.formatLabel && fmt.label && lastField.formatLabel !== fmt.label);
  if (startsNewBlock) {
    s.noteDoc.content.push({ type: "horizontalRule" });
  }
  s.noteDoc.content.push({ type: "paragraph", content: [{ type: "blank", attrs: { id } }] });
  s.noteText = docToNoteText(s.noteDoc);
}

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
  const formats = questionFormatsFor(subject);
  // true = đang hiện lưới chọn dạng bài (bấm "+ Add Question" mở ra, chọn
  // xong hoặc Cancel thì đóng lại). Không có state riêng cho "loại nào" vì
  // chọn xong là tạo câu luôn — không có bước "xác nhận" thừa.
  const [pickingFormat, setPickingFormat] = useState(false);

  // Tạo câu hỏi mới theo ĐÚNG tên dạng bài IELTS (vd "Table Completion")
  // thay vì bắt giáo viên tự biết chọn cơ chế nền (Fill/Matching/...) rồi tự
  // nhớ bật Note layout / điền Shared answer bank ở chỗ khác. Đây CHỈ là lớp
  // hướng dẫn UI — set đúng field.kind + tự bật/điền sẵn phần liên quan,
  // không đụng gì tới cách import CSV hay cách chấm điểm.
  function addQuestionWithFormat(fmt) {
    const id = nextFieldId(allSections);
    patch((d) => {
      const s = d[si];
      const field = emptyField(id);
      field.kind = fmt.kind;
      field.formatLabel = fmt.label || "";
      if (fmt.kind === "tfng") field.options = tfngOptions();
      if (fmt.kind === "ynng") field.options = ynngOptions();
      s.fields.push(field);

      if (fmt.noteMode) appendNoteBlank(s, id, fmt);
      if (fmt.needsBank && !(s.matchBank || []).length) {
        s.matchBank = [{ id: newOptionId(), text: "" }];
      }
    });
    setPickingFormat(false);
  }

  function addPlainQuestion() {
    patch((d) => d[si].fields.push(emptyField(nextFieldId(allSections))));
    setPickingFormat(false);
  }

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
          {/* Note layout, ảnh minh hoạ, kho đáp án Matching — đều là nguyên
              liệu để soạn câu hỏi, nên nằm trong khung Questions. Nhưng CHỈ
              hiện khi thật sự có câu hỏi cần tới (đã bật Note layout, hoặc
              đã có câu Matching/Labelling) — section trống chỉ có mỗi nút
              "Add Question", không hiện sẵn cả đống thứ chưa cần dùng. Chọn
              đúng dạng ở bước "Add Question" sẽ tự bật/hiện đúng phần này. */}
          {sec.noteMode && (
            <div className="note-editor-inline">
              <NoteCompletionEditor sec={sec} si={si} allSections={allSections} patch={patch} />
            </div>
          )}
          {(sec.fields || []).some((f) => f.kind === "matching" || f.kind === "labelling") && (
            <div className="builder-2col questions-media-row">
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Illustration (Diagram / Map — for Labelling questions)</label>
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
                <label>Shared answer bank (for Matching questions)</label>
                <div className="match-bank-box">
                  <MatchBank sec={sec} si={si} patch={patch} />
                </div>
              </div>
            </div>
          )}

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
              <FieldRow key={fi} f={f} fi={fi} si={si} sec={sec} subject={subject} media={media} patch={patch} />
            ))}
          </div>

          {pickingFormat ? (
            <div className="format-pick-panel">
              <div className="format-pick-head">
                <span>What format is this question?</span>
                <button type="button" className="icon-btn" title="Cancel" onClick={() => setPickingFormat(false)}>
                  <svg className="icon"><use href="#icon-cross" /></svg>
                </button>
              </div>
              <div className="format-pick-grid">
                {formats
                  ? formats.map((f) => (
                      <button key={f.key} type="button" className="format-pick-btn" onClick={() => addQuestionWithFormat(f)}>
                        {f.label}
                      </button>
                    ))
                  : QUESTION_KINDS.map((k) => (
                      <button
                        key={k}
                        type="button"
                        className="format-pick-btn"
                        onClick={() => addQuestionWithFormat({ kind: k })}
                      >
                        {QUESTION_KIND_LABELS[k]}
                      </button>
                    ))}
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="btn secondary btn-add-field"
              style={{ marginTop: 10, padding: "8px 14px", fontSize: ".85rem" }}
              onClick={() => (formats ? setPickingFormat(true) : addPlainQuestion())}
            >
              <svg className="icon"><use href="#icon-plus" /></svg> Add Question
            </button>
          )}
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

// Soạn "Note/Summary Completion" — giáo viên gõ thẳng đoạn ghi chú như trên
// Google Docs (WYSIWYG), bấm "+ Blank" để chèn chỗ trống đánh số vào vị trí
// con trỏ. Mỗi lần chèn tự tạo thêm 1 câu hỏi trong danh sách Questions bên
// dưới để nhập đáp án đúng/gợi ý/điểm cho số đó. Nội dung lưu dưới dạng
// TipTap JSON (sec.noteDoc); sec.noteText vẫn được ghi lại để tương thích.
function NoteCompletionEditor({ sec, si, allSections, patch }) {
  // Legacy sections only have noteText — chuyển sang doc khi mở editor.
  const doc =
    sec.noteDoc && Array.isArray(sec.noteDoc.content)
      ? sec.noteDoc
      : sec.noteText
      ? noteTextToDoc(sec.noteText)
      : null;

  function setDoc(nextDoc) {
    patch((d) => {
      d[si].noteDoc = nextDoc;
      d[si].noteText = docToNoteText(nextDoc);
      d[si].noteMode = true;
      // Mỗi blank trong đoạn ghi chú cần 1 field tương ứng để nhập đáp án.
      const have = new Set(d[si].fields.map((f) => Number(f.id)));
      for (const id of blankIdsFromDoc(nextDoc)) {
        if (!have.has(id)) {
          d[si].fields.push(emptyField(id));
          have.add(id);
        }
      }
    });
  }

  // Dán nguyên đề do AI soạn: chuyển format + điền luôn đáp án cho từng blank.
  function importFromAI(raw) {
    const { doc: nextDoc, answers } = importNoteText(raw);
    patch((d) => {
      d[si].noteDoc = nextDoc;
      d[si].noteText = docToNoteText(nextDoc);
      d[si].noteMode = true;
      const byId = new Map(d[si].fields.map((f) => [Number(f.id), f]));
      for (const id of blankIdsFromDoc(nextDoc)) {
        let field = byId.get(id);
        if (!field) {
          field = emptyField(id);
          d[si].fields.push(field);
          byId.set(id, field);
        }
        if (answers[id] && answers[id].length) {
          field.kind = "fill";
          field.answersText = answers[id].join("\n");
        }
      }
    });
  }

  // Cấp id mới cho blank sắp chèn — tránh trùng cả field lẫn blank đang có.
  function requestBlankId() {
    const fromFields = nextFieldId(allSections);
    const fromDoc = doc ? blankIdsFromDoc(doc) : [];
    return Math.max(fromFields - 1, ...fromDoc, 0) + 1;
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
              if (on && !(d[si].noteDoc && d[si].noteDoc.content)) {
                d[si].noteDoc = d[si].noteText ? noteTextToDoc(d[si].noteText) : { type: "doc", content: [{ type: "paragraph" }] };
              }
            });
          }}
        />
        Note / Summary completion layout (numbered blanks inside a continuous note, like the real IELTS test)
      </label>
      {sec.noteMode && (
        <>
          <RichTextEditor
            variant="note"
            value={doc}
            onChange={setDoc}
            onRequestBlankId={requestBlankId}
            onImport={importFromAI}
            placeholder={
              "Complete the notes below. Choose ONE WORD ONLY from the passage for each answer.\n" +
              "Add a divider, then: heading, sub-heading, bullets, and a “+ Blank” wherever an answer goes."
            }
          />
          <span className="note-toolbar-hint">
            Type the note exactly as students should see it. Use “+ Blank” for each numbered answer,
            then fill in the correct answer for that number in the Questions list below.
          </span>
        </>
      )}
    </div>
  );
}

function FieldRow({ f, fi, si, sec, subject, media, patch }) {
  const setF = (k, v) => patch((d) => (d[si].fields[fi][k] = v));
  const formats = questionFormatsFor(subject);

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

  // Đổi Type qua tên dạng IELTS (thay vì 6 cơ chế nền trần trụi) — cùng 1
  // danh sách 27 tên với lúc "Add Question", nhất quán khi sửa lại câu đã
  // tạo. Đổi sang dạng "completion"/"matching" cũng tự bật Note layout /
  // Shared bank như lúc thêm mới, không phải riêng biệt chỉ áp dụng khi tạo.
  // QUAN TRỌNG: gộp hết vào 1 lần patch() duy nhất — gọi patch() 2 lần liên
  // tiếp trong cùng 1 handler sẽ clone `sections` (prop) 2 lần từ cùng 1
  // bản cũ (React chưa kịp re-render giữa 2 lần gọi), khiến lần patch sau
  // ghi đè mất thay đổi của lần patch trước.
  function changeFormat(fmt) {
    patch((d) => {
      const s = d[si];
      const ff = s.fields[fi];
      const wasTfng = isFixedChoiceShape(ff.options, ["true", "false", "ng"]);
      const wasYnng = isFixedChoiceShape(ff.options, ["yes", "no", "ng"]);
      ff.kind = fmt.kind;
      ff.formatLabel = fmt.label || "";
      if (fmt.kind === "tfng" && !wasTfng) {
        ff.options = tfngOptions();
        ff.correctOptionIds = [];
      }
      if (fmt.kind === "ynng" && !wasYnng) {
        ff.options = ynngOptions();
        ff.correctOptionIds = [];
      }
      if (fmt.kind === "mcq" && (!ff.options.length || wasTfng || wasYnng)) {
        ff.options = [];
        ff.correctOptionIds = [];
      }

      if (fmt.noteMode) {
        // Câu này đã sẵn là 1 chỗ trống trong note (đổi Type qua lại giữa các
        // dạng completion) -> không cần chèn blank mới, tránh nhân đôi.
        s.noteMode = true;
        const alreadyBlank =
          s.noteDoc && Array.isArray(s.noteDoc.content) && blankIdsFromDoc(s.noteDoc).includes(Number(f.id));
        if (!alreadyBlank) appendNoteBlank(s, Number(f.id), fmt);
      }
      if (fmt.needsBank && !(s.matchBank || []).length) {
        s.matchBank = [{ id: newOptionId(), text: "" }];
      }
    });
  }

  // Nhiều tên IELTS trỏ về cùng 1 cơ chế (vd Note/Table/Flow-chart Completion
  // đều là "fill") — ưu tiên đúng tên đã lưu (formatLabel) để dropdown hiện
  // lại chính xác; câu cũ tạo trước khi có formatLabel (hoặc import CSV)
  // thì mới hiện đại diện đầu tiên khớp cơ chế đó.
  const currentFormatKey = formats
    ? ((formats.find((x) => x.label === f.formatLabel) || formats.find((x) => x.kind === f.kind)) || {}).key || ""
    : "";

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
        {formats ? (
          <select
            className="f-kind"
            value={currentFormatKey}
            onChange={(e) => {
              const fmt = formats.find((x) => x.key === e.target.value);
              if (fmt) changeFormat(fmt);
            }}
          >
            {formats.map((fmt) => (
              <option key={fmt.key} value={fmt.key}>
                {fmt.label}
              </option>
            ))}
          </select>
        ) : (
          <select className="f-kind" value={f.kind} onChange={(e) => changeKind(e.target.value)}>
            {QUESTION_KINDS.map((k) => (
              <option key={k} value={k}>
                {QUESTION_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        )}
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
      <div className="question-hint-row">
        <textarea
          className="f-explanation"
          rows={1}
          placeholder="Explanation (optional) — shown to students in review, whether they answered right or wrong"
          value={f.explanation || ""}
          onChange={(e) => setF("explanation", e.target.value)}
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
            : f.correctOptionIds.length + " correct answers — students must pick up to " + f.correctOptionIds.length + ". Each pick is graded independently (partial credit)."}
        </div>
        {f.correctOptionIds.length > 1 && (
          <div className="f-group" style={{ marginTop: 8 }}>
            <label>Spans question numbers (optional) — e.g. "Questions {f.id}-{f.id + f.correctOptionIds.length - 1}"</label>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: ".85rem", color: "var(--muted)" }}>Ends at question #</span>
              <input
                type="number"
                style={{ width: 90 }}
                placeholder={String(f.id)}
                value={f.idEnd || ""}
                onChange={(e) => setF("idEnd", e.target.value ? Number(e.target.value) : null)}
              />
              {Number(f.score) !== f.correctOptionIds.length && (
                <button
                  type="button"
                  className="btn secondary sm"
                  onClick={() => setF("score", f.correctOptionIds.length)}
                >
                  Set score = {f.correctOptionIds.length} (1 per answer)
                </button>
              )}
            </div>
          </div>
        )}
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
