const Unit = require("../models/Unit");
const Class = require("../models/Class");
const Submission = require("../models/Submission");
const { emit, fmtDateTime } = require("./index");

const DAY_MS = 24 * 60 * 60 * 1000;

// Tổng số "việc phải làm" của 1 Unit: mọi exercise (kể cả trong grammar
// topics / vocab groups) + mọi prompt (writing/speaking).
function countUnitItems(unit) {
  let n = 0;
  for (const c of unit.categories || []) {
    n += (c.exercises || []).length;
    n += (c.prompts || []).length;
    for (const t of c.topics || []) n += (t.exercises || []).length;
    for (const g of c.groups || []) n += (g.exercises || []).length;
  }
  return n;
}

function isUnitComplete(unit, subs) {
  const total = countUnitItems(unit);
  if (!total) return true; // Unit rỗng -> coi như không có gì để nhắc
  const attempted = new Set();
  for (const s of subs) {
    if (s.kind === "exercise" && s.exerciseId) attempted.add("ex:" + s.exerciseId);
    else if ((s.kind === "writing" || s.kind === "speaking") && s.promptId)
      attempted.add("pr:" + s.promptId);
  }
  return attempted.size >= total;
}

// Sinh thông báo "deadline_soon" cho học sinh: mọi Unit đã publish, đúng
// level, có hạn nộp cho lớp của em nằm trong 24h tới và em chưa làm xong.
// Idempotent (emit dedupe theo key), gọi lazy mỗi lần load /api/notifications.
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

  const dueSoon = [];
  for (const u of units) {
    const dl = (u.deadlines || []).find((d) => String(d.classId) === String(student.classId));
    if (!dl || !dl.dueAt) continue;
    const t = new Date(dl.dueAt).getTime();
    if (t > now && t <= soon) dueSoon.push({ unit: u, dueAt: dl.dueAt });
  }
  if (!dueSoon.length) return;

  const subs = await Submission.find({
    studentId: student._id,
    unitId: { $in: dueSoon.map((x) => x.unit._id) },
  })
    .select("unitId kind exerciseId promptId")
    .lean();

  for (const { unit, dueAt } of dueSoon) {
    const mine = subs.filter((s) => String(s.unitId) === String(unit._id));
    if (isUnitComplete(unit, mine)) continue;
    await emit({
      studentId: student._id,
      type: "deadline_soon",
      dedupeKey: `${student._id}:${unit._id}:deadline_soon`,
      unitId: unit._id,
      dueAt,
      title: "Deadline tomorrow",
      body: `${unit.name} is due ${fmtDateTime(dueAt)}. Finish and submit your work before then.`,
    });
  }
}

module.exports = { generateDeadlineNotifications };
