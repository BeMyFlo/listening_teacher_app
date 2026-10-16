"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client/api";
import { TEST_SKILLS } from "@/lib/teacher/testBuilder";
import { useDialog } from "@/components/ui/Dialog";
import { programOf } from "@/lib/curriculum";
import { programParam, usePrograms } from "@/lib/client/program";
import ProgramChips, { ProgramEmpty } from "@/components/teacher/ProgramChips";
import ProgramBadge from "@/components/ProgramBadge";

function TeacherTestsInner() {
  const dialog = useDialog();
  const router = useRouter();
  const search = useSearchParams();
  const program = programParam(search); // null = All
  const { isMulti } = usePrograms();
  const [rows, setRows] = useState(null);
  const [classes, setClasses] = useState([]);
  const [listErr, setListErr] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  function load() {
    Promise.all([api.teacher.listTests(), api.teacher.listClasses().catch(() => ({ rows: [] }))])
      .then(([t, c]) => {
        setRows(t.rows || []);
        setClasses(c.rows || []);
      })
      .catch((e) => setListErr(e.message));
  }
  useEffect(load, []);
  // Đổi chip -> bỏ bộ lọc level/lớp cũ (có thể thuộc chương trình khác).
  useEffect(() => {
    setLevelFilter("all");
    setClassFilter("all");
  }, [program]);

  const classById = useMemo(() => Object.fromEntries(classes.map((c) => [String(c._id), c])), [classes]);
  // Lọc theo chương trình (chip): đề và lớp của chương trình khác không xuất hiện
  // ở danh sách, bộ lọc level, bộ lọc lớp. Không có chip = tất cả như trước.
  const progRows = useMemo(
    () => (rows || []).filter((t) => !program || programOf(t) === program),
    [rows, program]
  );
  const progClasses = useMemo(
    () => classes.filter((c) => !program || programOf(c) === program),
    [classes, program]
  );
  const levels = useMemo(() => {
    const set = new Set(progRows.map((t) => t.level));
    progClasses.forEach((c) => set.add(c.level));
    return [...set].filter((x) => x != null).sort((a, b) => a - b);
  }, [progRows, progClasses]);

  const filtered = progRows.filter((t) => {
    if (levelFilter !== "all" && t.level !== Number(levelFilter)) return false;
    if (classFilter === "all") return true;
    if (classFilter === "__none__") return !t.classIds || t.classIds.length === 0;
    return (t.classIds || []).map(String).includes(classFilter);
  });

  async function del(t) {
    const ok = await dialog.confirm({
      title: "Delete mock test",
      message: "Delete this mock test? This action cannot be undone.",
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.teacher.deleteTest(t._id);
      dialog.toast("Mock test deleted");
      load();
    } catch (e) {
      dialog.alert({ tone: "error", title: "Failed to delete", message: e.message });
    }
  }

  const classesForFilter =
    levelFilter === "all" ? progClasses : progClasses.filter((c) => c.level === Number(levelFilter));

  return (
    <div className="tab-panel active">
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-clipboard" /></svg></div>
          <div>
            <h1>Mock Tests</h1>
            <p className="page-sub">Create and publish mock tests by level — 1 to 4 skills each</p>
          </div>
        </div>
        <button
          type="button"
          className="btn"
          onClick={() => router.push("/teacher/tests/new" + (program ? "?program=" + program : ""))}
        >
          <svg className="icon"><use href="#icon-plus" /></svg> Create Test
        </button>
      </div>

      <ProgramChips />

      <div className="card">
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          <select className="select-inline" value={levelFilter} onChange={(e) => { setLevelFilter(e.target.value); setClassFilter("all"); }}>
            <option value="all">All levels</option>
            {levels.map((l) => (
              <option key={l} value={l}>
                Level {l}
              </option>
            ))}
          </select>
          <select className="select-inline" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="all">All tests</option>
            <option value="__none__">Not assigned to any class yet</option>
            {classesForFilter.map((c) => (
              <option key={c._id} value={String(c._id)}>
                Class: {c.name}
              </option>
            ))}
          </select>
        </div>

        {listErr && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {listErr}
          </div>
        )}
        {!rows && !listErr && <div className="notice info">Loading...</div>}
        <div id="testsList" style={{ marginTop: 4 }}>
          {rows && filtered.length === 0 &&
            (program && progRows.length === 0 ? (
              <ProgramEmpty program={program} what="mock tests yet" />
            ) : (
              <div className="empty-state">No mock tests found.</div>
            ))}
          {filtered.map((t) => {
            const skills = TEST_SKILLS.filter((s) => {
              const sk = (t.skills || {})[s.key] || {};
              return s.kind === "sections" ? (sk.sections || []).length > 0 : (sk.prompts || []).length > 0;
            }).map((s) => s.label);
            const assigned = (t.classIds || []).map((id) => classById[String(id)]?.name).filter(Boolean);
            const sched = [];
            if (t.opensAt) sched.push("Opens: " + new Date(t.opensAt).toLocaleString("en-US"));
            if (t.closesAt) sched.push("Closes: " + new Date(t.closesAt).toLocaleString("en-US"));
            return (
              <div className="test-item" key={t._id}>
                <div className="meta">
                  <h4>
                    {(t.unit ? t.unit + " · " : "") + t.title}{" "}
                    <span className={"status-pill " + t.status}>{t.status === "published" ? "Published" : "Draft"}</span>
                    <ProgramBadge program={programOf(t)} isMulti={isMulti} />
                  </h4>
                  <p>
                    Level {t.level != null ? t.level : "-"} ·{" "}
                    {assigned.length ? "Classes: " + assigned.join(", ") : "All students"} · Skills:{" "}
                    {skills.length ? skills.join(", ") : "none yet"}
                    {sched.length ? " · " + sched.join(" · ") : ""}
                  </p>
                </div>
                <div className="actions">
                  <button
                    type="button"
                    className="btn secondary"
                    style={{ padding: "6px 12px", fontSize: ".8rem" }}
                    onClick={() => router.push("/teacher/tests/" + t._id + "/submissions")}
                  >
                    <svg className="icon"><use href="#icon-list" /></svg> Submissions
                  </button>
                  <button type="button" className="icon-btn" title="Edit" onClick={() => router.push("/teacher/tests/" + t._id)}>
                    <svg className="icon"><use href="#icon-edit" /></svg>
                  </button>
                  <button type="button" className="icon-btn danger" title="Delete" onClick={() => del(t)}>
                    <svg className="icon"><use href="#icon-trash" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function TeacherTestsPage() {
  return (
    <Suspense fallback={<div className="tab-panel active"><div className="notice info">Loading...</div></div>}>
      <TeacherTestsInner />
    </Suspense>
  );
}
