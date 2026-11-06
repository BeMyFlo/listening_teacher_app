const mongoose = require("mongoose");
const { connectDB } = require("../../../lib/db");
const { requireAuth } = require("../../../lib/auth");
const { withTenant, tenantFilter } = require("../../../lib/tenant");
const { teacherScope, canAccessClass } = require("../../../lib/teacherScope");
const { asObjectId } = require("../../../lib/validate");
const Class = require("../../../lib/models/Class");
const Student = require("../../../lib/models/Student");
const Teacher = require("../../../lib/models/Teacher");
const Notification = require("../../../lib/models/Notification");
const { emit } = require("../../../lib/notifications");

async function handler(req, res) {
  // Chỉ tài khoản giáo viên mới được gửi và xem thông báo lớp
  if (!req.auth || req.auth.role !== "teacher" || !req.auth.teacherId) {
    return res.status(403).json({ ok: false, error: "Only teachers can manage announcements" });
  }

  await connectDB();

  if (req.method === "GET") {
    const teacherId = asObjectId(req.auth.teacherId);
    if (!teacherId) {
      return res.status(401).json({ ok: false, error: "Invalid teacher ID" });
    }

    const teacherObjectId = new mongoose.Types.ObjectId(teacherId);
    const rows = await Notification.aggregate([
      {
        $match: tenantFilter(req.ws, {
          type: "teacher_announcement",
          senderTeacherId: teacherObjectId,
        }),
      },
      {
        $group: {
          _id: "$announcementId",
          title: { $first: "$title" },
          body: { $first: "$body" },
          createdAt: { $first: "$createdAt" },
          recipients: { $sum: 1 },
          readCount: {
            $sum: {
              $cond: [{ $gt: ["$deliveries.inapp.readAt", null] }, 1, 0],
            },
          },
        },
      },
      { $sort: { createdAt: -1 } },
      { $limit: 20 },
      {
        $project: {
          _id: 0,
          announcementId: "$_id",
          title: 1,
          body: 1,
          createdAt: 1,
          recipients: 1,
          readCount: 1,
        },
      },
    ]);

    const formattedRows = rows.map((r) => ({
      announcementId: r.announcementId || r._id,
      title: r.title || "",
      body: r.body || "",
      createdAt: r.createdAt,
      recipients: r.recipients || 0,
      readCount: r.readCount || 0,
    }));

    return res.status(200).json({ ok: true, rows: formattedRows });
  }

  if (req.method === "POST") {
    const { classIds, title, body } = req.body || {};

    if (!Array.isArray(classIds) || classIds.length === 0) {
      return res.status(400).json({ ok: false, error: "classIds must be a non-empty array" });
    }

    const trimmedTitle = typeof title === "string" ? title.trim() : (title != null ? String(title).trim() : "");
    if (trimmedTitle.length < 1 || trimmedTitle.length > 120) {
      return res.status(400).json({ ok: false, error: "Title must be between 1 and 120 characters" });
    }

    const trimmedBody = typeof body === "string" ? body.trim() : (body != null ? String(body).trim() : "");
    if (trimmedBody.length > 1000) {
      return res.status(400).json({ ok: false, error: "Body must be at most 1000 characters" });
    }

    // Phạm vi lớp của giáo viên
    const scope = await teacherScope(req.auth);
    for (const cid of classIds) {
      if (!canAccessClass(scope, cid)) {
        return res.status(403).json({ ok: false, error: "One or more classes are not in your assigned classes" });
      }
    }

    // Kiểm tra tất cả classId thuộc workspace này
    const uniqueClassIds = [...new Set(classIds.map(String))];
    const validObjectIds = uniqueClassIds.map(asObjectId).filter(Boolean);
    if (validObjectIds.length !== uniqueClassIds.length) {
      return res.status(403).json({ ok: false, error: "One or more classes do not belong to this workspace" });
    }

    const existingClasses = await Class.find(tenantFilter(req.ws, { _id: { $in: validObjectIds } }))
      .select("_id")
      .lean();

    if (existingClasses.length !== uniqueClassIds.length) {
      return res.status(403).json({ ok: false, error: "One or more classes do not belong to this workspace" });
    }

    const ids = existingClasses.map((c) => c._id);
    const students = await Student.find(tenantFilter(req.ws, { classId: { $in: ids } }))
      .select("_id")
      .lean();

    const teacher = await Teacher.findById(req.auth.teacherId).select("name").lean();
    if (!teacher) {
      return res.status(401).json({ ok: false, error: "Teacher account not found" });
    }

    const senderName = (teacher && teacher.name) || "";
    const announcementId = new mongoose.Types.ObjectId();

    const CHUNK_SIZE = 20;
    for (let i = 0; i < students.length; i += CHUNK_SIZE) {
      const chunk = students.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map((student) =>
          emit({
            studentId: student._id,
            workspaceId: req.ws.workspaceId,
            type: "teacher_announcement",
            dedupeKey: `ann:${announcementId}:${student._id}`,
            link: "",
            title: trimmedTitle,
            body: trimmedBody,
            senderName,
            announcementId,
            senderTeacherId: teacher._id,
          })
        )
      );
    }

    return res.status(201).json({ ok: true, announcementId, recipients: students.length });
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ ok: false, error: "Method not allowed" });
}

module.exports = requireAuth(withTenant(handler));

module.exports.default = module.exports;
