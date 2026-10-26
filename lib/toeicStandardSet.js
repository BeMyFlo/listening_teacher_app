// Soạn đề TOEIC S&W (Phase 8B bước 4) — phần thuần (CommonJS, client-safe, không DB):
// bộ đề chuẩn, mặc định khi chọn dạng đề, và kiểm field thiếu ở phía giáo viên.
// Xem docs/plans/multi-tenant/PLAN-PHASE8B-TOEIC-SW.md mục 4.
const { toeicTask } = require("./toeicTasks");

// Cấu trúc đề thật: [taskType, số câu].
const STANDARD_LAYOUT = {
  writing: [["toeic.w.picture", 5], ["toeic.w.email", 2], ["toeic.w.essay", 1]],
  speaking: [["toeic.s.read", 2], ["toeic.s.picture", 2], ["toeic.s.respond", 3], ["toeic.s.info", 3], ["toeic.s.opinion", 1]],
};

// Câu cuối của nhóm respond / info được nói 30s (15/15/30); câu 10 phát audio 2 lần.
const LAST_OF_GROUP_SECONDS = { "toeic.s.respond": 30, "toeic.s.info": 30 };

const sec = (n) => String(n);

// Mặc định điền vào prompt khi chọn dạng đề. Giây giữ dạng chuỗi như các ô nhập.
// Chỉ ghi đè ô đang trống hoặc đang đúng bằng mặc định của dạng đề CŨ (giá trị giáo viên
// đã sửa thì giữ nguyên). Trả về object field cần gán (không đụng title/instructions/ảnh).
function taskDefaults(prompt, newType) {
  const task = toeicTask(newType);
  if (!task) return { taskType: "" };
  const old = toeicTask(prompt && prompt.taskType);
  const stale = (cur, oldDefault) => cur == null || String(cur) === "" || (old && String(cur) === String(oldDefault));
  const out = { taskType: newType };
  if (stale(prompt && prompt.prepSeconds, old && old.prepSeconds)) out.prepSeconds = sec(task.prepSeconds);
  if (stale(prompt && prompt.responseSeconds, old && old.responseSeconds)) out.responseSeconds = sec(task.responseSeconds);
  if (!task.needsAudio) {
    out.audioId = "";
    out.audioPlays = 1;
  }
  const words = (prompt && prompt.requiredWords) || [];
  out.requiredWords = task.needsRequiredWords ? [words[0] || "", words[1] || ""] : [];
  return out;
}

// Prompt rỗng đúng taskType + thời gian mặc định, shape khớp editor (testToBuilder).
function blankToeicPrompt(taskType, title) {
  return {
    title: title || "",
    instructions: "",
    imageId: "",
    writingTask: "task2",
    audioId: "",
    audioPlays: 1,
    ...taskDefaults({}, taskType),
  };
}

// Bộ đề chuẩn của 1 kỹ năng ("writing" 8 đề, "speaking" 11 đề); kỹ năng khác -> [].
function standardSet(skill) {
  const layout = STANDARD_LAYOUT[skill];
  if (!layout) return [];
  const out = [];
  layout.forEach(([type, count]) => {
    for (let i = 0; i < count; i++) {
      const p = blankToeicPrompt(type, "Question " + (out.length + 1));
      if (i === count - 1 && LAST_OF_GROUP_SECONDS[type]) p.responseSeconds = sec(LAST_OF_GROUP_SECONDS[type]);
      // Câu 10 (info cuối) nghe câu hỏi 2 lần.
      if (type === "toeic.s.info" && i === count - 1) p.audioPlays = 2;
      out.push(p);
    }
  });
  return out;
}

// Field bắt buộc còn thiếu của 1 prompt TOEIC (phía client, khớp luật server mục 2.3).
// Trả mảng thông điệp ngắn; rỗng = đủ.
function promptCues(p, skill) {
  const cues = [];
  const task = toeicTask(p && p.taskType);
  if (!task || task.skill !== skill) {
    cues.push("choose a task type");
    return cues;
  }
  if (!String(p.title || "").trim()) cues.push("add a title");
  if (!String(p.instructions || "").trim()) cues.push("add instructions");
  if (task.needsImage && !p.imageId) cues.push("select an image");
  if (task.needsRequiredWords) {
    const n = (p.requiredWords || []).filter((w) => String(w || "").trim()).length;
    if (n !== 2) cues.push("enter 2 required words");
  }
  return cues;
}

// Lỗi đầu tiên của danh sách prompt, dạng "Writing: Prompt 3: choose a task type." hoặc null.
function toeicPromptsError(prompts, skill) {
  const label = skill === "speaking" ? "Speaking" : "Writing";
  for (let i = 0; i < (prompts || []).length; i++) {
    const cues = promptCues(prompts[i], skill);
    if (cues.length) return `${label}: Prompt ${i + 1}: ${cues.join(", ")}.`;
  }
  return null;
}

module.exports = { STANDARD_LAYOUT, taskDefaults, blankToeicPrompt, standardSet, promptCues, toeicPromptsError };
