"use client";

import { useEffect, useState } from "react";
import RichTextEditor from "./RichTextEditor";
import { noteTextToDoc, docToNoteText, blankIdsFromDoc } from "@/lib/tiptap/noteConvert";
import { removeBlankFromDoc, remapBlankIds, docIsEmpty, walkDoc } from "@/lib/tiptap/doc";
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
  appendAiSections,
  applyFormat,
  applyFormatBasics,
} from "@/lib/teacher/sectionTransforms";
import SpreadsheetImport from "./SpreadsheetImport";
import AiExerciseDialog from "./AiExerciseDialog";
import WordImport from "./WordImport";
import SaveToBankDialog from "./SaveToBankDialog";
import { SwapButton } from "./SwapQuestionDialog";
import { questionFormatsFor } from "@/lib/teacher/questionFormats";
import { LETTERS, letterOptions, isLetterEditorField } from "@/lib/letterQuestion";
import { PROGRAMS, programOf } from "@/lib/curriculum";
import {
  GENERAL_LABELS,
  underlineModeOf,
  isErrorIdFormat,
  optionLettersFromUnderlines,
  splitTokens,
  shuffleTokens,
  arrangeOptions,
  aiFormatsFor,
} from "@/lib/generalFormats";
import { parseUnderline, underlinedParts } from "@/lib/underline";

// Kiểu câu cơ bản cho danh sách khi không có dạng bài (IELTS/TOEIC Grammar, Vocab): "reorder" chỉ
// vào qua dạng bài General nên không liệt kê ở đây — builder IELTS/TOEIC giữ nguyên lựa chọn cũ.
const BASIC_KINDS = QUESTION_KINDS.filter((k) => k !== "reorder");

// letterOptions(n) (dạng server {value,label}) -> dạng editor {id,text}.
const editorLetterOptions = (n) => letterOptions(n).map((o) => ({ id: o.value, text: o.label }));

// Xem trước văn bản gạch chân (dạng bài General) — an toàn, không dùng dangerouslySetInnerHTML.
function UnderlinePreview({ text }) {
  if (!text) return null;
  const parts = parseUnderline(text);
  if (!parts.some((p) => p.u)) return null;
  return (
    <div className="underline-preview" style={{ fontSize: ".84rem", color: "var(--ink)", marginTop: 3 }}>
      <span style={{ color: "var(--muted)", marginRight: 6 }}>Preview:</span>
      {parts.map((p, i) =>
        p.u ? (
          <u key={i} style={{ textDecorationThickness: "2px", textUnderlineOffset: "3px", fontWeight: 600 }}>
            {p.text}
          </u>
        ) : (
          <span key={i}>{p.text}</span>
        )
      )}
    </div>
  );
}

// Danh sách khối note/table hiện có của 1 section, để builder SỬA — ưu
// tiên `noteBlocks` (dữ liệu mới, mỗi khối 1 khung độc lập). Section soạn
// từ trước (chỉ có noteDoc/noteText gộp) được giữ NGUYÊN VẸN thành 1 khối
// duy nhất, kể cả khi bên trong có sẵn Divider: không tự ý tách ra nhiều
// khung, vì như vậy vừa làm giáo viên bất ngờ ("bấm 1 lần ra mấy khung"),
// vừa đổi cách hiển thị của bài cũ (đoạn hướng dẫn trước Divider đầu tiên
// vốn nằm NGOÀI khung sẽ bị đóng khung lại). Khung mới chỉ xuất hiện khi
// giáo viên chủ động bấm "Add Question".
function editableNoteBlocks(sec) {
  if (Array.isArray(sec.noteBlocks) && sec.noteBlocks.length) return sec.noteBlocks;
  const doc =
    sec.noteDoc && Array.isArray(sec.noteDoc.content)
      ? sec.noteDoc
      : sec.noteText
      ? noteTextToDoc(sec.noteText)
      : null;
  return doc && doc.content.length ? [{ noteDoc: doc, noteText: sec.noteText || docToNoteText(doc) }] : [];
}

// Khối đã có chữ nghĩa/tiêu đề/Divider thật chưa (ô trống không tính) — dùng
// để phân biệt khung giáo viên đã soạn với khung vừa tạo còn trống trơn.
function docHasProse(doc) {
  let found = false;
  walkDoc(doc, (n) => {
    if (n.type === "text" && String(n.text || "").trim()) found = true;
    if (n.type === "horizontalRule" || n.type === "image") found = true;
  });
  return found;
}

// Nội dung import (đã đánh số lại) -> danh sách khối. Mỗi đoạn cách nhau bởi
// Divider là 1 bảng riêng nên tách thành 1 khung riêng. Đoạn ĐẦU nếu không có
// ô trống nào thì đó là dòng hướng dẫn chung ("Complete the notes below...")
// -> gắn liền vào bảng đầu tiên kèm Divider, để nó vẫn hiện NGOÀI khung đúng
// như đề thi thật thay vì bị đóng hộp thành 1 bảng rỗng.
function importedDocToBlocks(doc) {
  const segments = [[]];
  doc.content.forEach((n) => {
    if (n.type === "horizontalRule") segments.push([]);
    else segments[segments.length - 1].push(n);
  });
  const parts = segments.filter((seg) => seg.length);
  const mk = (content) => {
    const d = { type: "doc", content };
    return { noteDoc: d, noteText: docToNoteText(d) };
  };
  if (parts.length <= 1) return parts.map(mk);
  const firstIsIntro = blankIdsFromDoc({ type: "doc", content: parts[0] }).length === 0;
  if (!firstIsIntro) return parts.map(mk);
  return [mk([...parts[0], { type: "horizontalRule" }, ...parts[1]]), ...parts.slice(2).map(mk)];
}

