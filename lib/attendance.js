// Hằng số dùng chung cho UI điểm danh (client).

export const ATT_STATUSES = ["present", "late", "excused", "absent"];

export const ATT_META = {
  present: { label: "Present", short: "P", cls: "att-present" },
  late: { label: "Late", short: "L", cls: "att-late" },
  excused: { label: "Excused", short: "E", cls: "att-excused" },
  absent: { label: "Absent", short: "A", cls: "att-absent" },
};

// "2026-08-30" -> "Sat, 30 Aug 2026"
export function fmtAttDate(d) {
  if (!d) return "";
  const parts = String(d).split("-");
  if (parts.length !== 3) return d;
  const dt = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}
