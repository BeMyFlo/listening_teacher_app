"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { useDialog } from "@/components/ui/Dialog";
import { PROGRAMS } from "@/lib/curriculum";
import { programParam, usePrograms } from "@/lib/client/program";
import { GENERAL_LABELS } from "@/lib/generalFormats";
import { GENERAL_TOPICS, DIFFICULTIES, difficultyLabel, topicLabel } from "@/lib/generalTopics";
import ProgramChips from "@/components/teacher/ProgramChips";
import AiQuestionPreview from "@/components/teacher/AiQuestionPreview";
import BankLabelFields from "@/components/teacher/BankLabelFields";
import WordImport from "@/components/teacher/WordImport";

const PAGE_SIZE = 20;
const COLLAPSED_QUESTIONS = 3; // nhóm dài: chỉ hiện vài câu đầu, bấm để xem hết
const FORMAT_OPTIONS = Object.keys(GENERAL_LABELS).map((k) => ({ key: "g-" + k, label: GENERAL_LABELS[k] }));
const EMPTY_LABELS = { level: "", textbook: "", unitLabel: "", topic: "", difficulty: "" };

// Hộp thoại nhỏ dùng chung cho "sửa nhãn 1 mục" và "Set labels" nhiều mục.
function LabelsModal({ title, intro, value, onChange, show, levels, levelText, busy, error, saveText, onSave, onClose }) {
  return (
    <div className="modal-overlay" onClick={(e) => e.target.classList.contains("modal-overlay") && !busy && onClose()}>
      <div className="modal-box" style={{ maxWidth: 520, width: "100%", margin: "0 auto" }}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button type="button" className="icon-btn" disabled={busy} onClick={onClose}>
            <svg className="icon"><use href="#icon-cross" /></svg>
          </button>
        </div>
        <div className="modal-body">
          {intro && <p style={{ color: "var(--muted)", fontSize: ".86rem", marginTop: 0 }}>{intro}</p>}
          <BankLabelFields
            value={value}
            onChange={onChange}
            show={show}
            levels={levels}
            levelText={levelText}
            idPrefix="qb-edit"
            blankLabel={show.keepBlank ? "Leave unchanged" : "Not set"}
          />
          {error && <div className="notice error" style={{ marginTop: 10 }}>{error}</div>}
          <div style={{ marginTop: 14, display: "flex", gap: 10, justifyContent: "flex-end", flexWrap: "wrap" }}>
            <button type="button" className="btn secondary" disabled={busy} onClick={onClose}>Cancel</button>
            <button type="button" className="btn" disabled={busy} onClick={onSave}>{busy ? "Saving…" : saveText}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ItemCard({ item, checked, onCheck, onEdit, onDelete, levelText }) {
  const [open, setOpen] = useState(false);
  const fields = item.fields || [];
  const isGroup = item.kind === "group";
  const shown = open ? fields : fields.slice(0, COLLAPSED_QUESTIONS);
  const pills = [];
  if (item.level != null) pills.push(levelText(item.level));
  if (item.textbook) pills.push(item.textbook);
  if (item.unitLabel) pills.push(item.unitLabel);
  return (
    <div className="test-item" style={{ alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
      <input
        type="checkbox"
        aria-label="Select this item"
        checked={checked}
        onChange={(e) => onCheck(e.target.checked)}
        style={{ marginTop: 5 }}
      />
      <div className="meta" style={{ flex: "1 1 240px", minWidth: 0 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center", marginBottom: 6 }}>
          <span className="pill">{GENERAL_LABELS[String(item.format).replace(/^g-/, "")] || item.format}</span>
          {isGroup ? <span className="pill">Passage group · {item.questionCount} questions</span> : null}
          {item.difficulty ? <span className="pill pill-ok">{difficultyLabel(item.difficulty)}</span> : <span className="pill">No difficulty</span>}
          {item.topic ? <span className="pill">{topicLabel(item.topic)}</span> : <span className="pill">No topic</span>}
          {item.imageId ? <span className="pill">Has image</span> : null}
        </div>
        {pills.length > 0 && <p style={{ margin: "0 0 6px" }}>{pills.join(" · ")}</p>}
        <ol style={{ paddingLeft: 20, margin: 0, overflowWrap: "anywhere" }}>
          {shown.map((f, fi) => (
            <AiQuestionPreview key={fi} f={f} passage={isGroup && fi === 0 ? item.passageText : undefined} />
          ))}
        </ol>
        {fields.length > COLLAPSED_QUESTIONS && (
          <button type="button" className="btn secondary" style={{ padding: "4px 10px", fontSize: ".78rem" }} onClick={() => setOpen((v) => !v)}>
            {open ? "Show fewer" : `Show all ${fields.length} questions`}
          </button>
        )}
      </div>
      <div className="actions">
        <button type="button" className="icon-btn" title="Edit labels" onClick={onEdit}>
          <svg className="icon"><use href="#icon-edit" /></svg>
        </button>
        <button type="button" className="icon-btn danger" title="Delete" onClick={onDelete}>
          <svg className="icon"><use href="#icon-trash" /></svg>
        </button>
      </div>
    </div>
  );
}

function QuestionBankInner() {
  const dialog = useDialog();
  const router = useRouter();
  const search = useSearchParams();
  const { programs, loaded, levelLabel } = usePrograms();

  // Chương trình có ngân hàng (hiện chỉ General). ?program= hợp lệ thắng; còn lại lấy chương trình duy nhất.
  const eligible = useMemo(() => programs.filter((p) => PROGRAMS[p] && PROGRAMS[p].questionBank), [programs]);
  const urlProgram = programParam(search);
  const bankProgram = urlProgram && eligible.includes(urlProgram) ? urlProgram : eligible.length === 1 ? eligible[0] : null;
  const levels = (bankProgram && PROGRAMS[bankProgram].fixedLevels) || [];
  const levelText = useCallback((l) => levelLabel(bankProgram, l), [levelLabel, bankProgram]);

  const [filters, setFilters] = useState({ level: "", format: "", difficulty: "", topic: "", q: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null); // { items, total }
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [editing, setEditing] = useState(null); // { ids: [...], bulk: bool }
  const [labelForm, setLabelForm] = useState(EMPTY_LABELS);
  const [labelBusy, setLabelBusy] = useState(false);
  const [labelErr, setLabelErr] = useState("");
  const [wordOpen, setWordOpen] = useState(false);
  const reqSeq = useRef(0);

  // Chữ gõ (topic, q) chờ 400ms rồi mới gọi API.
  const [debounced, setDebounced] = useState(filters);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(filters), 400);
    return () => clearTimeout(t);
  }, [filters]);
  useEffect(() => setPage(1), [debounced, bankProgram]);

  const load = useCallback(() => {
    if (!bankProgram) return;
    const seq = ++reqSeq.current;
    setLoading(true);
    const params = { program: bankProgram, page, limit: PAGE_SIZE };
    for (const k of ["level", "format", "difficulty", "topic", "q"]) if (debounced[k] && String(debounced[k]).trim()) params[k] = String(debounced[k]).trim();
    api.teacher
      .listQuestionBank(params)
      .then((d) => {
        if (seq !== reqSeq.current) return;
        setData({ items: d.items || [], total: d.total || 0 });
        setErr("");
        setSelected(new Set());
      })
      .catch((e) => seq === reqSeq.current && setErr(e.message))
      .finally(() => seq === reqSeq.current && setLoading(false));
  }, [bankProgram, page, debounced]);
  useEffect(load, [load]);

  const setFilter = (k, v) => setFilters((f) => ({ ...f, [k]: v }));
  const items = (data && data.items) || [];
  const total = (data && data.total) || 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const filtered = Object.values(debounced).some((v) => String(v).trim());
  const allOnPage = items.length > 0 && items.every((it) => selected.has(String(it._id)));

  function toggle(id, on) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function openEdit(item) {
    setLabelForm({
      level: String(item.level ?? ""),
      textbook: item.textbook || "",
      unitLabel: item.unitLabel || "",
      topic: item.topic || "",
      difficulty: item.difficulty || "",
    });
    setLabelErr("");
    setEditing({ ids: [String(item._id)], bulk: false });
  }

  function openBulk() {
    setLabelForm(EMPTY_LABELS);
    setLabelErr("");
    setEditing({ ids: [...selected], bulk: true });
  }

  async function saveLabels() {
    setLabelBusy(true);
    setLabelErr("");
    try {
      if (editing.bulk) {
        // Chỉ gửi ô đã điền; ô trống = giữ nguyên.
        const set = {};
        for (const k of ["topic", "difficulty", "unitLabel", "textbook"]) if (labelForm[k].trim()) set[k] = labelForm[k].trim();
        if (!Object.keys(set).length) {
          setLabelErr("Fill in at least one label to apply.");
          return;
        }
        const r = await api.teacher.setQuestionLabels(editing.ids, set);
        dialog.toast(`Labels set on ${r.updated} item${r.updated === 1 ? "" : "s"}`);
      } else {
        const level = Number(labelForm.level);
        if (!level) {
          setLabelErr("Choose a grade.");
          return;
        }
        await api.teacher.updateQuestionItem(editing.ids[0], {
          level,
          textbook: labelForm.textbook.trim(),
          unitLabel: labelForm.unitLabel.trim(),
          topic: labelForm.topic.trim(),
          difficulty: labelForm.difficulty,
        });
        dialog.toast("Labels saved");
      }
      setEditing(null);
      load();
    } catch (e) {
      setLabelErr(e.message);
    } finally {
      setLabelBusy(false);
    }
  }

  async function remove(ids) {
    const many = ids.length > 1;
    const ok = await dialog.confirm({
      title: many ? "Delete questions" : "Delete question",
      message: many
        ? `Delete ${ids.length} selected items from the question bank? Tests already made from them are not changed. This action cannot be undone.`
        : "Delete this item from the question bank? Tests already made from it are not changed. This action cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.teacher.deleteQuestionItems(ids);
      dialog.toast(many ? "Items deleted" : "Item deleted");
      if (items.length === ids.length && page > 1) setPage(page - 1);
      else load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to delete", message: e.message });
    }
  }

  const head = (
    <div className="page-head">
      <div className="head-left">
        <div className="page-head-icon"><svg className="icon"><use href="#icon-list" /></svg></div>
        <div>
          <h1>Question Bank</h1>
          <p className="page-sub">Reusable questions with grade, unit, topic and difficulty labels</p>
        </div>
      </div>
      {bankProgram && (
        <div className="page-head-actions">
          <button type="button" className="btn" onClick={() => setWordOpen(true)}>
            <svg className="icon"><use href="#icon-upload" /></svg> Import from Word
          </button>
        </div>
      )}
    </div>
  );

  if (!loaded) {
    return <div className="tab-panel active">{head}<div className="notice info">Loading...</div></div>;
  }
  if (!eligible.length) {
    return (
      <div className="tab-panel active">
        {head}
        <div className="card">
          <div className="empty-state">
            The question bank is available for General English workspaces. This workspace does not use General English, so there is nothing to show here.
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn secondary" onClick={() => router.push("/teacher/overview")}>Back to overview</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-panel active">
      {head}
      <ProgramChips />
      {!bankProgram ? (
        <div className="notice info">Choose a program above to see its question bank.</div>
      ) : (
        <div className="card">
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <select className="select-inline" style={{ flex: "1 1 130px", minWidth: 0 }} value={filters.level} onChange={(e) => setFilter("level", e.target.value)}>
              <option value="">All grades</option>
              {levels.map((l) => <option key={l} value={l}>{levelText(l)}</option>)}
            </select>
            <select className="select-inline" style={{ flex: "1 1 160px", minWidth: 0 }} value={filters.format} onChange={(e) => setFilter("format", e.target.value)}>
              <option value="">All question types</option>
              {FORMAT_OPTIONS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
            </select>
            <select className="select-inline" style={{ flex: "1 1 150px", minWidth: 0 }} value={filters.difficulty} onChange={(e) => setFilter("difficulty", e.target.value)}>
              <option value="">All difficulties</option>
              {DIFFICULTIES.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <input
              type="text"
              style={{ flex: "1 1 150px", minWidth: 0 }}
              placeholder="Topic (exact)"
              list="qb-filter-topics"
              value={filters.topic}
              onChange={(e) => setFilter("topic", e.target.value)}
            />
            <TopicList id="qb-filter-topics" />
            <input
              type="search"
              style={{ flex: "2 1 180px", minWidth: 0 }}
              placeholder="Search text, unit, textbook…"
              value={filters.q}
              onChange={(e) => setFilter("q", e.target.value)}
            />
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <label style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: ".86rem" }}>
              <input
                type="checkbox"
                checked={allOnPage}
                onChange={(e) => setSelected(e.target.checked ? new Set(items.map((it) => String(it._id))) : new Set())}
                disabled={!items.length}
              />
              Select page
            </label>
            <span style={{ color: "var(--muted)", fontSize: ".84rem" }}>
              {data ? `${total} item${total === 1 ? "" : "s"}${filtered ? " match" : " in the bank"}` : ""}
              {selected.size > 0 ? ` · ${selected.size} selected` : ""}
            </span>
            {selected.size > 0 && (
              <>
                <button type="button" className="btn secondary" style={{ padding: "5px 12px", fontSize: ".82rem" }} onClick={openBulk}>Set labels</button>
                <button type="button" className="btn secondary" style={{ padding: "5px 12px", fontSize: ".82rem" }} onClick={() => remove([...selected])}>Delete selected</button>
              </>
            )}
          </div>

          {err && <div className="notice error"><svg className="icon"><use href="#icon-warning" /></svg> {err}</div>}
          {!data && !err && <div className="notice info">Loading...</div>}
          {data && items.length === 0 && (
            <div className="empty-state">
              {filtered ? (
                "No questions match these filters."
              ) : (
                <>
                  Your question bank is empty. Add questions in two ways:
                  <ul style={{ textAlign: "left", maxWidth: 460, margin: "8px auto 0" }}>
                    <li>Open a mock test or lesson unit, and use <b>Save to question bank</b> on a section.</li>
                    <li>Click <b>Import from Word</b> above to add a whole test file at once.</li>
                  </ul>
                </>
              )}
            </div>
          )}
          <div style={{ opacity: loading ? 0.6 : 1 }}>
            {items.map((it) => (
              <ItemCard
                key={it._id}
                item={it}
                levelText={levelText}
                checked={selected.has(String(it._id))}
                onCheck={(on) => toggle(String(it._id), on)}
                onEdit={() => openEdit(it)}
                onDelete={() => remove([String(it._id)])}
              />
            ))}
          </div>

          {total > PAGE_SIZE && (
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
              <button type="button" className="btn secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ fontSize: ".86rem" }}>Page {page} of {pages}</span>
              <button type="button" className="btn secondary" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {editing && (
        <LabelsModal
          title={editing.bulk ? `Set labels on ${editing.ids.length} item${editing.ids.length === 1 ? "" : "s"}` : "Edit labels"}
          intro={editing.bulk ? "Only the labels you fill in are changed. Empty ones stay as they are." : null}
          value={labelForm}
          onChange={setLabelForm}
          show={editing.bulk ? { textbook: true, unitLabel: true, topic: true, difficulty: true, keepBlank: true } : { level: true, textbook: true, unitLabel: true, topic: true, difficulty: true }}
          levels={levels}
          levelText={levelText}
          busy={labelBusy}
          error={labelErr}
          saveText={editing.bulk ? "Apply labels" : "Save labels"}
          onSave={saveLabels}
          onClose={() => setEditing(null)}
        />
      )}

      {wordOpen && bankProgram && (
        <WordImport
          target="bank"
          subject="reading"
          program={bankProgram}
          initialLevel={filters.level}
          onSaved={load}
          onClose={() => setWordOpen(false)}
        />
      )}
    </div>
  );
}

// Gợi ý chủ điểm cho ô lọc (datalist riêng của trang).
function TopicList({ id }) {
  return (
    <datalist id={id}>
      {TOPIC_OPTIONS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
    </datalist>
  );
}
const TOPIC_OPTIONS = GENERAL_TOPICS.flatMap((g) => g.topics);

export default function QuestionBankPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <QuestionBankInner />
    </Suspense>
  );
}
