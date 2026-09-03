// Tổng hợp dữ liệu cho trang Overview của giáo viên — xoay quanh LỚP và
// ASSIGNMENT. "Assignment" = 1 mốc hạn của Unit cho 1 lớp (hạn chung cả Unit
// hoặc hạn riêng 1 kỹ năng). Không có model riêng.
//
// Thuần hàm, nhận plain object (đã .lean()), để test được không cần DB.

const { distinctDeadlines } = require("../deadlines");
const { CATEGORY_LABELS, isScopeComplete, attemptedKeys, countCategoryItems, countUnitItems } = require("../completion");

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_BEFORE_MS = 45 * DAY_MS; // bỏ qua hạn đã quá 45 ngày
const DUE_SOON_MS = 7 * DAY_MS;
const INACTIVE_DAYS = 14;
const BAND_DROP = 0.5;

function id(v) {
  return v == null ? "" : String(v);
}

function assignmentLabel(unitName, categoryKey) {
  return categoryKey ? `${CATEGORY_LABELS[categoryKey] || categoryKey} — ${unitName}` : unitName;
}

// Số phạm vi (scope) của 1 assignment mà học sinh đã làm xong / tổng.
function scopeItemsTotal(unit, categoryKey) {
  if (!categoryKey) return countUnitItems(unit);
  const cat = (unit.categories || []).find((c) => c.key === categoryKey);
  return countCategoryItems(cat);
}

