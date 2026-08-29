"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRubric, resolveVariant, overallBand } from "@/lib/grading/rubric";
import { resumeAiGrade } from "@/lib/client/aiGrade";
import EssayAnnotator from "./EssayAnnotator";
import SpeakingReview from "./SpeakingReview";
import SuggestedActionsEditor from "./SuggestedActionsEditor";

const BANDS = [9, 8, 7, 6, 5, 4, 3, 2, 1];

// Chấm 1 bài Writing/Speaking theo rubric IELTS: band từng tiêu chí -> điểm
// tổng tự tính. Dùng chung cho màn chấm Lesson và Mock Test.
//
// props:
//   submission : { kind, rubricVariant?, writingTask?, criteria?, manualScore?, manualFeedback?, essayText?, annotations? }
//   busy       : bool
//   onSave({ criteria, rubricVariant, manualScore, manualFeedback, annotations, gradeSource })
//   onAiGrade  : optional () => Promise<draft>  (Gemini) — nạp band + annotation + feedback vào form
export default function RubricGrader({ submission, busy, onSave, onAiGrade }) {
  const isWriting = submission.kind === "writing";
  const isSpeaking = submission.kind === "speaking";
  const hasEssay = isWriting && !!submission.essayText;

  const [annotations, setAnnotations] = useState(submission.annotations || []);
  const [transcript, setTranscript] = useState(submission.transcript || "");
  const [speakingNotes, setSpeakingNotes] = useState(submission.speakingNotes || []);
  const [gradeSource, setGradeSource] = useState(submission.gradeSource || "teacher");
  const [priorities, setPriorities] = useState(submission.priorities || []);
  const [topicVocabulary, setTopicVocabulary] = useState(submission.topicVocabulary || []);
  const [improvedSample, setImprovedSample] = useState(submission.improvedSample || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const stopRef = useRef(false);

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
      gradeSource,
      priorities,
      topicVocabulary,
      improvedSample: improvedSample.trim(),
      ...(hasEssay || isSpeaking ? { annotations } : {}),
      ...(isSpeaking ? { transcript, speakingNotes } : {}),
    });
  }

  function applyDraft(draft) {
    if (!draft) return;
    if (draft.annotations) setAnnotations(draft.annotations);
    if (typeof draft.transcript === "string") setTranscript(draft.transcript);
    if (Array.isArray(draft.speakingNotes)) setSpeakingNotes(draft.speakingNotes);
    if (Array.isArray(draft.criteria)) {
      setBands((b) => {
        const o = { ...b };
        draft.criteria.forEach((c) => { if (c.band != null) o[c.key] = String(c.band); });
        return o;
      });
      setNotes((n) => {
        const o = { ...n };
        draft.criteria.forEach((c) => { if (c.comment) o[c.key] = c.comment; });
        return o;
      });
    }
    if (draft.overallFeedback) setFeedback(draft.overallFeedback);
    if (Array.isArray(draft.priorities)) setPriorities(draft.priorities);
    if (Array.isArray(draft.topicVocabulary)) setTopicVocabulary(draft.topicVocabulary);
    if (typeof draft.improvedSample === "string" && draft.improvedSample) setImprovedSample(draft.improvedSample);
    setGradeSource("ai-reviewed");
    setAiNote(
      `AI draft loaded${draft.model ? ` (${draft.model})` : ""} — review every band and note, edit as needed, then Save Grade.` +
        (draft.unresolved ? ` (${draft.unresolved} suggestion(s) could not be placed)` : "")
    );
  }

  async function runAi() {
    if (!onAiGrade || aiBusy) return;
    setAiBusy(true);
    setErr("");
    setAiNote("AI is grading… 0s");
    try {
      applyDraft(await onAiGrade((secs) => setAiNote(`AI is grading… ${secs}s`)));
    } catch (e) {
      setErr("AI grading failed: " + e.message);
      setAiNote("");
    } finally {
      setAiBusy(false);
    }
  }

  // Load lại trang giữa lúc AI đang chấm -> tự bắt lại tiến trình.
  useEffect(() => {
    stopRef.current = false;
    if (!onAiGrade || !submission.submissionId) return;
    resumeAiGrade(submission.submissionId, {
      onActive: () => !stopRef.current && setAiBusy(true),
      onTick: (s) => !stopRef.current && setAiNote(`AI is grading… ${s}s`),
      shouldStop: () => stopRef.current,
    })
      .then((draft) => {
        if (!stopRef.current && draft) applyDraft(draft);
      })
      .catch(() => {})
      .finally(() => !stopRef.current && setAiBusy(false));
    return () => {
      stopRef.current = true;
    };
    // eslint-disable-line react-hooks/exhaustive-deps
  }, [submission.submissionId]);

  if (!rubric) return <p className="notice error">Grading rubric not found.</p>;

  return (
    <div className="rubric-grader">
      {hasEssay && (
        <EssayAnnotator
          essayText={submission.essayText}
          annotations={annotations}
          kind={submission.kind}
          onChange={setAnnotations}
          onAiGrade={onAiGrade ? runAi : undefined}
          aiBusy={aiBusy}
        />
      )}
      {isSpeaking && (
        <SpeakingReview
          audioUrl={submission.audioUrl}
          transcript={transcript}
          notes={speakingNotes}
          annotations={annotations}
          onChange={setSpeakingNotes}
          onTranscriptChange={setTranscript}
          onAnnotationsChange={setAnnotations}
          onAiGrade={onAiGrade ? runAi : undefined}
          aiBusy={aiBusy}
        />
      )}
      {aiNote && <p className="notice info" style={{ marginTop: 8 }}>{aiNote}</p>}

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

      <SuggestedActionsEditor
        priorities={priorities}
        onPrioritiesChange={setPriorities}
        topicVocabulary={topicVocabulary}
        onTopicVocabularyChange={setTopicVocabulary}
        improvedSample={improvedSample}
        onImprovedSampleChange={setImprovedSample}
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
