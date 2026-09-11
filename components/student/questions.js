"use client";

import { createContext, useCallback, useContext, useState } from "react";
import ReadingPassage from "@/components/student/ReadingPassage";
import { parseNoteInline, parseNoteLayout } from "@/lib/noteLayout";
import { NoteDoc } from "@/components/student/RichDoc";
import HighlightText, { hashStr, clearHighlights } from "@/components/student/HighlightText";
import ExamAudioPlayer from "@/components/student/ExamAudioPlayer";
import { blankIdsFromDoc } from "@/lib/tiptap/doc";

// Highlightable static text in the question column. `base` scopes it to the
// current section; `slot` + a hash of the text keep the localStorage key stable
// until the teacher edits the wording.
// Ngữ cảnh ghi chú (unit/test đang xem) — SectionBlock cấp, <HL> đọc để gắn
// vào cuốn sổ khi học sinh note.
const HlSourceContext = createContext(null);

function HL({ base, slot, text }) {
  const source = useContext(HlSourceContext);
  const t = text == null ? "" : String(text);
  if (!base || !t) return <>{t}</>;
  return <HighlightText inline text={t} lsKey={`${base}${slot}:${hashStr(t)}`} noteSource={source} />;
}

// A TipTap doc counts as "has content" only if it holds more than empty paragraphs.
function docHasContent(doc) {
  if (!doc || !Array.isArray(doc.content)) return false;
  const scan = (n) =>
    (n.type === "text" && String(n.text || "").trim()) ||
    n.type === "blank" ||
    n.type === "horizontalRule" ||
    (Array.isArray(n.content) && n.content.some(scan));
  return doc.content.some(scan);
}

// Question ids actually embedded as [[n]] blanks inside a section's Note
// Completion content (WYSIWYG noteDoc, or legacy noteText string).
function noteBlankIdSet(section) {
  if (docHasContent(section.noteDoc)) return new Set(blankIdsFromDoc(section.noteDoc));
  const ids = [];
  const re = /\[\[(\d+)\]\]/g;
  let m;
  while ((m = re.exec(section.noteText || ""))) ids.push(Number(m[1]));
  return new Set(ids);
}

// ---------- State câu trả lời ----------
// initial: câu trả lời đã nộp trước đó (last.answers) — để mở lại bài đã làm
// (review) vẫn thấy đúng lựa chọn cũ, không phải ô trống.
export function useAnswers(initial) {
  const [answers, setAnswers] = useState(() => initial || {});
  const getValue = useCallback(
    (f) => {
      const v = answers[f.id];
      if (v != null) return v;
      return Number(f.selectCount) > 1 ? [] : "";
    },
    [answers]
  );
  const setValue = useCallback((id, v) => setAnswers((p) => ({ ...p, [id]: v })), []);
  const reset = useCallback(() => setAnswers({}), []);
  // Nạp lại nguyên cục câu trả lời đã nộp trước đó — dùng khi `initial` chưa
  // có sẵn lúc mount (VD: đang chờ tải submissions cũ về) nên phải cập nhật
  // sau, không thể chỉ dựa vào giá trị khởi tạo của useState.
  const setAll = useCallback((obj) => setAnswers(obj || {}), []);
  const collect = useCallback(
    (sections) => {
      const out = {};
      (sections || []).forEach((sec) =>
        (sec.fields || []).forEach((f) => {
          const v = answers[f.id];
          out[f.id] = v != null ? v : Number(f.selectCount) > 1 ? [] : "";
        })
      );
      return out;
    },
    [answers]
  );
  return { answers, getValue, setValue, collect, reset, setAll };
}

function fieldOptions(field, section) {
  return field.options && field.options.length ? field.options : section.matchOptions || [];
}

export function answerLabel(field, value, section) {
  const options = fieldOptions(field, section);
  if (Array.isArray(value)) {
    if (!value.length) return "";
    return value.map((val) => (options.find((o) => o.value === val) || {}).label || val).join(", ");
  }
  if (field.type === "choice") {
    const opt = options.find((o) => o.value === value);
    return opt ? opt.label : value;
  }
  return value;
}

// ---------- 1 câu hỏi (khớp .field-row của legacy) ----------
// Câu "chọn N trong M" gộp nhiều số thứ tự liền nhau (vd id=21, idEnd=22) ->
// hiện "21-22." thay vì chỉ số đầu.
function fieldNum(field) {
  return field.idEnd && field.idEnd > field.id ? `${field.id}-${field.idEnd}` : field.id;
}

