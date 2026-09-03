"use client";
// Bộ mảnh UI dùng chung cho các trang dashboard (teacher overview, admin, ...).

export function DashStat({ icon, value, label, hint, tone, onClick }) {
  return (
    <div className={"dash-stat" + (tone ? " tone-" + tone : "") + (onClick ? " dash-stat-clickable" : "")} onClick={onClick}>
      <div className="dash-stat-top">
        <span className="dash-stat-ico"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
        <span className="dash-stat-label">{label}</span>
      </div>
      <div className="dash-stat-value">{value}</div>
      {hint != null && hint !== "" && (
        <div style={{ fontSize: ".78rem", color: "var(--muted)", fontWeight: 600 }}>{hint}</div>
      )}
    </div>
  );
}

export function CardHead({ icon, title, actionLabel, onAction }) {
  return (
    <div className="card-head-v2">
      <div className="head-left">
        <span className="icon-chip"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
        <h3>{title}</h3>
      </div>
      {onAction && (
        <a href="#" className="view-all" onClick={(e) => { e.preventDefault(); onAction(); }}>
          {actionLabel || "View all"} <svg className="icon flip"><use href="#icon-arrow-left" /></svg>
        </a>
      )}
    </div>
  );
}

export function Empty({ icon, title, text }) {
  return (
    <div className="dash-empty">
      <span className="dash-empty-ico"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
      <div><h4>{title}</h4><p>{text}</p></div>
    </div>
  );
}

export function timeAgo(d) {
  if (!d) return "";
  const s = Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`;
  const day = Math.floor(h / 24);
  return `${day} day${day > 1 ? "s" : ""} ago`;
}

export function initials(name) {
  const parts = String(name || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return ((parts[0][0] || "") + (parts[parts.length - 1][0] || "")).toUpperCase();
}
