const { toeicTask } = require("./toeicTasks");

// Gom các câu LIỀN NHAU có cùng `formatLabel` thành từng nhóm để Mock Test TOEIC hiện
// tiêu đề "Part N — Name" (plan Phase 8, C9). Thuần dữ liệu, dùng chung client + test.
//
// Trả về [{ label, fields }] giữ nguyên thứ tự gốc. Câu không có formatLabel (rỗng) gom
// vào nhóm có label "" — nơi gọi không vẽ tiêu đề cho nhóm đó. Hai nhóm cùng label nhưng
// bị 1 câu khác label chen giữa vẫn là 2 nhóm (chỉ gom các câu liên tiếp).
function groupFieldsByPart(fields) {
  const groups = [];
  (fields || []).forEach((f) => {
    const label = String((f && f.formatLabel) || "").trim();
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.fields.push(f);
    else groups.push({ label, fields: [f] });
  });
  return groups;
}

// Gom các prompt TOEIC LIỀN NHAU có cùng `taskType` thành nhóm kèm tiêu đề
// "Questions 1–5 · Write a sentence based on a picture" (plan 8B, mục 5.2).
// Prompt không có taskType hợp lệ (vd IELTS) -> label "", nơi gọi không vẽ tiêu đề.
function groupPromptsByTask(prompts) {
  const raw = [];
  (prompts || []).forEach((p, idx) => {
    const task = toeicTask(p && p.taskType);
    const key = task ? task.key : "";
    const last = raw[raw.length - 1];
    if (last && last.key === key) {
      last.prompts.push(p);
      last.end = idx + 1;
    } else {
      raw.push({ key, task, start: idx + 1, end: idx + 1, prompts: [p] });
    }
  });
  return raw.map(({ task, start, end, prompts: list }) => ({
    label: task
      ? `${start === end ? "Question " + start : "Questions " + start + "–" + end} · ${task.label}`
      : "",
    prompts: list,
  }));
}

// "Question 5" | "Questions 1–4" cho một nhóm câu (tính cả idEnd của câu "chọn N"). "" nếu rỗng.
function fieldRangeLabel(fields) {
  const ids = [];
  (fields || []).forEach((f) => {
    const a = Number(f && f.id);
    if (!Number.isFinite(a)) return;
    ids.push(a);
    const b = Number(f.idEnd);
    if (Number.isFinite(b) && b > a) ids.push(b);
  });
  if (!ids.length) return "";
  const lo = Math.min(...ids);
  const hi = Math.max(...ids);
  return lo === hi ? `Question ${lo}` : `Questions ${lo}–${hi}`;
}

// Kết quả theo từng phần: [{ name, range, correct, total, score, maxScore }].
// `detailById` = { [fieldId]: { correct, earned } }; câu không có trong detail = sai (0 điểm).
// Phần không có câu bị bỏ.
function partBreakdown(sections, detailById) {
  const detail = detailById || {};
  const out = [];
  (sections || []).forEach((s, i) => {
    const fields = (s && s.fields) || [];
    if (!fields.length) return;
    let correct = 0;
    let score = 0;
    let maxScore = 0;
    fields.forEach((f) => {
      const d = detail[f.id];
      if (d && d.correct) correct += 1;
      if (d) score += Number(d.earned) || 0;
      maxScore += Math.max(1, Number(f.score) || 1);
    });
    out.push({
      name: String(s.name || "").trim() || `Part ${i + 1}`,
      range: fieldRangeLabel(fields),
      correct,
      total: fields.length,
      score,
      maxScore,
    });
  });
  return out;
}

module.exports = { groupFieldsByPart, groupPromptsByTask, fieldRangeLabel, partBreakdown };
