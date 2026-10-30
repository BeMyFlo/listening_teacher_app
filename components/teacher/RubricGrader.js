"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getRubric, resolveVariant, overallBand, overallScore, isToeicVariant, isGeneralVariant, scoreRange, taskScore } from "@/lib/grading/rubric";
import { GENERAL_ANCHORS, generalScoreError, descriptorLevel } from "@/lib/grading/generalUi";
import { resumeAiGrade } from "@/lib/client/aiGrade";
import { useDialog } from "@/components/ui/Dialog";
import EssayAnnotator from "./EssayAnnotator";
import SpeakingReview from "./SpeakingReview";
import SuggestedActionsEditor from "./SuggestedActionsEditor";

const BANDS = [9, 8, 7, 6, 5, 4, 3, 2, 1];

// Chấm 1 bài Writing/Speaking theo rubric IELTS: band từng tiêu chí -> điểm
// tổng tự tính. General (thang 10): 1 ô số 0–2.5 (bước 0.25) mỗi tiêu chí, tổng = cộng 4 tiêu chí, không ghi đè. Dùng chung cho màn chấm Lesson và Mock Test.
//
// props:
//   submission : { kind, rubricVariant?, writingTask?, criteria?, manualScore?, manualFeedback?, essayText?, annotations? }
//   busy       : bool
//   onSave({ criteria, rubricVariant, manualScore, manualFeedback, annotations, gradeSource })
//   onAiGrade  : optional () => Promise<draft>  (Gemini) — nạp band + annotation + feedback vào form
export default function RubricGrader({ submission, busy, onSave, onAiGrade }) {
  const dialog = useDialog();
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
  const [mainIssue, setMainIssue] = useState(submission.mainIssue || "");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState("");
  const stopRef = useRef(false);

  const initialVariant =
    submission.rubricVariant ||
    resolveVariant(submission.kind, submission.writingTask, submission.program) ||
    (isWriting ? "writing.task2" : "speaking");

  const [variant, setVariant] = useState(initialVariant);
  const rubric = getRubric(variant);
  // TOEIC: 1 criterion "score" 0..max, không có Task 1/Task 2, không override.
  const toeic = isToeicVariant(variant);
  // General: rubric thang 10 (ô số từng tiêu chí, tổng tự cộng, không Task 1/2, không override).
  const general = isGeneralVariant(variant);
  const levels = toeic
    ? Array.from({ length: scoreRange(variant).max + 1 }, (_, i) => scoreRange(variant).max - i)
    : BANDS;

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
  const auto = general ? overallScore(variant, criteriaArr) : toeic ? taskScore(variant, filled) : overallBand(filled);
  const rawMean = filled.length ? filled.reduce((a, c) => a + c.band, 0) / filled.length : null;
  const allFilled = criteriaArr.every((c) => c.band != null);
  const finalBand = !toeic && !general && override && overrideVal !== "" ? Number(overrideVal) : auto;

  // publish=true -> xuất bản (học sinh thấy); publish=false -> lưu nháp.
  function save(publish) {
    if (publish) {
      if (!allFilled) {
        setErr(toeic ? "Please choose a score." : general ? "Please enter a score for every criterion." : "Please choose a band for every criterion.");
        return;
      }
      if (general && (criteriaArr.some((c) => generalScoreError(c.band)) || auto == null)) {
        setErr("Fix the criterion scores marked in red.");
        return;
      }
      if (!feedback.trim()) {
        setErr("Please write overall feedback for the student.");
        return;
      }
    }
    if (general && criteriaArr.some((c) => generalScoreError(c.band))) {
      setErr("Fix the criterion scores marked in red.");
      return;
    }
    setErr("");
    onSave({
      publish,
      criteria: criteriaArr,
      rubricVariant: variant,
      manualScore: finalBand, // General: đúng tổng 4 tiêu chí (server đối chiếu), null khi nháp chưa đủ
      manualFeedback: feedback.trim(),
      // Giáo viên bấm Save = đã duyệt: nâng "ai" (bản nháp AI) thành "ai-reviewed".
      gradeSource: gradeSource === "ai" ? "ai-reviewed" : gradeSource,
      priorities,
      topicVocabulary,
      improvedSample: improvedSample.trim(),
      ...(isSpeaking ? { mainIssue: mainIssue.trim() } : {}),
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
    if (typeof draft.mainIssue === "string" && draft.mainIssue) setMainIssue(draft.mainIssue);
    setGradeSource("ai-reviewed");
    setAiNote(
      `AI draft loaded${draft.model ? ` (${draft.model})` : ""} — review every ${general ? "score" : "band"} and note, edit as needed, then Save draft or Publish.` +
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
      // Lỗi inline nằm cuối form nên dễ bị bỏ sót (vd demo workspace bị tắt AI) -> báo toast.
      dialog.toast(e.message || "AI grading failed", "error", 5000);
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
          variant={variant}
          onChange={setAnnotations}
          onAiGrade={onAiGrade ? runAi : undefined}
          aiBusy={aiBusy}
        />
      )}
      {isSpeaking && (
        <SpeakingReview
          variant={variant}
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

      {isWriting && !toeic && !general && (
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
        const gErr = general ? generalScoreError(chosen) : "";
        const gLevel = general ? descriptorLevel(chosen) : null;
        const desc = general ? (gLevel != null ? c.bands[String(gLevel)] : null) : chosen !== "" ? c.bands[String(chosen)] : null;
        return (
          <div className="rubric-crit" key={c.key}>
            <div className="rubric-crit-head">
              <span className="rubric-crit-name">
                {c.label}{!toeic && <> <span className="rubric-crit-key">({c.key})</span></>}
              </span>
              {general ? (
                <span className="rubric-gscore">
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    max={scoreRange(variant).max}
                    step="0.25"
                    aria-label={`${c.label} score`}
                    aria-invalid={gErr ? "true" : undefined}
                    style={{ width: 84, ...(gErr ? { borderColor: "var(--red)" } : null) }}
                    value={chosen}
                    onChange={(e) => setBands((b) => ({ ...b, [c.key]: e.target.value }))}
                  />{" "}
                  <small>/ {scoreRange(variant).max}</small>
                </span>
              ) : (
              <select
                value={chosen}
                onChange={(e) => setBands((b) => ({ ...b, [c.key]: e.target.value }))}
              >
                <option value="">{toeic ? "— score —" : "— band —"}</option>
                {levels.map((b) => (
                  <option key={b} value={b}>
                    {toeic ? `${b} / ${scoreRange(variant).max}` : `Band ${b}`}
                  </option>
                ))}
              </select>
              )}
              <button
                type="button"
                className="rubric-showbands"
                onClick={() => setExpanded((x) => ({ ...x, [c.key]: !x[c.key] }))}
              >
                {expanded[c.key] ? (toeic || general ? "Hide scores" : "Hide bands") : (toeic || general ? "All scores" : "All bands")}
              </button>
            </div>

            {gErr && <p className="notice error" style={{ margin: "4px 0" }}>{gErr}</p>}
            {desc && (
              <div className="rubric-crit-desc">
                {general && <p><b>Like {gLevel} / {scoreRange(variant).max}:</b></p>}
                <p>{desc.en}</p>
                {desc.vi && <p className="vi">{desc.vi}</p>}
              </div>
            )}

            {expanded[c.key] && (
              <table className="rubric-bandtable">
                <tbody>
                  {(general ? GENERAL_ANCHORS : levels).map((b) => (
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
              placeholder={toeic ? "Note (optional)" : `Note on ${c.key} (optional)`}
              value={notes[c.key]}
              onChange={(e) => setNotes((n) => ({ ...n, [c.key]: e.target.value }))}
            />
          </div>
        );
      })}

      <div className="rubric-overall">
        <div>
          <span className="rubric-overall-label">{toeic || general ? "Score" : "Overall band"}</span>
          <span className="rubric-overall-value">{finalBand != null ? (general ? `${finalBand} / 10` : toeic ? `${finalBand}/${scoreRange(variant).max}` : finalBand) : "—"}</span>
          {general && (
            <span className="rubric-overall-auto">
              total of {criteriaArr.length} criteria{allFilled ? "" : ` (${filled.length}/${criteriaArr.length} scored)`}
            </span>
          )}
          {!toeic && !general && rawMean != null && !override && (
            <span className="rubric-overall-auto">
              auto · mean {rawMean.toFixed(2)}
              {allFilled ? "" : ` (${filled.length}/${criteriaArr.length} criteria)`}
            </span>
          )}
        </div>
        {!toeic && !general && <label className="rubric-override">
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
        </label>}
        {!toeic && !general && override && (
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
        mainIssue={isSpeaking ? mainIssue : undefined}
        onMainIssueChange={isSpeaking ? setMainIssue : undefined}
      />

      {err && <p className="notice error" style={{ marginTop: 8 }}>{err}</p>}

      <p className="notice info" style={{ marginTop: 10, marginBottom: 6 }}>
        {submission.gradingStatus === "graded"
          ? "This grade is live for the student. Saving a draft will hide it until you publish again."
          : "Draft — the student sees nothing yet. Click “Publish” when you want them to see the result."}
      </p>
      <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
        <button type="button" className="btn secondary" disabled={busy} onClick={() => save(false)}>
          {busy ? "Saving..." : "Save draft"}
        </button>
        <button type="button" className="btn" disabled={busy} onClick={() => save(true)}>
          {busy ? "Saving..." : submission.gradingStatus === "graded" ? "Update & keep visible" : "Publish to student"}
        </button>
      </div>
    </div>
  );
}
