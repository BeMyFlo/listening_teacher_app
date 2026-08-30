// "Vừa có hạn nộp" — khi giáo viên đặt/đổi hạn nộp cho 1 lớp trên 1 Unit đã
// publish, gửi thông báo (in-app + email) cho mọi học sinh của lớp đó.
//
// Tách 2 phần:
//   announceDeadlines()      — gọi trong PUT /api/admin/units sau unit.save().
//                              Rẻ: chỉ diff hạn cũ/mới rồi tạo DeadlineEmailJob.
//                              KHÔNG gửi mail ở đây.
//   runDeadlineEmailJob()    — worker thật: claim job, lặp emit() từng học sinh.
//                              Gọi từ /api/admin/deadline-jobs/run và cron.
//   sweepDeadlineEmailJobs() — quét job pending / running-treo (cho cron).

const Unit = require("../models/Unit");
const Student = require("../models/Student");
const Notification = require("../models/Notification");
const DeadlineEmailJob = require("../models/DeadlineEmailJob");
const { emit, fmtDateTime } = require("./index");
const { CATEGORY_LABELS } = require("../completion");

const STALE_MS = 90 * 1000; // job "running" quá lâu -> coi như treo, cho chạy lại
const BATCH = 10; // số học sinh xử lý mỗi vòng lưu DB
const TIME_BUDGET_MS = 50 * 1000; // dừng trước khi Vercel kill function (60s)

function announceText(unit, categoryKey, dueAt) {
  const scope = categoryKey
    ? `the ${CATEGORY_LABELS[categoryKey] || categoryKey} part of "${unit.name}"`
    : `"${unit.name}"`;
  return {
    title: "New assignment deadline",
    body:
      `A deadline was set for ${scope} — due ${fmtDateTime(dueAt)}. ` +
      `Complete and submit your work before then.`,
  };
}

// prevDeadlines: [{ classId:String, categoryKey:String|null, dueAtMs:Number|null }]
//               chụp TRƯỚC khi gán unit.deadlines mới.
// announceAll:  true khi lần Save này chuyển Unit từ draft -> published
//               (coi mọi hạn hiện có là "mới").
// Trả về mảng jobId đã tạo (hoặc job pending/running trùng đang có).
async function announceDeadlines(unit, prevDeadlines, { requestedBy, announceAll } = {}) {
  if (!unit || unit.status !== "published") return []; // học sinh không thấy Unit draft

  const prev = new Map((prevDeadlines || []).map((d) => [`${d.classId}|${d.categoryKey || ""}`, d.dueAtMs]));
  const now = Date.now();
  const created = [];

  for (const d of unit.deadlines || []) {
    const key = `${String(d.classId)}|${d.categoryKey || ""}`;
    const wasMs = prev.get(key);
    const nowMs = +new Date(d.dueAt);
    const isNewOrMoved = announceAll || wasMs == null || wasMs !== nowMs;
    if (!isNewOrMoved) continue;
    if (!nowMs || nowMs <= now) continue; // hạn đã qua -> không nhắc

    // Không chồng job trùng cho cùng 1 mốc.
    const dup = await DeadlineEmailJob.findOne({
      unitId: unit._id,
      classId: d.classId,
      categoryKey: d.categoryKey || null,
      dueAt: d.dueAt,
      status: { $in: ["pending", "running"] },
    })
      .select("_id")
      .lean();
    if (dup) {
      created.push(dup._id);
      continue;
    }

    const students = await Student.find({ classId: d.classId }).select("_id").lean();
    const job = await DeadlineEmailJob.create({
      unitId: unit._id,
      classId: d.classId,
      categoryKey: d.categoryKey || null,
      dueAt: d.dueAt,
      recipientIds: students.map((s) => s._id),
      progress: { total: students.length, notified: 0, emailSent: 0, emailSkipped: 0, emailFailed: 0 },
      requestedBy: requestedBy || undefined,
    });
    created.push(job._id);
  }

  return created;
}

