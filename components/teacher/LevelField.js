"use client";

// Ô chọn Level của form lớp (tạo + sửa). Level do giáo viên tạo trước ở Classes > Levels;
// ô này chỉ CHỌN trong các level của chương trình đang chọn, hoặc tạo nhanh qua "+ New level…".
// Chương trình chưa có level nào -> chỉ có "+ Create the first level", và `value` là null
// (form tạo lớp khoá nút Create cho tới khi chọn). Xem docs/plans/PLAN-LEVEL-NAMES.md.
import { useEffect, useMemo } from "react";
import { useDialog } from "@/components/ui/Dialog";
import { useLevels, validateLevelName } from "@/lib/client/levels";
import { formatLevelLabel } from "@/lib/levelNames";
import { PROGRAMS } from "@/lib/curriculum";

const NEW = "__new";

// `value`: số level đang chọn, hoặc null (chưa chọn). `keepLevels`: level luôn có trong danh sách
// (vd level hiện tại của lớp đang sửa, kể cả khi chưa có tên).
export default function LevelField({ program, value, onChange, keepLevels = [], label = "Level" }) {
  const dialog = useDialog();
  const { levels, loaded, error, addLevel } = useLevels();

  const options = useMemo(() => {
    const rows = new Map(((levels && levels[program]) || []).map((r) => [r.level, r.name]));
    for (const lv of keepLevels.map(Number)) {
      if (Number.isInteger(lv) && lv >= 1 && !rows.has(lv)) rows.set(lv, "");
    }
    return [...rows.entries()].sort((a, b) => a[0] - b[0]).map(([level, name]) => ({ level, name }));
  }, [levels, program, keepLevels.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = value == null || value === "" ? null : Number(value);
  const valid = current != null && options.some((o) => o.level === current);

  // Giá trị không còn hợp lệ (đổi Program, hoặc vừa tải xong): chọn level đầu tiên, hoặc null nếu chưa có level nào.
  useEffect(() => {
    if (!loaded) return;
    if (valid) return;
    const first = options.length ? options[0].level : null;
    if (first !== current) onChange(first);
  }, [loaded, valid, options, current]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createNew() {
    const progLabel = PROGRAMS[program] ? PROGRAMS[program].label + " " : "";
    const name = await dialog.prompt({
      title: options.length ? `New ${progLabel}level` : `Create the first ${progLabel}level`,
      label: "Level name",
      placeholder: program === "toeic" ? "e.g. 300–450" : "e.g. Band 3.5–5.0",
      validate: validateLevelName,
    });
    if (name == null) return;
    try {
      const created = await addLevel(program, name.trim());
      onChange(created.level);
      dialog.toast(`Level ${created.level} created`);
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not create level", message: e.message });
    }
  }

  function onSelect(v) {
    if (v === NEW) {
      createNew();
      return;
    }
    onChange(Number(v));
  }

  return (
    <div className="form-row" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      <select
        value={valid ? String(current) : ""}
        disabled={!loaded}
        onChange={(e) => onSelect(e.target.value)}
        aria-label={label}
      >
        {!valid && (
          <option value="" disabled hidden>
            {loaded ? "Select a level" : "Loading…"}
          </option>
        )}
        {options.map((o) => (
          <option key={o.level} value={o.level}>{formatLevelLabel(o.level, o.name)}</option>
        ))}
        <option value={NEW}>{options.length ? "+ New level…" : "+ Create the first level"}</option>
      </select>
      {error && <p className="program-hint" style={{ marginTop: 4, color: "var(--red)" }}>{error}</p>}
    </div>
  );
}
