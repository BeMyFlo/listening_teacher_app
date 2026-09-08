// Tự suy trạng thái "làm bài tập về nhà" cho từng học sinh trong 1 buổi điểm
// danh. "Bài tập của buổi này" = các mốc hạn nộp (Unit deadline) của lớp rơi
// vào khoảng GIỮA buổi trước và buổi này. Giáo viên vẫn chỉnh tay đè lên được
// (xem AttendanceRecord.homeworkAuto trong AttendanceSession.js).
//
//   done     — nộp đủ mọi mốc, đúng hạn
//   partial  — có làm nhưng thiếu, hoặc nộp trễ hạn
//   missing  — không nộp gì cho mốc nào
//   none     — buổi này không có mốc hạn nào -> không đánh giá

const { CATEGORY_KEYS, distinctDeadlines } = require("./deadlines");
const {
  countUnitItems,
  countCategoryItems,
  attemptedKeys,
} = require("./completion");

const HW_STATUSES = ["done", "partial", "missing", "none"];
const FIRST_SESSION_LOOKBACK_DAYS = 14;

// Date -> "YYYY-MM-DD" theo giờ VN (khớp cách AttendanceSession lưu date).
function vnDateStr(d) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d instanceof Date ? d : new Date(d));
}

// "YYYY-MM-DD" trừ N ngày -> "YYYY-MM-DD".
function minusDays(dateStr, n) {
  const [y, m, dd] = String(dateStr).split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, dd));
  dt.setUTCDate(dt.getUTCDate() - n);
  return dt.toISOString().slice(0, 10);
}

// Khoảng bài tập của buổi: (startExclusive, endInclusive] theo chuỗi ngày.
function homeworkWindow(session, prevSession) {
  const end = session.date;
  const start = prevSession
    ? prevSession.date
    : minusDays(end, FIRST_SESSION_LOOKBACK_DAYS);
  return { start, end };
}

// 1 mốc hạn của lớp trong khoảng buổi. subs = submissions của 1 học sinh cho
// đúng unit đó (kind exercise/writing/speaking).
function milestoneStatus(unit, categoryKey, dueAt, subs) {
  let total;
  let scoped;
  if (!categoryKey) {
    total = countUnitItems(unit);
    scoped = subs;
  } else {
    const cat = (unit.categories || []).find((c) => c.key === categoryKey);
    total = countCategoryItems(cat);
    scoped = subs.filter((s) => s.categoryKey === categoryKey);
  }
  if (!total) return null; // không có gì để làm ở phạm vi này

  const due = +new Date(dueAt);
  const onTime = attemptedKeys(scoped.filter((s) => +new Date(s.submittedAt) <= due));
  if (onTime.size >= total) return "done";

  const any = attemptedKeys(scoped);
  return any.size > 0 ? "partial" : "missing"; // có làm (kể cả trễ) vs không làm
}

// Gộp trạng thái nhiều mốc thành 1.
function combine(list) {
  if (list.length === 0) return "none";
  if (list.every((s) => s === "done")) return "done";
  if (list.every((s) => s === "missing")) return "missing";
  return "partial";
}

// units: mảng plain Unit (published) có deadline cho lớp này.
// subsByStudent: Map<studentIdStr, Submission[]> — chỉ kind exercise/writing/speaking.
// -> Map<studentIdStr, "done"|"partial"|"missing"|"none">
function autoHomework({ session, prevSession, classId, roster, units, subsByStudent }) {
  const { start, end } = homeworkWindow(session, prevSession);
  const cid = String(classId);

  // [{ unit, categoryKey, dueAt }] các mốc trong khoảng buổi.
  const milestones = [];
  for (const unit of units || []) {
    for (const d of distinctDeadlines(unit, cid)) {
      const ds = vnDateStr(d.dueAt);
      if (ds > start && ds <= end) milestones.push({ unit, categoryKey: d.categoryKey, dueAt: d.dueAt });
    }
  }

  const out = new Map();
  for (const s of roster) {
    const sid = String(s.studentId || s._id);
    if (milestones.length === 0) {
      out.set(sid, "none");
      continue;
    }
    const subs = subsByStudent.get(sid) || [];
    const perMilestone = [];
    for (const m of milestones) {
      const mSubs = subs.filter((x) => String(x.unitId) === String(m.unit._id));
      const st = milestoneStatus(m.unit, m.categoryKey, m.dueAt, mSubs);
      if (st) perMilestone.push(st);
    }
    out.set(sid, combine(perMilestone));
  }
  return out;
}

module.exports = {
  HW_STATUSES,
  CATEGORY_KEYS,
  vnDateStr,
  homeworkWindow,
  autoHomework,
};
