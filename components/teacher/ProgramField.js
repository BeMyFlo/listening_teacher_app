"use client";

// Ô chọn Program (radio IELTS / TOEIC) của form lớp — cửa vào TOEIC (C4), luôn
// hiện kể cả workspace chỉ có IELTS. `locked` = lớp đã có Unit/Test giao (C7):
// khoá ô và ghi lý do.
import { PROGRAMS, PROGRAM_KEYS } from "@/lib/curriculum";

export const PROGRAM_LOCKED_HINT =
  "This class already has lessons or tests assigned, so its program can't be changed.";

export default function ProgramField({ name, value, onChange, locked = false }) {
  return (
    <div className="form-row" style={{ marginBottom: 0 }}>
      <label>Program</label>
      <div className={"program-radios" + (locked ? " locked" : "")} role="radiogroup" aria-label="Program">
        {PROGRAM_KEYS.map((k) => (
          <label key={k}>
            <input
              type="radio"
              name={name}
              value={k}
              checked={value === k}
              disabled={locked}
              onChange={() => onChange(k)}
            />
            {PROGRAMS[k].label}
          </label>
        ))}
      </div>
      {locked && <p className="program-hint">{PROGRAM_LOCKED_HINT}</p>}
    </div>
  );
}
