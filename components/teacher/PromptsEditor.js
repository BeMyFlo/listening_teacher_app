"use client";

// Trình soạn "prompts" (Writing/Speaking) — markup khớp renderPromptsEditor.
// skill: "writing" | "speaking" — Writing hiện thêm ô chọn Task 1 / Task 2
// (quyết định rubric chấm điểm).
// program === "toeic" (Phase 8B): thay Task 1/2 bằng ô chọn dạng đề TOEIC + các field theo
// registry (ảnh, 2 từ bắt buộc, audio, giờ chuẩn bị/nói). IELTS giữ nguyên từng chữ.
// standardSet: (chỉ Mock Test) hiện nút "Add standard TOEIC set" khi kỹ năng chưa có đề.
import { useDialog } from "@/components/ui/Dialog";
import { ASPECT_LABELS, toeicTask, tasksForSkill } from "@/lib/toeicTasks";
import { PROGRAMS, isProgram } from "@/lib/curriculum";
import { taskDefaults, blankToeicPrompt, standardSet, promptCues } from "@/lib/toeicStandardSet";

const fmtSec = (n) => (n >= 60 && n % 60 === 0 ? n / 60 + " min" : n + "s");

export default function PromptsEditor({ prompts, media, onChange, skill, program, standardSet: allowSet }) {
  const dialog = useDialog();
  const isWriting = skill === "writing";
  const toeic = program === "toeic"; // G5: general.writing
  // Chương trình có rubric riêng theo kỹ năng (General) không dùng Task 1/Task 2 của IELTS: đọc registry.
  const ownRubric = isProgram(program) && !!PROGRAMS[program].rubricVariants;

  function patch(mut) {
    const draft = structuredClone(prompts);
    mut(draft);
    onChange(draft);
  }

  // Chọn dạng đề: điền sẵn mặc định (không đè giá trị đã sửa) + gợi ý tiêu đề nếu đang trống.
  function chooseTask(i, key) {
    patch((d) => {
      Object.assign(d[i], taskDefaults(d[i], key));
      if (key && !String(d[i].title || "").trim()) d[i].title = "Question " + (i + 1);
    });
  }

  return (
    <>
      {prompts.map((p, i) => {
        const task = toeic ? toeicTask(p.taskType) : null;
        const cues = toeic ? promptCues(p, skill) : [];
        return (
          <div className="builder-section" key={i}>
            <div className="builder-section-head">
              <input
                type="text"
                className="p-title"
                placeholder={ownRubric ? "Prompt Title (e.g. Question 1)" : "Prompt Title (e.g. Task 1)"}
                style={{ flex: 1 }}
                value={p.title}
                onChange={(e) => patch((d) => (d[i].title = e.target.value))}
              />
              <button
                type="button"
                className="icon-btn danger"
                title="Delete prompt"
                onClick={async () => {
                  if (await dialog.confirmDelete("Delete this prompt?")) patch((d) => d.splice(i, 1));
                }}
              >
                <svg className="icon"><use href="#icon-trash" /></svg>
              </button>
            </div>
            {toeic && (
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label>Task type (required)</label>
                <select
                  className="select-inline p-task-type"
                  style={{ width: "100%" }}
                  value={task ? task.key : ""}
                  onChange={(e) => chooseTask(i, e.target.value)}
                >
                  <option value="">— Choose a task type —</option>
                  {tasksForSkill(skill).map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
                {task && (
                  <p className="program-hint">
                    {task.prepSeconds > 0 ? `Prep ${fmtSec(task.prepSeconds)} · ` : ""}
                    {skill === "speaking" ? "Speak" : "Write"} {fmtSec(task.responseSeconds)} · scored 0–{task.maxScore}
                    {task.wordTarget ? ` · about ${task.wordTarget} words` : ""}
                    {" · AI notes: " + task.aspects.map((a) => ASPECT_LABELS[a]).join(", ")}
                  </p>
                )}
                {cues.length > 0 && (
                  <p className="program-hint p-cues" style={{ color: "var(--red)" }}>
                    Still needed: {cues.join(", ")}.
                  </p>
                )}
              </div>
            )}
            {isWriting && !toeic && !ownRubric && (
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label>Task type (grading rubric)</label>
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    ["task1", "Task 1 — chart / process / letter"],
                    ["task2", "Task 2 — essay"],
                  ].map(([v, label]) => (
                    <label key={v} style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400 }}>
                      <input
                        type="radio"
                        name={"writingTask-" + i}
                        checked={(p.writingTask || "task2") === v}
                        onChange={() => patch((d) => (d[i].writingTask = v))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}
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
            <div className="form-row" style={{ marginBottom: toeic ? 10 : 0 }}>
              <label>
                {toeic ? (task && task.needsImage ? "Image (required)" : "Image (optional)") : "Image Illustration (optional)"}
              </label>
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
            {task && task.needsRequiredWords && (
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label>Required words (exactly 2)</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {[0, 1].map((wi) => (
                    <input
                      key={wi}
                      type="text"
                      className="p-required-word"
                      style={{ flex: 1 }}
                      placeholder={"Word " + (wi + 1)}
                      value={(p.requiredWords || [])[wi] || ""}
                      onChange={(e) =>
                        patch((d) => {
                          const w = (d[i].requiredWords || []).slice(0, 2);
                          while (w.length < 2) w.push("");
                          w[wi] = e.target.value;
                          d[i].requiredWords = w;
                        })
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {task && task.needsAudio && (
              <div className="form-row" style={{ marginBottom: 10 }}>
                <label>Question audio (optional — without it students see the text only)</label>
                <select
                  className="select-inline section-audio-select"
                  style={{ width: "100%" }}
                  value={p.audioId || ""}
                  onChange={(e) => patch((d) => (d[i].audioId = e.target.value))}
                >
                  <option value="">— No audio —</option>
                  {media.audio.map((a) => (
                    <option key={a._id} value={a._id}>
                      {(a.unit ? a.unit + " · " : "") + a.title}
                    </option>
                  ))}
                </select>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 400, marginTop: 8 }}>
                  <input
                    type="checkbox"
                    className="p-audio-twice"
                    checked={Number(p.audioPlays) === 2}
                    onChange={(e) => patch((d) => (d[i].audioPlays = e.target.checked ? 2 : 1))}
                  />
                  Play twice
                </label>
              </div>
            )}
            {task && (
              <div className="form-row" style={{ marginBottom: 0 }}>
                <label>Timing in seconds (blank = default)</label>
                <div style={{ display: "flex", gap: 10 }}>
                  {skill === "speaking" && (
                    <input
                      type="number"
                      className="p-prep-seconds"
                      style={{ flex: 1 }}
                      min="0"
                      max="600"
                      step="1"
                      placeholder={"Prep seconds (default " + task.prepSeconds + ")"}
                      value={p.prepSeconds == null ? "" : p.prepSeconds}
                      onChange={(e) => patch((d) => (d[i].prepSeconds = e.target.value))}
                    />
                  )}
                  <input
                    type="number"
                    className="p-response-seconds"
                    style={{ flex: 1 }}
                    min="5"
                    max="3600"
                    step="1"
                    placeholder={(skill === "speaking" ? "Speak" : "Write") + " seconds (default " + task.responseSeconds + ")"}
                    value={p.responseSeconds == null ? "" : p.responseSeconds}
                    onChange={(e) => patch((d) => (d[i].responseSeconds = e.target.value))}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        className="dashed-add-btn"
        style={{ marginTop: 10 }}
        onClick={() =>
          onChange([
            ...prompts,
            toeic
              ? blankToeicPrompt("", "")
              : { title: "", instructions: "", imageId: "", ...(isWriting ? { writingTask: "task2" } : {}) },
          ])
        }
      >
        <svg className="icon"><use href="#icon-plus" /></svg> Add Prompt
      </button>
      {toeic && allowSet && prompts.length === 0 && (
        <button
          type="button"
          className="dashed-add-btn p-standard-set"
          style={{ marginTop: 10 }}
          onClick={() => onChange(standardSet(skill))}
        >
          <svg className="icon"><use href="#icon-plus" /></svg> Add standard TOEIC set ({isWriting ? "8 writing" : "11 speaking"} questions)
        </button>
      )}
    </>
  );
}
