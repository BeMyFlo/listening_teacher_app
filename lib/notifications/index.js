const Notification = require("../models/Notification");
const inapp = require("./channels/inapp");
const email = require("./channels/email");

const CHANNELS = { inapp, email };

// Kênh nào được bật cho từng loại thông báo. Khi muốn gửi email nhắc hạn,
// chỉ cần thêm "email" vào đây và hiện thực channels/email.js — chỗ gọi
// emit() không phải đổi gì.
const CHANNEL_CONFIG = {
  deadline_soon: ["inapp", "email"],
  deadline_assigned: ["inapp", "email"],
  submission_late: ["inapp", "email"],
  submission_received: ["inapp", "email"],
};

// Định dạng ngày giờ cho phần body (chuỗi lưu sẵn trong DB). App phục vụ
// học sinh ở VN nên cố định múi giờ để chuỗi không lệch theo server.
const APP_TZ = "Asia/Ho_Chi_Minh";

function fmtDateTime(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString("en-US", {
      timeZone: APP_TZ,
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return new Date(d).toISOString();
  }
}

// Tạo (nếu chưa có) 1 thông báo và fan-out sang các kênh đang bật. Idempotent
// theo dedupeKey: gọi lại nhiều lần chỉ gửi kênh đúng 1 lần (lần tạo mới).
async function emit({ studentId, teacherId, type, dedupeKey, unitId, submissionId, link, title, body, dueAt }) {
  if ((!studentId && !teacherId) || !type || !dedupeKey) {
    throw new Error("emit: (studentId or teacherId), type, dedupeKey are required");
  }

  const r = await Notification.findOneAndUpdate(
    { dedupeKey },
    {
      $setOnInsert: {
        studentId,
        teacherId,
        type,
        unitId,
        submissionId,
        link: link || "",
        title: title || "",
        body: body || "",
        dueAt,
        createdAt: new Date(),
      },
    },
    { upsert: true, new: true, includeResultMetadata: true }
  );

  const isNew = !(r.lastErrorObject && r.lastErrorObject.updatedExisting);
  const notif = r.value;
  if (!isNew) return notif;

  for (const key of CHANNEL_CONFIG[type] || ["inapp"]) {
    const channel = CHANNELS[key];
    if (!channel) continue;
    try {
      await channel.deliver(notif);
    } catch (err) {
      console.error(`[notifications] channel "${key}" failed for ${notif._id}:`, err.message);
    }
  }
  return notif;
}

module.exports = { emit, fmtDateTime, APP_TZ };
