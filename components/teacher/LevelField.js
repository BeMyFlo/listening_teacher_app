"use client";

// Ô chọn Level của form lớp. Chưa có level nào của chương trình này được đặt tên
// -> đúng ô số như trước. Có tên -> <select> "Level N · Tên" + "Other…" (hiện ô số)
// và link sang trang cài đặt tên level. Xem docs/plans/PLAN-LEVEL-NAMES.md.
import { useState } from "react";
import Link from "next/link";
import { usePrograms } from "@/lib/client/program";

export default function LevelField({ program, value, onChange, usedLevels = [], label = "Level" }) {
  const { namedLevels, levelLabel } = usePrograms();
  const [otherPicked, setOtherPicked] = useState(false);
  const named = namedLevels(program);

  if (named.length === 0) {
    return (
      <div className="form-row" style={{ marginBottom: 0 }}>
        <label>{label}</label>
        <input type="number" min="1" step="1" value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
    );
  }

  // Các level biết trước: đã đặt tên + đang được lớp (cùng chương trình) dùng.
  const options = [...new Set([...named, ...usedLevels.map(Number).filter((n) => Number.isInteger(n) && n >= 1)])].sort(
    (a, b) => a - b
  );
  const showOther = otherPicked || !options.includes(Number(value));

  function onSelect(v) {
    if (v === "other") {
      setOtherPicked(true);
      return;
    }
    setOtherPicked(false);
    onChange(Number(v));
  }

  return (
    <div className="form-row" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <select value={showOther ? "other" : String(Number(value))} onChange={(e) => onSelect(e.target.value)}>
        {options.map((lv) => (
          <option key={lv} value={lv}>{levelLabel(program, lv)}</option>
        ))}
        <option value="other">Other…</option>
      </select>
      {showOther && (
        <input
          type="number" min="1" step="1" aria-label="Level number" style={{ marginTop: 6 }}
          value={value} onChange={(e) => onChange(e.target.value)}
        />
      )}
      <p className="program-hint" style={{ marginTop: 4 }}>
        <Link href="/teacher/settings/workspace#levels">Edit level names</Link>
      </p>
    </div>
  );
}
