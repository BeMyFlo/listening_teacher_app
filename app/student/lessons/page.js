"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { LESSON_CATS } from "@/lib/student/constants";
import { unitProgress } from "@/lib/student/submissions";

function CategoryBadges({ unit }) {
  return (
    <div className="unit-overview-badges">
      {LESSON_CATS.map((cat) => {
        const c = (unit.categories || []).find((x) => x.key === cat.key);
        const has = c && c.hasContent;
        return has ? (
          <span
            key={cat.key}
            className="cat-badge"
            style={{ background: cat.color + "22", color: cat.color }}
          >
            {cat.label}
          </span>
        ) : (
          <span key={cat.key} className="cat-badge cat-badge-empty">
            {cat.label}
          </span>
        );
      })}
    </div>
  );
}

export default function LessonsPage() {
  const router = useRouter();
  const [units, setUnits] = useState(null);
  const [err, setErr] = useState("");
  const [sort, setSort] = useState("order");
  const [selectedId, setSelectedId] = useState(null);
  const { subs } = useMySubmissions();

  useEffect(() => {
    api.student
      .listUnits()
      .then((d) => setUnits(d.rows || []))
      .catch((e) => setErr(e.message));
  }, []);

  const sorted = useMemo(() => {
    const arr = (units || []).slice();
    if (sort === "newest")
      arr.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return arr;
  }, [units, sort]);

  const withProgress = (units || []).map((u) => ({ u, p: unitProgress(u, subs) }));
  const featured =
    (selectedId && withProgress.find((x) => String(x.u.id) === String(selectedId))) ||
    withProgress.find((x) => x.p.pct > 0 && x.p.pct < 100) ||
    withProgress.find((x) => x.p.pct === 0) ||
    withProgress[0] ||
    null;

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-book-open" /></svg></div>
          <div>
            <h1>Lessons</h1>
            <p className="page-sub">
              Units by level — Grammar, Vocabulary, Listening, Reading, Writing, Speaking
            </p>
          </div>
        </div>
      </div>

      <div id="lessonsList">
        {err && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> Failed to load lesson units: {err}
          </div>
        )}
        {!units && !err && <div className="notice info">Loading lesson units...</div>}
        {units && units.length === 0 && (
          <div id="unitsList">
            <div className="empty-state">No lesson units available for your level.</div>
          </div>
        )}

        {featured && (
          <div id="unitsFeatured">
            <div className="unit-featured-card">
              <div className="unit-featured-icon"><svg className="icon"><use href="#icon-book-open" /></svg></div>
              <div style={{ flex: 1, minWidth: 220 }}>
                <h3 style={{ margin: "0 0 4px" }}>{featured.u.name}</h3>
                <CategoryBadges unit={featured.u} />
              </div>
              <div className="unit-featured-progress">
                <span className="label">Overall Progress</span>
                <span className="pct">{featured.p.pct}%</span>
                <div className="progress-bar">
                  <div className="progress-bar-fill" style={{ width: featured.p.pct + "%" }} />
                </div>
                <span className="sub">
                  {featured.p.completed}/{featured.p.totalItems} item(s) completed
                </span>
              </div>
              <button
                type="button"
                className="btn unit-featured-cta"
                onClick={() => router.push("/student/lessons/" + featured.u.id)}
              >
                <svg className="icon"><use href="#icon-play" /></svg>{" "}
                {featured.p.pct === 0 ? "Start Lesson" : featured.p.pct === 100 ? "Review Lesson" : "Continue Lesson"}
              </button>
            </div>
          </div>
        )}

        {units && units.length > 0 && (
          <>
            <div className="page-head" id="unitsListHead" style={{ marginTop: 22 }}>
              <div className="head-left">
                <h3 style={{ margin: 0 }}>All Units</h3>
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <select
                  className="select-inline"
                  value={sort}
                  onChange={(e) => setSort(e.target.value)}
                >
                  <option value="order">Unit order</option>
                  <option value="newest">Newest first</option>
                </select>
              </div>
            </div>

            <div id="unitsList" style={{ marginTop: 10 }}>
              {sorted.map((u, idx) => {
                const p = unitProgress(u, subs);
                const skillsWithContent = (u.categories || []).filter((c) => c.hasContent).length;
                const statusLabel =
                  p.pct === 100 ? "Completed" : p.pct === 0 ? "Not started" : "In progress";
                const color =
                  p.pct === 100 ? "var(--green)" : p.pct === 0 ? "var(--muted)" : "var(--blue)";
                const isSelected = featured && String(u.id) === String(featured.u.id);
                return (
                  <div
                    key={u.id}
                    className={"unit-list-row" + (isSelected ? " selected" : "")}
                    onClick={() => setSelectedId(u.id)}
                  >
                    <div className="unit-list-num">{String(idx + 1).padStart(2, "0")}</div>
                    <div className="unit-list-meta">
                      <h4>{u.name}</h4>
                      <p>
                        <span className="meta-icon">
                          <svg className="icon"><use href="#icon-headphones" /></svg> {skillsWithContent}/
                          {LESSON_CATS.length} skills
                        </span>
                        <span className="meta-icon">
                          <svg className="icon"><use href="#icon-clipboard" /></svg> {p.totalItems} item(s)
                        </span>
                      </p>
                    </div>
                    <div className="unit-list-progress">
                      <div className="unit-list-pct" style={{ color }}>
                        {p.pct}%
                      </div>
                      <div className="unit-list-status" style={{ color }}>
                        {statusLabel}
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{ width: p.pct + "%", background: color }}
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="icon-btn unit-list-goto"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/student/lessons/" + u.id);
                      }}
                    >
                      <svg className="icon"><use href="#icon-chevron-right" /></svg>
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
