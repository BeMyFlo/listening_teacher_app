"use client";

// Định dạng tiền AI + thanh "đã tiêu / giới hạn" dùng chung cho /admin/system
// và /admin/ai-logs.

// Mỗi lần gọi chỉ vài phần nghìn USD -> số nhỏ cần thêm chữ số lẻ.
export function fmtUsd(v) {
  const n = Number(v) || 0;
  if (n === 0) return "$0";
  if (n < 0.01) return "$" + n.toFixed(4);
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function fmtVnd(usd, rate) {
  const n = Math.round((Number(usd) || 0) * (Number(rate) || 0));
  return n.toLocaleString("vi-VN") + " ₫";
}

export function BudgetBar({ spentUsd, limitUsd, usdToVnd, month, blocked }) {
  const unlimited = limitUsd == null;
  const pct = unlimited ? 0 : limitUsd > 0 ? Math.min(100, (spentUsd / limitUsd) * 100) : 100;
  const over = !unlimited && spentUsd >= limitUsd;
  const tone = over ? "var(--red)" : pct >= 80 ? "#E0A800" : "var(--green)";
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
        <div>
          <b style={{ fontSize: "1.15rem" }}>{fmtUsd(spentUsd)}</b>
          <span style={{ color: "var(--muted)" }}> {unlimited ? "spent — no limit set" : `of ${fmtUsd(limitUsd)}`}</span>
          <span style={{ color: "var(--muted)", fontSize: ".8rem" }}> · ≈ {fmtVnd(spentUsd, usdToVnd)}</span>
        </div>
        <span style={{ color: "var(--muted)", fontSize: ".8rem" }}>Month {month} (Vietnam time)</span>
      </div>
      {!unlimited && (
        <div style={{ height: 8, borderRadius: 4, background: "var(--border)", overflow: "hidden", marginTop: 6 }}>
          <div style={{ width: pct + "%", height: "100%", background: tone }} />
        </div>
      )}
      {over && (
        <p style={{ color: "var(--red)", fontWeight: 600, fontSize: ".82rem", margin: "6px 0 0" }}>
          Limit reached — AI grading and AI lesson generation are blocked for teachers until the limit is raised.
          {blocked ? ` ${blocked} call${blocked === 1 ? "" : "s"} blocked this month.` : ""}
        </p>
      )}
    </div>
  );
}
