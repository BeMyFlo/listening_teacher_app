// Phần của registry chương trình cần DB — chỉ dùng ở server. Phần dùng chung
// với client nằm ở lib/curriculum.js (không import mongoose).
const { tenantFilter } = require("./tenant");
const { PROGRAM_KEYS, DEFAULT_PROGRAM } = require("./curriculum");

// Chương trình workspace đang dùng, SUY RA từ dữ liệu (Lớp + Unit + Test) chứ
// không lưu (PLAN-PHASE8-TOEIC.md mục 3.5, C4). null/thiếu field tính là IELTS.
// Workspace mới tinh chưa có gì -> ["ielts"]. Kết quả theo thứ tự PROGRAM_KEYS.
//
// `models` cho phép test truyền model giả; mặc định nạp model thật (lazy, để
// require file này không kéo mongoose models khi chỉ cần import).
async function activePrograms(ws, models) {
  const list = models || [
    require("./models/Class"),
    require("./models/Unit"),
    require("./models/Test"),
  ];
  const seen = new Set();
  for (const M of list) {
    for (const p of await M.distinct("program", tenantFilter(ws))) {
      seen.add(p || DEFAULT_PROGRAM);
    }
  }
  const known = PROGRAM_KEYS.filter((k) => seen.has(k));
  return known.length ? known : [DEFAULT_PROGRAM];
}

module.exports = { activePrograms };
