"use client";

import { useMemo, useState } from "react";
import { getRubric, resolveVariant, overallBand } from "@/lib/grading/rubric";

const BANDS = [9, 8, 7, 6, 5, 4, 3, 2, 1];

// Chấm 1 bài Writing/Speaking theo rubric IELTS: band từng tiêu chí -> điểm
// tổng tự tính. Dùng chung cho màn chấm Lesson và Mock Test.
//
// props:
//   submission : { kind, rubricVariant?, writingTask?, criteria?, manualScore?, manualFeedback? }
//   busy       : bool
//   onSave({ criteria, rubricVariant, manualScore, manualFeedback })
export default function RubricGrader({ submission, busy, onSave }) {
  const isWriting = submission.kind === "writing";

  const initialVariant =
    submission.rubricVariant ||
    resolveVariant(submission.kind, submission.writingTask) ||
    (isWriting ? "writing.task2" : "speaking");

  const [variant, setVariant] = useState(initialVariant);
  const rubric = getRubric(variant);

  const seed = useMemo(() => {
    const m = {};
    (submission.criteria || []).forEach((c) => (m[c.key] = c));
    return m;
  }, [submission]);

  const [bands, setBands] = useState(() => {
    const o = {};
    (rubric?.criteria || []).forEach((c) => (o[c.key] = seed[c.key]?.band ?? ""));
    return o;
  });
  const [notes, setNotes] = useState(() => {
    const o = {};
    (rubric?.criteria || []).forEach((c) => (o[c.key] = seed[c.key]?.comment ?? ""));
    return o;
  });
  const [feedback, setFeedback] = useState(submission.manualFeedback || "");
  const [expanded, setExpanded] = useState({});
  const [override, setOverride] = useState(false);
  const [overrideVal, setOverrideVal] = useState(
    submission.manualScore != null ? String(submission.manualScore) : ""
  );
  const [err, setErr] = useState("");

  // Đổi Task 1/Task 2: giữ lại band/note của các tiêu chí trùng key (CC/LR/GRA).
  function switchVariant(next) {
    const nextRubric = getRubric(next);
    setVariant(next);
    setBands((prev) => {
      const o = {};
      nextRubric.criteria.forEach((c) => (o[c.key] = prev[c.key] ?? ""));
      return o;
    });
    setNotes((prev) => {
      const o = {};
      nextRubric.criteria.forEach((c) => (o[c.key] = prev[c.key] ?? ""));
      return o;
    });
  }

  const criteriaArr = (rubric?.criteria || []).map((c) => ({
    key: c.key,
    band: bands[c.key] === "" ? null : Number(bands[c.key]),
    comment: notes[c.key] || "",
  }));
  const filled = criteriaArr.filter((c) => c.band != null);
  const auto = overallBand(filled);
  const rawMean = filled.length ? filled.reduce((a, c) => a + c.band, 0) / filled.length : null;
  const allFilled = criteriaArr.every((c) => c.band != null);
  const finalBand = override && overrideVal !== "" ? Number(overrideVal) : auto;

  function save() {
    if (!allFilled) {
      setErr("Please choose a band for every criterion.");
      return;
    }
    if (!feedback.trim()) {
      setErr("Please write overall feedback for the student.");
      return;
    }
    setErr("");
    onSave({
      criteria: criteriaArr,
      rubricVariant: variant,
      manualScore: finalBand,
      manualFeedback: feedback.trim(),
    });
  }

  if (!rubric) return <p className="notice error">Grading rubric not found.</p>;

  return (
    <div className="rubric-grader">
      {isWriting && (
        <div className="rubric-tasktoggle">
          <span>Rubric:</span>
          {[
            ["writing.task1", "Task 1"],
            ["writing.task2", "Task 2"],
          ].map(([v, label]) => (
            <button
              key={v}
              type="button"
              className={"rubric-pilltab" + (variant === v ? " active" : "")}
              onClick={() => switchVariant(v)}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {rubric.criteria.map((c) => {
        const chosen = bands[c.key];
        const desc = chosen !== "" ? c.bands[String(chosen)] : null;
        return (
          <div className="rubric-crit" key={c.key}>
            <div className="rubric-crit-head">
              <span className="rubric-crit-name">
                {c.label} <span className="rubric-crit-key">({c.key})</span>
              </span>
              <select
                value={chosen}
                onChange={(e) => setBands((b) => ({ ...b, [c.key]: e.target.value }))}
              >
                <option value="">— band —</option>
                {BANDS.map((b) => (
                  <option key={b} value={b}>
                    Band {b}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="rubric-showbands"
                onClick={() => setExpanded((x) => ({ ...x, [c.key]: !x[c.key] }))}
              >
                {expanded[c.key] ? "Hide bands" : "All bands"}
              </button>
            </div>

            {desc && (
              <div className="rubric-crit-desc">
                <p>{desc.en}</p>
                {desc.vi && <p className="vi">{desc.vi}</p>}
              </div>
            )}

            {expanded[c.key] && (
              <table className="rubric-bandtable">
                <tbody>
                  {BANDS.map((b) => (
                    <tr
                      key={b}
                      className={String(b) === String(chosen) ? "active" : ""}
                      onClick={() => setBands((bd) => ({ ...bd, [c.key]: String(b) }))}
                    >
                      <td className="b">{b}</td>
                      <td>
                        {c.bands[String(b)]?.en}
                        {c.bands[String(b)]?.vi && (
                          <span className="vi"> — {c.bands[String(b)].vi}</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <input
              type="text"
              className="rubric-crit-note"
              placeholder={`Note on ${c.key} (optional)`}
              value={notes[c.key]}
              onChange={(e) => setNotes((n) => ({ ...n, [c.key]: e.target.value }))}
            />
          </div>
        );
      })}

      <div className="rubric-overall">
        <div>
          <span className="rubric-overall-label">Overall band</span>
          <span className="rubric-overall-value">{finalBand != null ? finalBand : "—"}</span>
          {rawMean != null && !override && (
            <span className="rubric-overall-auto">
              auto · mean {rawMean.toFixed(2)}
              {allFilled ? "" : ` (${filled.length}/${criteriaArr.length} criteria)`}
            </span>
          )}
        </div>
        <label className="rubric-override">
          <input
            type="checkbox"
            checked={override}
            onChange={(e) => {
              setOverride(e.target.checked);
              if (e.target.checked && overrideVal === "" && auto != null) {
                setOverrideVal(String(auto));
              }
            }}
          />
          Adjust manually
        </label>
        {override && (
          <input
            type="number"
            min="0"
            max="9"
            step="0.5"
            style={{ width: 80 }}
            value={overrideVal}
            onChange={(e) => setOverrideVal(e.target.value)}
          />
        )}
      </div>

      <textarea
        className="rubric-feedback"
        rows={3}
        placeholder="Overall feedback for the student..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />

      {err && <p className="notice error" style={{ marginTop: 8 }}>{err}</p>}

      <button
        type="button"
        className="btn"
        style={{ marginTop: 10 }}
        disabled={busy}
        onClick={save}
      >
        {busy ? "Saving..." : "Save Grade"}
      </button>
    </div>
  );
}
