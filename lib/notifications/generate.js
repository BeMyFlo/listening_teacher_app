const Unit = require("../models/Unit");
const Class = require("../models/Class");
const Submission = require("../models/Submission");
const { emit, fmtDateTime } = require("./index");
const { distinctDeadlines } = require("../deadlines");
const { CATEGORY_LABELS, isScopeComplete } = require("../completion");

const DAY_MS = 24 * 60 * 60 * 1000;

// Sinh thông báo "deadline_soon": mọi Unit publish đúng level có hạn (chung
// hoặc riêng kỹ năng) cho lớp của em trong 24h tới và phần đó chưa làm xong.
// Idempotent (dedupeKey), gọi lazy mỗi lần load /api/notifications.
async function generateDeadlineNotifications(student) {
  if (!student || !student.classId) return;
  const cls = await Class.findById(student.classId).lean();
  if (!cls) return;

  const now = Date.now();
  const soon = now + DAY_MS;

  const units = await Unit.find({
    status: "published",
    level: cls.level,
    "deadlines.classId": student.classId,
  }).lean();

  // [{ unit, categoryKey, dueAt }] cho mọi mốc trong cửa sổ 24h tới.
  const dueSoon = [];
  for (const u of units) {
    for (const d of distinctDeadlines(u, student.classId)) {
      const t = new Date(d.dueAt).getTime();
      if (t > now && t <= soon) dueSoon.push({ unit: u, categoryKey: d.categoryKey, dueAt: d.dueAt });
    }
  }
  if (!dueSoon.length) return;

  const subs = await Submission.find({
    studentId: student._id,
    unitId: { $in: [...new Set(dueSoon.map((x) => String(x.unit._id)))] },
  })
    .select("unitId kind exerciseId promptId categoryKey")
    .lean();

  for (const { unit, categoryKey, dueAt } of dueSoon) {
    const mine = subs.filter((s) => String(s.unitId) === String(unit._id));
    if (isScopeComplete(unit, categoryKey, mine)) continue;

    const scopeLabel = categoryKey ? `The ${CATEGORY_LABELS[categoryKey]} part of ${unit.name}` : unit.name;
    await emit({
      studentId: student._id,
      type: "deadline_soon",
      dedupeKey: `${student._id}:${unit._id}:${categoryKey || "unit"}:deadline_soon`,
      unitId: unit._id,
      dueAt,
      title: "Deadline tomorrow",
      body: `${scopeLabel} is due ${fmtDateTime(dueAt)}. Finish and submit your work before then.`,
    });
  }
}

// Quét toàn bộ học sinh đã xếp lớp (dùng cho cron). Idempotent nhờ dedupeKey:
// chạy lại nhiều lần trong ngày không tạo trùng thông báo / email.
async function generateDeadlineNotificationsForAll() {
  const Student = require("../models/Student");
  const students = await Student.find({ classId: { $ne: null } }).select("_id classId name").lean();
  let ok = 0;
  let failed = 0;
  for (const s of students) {
    try {
      await generateDeadlineNotifications(s);
      ok++;
    } catch (err) {
      failed++;
      console.error(`[notifications] deadline scan failed for student ${s._id}:`, err.message);
    }
  }
  return { scanned: students.length, ok, failed };
}

module.exports = { generateDeadlineNotifications, generateDeadlineNotificationsForAll, CATEGORY_LABELS };