function buildTeacherDashboard({ classes = [], students = [], units = [], submissions = [], now = new Date(), totalUnits, totalTests, unreadSubmissions = 0 } = {}) {
  const nowMs = new Date(now).getTime();
  const classById = new Map(classes.map((c) => [id(c._id), c]));
  const unitById = new Map(units.map((u) => [id(u._id), u]));

  // Học sinh theo lớp + submissions theo học sinh.
  const studentsByClass = new Map();
  for (const s of students) {
    const k = id(s.classId);
    if (!studentsByClass.has(k)) studentsByClass.set(k, []);
    studentsByClass.get(k).push(s);
  }
  const subsByStudent = new Map();
  for (const sub of submissions) {
    const k = id(sub.studentId);
    if (!subsByStudent.has(k)) subsByStudent.set(k, []);
    subsByStudent.get(k).push(sub);
  }
  const subsFor = (studentId, unitId) =>
    (subsByStudent.get(id(studentId)) || []).filter((x) => id(x.unitId) === id(unitId));

  // --- Assignments: (unit x class x scope hạn) ---
  const assignments = [];
  for (const u of units) {
    for (const c of classes) {
      for (const d of distinctDeadlines(u, c._id)) {
        const dueMs = new Date(d.dueAt).getTime();
        if (!dueMs || dueMs < nowMs - STALE_BEFORE_MS) continue;
        assignments.push({
          unitId: id(u._id),
          unitName: u.name,
          classId: id(c._id),
          className: c.name,
          categoryKey: d.categoryKey || null,
          dueAt: d.dueAt,
          dueMs,
          overdue: dueMs < nowMs,
          dueSoon: dueMs >= nowMs && dueMs <= nowMs + DUE_SOON_MS,
        });
      }
    }
  }

  // Latest writing/speaking sub theo promptId (để đếm "to grade").
  function pendingGradeCount(classStudents, unit, categoryKey) {
    let n = 0;
    for (const st of classStudents) {
      const us = subsFor(st._id, unit._id).filter(
        (x) =>
          (x.kind === "writing" || x.kind === "speaking") &&
          (!categoryKey || x.categoryKey === categoryKey || x.kind === categoryKey)
      );
      const latestByPrompt = new Map();
      for (const x of us) {
        const key = id(x.promptId);
        const cur = latestByPrompt.get(key);
        if (!cur || new Date(x.submittedAt) > new Date(cur.submittedAt)) latestByPrompt.set(key, x);
      }
      // Chưa "graded" (kể cả ai_draft / draft) = vẫn nằm trong hàng chờ chấm.
      for (const x of latestByPrompt.values()) if (x.gradingStatus !== "graded") n++;
    }
    return n;
  }

  // Bồi thêm số liệu tiến độ cho từng assignment.
  for (const a of assignments) {
    const unit = unitById.get(a.unitId);
    const classStudents = studentsByClass.get(a.classId) || [];
    a.classSize = classStudents.length;
    a.itemsTotal = scopeItemsTotal(unit, a.categoryKey);

    let submitted = 0;
    let complete = 0;
    for (const st of classStudents) {
      const us = subsFor(st._id, unit._id);
      const scoped = a.categoryKey ? us.filter((x) => x.categoryKey === a.categoryKey || x.kind === a.categoryKey) : us;
      if (attemptedKeys(scoped).size > 0) submitted++;
      if (isScopeComplete(unit, a.categoryKey, us)) complete++;
    }
    a.submitted = submitted;
    a.complete = complete;
    a.toGrade = pendingGradeCount(classStudents, unit, a.categoryKey);
    a.label = assignmentLabel(a.unitName, a.categoryKey);
  }

  // --- Cờ theo học sinh ---
  const watch = [];
  const needAttentionByClass = new Map();
  let needAttentionStudents = 0;

  for (const st of students) {
    const clsKey = id(st.classId);
    const classAssignments = assignments.filter((a) => a.classId === clsKey);
    const mySubs = subsByStudent.get(id(st._id)) || [];

    // overdue: assignment quá hạn mà em chưa làm xong
    let overdueCount = 0;
    for (const a of classAssignments) {
      if (!a.overdue) continue;
      const us = subsFor(st._id, a.unitId);
      if (!isScopeComplete(unitById.get(a.unitId), a.categoryKey, us)) overdueCount++;
    }

    // inactive: lâu không nộp (chỉ tính khi lớp có assignment)
    let lastMs = 0;
    for (const s of mySubs) {
      const t = new Date(s.submittedAt).getTime();
      if (t > lastMs) lastMs = t;
    }
    const inactiveDays = lastMs ? Math.floor((nowMs - lastMs) / DAY_MS) : null;
    const inactive =
      classAssignments.length > 0 && (inactiveDays === null || inactiveDays >= INACTIVE_DAYS);

    // declining: 2 band writing/speaking gần nhất tụt >= 0.5
    const graded = mySubs
      .filter((s) => (s.kind === "writing" || s.kind === "speaking") && s.gradingStatus === "graded" && typeof s.manualScore === "number")
      .sort((x, y) => new Date(x.submittedAt) - new Date(y.submittedAt));
    let bandDrop = null;
    if (graded.length >= 2) {
      const prev = graded[graded.length - 2].manualScore;
      const last = graded[graded.length - 1].manualScore;
      if (prev - last >= BAND_DROP) bandDrop = { from: prev, to: last };
    }

    const reasons = [];
    if (overdueCount > 0)
      reasons.push({ case: "overdue", label: `${overdueCount} overdue assignment${overdueCount > 1 ? "s" : ""}` });
    if (bandDrop) reasons.push({ case: "declining", label: `Score ↓ ${bandDrop.from} → ${bandDrop.to}` });
    if (inactive)
      reasons.push({
        case: "inactive",
        label: inactiveDays === null ? "No submissions yet" : `No submission in ${inactiveDays} days`,
      });

    if (reasons.length) {
      needAttentionStudents++;
      needAttentionByClass.set(clsKey, (needAttentionByClass.get(clsKey) || 0) + 1);
      watch.push({
        studentId: id(st._id),
        name: st.name,
        className: classById.get(clsKey) ? classById.get(clsKey).name : null,
        overdueCount,
        reasons,
        summary: reasons.map((r) => r.label).join(" • "),
      });
    }
  }

  const severity = (w) => w.reasons.reduce((n, r) => n + (r.case === "overdue" ? 100 + w.overdueCount : r.case === "declining" ? 50 : 10), 0);
  watch.sort((a, b) => severity(b) - severity(a) || a.name.localeCompare(b.name));

  // --- Rollup theo lớp ---
  const classRows = classes.map((c) => {
    const k = id(c._id);
    const classStudents = studentsByClass.get(k) || [];
    const classAssignments = assignments.filter((a) => a.classId === k);
    const totalScopes = classAssignments.length;
    let progressPct = 0;
    if (totalScopes && classStudents.length) {
      let sum = 0;
      for (const st of classStudents) {
        let done = 0;
        for (const a of classAssignments) {
          if (isScopeComplete(unitById.get(a.unitId), a.categoryKey, subsFor(st._id, a.unitId))) done++;
        }
        sum += done / totalScopes;
      }
      progressPct = Math.round((sum / classStudents.length) * 100);
    }
    return {
      _id: k,
      name: c.name,
      level: c.level,
      studentCount: classStudents.length,
      assignmentCount: totalScopes,
      progressPct,
      needAttentionCount: needAttentionByClass.get(k) || 0,
    };
  });

  // --- Needs Your Attention ---
  const notGraded = submissions.filter(
    (s) => (s.kind === "writing" || s.kind === "speaking") && s.gradingStatus !== "graded"
  ).length;
  const overdueStudentCount = watch.filter((w) => w.overdueCount > 0).length;
  const dueSoonCount = assignments.filter((a) => a.dueSoon).length;

  const attention = [];
  if (notGraded > 0)
    attention.push({
      kind: "grading",
      count: notGraded,
      text: `${notGraded} submission${notGraded > 1 ? "s are" : " is"} waiting for grading`,
      link: "/teacher/submissions",
    });
  if (overdueStudentCount > 0)
    attention.push({
      kind: "overdue",
      count: overdueStudentCount,
      text: `${overdueStudentCount} student${overdueStudentCount > 1 ? "s have" : " has"} overdue assignments`,
    });
  if (dueSoonCount > 0)
    attention.push({
      kind: "due_soon",
      count: dueSoonCount,
      text: `${dueSoonCount} assignment${dueSoonCount > 1 ? "s are" : " is"} due soon`,
    });

  // --- Assignments Progress (sort: to-grade desc, hạn gần trước) ---
  const assignmentsProgress = assignments
    .slice()
    .sort((a, b) => b.toGrade - a.toGrade || a.dueMs - b.dueMs)
    .slice(0, 8)
    .map((a) => ({
      unitId: a.unitId,
      label: a.label,
      className: a.className,
      submitted: a.submitted,
      classSize: a.classSize,
      toGrade: a.toGrade,
      dueAt: a.dueAt,
      overdue: a.overdue,
    }));

  // --- Upcoming (hạn trong 7 ngày tới) ---
  const upcoming = assignments
    .filter((a) => a.dueMs >= nowMs && a.dueMs <= nowMs + DUE_SOON_MS)
    .sort((a, b) => a.dueMs - b.dueMs)
    .slice(0, 8)
    .map((a) => ({
      unitId: a.unitId,
      label: a.label,
      className: a.className,
      dueAt: a.dueAt,
      categoryKey: a.categoryKey,
      daysLeft: Math.max(0, Math.ceil((a.dueMs - nowMs) / DAY_MS)),
    }));

  // --- Recent Assignments (mốc hạn gần đây nhất, còn hạn hoặc vừa hết) ---
  const recentAssignments = assignments
    .slice()
    .sort((a, b) => b.dueMs - a.dueMs)
    .slice(0, 6)
    .map((a) => ({
      unitId: a.unitId,
      label: a.label,
      className: a.className,
      categoryKey: a.categoryKey,
      submitted: a.submitted,
      classSize: a.classSize,
      dueAt: a.dueAt,
    }));

  // --- Grading Queue (assignment còn bài chờ chấm) ---
  const gradingQueue = assignments
    .filter((a) => a.toGrade > 0)
    .sort((a, b) => b.toGrade - a.toGrade || a.dueMs - b.dueMs)
    .slice(0, 6)
    .map((a) => ({ unitId: a.unitId, label: a.label, className: a.className, toGrade: a.toGrade }));

  // --- Recent activity ---
  const recent = submissions
    .slice()
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))
    .slice(0, 8)
    .map((s) => ({
      studentName: s.studentName,
      kind: s.kind,
      testTitle: s.testTitle,
      exerciseTitle: s.exerciseTitle,
      score: s.score,
      total: s.total,
      manualScore: s.manualScore,
      gradingStatus: s.gradingStatus,
      submittedAt: s.submittedAt,
    }));

  const activeAssignments = assignments.filter((a) => a.dueMs >= nowMs).length;

  return {
    summary: {
      totalClasses: classes.length,
      notGraded,
      unreadSubmissions,
      activeAssignments,
      needAttentionStudents,
      totalUnits: totalUnits != null ? totalUnits : units.length,
      totalTests: totalTests != null ? totalTests : 0,
      pendingGrading: notGraded,
    },
    attention,
    classes: classRows,
    assignments: assignmentsProgress,
    recentAssignments,
    gradingQueue,
    watch: watch.slice(0, 8),
    recent,
    upcoming,
  };
}

module.exports = { buildTeacherDashboard, assignmentLabel };