function blockBlankIds(block) {
  return block && block.noteDoc && Array.isArray(block.noteDoc.content) ? blankIdsFromDoc(block.noteDoc) : [];
}

// Lần đầu sửa note của 1 section — chốt lại `noteBlocks` (tách từ dữ liệu
// cũ nếu cần) để các lần patch sau thao tác trực tiếp trên mảng này.
function materializeNoteBlocks(s) {
  if (!Array.isArray(s.noteBlocks) || !s.noteBlocks.length) s.noteBlocks = editableNoteBlocks(s);
  return s.noteBlocks;
}

// Thêm 1 khối MỚI, độc lập, chứa đúng 1 chỗ trống — dùng khi tạo câu hỏi
// dạng Completion (Note/Table/Flow-chart...) từ "Add Question", hoặc khi
// đổi Type 1 câu đang có sang dạng Completion. Mỗi lần luôn ra 1 khung
// riêng (không dồn vào khối trước), giáo viên chỉ cần bấm "Add Question"
// lần nữa để có thêm 1 bảng/note độc lập khác.
// Xoá 1 câu hỏi khỏi section — kèm luôn ô trống tương ứng trong khối note
// (nếu câu đó là 1 ô trống), để note không còn ô mồ côi không có đáp án.
function removeField(s, fi) {
  const [removed] = s.fields.splice(fi, 1);
  const id = Number(removed && removed.id);
  if (!Number.isFinite(id)) return;
  const blocks = editableNoteBlocks(s);
  if (!blocks.some((b) => blockBlankIds(b).includes(id))) return;
  const list = materializeNoteBlocks(s);
  for (let i = list.length - 1; i >= 0; i--) {
    if (!blockBlankIds(list[i]).includes(id)) continue;
    const nextDoc = removeBlankFromDoc(list[i].noteDoc, id);
    // Khối chỉ có mỗi ô trống vừa xoá, không còn chữ nghĩa gì -> bỏ cả khung.
    if (docIsEmpty(nextDoc)) list.splice(i, 1);
    else list[i] = { noteDoc: nextDoc, noteText: docToNoteText(nextDoc) };
  }
  if (!list.length) s.noteMode = false;
}

function addNoteBlock(s, id) {
  materializeNoteBlocks(s).push({
    noteDoc: { type: "doc", content: [{ type: "paragraph", content: [{ type: "blank", attrs: { id } }] }] },
    noteText: `[[${id}]]`,
  });
  s.noteMode = true;
}

// Trình soạn "section + câu hỏi" dùng chung cho Exercise (Unit) và Mock
// Test. Controlled; markup khớp renderSectionsEditor của legacy.
// showTranscript: hiện ô Transcript cho section Listening — chỉ bài tập trong Unit
// (Vocab Review dùng), không bật ở builder đề thi.
// program: "ielts" (mặc định) | "toeic" — quyết định danh sách dạng câu hỏi và ẩn
// nút import spreadsheet với nội dung TOEIC (chưa có template, Phase 8 bước 5.6).
// firstId: số câu đầu tiên của kỹ năng khi chưa có câu nào (TOEIC Reading = 101).
export default function SectionsEditor({
  sections,
  subject,
  media,
  onChange,
  showTranscript = false,
  program,
  firstId = 1,
  aiContext,
  onMediaChanged,
  bankExcludeIds,
}) {
  const [importing, setImporting] = useState(false);
  const [aiExerciseOpen, setAiExerciseOpen] = useState(false);
  const [wordImportOpen, setWordImportOpen] = useState(false);

  const prog = programOf({ program: program || (aiContext && aiContext.program) });
  const canImport = !!PROGRAMS[prog]?.excelImport;
  const canAiExercise = !!PROGRAMS[prog]?.aiExercise && aiFormatsFor(subject).length > 0;
  const canWordImport = !!PROGRAMS[prog]?.wordImport;
  const canBank = !!PROGRAMS[prog]?.questionBank; // ngân hàng câu hỏi (G4): chỉ chương trình bật cờ trong registry

  function patch(mut) {
    const draft = structuredClone(sections);
    mut(draft);
    onChange(draft);
  }

  // Thêm các section sinh từ AI: đánh số tiếp từ nextFieldId và gắn cờ vàng
  function handleAddAiSections(chosenTopics) {
    onChange(appendAiSections(sections, chosenTopics, firstId));
  }

  // Đếm tổng số câu có cờ vàng trong phiên soạn
  const flaggedCount = sections.reduce(
    (acc, sec) => acc + (sec.fields || []).filter((f) => !!f.aiFlag).length,
    0
  );

  function scrollToNextFlag() {
    const flagged = document.querySelectorAll(".question-row.flagged");
    if (!flagged.length) return;
    let target = Array.from(flagged).find((el) => {
      const rect = el.getBoundingClientRect();
      return rect.top > 120;
    });
    if (!target) target = flagged[0];
    target.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <>
      {flaggedCount > 0 && (
        <div
          className="notice warn builder-flag-notice"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <span>
            ⚠ {flaggedCount} question{flaggedCount === 1 ? "" : "s"} need checking
          </span>
          <button
            type="button"
            className="btn secondary sm"
            style={{
              borderColor: "currentColor",
              color: "inherit",
              padding: "4px 10px",
              fontSize: ".82rem",
            }}
            onClick={scrollToNextFlag}
          >
            Next
          </button>
        </div>
      )}
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
          showTranscript={showTranscript}
          allSections={sections}
          program={program}
          firstId={firstId}
          patch={patch}
          bank={canBank ? { program: prog, aiContext, swap: { program: prog, level: Number(aiContext && aiContext.level) || 0, excludeIds: bankExcludeIds || [] } } : null}
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
        {canAiExercise && (
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "8px 14px", fontSize: ".85rem" }}
            onClick={() => setAiExerciseOpen(true)}
          >
            <svg className="icon"><use href="#icon-sparkles" /></svg> Generate with AI
          </button>
        )}
        {canImport && (
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "8px 14px", fontSize: ".85rem" }}
            onClick={() => setImporting(true)}
          >
            <svg className="icon"><use href="#icon-upload" /></svg> Import from spreadsheet
          </button>
        )}
        {canWordImport && (
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "8px 14px", fontSize: ".85rem" }}
            onClick={() => setWordImportOpen(true)}
          >
            <svg className="icon"><use href="#icon-upload" /></svg> Import from Word
          </button>
        )}
      </div>

      {canAiExercise && aiExerciseOpen && (
        <AiExerciseDialog
          context={aiContext}
          subject={subject}
          onAdd={handleAddAiSections}
          onClose={() => setAiExerciseOpen(false)}
        />
      )}

      {canImport && importing && (
        <SpreadsheetImport
          existingSections={sections}
          onImport={(imported) => onChange([...sections, ...imported])}
          onClose={() => setImporting(false)}
        />
      )}

      {canWordImport && wordImportOpen && (
        <WordImport
          existingSections={sections}
          subject={subject}
          program={prog}
          aiContext={aiContext}
          firstId={firstId}
          onMediaChanged={onMediaChanged || media?.reload}
          onImport={(nextSections) => onChange(nextSections)}
          onClose={() => setWordImportOpen(false)}
        />
      )}
    </>
  );
}