// Chạy 1 job tới khi xong hoặc hết ngân sách thời gian. Idempotent: emit()
// dedupe theo dedupeKey nên chạy lại / cron chồng lên không gửi trùng.
async function runDeadlineEmailJob(jobId) {
  let job = await DeadlineEmailJob.findById(jobId);
  if (!job) return null;

  // Reset job treo (function bị kill giữa chừng).
  if (job.status === "running" && job.startedAt && Date.now() - job.startedAt.getTime() > STALE_MS) {
    job.status = "pending";
    await job.save();
  }
  if (job.status === "done" || job.status === "error") return job;

  // Giành job (atomic).
  const claimed = await DeadlineEmailJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["pending", "running"] } },
    { $set: { status: "running", startedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return DeadlineEmailJob.findById(jobId);
  job = claimed;

  const unit = await Unit.findById(job.unitId).select("name status").lean();
  if (!unit) {
    job.status = "error";
    job.error = "Unit no longer exists";
    await job.save();
    return job;
  }

  const { title, body } = announceText(unit, job.categoryKey, job.dueAt);
  const t0 = Date.now();

  try {
    while (job.cursor < job.recipientIds.length && Date.now() - t0 < TIME_BUDGET_MS) {
      const slice = job.recipientIds.slice(job.cursor, job.cursor + BATCH);
      for (const studentId of slice) {
        try {
          const dedupeKey = `${studentId}:${job.unitId}:${job.categoryKey || "unit"}:deadline_assigned:${+job.dueAt}`;
          await emit({
            studentId,
            type: "deadline_assigned",
            dedupeKey,
            unitId: job.unitId,
            dueAt: job.dueAt,
            link: `/student/lessons/${job.unitId}`,
            title,
            body,
          });
          job.progress.notified++;
          // emit() ghi trạng thái email qua updateOne (không sửa doc trả về) nên
          // đọc lại để đếm cho đúng.
          const saved = await Notification.findOne({ dedupeKey })
            .select("deliveries.email.status")
            .lean();
          const st = saved && saved.deliveries && saved.deliveries.email && saved.deliveries.email.status;
          if (st === "sent") job.progress.emailSent++;
          else if (st === "failed") job.progress.emailFailed++;
          else if (st === "skipped") job.progress.emailSkipped++;
        } catch (err) {
          // E11000: cron/khác đã emit cho học sinh này -> coi như xong, không tính lỗi.
          if (err && err.code !== 11000) {
            job.progress.emailFailed++;
            console.error(`[deadline-job ${job._id}] student ${studentId}:`, err.message);
          }
        }
      }
      job.cursor += slice.length;
      job.startedAt = new Date(); // heartbeat
      await job.save();
    }

    if (job.cursor >= job.recipientIds.length) {
      job.status = "done";
      job.finishedAt = new Date();
    } else {
      job.status = "pending"; // còn nữa -> lần run sau / cron chạy tiếp
    }
    await job.save();
  } catch (err) {
    job.status = "error";
    job.error = String((err && err.message) || err).slice(0, 500);
    await job.save();
  }

  return job;
}

// Lưới an toàn cho cron: job chưa xong (pending) hoặc running bị treo.
async function sweepDeadlineEmailJobs() {
  const jobs = await DeadlineEmailJob.find({
    $or: [
      { status: "pending" },
      { status: "running", startedAt: { $lt: new Date(Date.now() - STALE_MS) } },
    ],
  })
    .select("_id")
    .lean();

  let ran = 0;
  for (const j of jobs) {
    try {
      await runDeadlineEmailJob(j._id);
      ran++;
    } catch (err) {
      console.error(`[deadline-job ${j._id}] sweep failed:`, err.message);
    }
  }
  return { swept: jobs.length, ran };
}

module.exports = { announceDeadlines, runDeadlineEmailJob, sweepDeadlineEmailJobs };
