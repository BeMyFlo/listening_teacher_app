// Tiện ích dùng chung cho phiếu hỗ trợ (pages/api/tickets.js +
// pages/api/sysadmin/tickets.js + UI).

const { isCloudinaryUrl, publicIdFromUrl } = require("./validate");

const STATUS_LABEL = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

const KIND_LABEL = { bug: "Bug", feature: "Feature request" };

// Chỉ nhận ảnh nằm trên đúng tài khoản Cloudinary của mình. Trước đây bất kỳ
// URL https nào cũng lọt, nghĩa là người gửi phiếu ghim được URL lạ vào phiếu
// và trình duyệt admin sẽ tự gọi tới đó khi mở phiếu (lộ IP / thời điểm đọc).
// publicId cũng lấy từ chính URL, không tin giá trị client gửi kèm.
function cleanImages(arr) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter((x) => x && isCloudinaryUrl(x.url))
    .slice(0, 6)
    .map((x) => ({ url: x.url, publicId: publicIdFromUrl(x.url) }));
}

function msgPublic(m) {
  return {
    _id: m._id,
    authorRole: m.authorRole,
    authorName: m.authorName || "",
    body: m.body || "",
    images: (m.images || []).map((i) => ({ url: i.url })),
    createdAt: m.createdAt,
  };
}

// full=false -> bỏ nội dung thread cho danh sách; full=true -> kèm messages.
function toPublic(t, { full = false } = {}) {
  const base = {
    _id: t._id,
    reporterRole: t.reporterRole,
    reporterName: t.reporterName || "",
    kind: t.kind,
    title: t.title,
    status: t.status,
    priority: t.priority,
    pageUrl: t.pageUrl || "",
    lastReplyRole: t.lastReplyRole || null,
    adminUnread: !!t.adminUnread,
    reporterUnread: !!t.reporterUnread,
    replies: (t.messages || []).length,
    resolvedAt: t.resolvedAt || null,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
  if (full) {
    base.body = t.body || "";
    base.images = (t.images || []).map((i) => ({ url: i.url }));
    base.messages = (t.messages || []).map(msgPublic);
  }
  return base;
}

module.exports = { STATUS_LABEL, KIND_LABEL, cleanImages, toPublic };