function SectionCard({ sec, si, subject, media, allSections, patch, showTranscript, program, firstId = 1, bank = null }) {
  const set = (k, v) => patch((d) => (d[si][k] = v));
  const formats = questionFormatsFor(subject, program);
  // true = đang hiện lưới chọn dạng bài (bấm "+ Add Question" mở ra, chọn
  // xong hoặc Cancel thì đóng lại). Không có state riêng cho "loại nào" vì
  // chọn xong là tạo câu luôn — không có bước "xác nhận" thừa.
  const [pickingFormat, setPickingFormat] = useState(false);
  const [bankOpen, setBankOpen] = useState(false); // hộp "Save to question bank"

  // Tạo câu hỏi mới theo ĐÚNG tên dạng bài IELTS (vd "Table Completion")
  // thay vì bắt giáo viên tự biết chọn cơ chế nền (Fill/Matching/...) rồi tự
  // nhớ bật Note layout / điền Shared answer bank ở chỗ khác. Đây CHỈ là lớp
  // hướng dẫn UI — set đúng field.kind + tự bật/điền sẵn phần liên quan,
  // không đụng gì tới cách import CSV hay cách chấm điểm.
  function addQuestionWithFormat(fmt) {
    const id = nextFieldId(allSections, firstId);
    patch((d) => {
      const s = d[si];
      // "letter" (Listen and choose — no printed question) lưu như câu mcq đề trống,
      // lựa chọn A..D tự tạo — xem lib/letterQuestion.js (logic nằm trong applyFormat).
      const field = applyFormat(emptyField(id), fmt);
      s.fields.push(field);

      if (fmt.noteMode) addNoteBlock(s, id);
      if (fmt.needsBank && !(s.matchBank || []).length) {
        s.matchBank = [{ id: newOptionId(), text: "" }];
      }
    });
    setPickingFormat(false);
  }

  function addPlainQuestion() {
    patch((d) => d[si].fields.push(emptyField(nextFieldId(allSections, firstId))));
    setPickingFormat(false);
  }

  // "+ Add question" / "+ Add 5 questions" của dạng letter: nhân bản dạng của câu
  // letter cuối cùng trong section (cùng nhãn dạng, cùng số lựa chọn, không ảnh).
  const lastLetter = [...(sec.fields || [])].reverse().find(isLetterEditorField) || null;
  function addLetterQuestions(count) {
    if (!lastLetter) return;
    const first = nextFieldId(allSections, firstId);
    patch((d) => {
      const s = d[si];
      for (let k = 0; k < count; k++) {
        const field = emptyField(first + k);
        field.kind = "mcq";
        field.formatLabel = lastLetter.formatLabel || "";
        field.options = editorLetterOptions(lastLetter.options.length);
        s.fields.push(field);
      }
    });
  }

  // Câu hỏi rời (không thuộc bất kỳ khối Completion nào) — chỉ những câu
  // này mới hiện trong bảng "Questions" phẳng bên dưới; câu thuộc 1 khối đã
  // hiện ngay TRONG khung của khối đó (xem NoteBlocksEditor).
  const blockIds = new Set(editableNoteBlocks(sec).flatMap(blockBlankIds));
  const standaloneEntries = sec.fields
    .map((f, fi) => ({ f, fi }))
    .filter(({ f }) => !blockIds.has(Number(f.id)));

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

      {bank && (sec.fields || []).length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
          <button
            type="button"
            className="btn secondary"
            style={{ padding: "5px 12px", fontSize: ".8rem" }}
            onClick={() => setBankOpen(true)}
          >
            <svg className="icon"><use href="#icon-list" /></svg> Save to question bank
          </button>
        </div>
      )}
      {bankOpen && bank && (
        <SaveToBankDialog sec={sec} subject={subject} program={bank.program} aiContext={bank.aiContext || {}} onClose={() => setBankOpen(false)} />
      )}

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
          {showTranscript && (
            <>
              <label style={{ marginTop: 10 }}>Transcript (optional — used by AI Vocab Review, hidden from students)</label>
              <textarea
                className="sec-transcript"
                rows={4}
                placeholder="Paste the listening transcript here..."
                value={sec.transcript || ""}
                onChange={(e) => set("transcript", e.target.value)}
              />
            </>
          )}
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
              <NoteBlocksEditor sec={sec} si={si} allSections={allSections} subject={subject} program={program} media={media} patch={patch} />
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

          {standaloneEntries.length > 0 && (
            <>
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
                {standaloneEntries.map(({ f, fi }) => (
                  <FieldRow key={fi} f={f} fi={fi} si={si} sec={sec} subject={subject} program={program} media={media} patch={patch} swap={bank && bank.swap} allSections={allSections} />
                ))}
              </div>
            </>
          )}

          {lastLetter && !pickingFormat && (
            <div className="letter-quick-add">
              <span className="letter-quick-add-label">Quick add — {lastLetter.formatLabel || "Listen and choose"}:</span>
              <button type="button" className="btn secondary" onClick={() => addLetterQuestions(1)}>
                <svg className="icon"><use href="#icon-plus" /></svg> Add question
              </button>
              <button type="button" className="btn secondary" onClick={() => addLetterQuestions(5)}>
                <svg className="icon"><use href="#icon-plus" /></svg> Add 5 questions
              </button>
            </div>
          )}

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
                  : BASIC_KINDS.map((k) => (
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

// Soạn các câu hỏi dạng "Completion" (Note/Summary/Table/Flow-chart...) —
// mỗi câu hỏi dạng này là 1 KHỐI RIÊNG, độc lập hoàn toàn (khung + editor
// + đáp án của khối đó không dính tới khối khác). Giáo viên gõ ghi chú/bảng
// như trên Google Docs (WYSIWYG) trong khung của khối, bấm "+ Blank" để
// chèn thêm chỗ trống đánh số cho khối ĐÓ (vd ô 2, 3 của cùng 1 bảng). Muốn
// thêm 1 bảng/note khác, tách biệt hoàn toàn — dùng "Add Question" ở trên
// và chọn lại 1 dạng Completion, builder tự tạo khung mới. Mỗi blank chèn
// vào tự tạo thêm 1 câu hỏi trong danh sách Questions bên dưới để nhập đáp
// án đúng/gợi ý/điểm cho số đó.
function NoteBlocksEditor({ sec, si, allSections, subject, program, media, patch }) {
  const blocks = editableNoteBlocks(sec);
  if (blocks.length === 0) return null;

  function updateBlock(bi, nextDoc) {
    patch((d) => {
      const s = d[si];
      const list = materializeNoteBlocks(s);
      list[bi] = { noteDoc: nextDoc, noteText: docToNoteText(nextDoc) };
      s.noteMode = true;
      // Mỗi blank trong khối cần 1 field tương ứng để nhập đáp án.
      const have = new Set(s.fields.map((f) => Number(f.id)));
      for (const id of blankIdsFromDoc(nextDoc)) {
        if (!have.has(id)) {
          s.fields.push(emptyField(id));
          have.add(id);
        }
      }
    });
  }

  // Dán nguyên đề do AI soạn + điền luôn đáp án cho từng ô trống. Bản import
  // có bao nhiêu bảng (cách nhau bởi Divider) thì ra bấy nhiêu KHUNG RIÊNG —
  // không nhồi chung vào 1 khung, vì nhồi chung sẽ khiến bảng đầu bị luật
  // "đoạn trước Divider đầu tiên = hướng dẫn" đẩy ra ngoài khung.
  // Khung vừa tạo từ "Add Question" (chưa gõ chữ nào, nhiều nhất 1 ô trống)
  // thì bị thay hẳn; khung đã soạn rồi thì giữ nguyên, khung mới chèn xuống
  // ngay sau nó.
  function importIntoBlock(bi, raw) {
    const { doc: importedDoc, answers } = importNoteText(raw);
    patch((d) => {
      const s = d[si];
      const list = materializeNoteBlocks(s);
      const current =
        list[bi] && list[bi].noteDoc && Array.isArray(list[bi].noteDoc.content) ? list[bi].noteDoc : null;
      const currentIds = current ? blankIdsFromDoc(current) : [];
      const replace = !!current && !docHasProse(current) && currentIds.length <= 1;

      // Số thứ tự đang bị chiếm ở mọi nơi trong section. Khung trống sắp bị
      // thay thì ô trống của nó không tính là đang chiếm.
      const used = new Set([...s.fields.map((f) => Number(f.id)), ...list.flatMap(blockBlankIds)]);
      if (replace) currentIds.forEach((id) => used.delete(id));

      // Bản import luôn đánh số từ [[1]]. Chỉ giữ nguyên số đó khi đang thay
      // khung trống và không đụng ai; còn chèn thêm vào sau bài đã soạn thì
      // phải đánh số NỐI TIẾP, không thì học sinh thấy số nhảy 12, 1, 2.
      const importedIds = blankIdsFromDoc(importedDoc);
      const idMap = new Map();
      if (!replace || importedIds.some((id) => used.has(id))) {
        let next = Math.max(0, ...used) + 1;
        importedIds.forEach((id) => idMap.set(id, next++));
      }
      const addedDoc = idMap.size ? remapBlankIds(importedDoc, idMap) : importedDoc;
      const addedAnswers = {};
      Object.keys(answers).forEach((k) => {
        const old = Number(k);
        addedAnswers[idMap.has(old) ? idMap.get(old) : old] = answers[k];
      });

      // Câu import kế thừa tên dạng bài của khối (vd "Table Completion") để
      // thống kê theo dạng bài không xếp nhầm vào nhóm "Khác".
      const blockFormat = (s.fields.find((f) => currentIds.includes(Number(f.id))) || {}).formatLabel || "";

      const added = importedDocToBlocks(addedDoc);
      if (!added.length) return;
      if (replace) {
        list.splice(bi, 1, ...added);
        // Ô trống của khung trống vừa bị thay -> bỏ luôn dòng đáp án của nó.
        const dropped = new Set(currentIds);
        if (dropped.size) s.fields = s.fields.filter((f) => !dropped.has(Number(f.id)));
      } else {
        list.splice(bi + 1, 0, ...added);
      }
      s.noteMode = true;
      const byId = new Map(s.fields.map((f) => [Number(f.id), f]));
      for (const id of blankIdsFromDoc(addedDoc)) {
        let field = byId.get(id);
        if (!field) {
          field = emptyField(id);
          if (blockFormat) field.formatLabel = blockFormat;
          s.fields.push(field);
          byId.set(id, field);
        }
        if (addedAnswers[id] && addedAnswers[id].length) {
          field.kind = "fill";
          field.answersText = addedAnswers[id].join("\n");
        }
      }
    });
  }

  function removeBlock(bi) {
    patch((d) => {
      const s = d[si];
      const list = materializeNoteBlocks(s);
      const [removed] = list.splice(bi, 1);
      const removedIds = new Set(blockBlankIds(removed));
      s.fields = s.fields.filter((f) => !removedIds.has(Number(f.id)));
      if (!list.length) s.noteMode = false;
    });
  }

  // Cấp id mới cho blank sắp chèn — tránh trùng cả field lẫn blank đang có
  // ở BẤT KỲ khối nào trong section (id phải duy nhất toàn bài).
  function requestBlankId() {
    const fromFields = nextFieldId(allSections);
    const fromBlocks = blocks.flatMap(blockBlankIds);
    return Math.max(fromFields - 1, ...fromBlocks, 0) + 1;
  }

  return (
    <div className="note-blocks-wrap">
      {blocks.map((block, bi) => {
        const doc =
          block.noteDoc && Array.isArray(block.noteDoc.content)
            ? block.noteDoc
            : block.noteText
            ? noteTextToDoc(block.noteText)
            : null;
        const idSet = new Set(blockBlankIds(block));
        const entries = sec.fields.map((f, fi) => ({ f, fi })).filter(({ f }) => idSet.has(Number(f.id)));
        return (
          <div className="note-block-frame" key={bi}>
            <div className="note-block-frame-head">
              <span className="note-block-frame-title">Block {bi + 1}</span>
              <button
                type="button"
                className="icon-btn danger"
                title="Remove this block"
                onClick={() => removeBlock(bi)}
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>
            <RichTextEditor
              variant="note"
              value={doc}
              onChange={(nextDoc) => updateBlock(bi, nextDoc)}
              onRequestBlankId={requestBlankId}
              onImport={(raw) => importIntoBlock(bi, raw)}
              placeholder={
                "Complete the notes below. Choose ONE WORD ONLY from the passage for each answer.\n" +
                "Type the table/note content, then use “+ Blank” wherever an answer goes."
              }
            />
            <span className="note-toolbar-hint">
              Use “+ Blank” above for each numbered answer in this table/note, then fill in the correct
              answer for that number below.
            </span>
            {entries.length > 0 && (
              <>
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
                  {entries.map(({ f, fi }) => (
                    <FieldRow key={fi} f={f} fi={fi} si={si} sec={sec} subject={subject} program={program} media={media} patch={patch} />
                  ))}
                </div>
              </>
            )}
          </div>
        );
      })}
      <span className="note-toolbar-hint">
        To add another separate table/note, use “Add Question” below and pick a Completion format again.
      </span>
    </div>
  );
}

function FieldRow({ f, fi, si, sec, subject, program, media, patch, swap = null, allSections = null }) {
  // Swap: thay câu/nhóm lấy từ ngân hàng bằng mục khác (G4 bước 3)
  const swapBtn = swap && allSections ? (
    <SwapButton swap={swap} sections={allSections} si={si} fi={fi} onApply={(next) => patch((d) => d.splice(0, d.length, ...next))} />
  ) : null;
  const setF = (k, v) => patch((d) => (d[si].fields[fi][k] = v));
  const formats = questionFormatsFor(subject, program);

  function changeKind(kind) {
    patch((d) => {
      const ff = d[si].fields[fi];
      const wasTfng = isFixedChoiceShape(ff.options, ["true", "false", "ng"]);
      const wasYnng = isFixedChoiceShape(ff.options, ["yes", "no", "ng"]);
      ff.kind = kind;
      if (kind === "reorder") {
        ff.matchMode = "sentence";
        if (!Array.isArray(ff.tokens)) ff.tokens = [];
      } else if (kind !== "fill") {
        ff.matchMode = "";
      }
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
      const wasLetter = isLetterEditorField(ff);
      applyFormatBasics(ff, fmt);
      if (fmt.kind === "reorder" && !Array.isArray(ff.tokens)) ff.tokens = [];
      if (fmt.kind === "tfng" && !wasTfng) {
        ff.options = tfngOptions();
        ff.correctOptionIds = [];
      }
      if (fmt.kind === "ynng" && !wasYnng) {
        ff.options = ynngOptions();
        ff.correctOptionIds = [];
      }
      if (fmt.kind === "mcq" && (!ff.options.length || wasTfng || wasYnng || wasLetter)) {
        ff.options = [];
        ff.correctOptionIds = [];
      }
      if (fmt.presetOptions && !ff.options.length) {
        ff.options = fmt.presetOptions.map((text) => ({ id: newOptionId(), text }));
        ff.correctOptionIds = [];
      }
      if (fmt.kind === "letter") {
        // Đề trống, lựa chọn A..D tự tạo; giữ đáp án đúng nếu vẫn hợp lệ.
        ff.label = "";
        ff.options = editorLetterOptions(fmt.letterOptions);
        ff.correctOptionIds = ff.correctOptionIds.filter((id) => ff.options.some((o) => o.id === id));
      }

      if (fmt.noteMode) {
        // Câu này đã sẵn là 1 chỗ trống trong 1 khối note (đổi Type qua lại
        // giữa các dạng completion) -> không cần tạo khối mới, tránh nhân đôi.
        s.noteMode = true;
        const alreadyBlank = materializeNoteBlocks(s).some((b) => blockBlankIds(b).includes(Number(f.id)));
        if (!alreadyBlank) addNoteBlock(s, Number(f.id));
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
  // TOEIC: nhiều Part chung 1 cơ chế (mcq) nên KHÔNG đoán theo cơ chế — câu chưa có
  // formatLabel hiện ô "Choose a Part" thay vì nhận bừa Part 3.
  const progConf = PROGRAMS[programOf({ program })] || PROGRAMS.ielts;
  const currentFormatKey = formats
    ? ((formats.find((x) => x.label === f.formatLabel) ||
        (progConf.legacyFormatGuess ? formats.find((x) => x.kind === f.kind) : null)) || {}).key || ""
    : "";
  const currentFormat = formats ? formats.find((x) => x.key === currentFormatKey) : null;
  const underlineMode = (currentFormat && currentFormat.underline) || underlineModeOf(f.formatLabel);

  // Câu "Listen and choose — no printed question": chỉ còn số câu + đáp án đúng A/B/C(/D)
  // (+ ảnh của câu cho Part 1). Không có ô đề, không có ô nhập lựa chọn.
  if (isLetterEditorField(f)) {
    const fmt = formats ? formats.find((x) => x.label === f.formatLabel) : null;
    const wantsImage = !!(fmt && fmt.needsFieldImage);
    return (
      <div className={"question-row letter-row" + (f.aiFlag ? " flagged" : "")}>
        {swapBtn}
        {f.aiFlag && (
          <div className="question-flag-bar">
            <span className="flag-reason">⚠ {f.aiFlag}</span>
            <button
              type="button"
              onClick={() =>
                patch((d) => {
                  delete d[si].fields[fi].aiFlag;
                })
              }
            >
              Mark as checked
            </button>
          </div>
        )}
        <div className="letter-row-main">
          <input
            type="text"
            className="f-id letter-row-num"
            title="Question No."
            aria-label="Question number"
            value={String(f.id)}
            onChange={(e) => setF("id", e.target.value)}
          />
          <span className="letter-row-label">Correct answer:</span>
          <div className="letter-row-choices" role="radiogroup" aria-label={"Correct answer for question " + f.id}>
            {f.options.map((o) => (
              <label key={o.id} className={"letter-row-choice" + (f.correctOptionIds[0] === o.id ? " on" : "")}>
                <input
                  type="radio"
                  name={"letter-" + si + "-" + fi}
                  checked={f.correctOptionIds[0] === o.id}
                  onChange={() => patch((d) => (d[si].fields[fi].correctOptionIds = [o.id]))}
                />
                {o.text}
              </label>
            ))}
          </div>
          <select
            className="letter-row-count"
            title="Number of choices"
            aria-label="Number of choices"
            value={f.options.length}
            onChange={(e) =>
              patch((d) => {
                const ff = d[si].fields[fi];
                ff.options = editorLetterOptions(Number(e.target.value));
                ff.correctOptionIds = ff.correctOptionIds.filter((id) => ff.options.some((o) => o.id === id));
              })
            }
          >
            {[3, 4].map((n) => (
              <option key={n} value={n}>
                {LETTERS.slice(0, n).join("/")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="icon-btn danger f-remove"
            title="Delete question"
            onClick={() => patch((d) => removeField(d[si], fi))}
          >
            <svg className="icon"><use href="#icon-trash" /></svg>
          </button>
        </div>
        {(wantsImage || f.imageId) && (
          <FieldImagePicker f={f} fi={fi} si={si} media={media} patch={patch} defaultOpen={wantsImage || !!f.imageId} />
        )}
        <div className="question-hint-row">
          <input
            type="text"
            className="f-explanation"
            placeholder="Explanation (optional) — shown to students in review"
            value={f.explanation || ""}
            onChange={(e) => setF("explanation", e.target.value)}
          />
        </div>
        {!f.correctOptionIds.length && <div className="kind-hint warn">Pick the correct answer above.</div>}
      </div>
    );
  }

  return (
    <div className={"question-row" + (f.aiFlag ? " flagged" : "")}>
      {swapBtn}
      {f.aiFlag && (
        <div className="question-flag-bar">
          <span className="flag-reason">⚠ {f.aiFlag}</span>
          <button
            type="button"
            onClick={() =>
              patch((d) => {
                delete d[si].fields[fi].aiFlag;
              })
            }
          >
            Mark as checked
          </button>
        </div>
      )}
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
            {progConf.formatPlaceholder != null && !currentFormatKey && (
              <option value="" disabled>{progConf.formatPlaceholder}</option>
            )}
            {formats.map((fmt) => (
              <option key={fmt.key} value={fmt.key}>
                {fmt.label}
              </option>
            ))}
          </select>
        ) : (
          <select className="f-kind" value={f.kind} onChange={(e) => changeKind(e.target.value)}>
            {(f.kind === "reorder" ? QUESTION_KINDS : BASIC_KINDS).map((k) => (
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
          onClick={() => patch((d) => removeField(d[si], fi))}
        >
          <svg className="icon"><use href="#icon-trash" /></svg>
        </button>
      </div>
      {underlineMode === "label" && (
        <div className="question-hint-row" style={{ marginTop: 4, marginBottom: 4 }}>
          <div style={{ fontSize: ".8rem", color: "var(--muted)" }}>
            Wrap underlined text in double underscores: <code>h__ea__d</code>
          </div>
          <UnderlinePreview text={f.label} />
        </div>
      )}
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
      {f.kind === "mcq" && (
        <FieldImagePicker
          f={f}
          fi={fi}
          si={si}
          media={media}
          patch={patch}
          defaultOpen={!!(currentFormat && currentFormat.needsFieldImage) || !!f.imageId}
        />
      )}
      <div className="question-detail">
        <QuestionDetail f={f} fi={fi} si={si} sec={sec} media={media} patch={patch} currentFormat={currentFormat} />
      </div>
    </div>
  );
}

// Ảnh riêng của 1 câu (field.imageId) — vd TOEIC Part 1 (ảnh chụp), Part 3/4 có biểu đồ.
// Luôn có trên câu mcq nhưng thu gọn; mở sẵn khi dạng câu cần ảnh (needsFieldImage) hoặc
// câu đã có ảnh.
function FieldImagePicker({ f, fi, si, media, patch, defaultOpen }) {
  const [open, setOpen] = useState(!!defaultOpen);
  useEffect(() => {
    if (defaultOpen) setOpen(true);
  }, [defaultOpen]);
  const img = f.imageId ? media.images.find((im) => im._id === f.imageId) : null;
  return (
    <div className="field-image-picker">
      <button type="button" className="field-image-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg className="icon"><use href={"#icon-" + (open ? "chevron-down" : "chevron-right")} /></svg>
        Question image{f.imageId ? " · attached" : " (optional)"}
      </button>
      {open && (
        <div className="field-image-body">
          <select
            className="select-inline field-image-select"
            style={{ width: "100%" }}
            value={f.imageId || ""}
            onChange={(e) => patch((d) => (d[si].fields[fi].imageId = e.target.value))}
          >
            <option value="">— No question image —</option>
            {media.images.map((im) => (
              <option key={im._id} value={im._id}>
                {(im.unit ? im.unit + " · " : "") + im.title}
              </option>
            ))}
          </select>
          {media.loaded && media.images.length === 0 && (
            <p className="field-image-hint">No images yet — upload one in the Media library first.</p>
          )}
          {img && <img src={img.cloudinaryUrl} alt="" className="field-image-thumb" />}
        </div>
      )}
    </div>
  );
}

function QuestionDetail({ f, fi, si, sec, media, patch, currentFormat }) {
  const setF = (k, v) => patch((d) => (d[si].fields[fi][k] = v));
  const [errorLettersErr, setErrorLettersErr] = useState(null);
  const [orderInput, setOrderInput] = useState("");
  const [arrangeErr, setArrangeErr] = useState(null);

  if (f.kind === "reorder") {
    const tokens = Array.isArray(f.tokens) ? f.tokens : [];
    return (
      <div className="reorder-builder">
        <div className="f-group" style={{ marginBottom: 10 }}>
          <label>Correct sentence(s) — one per line (each line is an accepted answer)</label>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", flexWrap: "wrap" }}>
            <textarea
              className="f-answers"
              rows={2}
              placeholder={"She / always / gets up / early.\nShe always gets up early."}
              style={{ flex: 1, minWidth: 260 }}
              value={f.answersText || ""}
              onChange={(e) => setF("answersText", e.target.value)}
            />
            <button
              type="button"
              className="btn secondary"
              style={{ whiteSpace: "nowrap", padding: "8px 12px", fontSize: ".85rem" }}
              title="Split first sentence into pieces and shuffle"
              onClick={() => {
                const first = String(f.answersText || "").split("\n").map((s) => s.trim()).filter(Boolean)[0] || "";
                if (!first) return;
                const pieces = splitTokens(first);
                const shuffled = shuffleTokens(pieces);
                patch((d) => {
                  const ff = d[si].fields[fi];
                  ff.tokens = shuffled;
                  ff.matchMode = "sentence";
                });
              }}
            >
              <svg className="icon"><use href="#icon-sparkles" /></svg> Split into pieces
            </button>
          </div>
        </div>

        <div className="f-group">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, flexWrap: "wrap", gap: 6 }}>
            <label style={{ margin: 0 }}>Pieces for students to arrange ({tokens.length}) — stored in scrambled order</label>
            {tokens.length > 1 && (
              <button
                type="button"
                className="btn secondary sm"
                style={{ fontSize: ".78rem", padding: "3px 8px" }}
                onClick={() => {
                  const shuffled = shuffleTokens(tokens);
                  patch((d) => (d[si].fields[fi].tokens = shuffled));
                }}
              >
                Shuffle again
              </button>
            )}
          </div>

          {tokens.length === 0 ? (
            <div className="kind-hint warn">
              No pieces yet. Enter the correct sentence above and click &quot;Split into pieces&quot;, or add pieces manually.
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {tokens.map((token, ti) => (
                <div
                  key={ti}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: 6,
                    padding: "3px 6px",
                  }}
                >
                  <input
                    type="text"
                    style={{
                      width: Math.max(50, Math.min(220, (token.length + 2) * 9)) + "px",
                      border: "none",
                      background: "transparent",
                      padding: "2px 4px",
                      fontSize: ".88rem",
                      fontFamily: "inherit",
                    }}
                    value={token}
                    onChange={(e) =>
                      patch((d) => {
                        d[si].fields[fi].tokens[ti] = e.target.value;
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-btn danger"
                    style={{ width: 20, height: 20, padding: 0 }}
                    title="Delete piece"
                    onClick={() =>
                      patch((d) => {
                        d[si].fields[fi].tokens.splice(ti, 1);
                      })
                    }
                  >
                    <svg className="icon" style={{ width: 12, height: 12 }}><use href="#icon-cross" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="option-add-btn"
            onClick={() => patch((d) => d[si].fields[fi].tokens.push(""))}
          >
            <svg className="icon"><use href="#icon-plus" /></svg> Add piece
          </button>
        </div>
      </div>
    );
  }

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
    const underlineMode = (currentFormat && currentFormat.underline) || underlineModeOf(f.formatLabel);
    const isErrorLetters = !!(currentFormat && currentFormat.errorLetters) || isErrorIdFormat(f.formatLabel);
    const isArrange = !!(currentFormat && currentFormat.arrange) || f.formatLabel === GENERAL_LABELS.arrange;

    return (
      <>
        {isArrange && (
          <div style={{ background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 6, padding: "8px 10px", marginBottom: 10 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label style={{ fontSize: ".84rem", fontWeight: 600, margin: 0 }}>Correct order:</label>
              <input
                type="text"
                placeholder="e.g. b-d-a-c-e"
                style={{ width: 140, padding: "4px 8px", fontSize: ".85rem" }}
                value={orderInput}
                onChange={(e) => setOrderInput(e.target.value)}
              />
              <button
                type="button"
                className="btn secondary sm"
                onClick={() => {
                  const res = arrangeOptions(orderInput);
                  if (res.options.length < 4) {
                    setArrangeErr("Enter at least 3 letters so there are 4 different orders (e.g. b-d-a-c-e).");
                    return;
                  }
                  setArrangeErr(null);
                  const newOpts = res.options.map((optText) => ({ id: newOptionId(), text: optText }));
                  const correctOpt = newOpts[res.correctIndex];
                  patch((d) => {
                    const ff = d[si].fields[fi];
                    ff.options = newOpts;
                    ff.correctOptionIds = correctOpt ? [correctOpt.id] : [];
                  });
                }}
              >
                <svg className="icon"><use href="#icon-sparkles" /></svg> Generate options
              </button>
            </div>
            {arrangeErr && (
              <p className="notice error" style={{ marginTop: 6, padding: "4px 8px", fontSize: ".8rem" }}>
                {arrangeErr}
              </p>
            )}
          </div>
        )}

        {isErrorLetters && (
          <div style={{ marginBottom: 10 }}>
            <button
              type="button"
              className="btn secondary sm"
              onClick={() => {
                try {
                  const letters = optionLettersFromUnderlines(f.label || "");
                  setErrorLettersErr(null);
                  patch((d) => {
                    const ff = d[si].fields[fi];
                    ff.options = letters.map((l) => ({ id: newOptionId(), text: l }));
                    ff.correctOptionIds = [];
                  });
                } catch (err) {
                  setErrorLettersErr(err.message);
                }
              }}
            >
              <svg className="icon"><use href="#icon-sparkles" /></svg> Build options from underlines
            </button>
            {errorLettersErr && (
              <p className="notice error" style={{ marginTop: 6, padding: "6px 10px", fontSize: ".82rem" }}>
                {errorLettersErr}
              </p>
            )}
          </div>
        )}

        <div className="question-detail-inner">
          {(f.options || []).map((o, oi) => (
            <div key={oi} className={underlineMode === "options" ? "option-item" : "option-row"}>
              {underlineMode === "options" ? (
                <>
                  <div className="option-row" style={{ marginBottom: 4 }}>
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
                  <div style={{ marginLeft: 30, marginBottom: 8 }}>
                    <div style={{ fontSize: ".76rem", color: "var(--muted)" }}>
                      Wrap underlined text in double underscores: <code>h__ea__d</code>
                    </div>
                    <UnderlinePreview text={o.text} />
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
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
