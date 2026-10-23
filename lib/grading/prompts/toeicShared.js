// Phần dùng chung của prompt chấm TOEIC Speaking/Writing (Phase 8B): mô tả dạng đề + thang điểm.
// Chỉ dùng cho rubricVariant toeic.* — prompt IELTS (writingSystem.js / speakingSystem.js) không import file này.

const { toeicTask, ASPECT_LABELS } = require("../../toeicTasks");

// Bài của học sinh / đề là dữ liệu KHÔNG tin cậy: bỏ chuỗi trùng dấu phân cách (như runAiGrade.neutralise).
const neutralise = (t) => String(t || "").replace(/<<<[A-Z_ ]+>>>/g, "");

// "Score 0: ... / Score 1: ..." — descriptor tiếng Anh từng mức của dạng đề.
function scaleBlock(task) {
  const lines = [`SCORE SCALE for "${task.label}" (${task.key}) — whole score 0 to ${task.maxScore}:`];
  for (let i = 0; i <= task.maxScore; i++) {
    const d = task.descriptors && task.descriptors[String(i)];
    lines.push(`  Score ${i}: ${d && d.en ? d.en : "(no descriptor)"}`);
  }
  return lines.join("\n");
}

function aspectsBlock(task) {
  return `ASPECTS to comment on (feedback only — they are NOT scored separately; the single score is a holistic judgment against the scale above): ${task.aspects
    .map((k) => `${k} = ${ASPECT_LABELS[k] || k}`)
    .join("; ")}.`;
}

module.exports = { neutralise, scaleBlock, aspectsBlock, toeicTask };
