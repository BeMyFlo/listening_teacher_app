// Gọi chat-server phát tin realtime. Fire-and-forget: lỗi ở đây KHÔNG được
// làm hỏng request gửi tin (client vẫn thấy tin của mình, người khác nhận qua
// polling dự phòng).

async function emitToClass(classId, event, payload) {
  const url = process.env.CHAT_SERVER_URL;
  const secret = process.env.EMIT_SECRET;
  if (!url || !secret) return;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 4000);
    await fetch(url.replace(/\/$/, "") + "/emit", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-emit-secret": secret },
      body: JSON.stringify({ classId: String(classId), event, payload }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
  } catch (err) {
    console.error("[chat] emit failed:", err.message);
  }
}

function publicMessage(m) {
  return {
    _id: m._id,
    classId: m.classId,
    senderId: m.senderId,
    senderRole: m.senderRole,
    senderName: m.senderName,
    text: m.deletedAt ? "" : m.text,
    attachments: m.deletedAt ? [] : m.attachments || [],
    deletedAt: m.deletedAt || null,
    createdAt: m.createdAt,
  };
}

module.exports = { emitToClass, publicMessage };
