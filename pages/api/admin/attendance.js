// Điểm danh theo lớp.
//
//   GET  ?classId=<id>   -> danh sách buổi của lớp (kèm thống kê present/total)
//   GET  ?id=<sessionId> -> 1 buổi + roster đã trộn record (thêm học sinh mới
//                           vào lớp sau khi tạo buổi = mặc định "present")
//   POST { classId, date?, note? }        -> tạo buổi mới (number tự tăng)
//   PUT  ?id=<sessionId> { date?, note?, records: [{studentId,status,note}] }
//   DELETE ?id=<sessionId>

const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const AttendanceSession = require("../../../lib/models/AttendanceSession");
const Unit = require("../../../lib/models/Unit");
const Submission = require("../../../lib/models/Submission");
const { autoHomework } = require("../../../lib/attendanceHomework");

const STATUSES = AttendanceSession.STATUSES;
const HW_STATUSES = AttendanceSession.HW_STATUSES;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayStr() {
  // Ngày theo giờ VN — tránh lệch khi server chạy UTC.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA -> "YYYY-MM-DD"
}

function tally(records) {
  const t = { present: 0, late: 0, excused: 0, absent: 0 };
  for (const r of records || []) if (t[r.status] != null) t[r.status]++;
  return t;
}

function hwTally(records) {
  const t = { done: 0, partial: 0, missing: 0, none: 0 };
  for (const r of records || []) if (t[r.homework] != null) t[r.homework]++;
  return t;
}

// Trạng thái bài tập về nhà tự suy cho từng học sinh của buổi `session`.
// -> Map<studentIdStr, "done"|"partial"|"missing"|"none">
async function autoHomeworkMap(session, roster) {
  const prevSession = await AttendanceSession.findOne({
    classId: session.classId,
    number: { $lt: session.number },
  })
    .sort({ number: -1 })
    .select("date number")
    .lean();

  const units = await Unit.find({
    status: "published",
    "deadlines.classId": session.classId,
  })
    .select("name categories deadlines skillLocks")
    .lean();

  const unitIds = units.map((u) => u._id);
  const rosterIds = roster.map((s) => s._id);
  const subs =
    unitIds.length && rosterIds.length
      ? await Submission.find({
          studentId: { $in: rosterIds },
          unitId: { $in: unitIds },
          kind: { $in: ["exercise", "writing", "speaking"] },
        })
          .select("studentId unitId categoryKey exerciseId promptId kind submittedAt")
          .lean()
      : [];

  const subsByStudent = new Map();
  for (const s of subs) {
    const k = String(s.studentId);
    if (!subsByStudent.has(k)) subsByStudent.set(k, []);
    subsByStudent.get(k).push(s);
  }

  return autoHomework({
    session,
    prevSession,
    classId: session.classId,
    roster: roster.map((s) => ({ studentId: s._id })),
    units,
    subsByStudent,
  });
}

async function rosterFor(classId) {
  return Student.find({ classId }).sort({ name: 1 }).select("name username").lean();
}

// Trộn roster hiện tại với record đã lưu: giữ trạng thái đã điểm danh, học sinh
// mới (chưa có record) mặc định "present", bỏ record của học sinh đã rời lớp.
function mergeRoster(roster, records, autoHw) {
  const byId = new Map((records || []).map((r) => [String(r.studentId), r]));
  return roster.map((s) => {
    const rec = byId.get(String(s._id));
    const suggested = (autoHw && autoHw.get(String(s._id))) || "none";
    // Giữ giá trị giáo viên tự chọn (homeworkAuto === false); còn lại bám auto.
    const manual = rec && rec.homeworkAuto === false;
    return {
      studentId: String(s._id),
      name: s.name,
      username: s.username,
      status: rec ? rec.status : "present",
      note: rec ? rec.note || "" : "",
      homework: manual ? rec.homework : suggested,
      homeworkAuto: manual ? false : true,
      homeworkSuggested: suggested,
    };
  });
}