export function QuestionField({ field, section, value, onChange, review, hlBase }) {
  const isChoice = field.type === "choice";
  const selectCount = Number(field.selectCount) || 1;
  const options = fieldOptions(field, section);
  const rowCls =
    "field-row" + (review ? (review.correct ? " correct" : review.partial ? " partial" : " wrong") : "");

  // "Correct answer" lưu ở DB là VALUE nội bộ của lựa chọn (VD "o3_2"), không
  // phải chữ học sinh đọc được — map qua option để hiện đúng nhãn.
  const labelForValue = (v) => {
    const opt = options.find((o) => o.value === v);
    return opt ? opt.label : v;
  };
  const correctAnswerLabel = review
    ? selectCount > 1
      ? String(review.answer || "")
          .split(",")
          .map((v) => labelForValue(v.trim()))
          .join(", ")
      : labelForValue(review.answer || "")
    : "";

  if (isChoice) {
    return (
      <div className={rowCls} id={"row-" + field.id}>
        <span className="num">{fieldNum(field)}.</span>
        <div style={{ flex: 1 }}>
          <div className="label" style={{ marginBottom: 6 }}>
            <HL base={hlBase} slot={field.id + ":label"} text={field.label} />
            {selectCount > 1 && (
              <span className="select-hint"> (Select up to {selectCount} answers)</span>
            )}
            {field.hint && (
              <span className="field-hint"> <HL base={hlBase} slot={field.id + ":hint"} text={field.hint} /></span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {options.map((o) => {
              const checked =
                selectCount > 1
                  ? Array.isArray(value) && value.includes(o.value)
                  : value === o.value;
              const atLimit =
                selectCount > 1 && Array.isArray(value) && value.length >= selectCount && !checked;
              return (
                <label
                  key={o.value}
                  style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}
                >
                  <input
                    type={selectCount > 1 ? "checkbox" : "radio"}
                    name={"ans-" + field.id}
                    checked={checked}
                    disabled={!!review || atLimit}
                    onChange={() => {
                      if (review) return;
                      if (selectCount > 1) {
                        const arr = Array.isArray(value) ? value : [];
                        onChange(checked ? arr.filter((x) => x !== o.value) : [...arr, o.value]);
                      } else onChange(o.value);
                    }}
                  />
                  <HL base={hlBase} slot={field.id + ":opt:" + o.value} text={o.label} />
                </label>
              );
            })}
          </div>
        </div>
        {review && (
          <span className={"result-mark " + (review.correct ? "correct" : review.partial ? "partial" : "wrong")}>
            <svg className="icon"><use href={review.correct ? "#icon-check" : "#icon-cross"} /></svg>
          </span>
        )}
        {review && !review.correct && (
          <div className="correct-answer-note">
            {review.partial ? "Partially correct — full answer: " : "Correct answer: "}
            {correctAnswerLabel}
          </div>
        )}
        {review && review.explanation && (
          <div className="answer-explanation">{review.explanation}</div>
        )}
      </div>
    );
  }

  return (
    <div className={rowCls} id={"row-" + field.id}>
      <span className="num">{fieldNum(field)}.</span>
      <span className="label">
        <HL base={hlBase} slot={field.id + ":label"} text={field.label} />
        {field.pre ? <>: <HL base={hlBase} slot={field.id + ":pre"} text={field.pre} /></> : ""}
        {field.hint && <span className="field-hint"> <HL base={hlBase} slot={field.id + ":hint"} text={field.hint} /></span>}
      </span>
      <input
        type="text"
        id={"ans-" + field.id}
        autoComplete="off"
        value={typeof value === "string" ? value : ""}
        disabled={!!review}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="tail">
        <HL base={hlBase} slot={field.id + ":post"} text={field.post || ""} />
      </span>
      {review && (
        <span className={"result-mark " + (review.correct ? "correct" : "wrong")}>
          <svg className="icon"><use href={review.correct ? "#icon-check" : "#icon-cross"} /></svg>
        </span>
      )}
      {review && !review.correct && (
        <div className="correct-answer-note">Correct answer: {review.answer || ""}</div>
      )}
      {review && review.explanation && (
        <div className="answer-explanation">{review.explanation}</div>
      )}
    </div>
  );
}

function DiagramImage({ section, center }) {
  const style = center ? { margin: "0 auto 16px" } : undefined;
  if (!section.labelPoints || !section.labelPoints.length) {
    return <img src={section.imageUrl} alt="" className="diagram-image" style={style} />;
  }
  return (
    <div className="diagram-pin-wrap" style={style}>
      <img src={section.imageUrl} alt="" className="diagram-image" />
      {section.labelPoints.map((lp, i) => (
        <span key={i} className="pin-marker" style={{ left: lp.x + "%", top: lp.y + "%" }}>
          {lp.fieldId}
        </span>
      ))}
    </div>
  );
}

// ---------- 1 section (khớp renderSectionBlock của legacy) ----------
export function SectionBlock({
  section,
  secIdx,
  skill,
  answersApi,
  reviewById,
  onReplay,
  hlScope = "",
  noteSource = null,
  examAudio = false,
  audioPhase = "idle",
  onAudioPhase,
}) {
  const [replays, setReplays] = useState(0);
  const [hlNonce, setHlNonce] = useState(0);
  const isReading = skill === "reading";

  // Ngữ cảnh cho ghi chú tạo từ section này.
  const sectionSource = noteSource
    ? { ...noteSource, skill: noteSource.skill || skill, itemLabel: section.name || noteSource.itemLabel || "" }
    : null;
  const hasNote = docHasContent(section.noteDoc) || !!(section.noteText && section.noteText.trim());

  // localStorage namespace for question-column highlights in this section.
  const hlBase = `qhl:${hlScope}:${skill}:${section.name || ""}:${secIdx}:`;

  // 1 section có thể trộn câu hỏi rời (MCQ/Matching/TFNG...) VÀ 1 khối Note
  // Completion cùng lúc (vd Q1-7 Matching Headings + Q8-13 Table Completion
  // trong cùng 1 passage). Chỉ những câu hỏi KHÔNG nằm trong noteDoc/noteText
  // (không phải [[n]] nào cả) mới hiện ở danh sách rời — câu nào đã là 1 ô
  // trống trong note thì chỉ hiện đúng 1 lần, bên trong khối note. Trước đây
  // hễ có note là toàn bộ field rời bị bỏ qua hoàn toàn, làm mất câu hỏi.
  const noteBlankIds = hasNote ? noteBlankIdSet(section) : new Set();
  const standaloneFields = (section.fields || []).filter((f) => !noteBlankIds.has(Number(f.id)));

  const fields = standaloneFields.map((f) => (
    <QuestionField
      key={f.id}
      field={f}
      section={section}
      value={answersApi.getValue(f)}
      onChange={(v) => answersApi.setValue(f.id, v)}
      review={reviewById ? reviewById[f.id] : null}
      hlBase={hlBase}
    />
  ));

  const body = hasNote ? (
    <>
      {fields}
      <NoteCompletionBlock section={section} answersApi={answersApi} reviewById={reviewById} hlBase={hlBase} />
    </>
  ) : (
    fields
  );

  const questionsTools = (
    <div className="questions-tools">
      <span className="rt-hint">
        <svg className="icon"><use href="#icon-edit" /></svg>
        Select any text in the questions to <b>highlight</b> or add a <b>note</b>
      </span>
      <button
        type="button"
        className="rt-clear"
        onClick={() => {
          clearHighlights(hlBase);
          setHlNonce((n) => n + 1);
        }}
      >
        Clear highlights
      </button>
    </div>
  );

  if (isReading) {
    return (
      <HlSourceContext.Provider value={sectionSource}>
      <div className="reading-layout" style={{ marginBottom: 30 }}>
        <div className="passage-pane">
          <h3 style={{ color: "var(--navy)", marginTop: 0 }}>{section.name}</h3>
          {section.imageUrl && <DiagramImage section={section} />}
          {section.passageText && (
            <ReadingPassage
              text={section.passageText}
              storageKey={(section.name || "") + ":" + secIdx}
              noteSource={sectionSource}
            />
          )}
        </div>
        <div className="questions-pane">
          {questionsTools}
          <div key={hlNonce}>{body}</div>
        </div>
      </div>
      </HlSourceContext.Provider>
    );
  }

  return (
    <HlSourceContext.Provider value={sectionSource}>
    <div style={{ marginBottom: 30 }}>
      <div className="section-title">{section.name}</div>
      {section.audioUrl &&
        (examAudio ? (
          <ExamAudioPlayer
            src={section.audioUrl}
            partLabel={section.name || `Part ${secIdx + 1}`}
            phase={audioPhase}
            onPhase={onAudioPhase}
            warn={secIdx === 0}
          />
        ) : (
          <div className="player">
            <svg className="icon"><use href="#icon-speaker" /></svg>
            <audio
              controls
              src={section.audioUrl}
              onPlay={() => {
                setReplays((n) => n + 1);
                onReplay && onReplay();
              }}
            />
            <span className="replay-count">Listened: {replays} times</span>
          </div>
        ))}
      {section.imageUrl && <DiagramImage section={section} center />}
      {questionsTools}
      <div key={hlNonce}>{body}</div>
    </div>
    </HlSourceContext.Provider>
  );
}

// ---------- Note/Summary Completion — chỗ trống đánh số nằm trong 1 đoạn
// ghi chú liền mạch, giống bài thi IELTS thật, thay vì mỗi câu 1 hàng riêng.
const parseNoteBlanks = parseNoteInline;

function NoteBlankInput({ field, answersApi, review }) {
  if (!field) return null;
  const value = answersApi.getValue(field);
  return (
    <span className={"note-blank" + (review ? (review.correct ? " correct" : " wrong") : "")}>
      <span className="note-blank-num">{field.id}</span>
      <input
        type="text"
        className="note-blank-input"
        value={typeof value === "string" ? value : ""}
        disabled={!!review}
        onChange={(e) => answersApi.setValue(field.id, e.target.value)}
      />
      {review && !review.correct && <span className="note-blank-correct">({review.answer || ""})</span>}
    </span>
  );
}

// In review, list explanations for the numbered blanks that have one.
function NoteExplanations({ fields, reviewById }) {
  if (!reviewById) return null;
  const rows = (fields || [])
    .map((f) => ({ id: f.id, r: reviewById[f.id] }))
    .filter((x) => x.r && x.r.explanation);
  if (!rows.length) return null;
  return (
    <div className="note-explanations">
      {rows.map((x) => (
        <div key={x.id} className="answer-explanation">
          <b>{x.id}.</b> {x.r.explanation}
        </div>
      ))}
    </div>
  );
}

function NoteInlineText({ text, fieldsById, answersApi, reviewById, hlBase, hlSlot }) {
  return parseNoteBlanks(text).map((p, i) =>
    p.type === "text" ? (
      <HL key={i} base={hlBase} slot={`${hlSlot}:${i}`} text={p.text} />
    ) : (
      <NoteBlankInput key={i} field={fieldsById[p.id]} answersApi={answersApi} review={reviewById ? reviewById[p.id] : null} />
    )
  );
}

export function NoteCompletionBlock({ section, answersApi, reviewById, hlBase }) {
  const fieldsById = {};
  (section.fields || []).forEach((f) => (fieldsById[f.id] = f));

  // New WYSIWYG content is stored as a doc; fall back to the legacy noteText
  // markup for sections not yet migrated.
  if (docHasContent(section.noteDoc)) {
    return (
      <>
        <NoteDoc
          doc={section.noteDoc}
          renderBlank={(id, key) => (
            <NoteBlankInput
              key={key}
              field={fieldsById[id]}
              answersApi={answersApi}
              review={reviewById ? reviewById[id] : null}
            />
          )}
          renderText={(t, key) => <HL key={key} base={hlBase} slot={`notedoc:${key}`} text={t} />}
        />
        <NoteExplanations fields={section.fields} reviewById={reviewById} />
      </>
    );
  }

  const { introLines, blocks } = parseNoteLayout(section.noteText || "");

  const inline = (text, key) => (
    <NoteInlineText
      key={key}
      text={text}
      fieldsById={fieldsById}
      answersApi={answersApi}
      reviewById={reviewById}
      hlBase={hlBase}
      hlSlot={"note:" + key}
    />
  );

  return (
    <div className="note-completion">
      {introLines.filter((l) => l.trim()).map((l, i) => (
        <p key={i} className="note-completion-intro">
          <HL base={hlBase} slot={"note-intro:" + i} text={l} />
        </p>
      ))}
      <div className="note-completion-box">
        {blocks.map((b, i) => {
          if (b.type === "h3")
            return (
              <h3 key={i} className="note-h1">
                {inline(b.text, i)}
              </h3>
            );
          if (b.type === "h4")
            return (
              <h4 key={i} className="note-h2">
                {inline(b.text, i)}
              </h4>
            );
          if (b.type === "ul")
            return (
              <ul key={i} className="note-ul">
                {b.items.map((it, k) => (
                  <li key={k}>{inline(it, i + "-" + k)}</li>
                ))}
              </ul>
            );
          if (b.type === "spacer") return <div key={i} style={{ height: 8 }} />;
          return (
            <p key={i} className="note-p">
              {inline(b.text, i)}
            </p>
          );
        })}
      </div>
      <NoteExplanations fields={section.fields} reviewById={reviewById} />
    </div>
  );
}
