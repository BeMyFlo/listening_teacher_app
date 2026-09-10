// Nhãn + màu pill dùng chung cho UI phiếu hỗ trợ (client-side).
export const STATUS_LABEL = {
  open: "Open",
  in_progress: "In progress",
  resolved: "Resolved",
  closed: "Closed",
};

export const STATUS_PILL = {
  open: "pill-warn",
  in_progress: "pill-info",
  resolved: "pill-ok",
  closed: "pill-muted",
};

export const KIND_LABEL = { bug: "Bug", feature: "Feature request" };
export const PRIORITY_LABEL = { low: "Low", normal: "Normal", high: "High" };

export function timeAgo(d) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return m + "m ago";
  const h = Math.floor(m / 60);
  if (h < 24) return h + "h ago";
  const day = Math.floor(h / 24);
  if (day < 30) return day + "d ago";
  return new Date(d).toLocaleDateString();
}