async function handler(req, res) {
  await connectDB();
  const { id, classId } = req.query;

  // ----- danh sách buổi của 1 lớp -----
  if (req.method === "GET" && classId) {
    let cls;
    try {
      cls = await Class.findById(classId).lean();
    } catch {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }
    if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });

    const [sessions, rosterCount] = await Promise.all([
      AttendanceSession.find({ classId }).sort({ number: -1 }).lean(),
      Student.countDocuments({ classId }),
    ]);

    const rows = sessions.map((s) => ({
      _id: s._id,
      number: s.number,
      date: s.date,
      note: s.note || "",
      counts: tally(s.records),
      homework: hwTally(s.records),
      marked: (s.records || []).length,
      updatedAt: s.updatedAt,
    }));
    return res.status(200).json({ ok: true, class: { _id: cls._id, name: cls.name, level: cls.level }, rosterCount, rows });
  }

  // ----- tạo buổi -----
  if (req.method === "POST") {
    const cid = String((req.body && req.body.classId) || "");
    let cls;
    try {
      cls = await Class.findById(cid).lean();
    } catch {
      return res.status(404).json({ ok: false, error: "Class not found" });
    }
    if (!cls) return res.status(404).json({ ok: false, error: "Class not found" });

    let date = String((req.body && req.body.date) || "").trim() || todayStr();
    if (!DATE_RE.test(date)) return res.status(400).json({ ok: false, error: "Invalid date" });

    const last = await AttendanceSession.findOne({ classId: cid }).sort({ number: -1 }).select("number").lean();
    const number = (last ? last.number : 0) + 1;

    const roster = await rosterFor(cid);
    const session = await AttendanceSession.create({
      classId: cid,
      number,
      date,
      note: String((req.body && req.body.note) || "").trim(),
      records: roster.map((s) => ({ studentId: s._id, status: "present", note: "" })),
      takenBy: req.auth && req.auth.teacherId,
    });
    return res.status(201).json({ ok: true, session: { _id: session._id, number, date } });
  }

  // ----- 1 buổi cụ thể -----
  let session;
  try {
    session = await AttendanceSession.findById(id);
  } catch {
    return res.status(404).json({ ok: false, error: "Session not found" });
  }
  if (!session) return res.status(404).json({ ok: false, error: "Session not found" });

  if (req.method === "GET") {
    const [cls, roster] = await Promise.all([
      Class.findById(session.classId).lean(),
      rosterFor(session.classId),
    ]);
    const autoHw = await autoHomeworkMap(session, roster);
    const merged = mergeRoster(roster, session.records, autoHw);
    return res.status(200).json({
      ok: true,
      session: {
        _id: session._id,
        classId: session.classId,
        className: cls ? cls.name : "",
        number: session.number,
        date: session.date,
        note: session.note || "",
        updatedAt: session.updatedAt,
        hasHomework: merged.some((r) => r.homeworkSuggested !== "none"),
      },
      roster: merged,
    });
  }

  if (req.method === "PUT") {
    const { date, note, records } = req.body || {};
    if (date != null) {
      const d = String(date).trim();
      if (!DATE_RE.test(d)) return res.status(400).json({ ok: false, error: "Invalid date" });
      session.date = d;
    }
    if (note != null) session.note = String(note).trim();
    if (records != null) {
      if (!Array.isArray(records)) return res.status(400).json({ ok: false, error: "Invalid records" });
      const rosterIds = new Set((await rosterFor(session.classId)).map((s) => String(s._id)));
      session.records = records
        .filter((r) => r && rosterIds.has(String(r.studentId)))
        .map((r) => ({
          studentId: r.studentId,
          status: STATUSES.includes(r.status) ? r.status : "present",
          note: String(r.note || "").trim(),
          homework: HW_STATUSES.includes(r.homework) ? r.homework : "none",
          // client gửi homeworkAuto=false khi giáo viên tự chỉnh; mặc định bám auto
          homeworkAuto: r.homeworkAuto !== false,
        }));
    }
    await session.save();
    return res.status(200).json({ ok: true });
  }

  if (req.method === "DELETE") {
    await session.deleteOne();
    return res.status(200).json({ ok: true });
  }

  res.setHeader("Allow", "GET, POST, PUT, DELETE");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(handler);

module.exports.default = module.exports;
