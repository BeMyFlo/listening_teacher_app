// "On-time streak" của học sinh — KHÔNG theo ngày/lịch.
//
// Mỗi Unit đã QUA hạn nộp = 1 mốc. Học sinh giữ được streak khi Unit đó:
//   - làm đủ mọi bài (isScopeComplete), VÀ
//   - không có bài nào nộp trễ (isLate)
// Chỉ 1 lần nộp trễ hoặc bỏ dở 1 Unit đã quá hạn -> streak reset.
// Unit chưa tới hạn không được xét (không tính, không làm mất streak).

const { resolveDeadline, CATEGORY_KEYS } = require("../deadlines");
const { isScopeComplete, countUnitItems } = require("../completion");

// Hạn MUỘN nhất còn hiệu lực của 1 Unit cho lớp (hạn chung + mọi hạn riêng kỹ năng).
function latestDeadline(unit, classId) {
  const times = [resolveDeadline(unit, classId, null)]
    .concat(CATEGORY_KEYS.map((k) => resolveDeadline(unit, classId, k)))
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  return times.length ? Math.max(...times) : null;
}

// units: Unit docs đầy đủ (.lean()); subs: submission của CHÍNH học sinh đó.
// -> { current, longest }
function computeStreak({ units, subs, classId, now = new Date() } = {}) {
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();

  const graded = (units || [])
    .map((u) => ({ unit: u, dueMs: latestDeadline(u, classId) }))
    .filter((x) => x.dueMs != null && x.dueMs < nowMs && countUnitItems(x.unit) > 0)
    .sort((a, b) => a.dueMs - b.dueMs);

  const onTime = graded.map(({ unit }) => {
    const uid = String(unit._id);
    const unitSubs = (subs || []).filter((s) => String(s.unitId) === uid);
    const complete = isScopeComplete(unit, null, unitSubs);
    const anyLate = unitSubs.some((s) => s.isLate === true);
    return complete && !anyLate;
  });

  let current = 0;
  for (let i = onTime.length - 1; i >= 0; i--) {
    if (onTime[i]) current++;
    else break;
  }

  let longest = 0;
  let run = 0;
  for (const ok of onTime) {
    run = ok ? run + 1 : 0;
    if (run > longest) longest = run;
  }

  return { current, longest };
}

module.exports = { computeStreak, latestDeadline };
