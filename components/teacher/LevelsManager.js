"use client";

// Tab "Levels" của trang Classes: tạo, đổi tên, xoá level (level thuộc về Lớp).
// Mỗi chương trình workspace đang dùng một nhóm (chỉ một chương trình thì không có tiêu đề).
// Xem docs/plans/PLAN-LEVEL-NAMES.md.
import { useDialog } from "@/components/ui/Dialog";
import { useLevels, validateLevelName } from "@/lib/client/levels";
import { usePrograms } from "@/lib/client/program";
import { PROGRAMS, PROGRAM_KEYS } from "@/lib/curriculum";
import { LEVEL_MAX } from "@/lib/levelNames";

const PLACEHOLDERS = { ielts: "e.g. Band 3.5–5.0", toeic: "e.g. 300–450" };

function usedHint(r) {
  return r.classCount > 0
    ? `Used by ${r.classCount} class${r.classCount === 1 ? "" : "es"}`
    : "Used by lessons or mock tests";
}

export default function LevelsManager() {
  const dialog = useDialog();
  const { programs, loaded: programsLoaded } = usePrograms();
  const { levels, loaded, error, addLevel, renameLevel, deleteLevel } = useLevels();
  const shown = PROGRAM_KEYS.filter((k) => programs.includes(k));

  async function add(k) {
    const name = await dialog.prompt({
      title: "Add level",
      label: "Level name",
      placeholder: PLACEHOLDERS[k],
      validate: validateLevelName,
    });
    if (name == null) return;
    try {
      const created = await addLevel(k, name.trim());
      dialog.toast(`Level ${created.level} added`);
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not add level", message: e.message });
    }
  }

  async function rename(k, r) {
    const name = await dialog.prompt({
      title: `Level ${r.level}`,
      label: "Level name",
      placeholder: PLACEHOLDERS[k],
      initialValue: r.name,
      validate: validateLevelName,
    });
    if (name == null) return;
    try {
      await renameLevel(k, r.level, name.trim());
      dialog.toast("Level saved");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not save level", message: e.message });
    }
  }

  async function remove(k, r) {
    const ok = await dialog.confirm({
      title: "Delete level",
      message: `Delete Level ${r.level}${r.name ? ` ("${r.name}")` : ""}? Nothing uses it right now.`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteLevel(k, r.level);
      dialog.toast("Level deleted");
    } catch (e) {
      dialog.alert({ tone: "error", title: "Could not delete level", message: e.message });
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Levels</h3>
      <p className="page-sub" style={{ margin: "0 0 14px" }}>
        Create your levels here, then pick one when you create or edit a class. A name is a label your teachers and
        students recognise, such as a band or score range.
      </p>
      {error && (
        <div className="notice error">
          <svg className="icon"><use href="#icon-warning" /></svg> {error}
        </div>
      )}
      {!error && !(loaded && programsLoaded) && <div className="notice info">Loading...</div>}
      {loaded && programsLoaded && shown.map((k) => {
        const rows = (levels && levels[k]) || [];
        const last = rows.length ? rows[rows.length - 1].level : 0;
        return (
          <div key={k} style={{ marginBottom: 18 }}>
            {shown.length > 1 && (
              <h4 style={{ margin: "10px 0 6px", color: "var(--muted)", fontSize: ".78rem", letterSpacing: ".05em" }}>
                {PROGRAMS[k].label.toUpperCase()}
              </h4>
            )}
            {rows.length === 0 ? (
              <p className="page-sub" style={{ margin: "4px 0 8px" }}>No levels yet — add the first one.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table" style={{ maxWidth: 640 }}>
                  <thead>
                    <tr>
                      <th style={{ width: 150 }}>Level</th>
                      <th>Name</th>
                      <th style={{ width: 90 }}>Classes</th>
                      <th style={{ width: 90 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.level}>
                        <td>Level {r.level}{!r.name && <span style={{ color: "var(--muted)" }}> (no name)</span>}</td>
                        <td>{r.name || <span style={{ color: "var(--muted)" }}>—</span>}</td>
                        <td>{r.classCount}</td>
                        <td>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button
                              type="button" className="icon-btn"
                              title={r.name ? "Rename" : "Name this level"}
                              aria-label={`${r.name ? "Rename" : "Name"} level ${r.level}`}
                              onClick={() => rename(k, r)}
                            >
                              <svg className="icon"><use href="#icon-edit" /></svg>
                            </button>
                            <span title={r.inUse ? usedHint(r) : "Delete"}>
                              <button
                                type="button" className="icon-btn danger"
                                aria-label={`Delete level ${r.level}`}
                                disabled={r.inUse}
                                style={r.inUse ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                                onClick={() => remove(k, r)}
                              >
                                <svg className="icon"><use href="#icon-trash" /></svg>
                              </button>
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <button type="button" className="btn secondary sm" style={{ marginTop: 8 }}
              disabled={last >= LEVEL_MAX} onClick={() => add(k)}>
              <svg className="icon"><use href="#icon-plus" /></svg> Add level
            </button>
          </div>
        );
      })}
    </div>
  );
}
