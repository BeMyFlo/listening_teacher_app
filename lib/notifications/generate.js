const Unit = require("../models/Unit");
const Class = require("../models/Class");
const Submission = require("../models/Submission");
const { emit, fmtDateTime } = require("./index");
const { distinctDeadlines } = require("../deadlines");

const DAY_MS = 24 * 60 * 60 * 1000;

const CATEGORY_LABELS = {
  grammar: "Grammar",
  vocabulary: "Vocabulary",
  listening: "Listening",
  reading: "Reading",
  writing: "Writing",
  speaking: "Speaking",
};

function countCategoryItems(cat) {
  if (!cat) return 0;
  let n = (cat.exercises || []).length + (cat.prompts || []).length;
  for (const t of cat.topics || []) n += (t.exercises || []).length;
  for (const g of cat.groups || []) n += (g.exercises || []).length;
  return n;
}

function countUnitItems(unit) {
  return (unit.categories || []).reduce((n, c) => n + countCategoryItems(c), 0);
}

function attemptedKeys(subs) {
  const set = new Set();
  for (const s of subs) {
    if (s.kind === "exercise" && s.exerciseId) set.add("ex:" + s.exerciseId);
    else if ((s.kind === "writing" || s.kind === "speaking") && s.promptId) set.add("pr:" + s.promptId);
  }
  return set;
}

// Học sinh đã làm xong phạm vi cần nhắc chưa? categoryKey null = cả Unit.
function isScopeComplete(unit, categoryKey, subs) {
  if (!categoryKey) {
    const total = countUnitItems(unit);
    return !total || attemptedKeys(subs).size >= total;
  }
  const cat = (unit.categories || []).find((c) => c.key === categoryKey);
  const total = countCategoryItems(cat);
  if (!total) return true;
  const scoped = subs.filter((s) => s.categoryKey === categoryKey);
  return attemptedKeys(scoped).size >= total;
}

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

module.exports = { generateDeadlineNotifications, CATEGORY_LABELS };
