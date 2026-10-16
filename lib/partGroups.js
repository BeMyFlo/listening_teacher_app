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

module.exports = { groupFieldsByPart };
