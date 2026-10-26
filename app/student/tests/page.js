"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { useMySubmissions } from "@/lib/client/useMySubmissions";
import { SKILL_TABS, QUESTION_SKILLS } from "@/lib/student/constants";
import { latestExamSub } from "@/lib/student/submissions";
import { PROGRAMS, programOf, testSkillLabel, levelWordOf } from "@/lib/curriculum";
import { formatScore, toeicSkillSummary } from "@/lib/scoreLabel";
import { usesToeicScale, toeicResultLine, formatToeicTotalFromSubs } from "@/lib/toeicScale";

// Kỹ năng hiển thị của 1 đề = testSkills của chương trình (API cũng trả kỹ năng ẩn là rỗng).
const tabsForRow = (row) => {
  const p = programOf(row);
  return SKILL_TABS.filter((t) => PROGRAMS[p].testSkills.includes(t.key)).map((t) => ({
    ...t,
    label: testSkillLabel(p, t.key, t.label),
  }));
};

function StudentStats({ subs }) {
  const testSubs = subs.filter((s) => (s.kind || "test") === "test");
  const pending = subs.filter(
    (s) => (s.kind === "writing" || s.kind === "speaking") && s.gradingStatus !== "graded"
  ).length;
  const avg = testSubs.length
    ? Math.round(
        testSubs.reduce((sum, s) => sum + (s.total > 0 ? (s.score / s.total) * 100 : 0), 0) /
          testSubs.length
      )
    : null;
  if (!testSubs.length && !pending) return null;

  const card = (icon, value, label, tone) => (
    <div className={"stat-card-v2" + (tone ? " tone-" + tone : "")}>
      <div className="stat-top">
        <span className="label">{label}</span>
        <span className="stat-icon"><svg className="icon"><use href={"#icon-" + icon} /></svg></span>
      </div>
      <div className="value">{value}</div>
    </div>
  );

  return (
    <div className="stat-card-grid" id="studentStatGrid" style={{ display: "grid" }}>
      {card("clipboard", testSubs.length, "Mock Tests Taken")}
      {card("chart-bar", avg != null ? avg + "%" : "-", "Average Score", "success")}
      {card("warning", pending, "Pending Teacher Review", pending > 0 ? "warn" : "")}
    </div>
  );
}

export default function TestsPage() {
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState("");
  const { subs } = useMySubmissions();
  // Tiêu đề trang liệt kê kỹ năng theo các đề đang có. IELTS: đủ 4 kỹ năng như cũ.
  const availableTabs = rows && rows.length
    ? rows.flatMap((r) => tabsForRow(r)).filter((t, i, arr) => arr.findIndex((x) => x.key === t.key) === i)
    : SKILL_TABS;
  const skillNames = availableTabs.map((t) => t.label).join(", ");

  useEffect(() => {
    api.student
      .listTests()
      .then((d) => setRows(d.rows || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <section>
      <div className="page-head">
        <div className="head-left">
          <div className="page-head-icon"><svg className="icon"><use href="#icon-clipboard" /></svg></div>
          <div>
            <h1>Mock Tests</h1>
            <p className="page-sub">
              Mock exams — {skillNames}
              {rows && rows[0] && rows[0].levelName ? ` · ${levelWordOf(rows[0].program)} ${rows[0].level} · ${rows[0].levelName}` : ""}
            </p>
          </div>
        </div>
      </div>

      <StudentStats subs={subs} />

      <div className="card">
        {err && (
          <div className="notice error">
            <svg className="icon"><use href="#icon-warning" /></svg> {err}
          </div>
        )}
        {!rows && !err && <div className="notice info">Loading test list...</div>}
        <div id="testList">
          {rows && rows.length === 0 && (
            <div className="empty-state">No mock tests published yet.</div>
          )}
          {(rows || []).map((row) => (
            <TestCard key={row.id} row={row} subs={subs} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TestCard({ row, subs }) {
  const heading = (row.unit ? row.unit + " · " : "") + row.title;

  if (row.locked) {
    const opensText = row.opensAt ? new Date(row.opensAt).toLocaleString("en-US") : "";
    return (
      <div className="test-exam-card locked">
        <div className="meta">
          <h4>
            <svg className="icon"><use href="#icon-lock" /></svg> {heading}
          </h4>
          <p>Locked — opens {opensText}</p>
        </div>
      </div>
    );
  }

  // Mock Test TOEIC: "38/50 correct · ≈ 385 / 495 (estimated)" + tổng L+R. IELTS giữ "score/total".
  const toeic = usesToeicScale(programOf(row));
  const rowTabs = tabsForRow(row);
  const bits = [];
  rowTabs.forEach((tab) => {
    const sub = latestExamSub(subs, row.id, tab.key);
    if (!sub) return;
    if (tab.key === "listening" || tab.key === "reading")
      bits.push(`${tab.label}: ${toeic ? toeicResultLine(tab.key, sub.score, sub.total) : `${sub.score}/${sub.total}`}`);
    else {
      // TOEIC Writing/Speaking: tổng điểm thô các đề ("Speaking: 27/35 points"), chưa đủ thì "x/y graded".
      const sw = toeicSkillSummary(subs, row.id, tab.key, row.skills?.[tab.key]?.count);
      if (sw) bits.push(`${tab.label}: ${sw.text}`);
      else if (sub.gradingStatus === "graded") bits.push(`${tab.label}: ${formatScore(sub)}`);
    }
  });
  if (toeic) {
    const totalText = formatToeicTotalFromSubs(latestExamSub(subs, row.id, "listening"), latestExamSub(subs, row.id, "reading"));
    if (totalText) bits.push(`Total: ${totalText}`);
  }

  return (
    <div className="test-exam-card">
      <div className="meta">
        <h4>
          {heading}
          {row.closed && <span className="pill pill-muted"> Closed</span>}
        </h4>
        {bits.length > 0 && <p className="exam-result-summary">Results — {bits.join(" · ")}</p>}
      </div>
      <div className="exam-skill-grid">
        {rowTabs.map((tab) => {
          const meta = row.skills?.[tab.key];
          if (!meta || !meta.present) return null;
          return <SkillBox key={tab.key} row={row} tab={tab} meta={meta} subs={subs} />;
        })}
      </div>
    </div>
  );
}

function SkillBox({ row, tab, meta, subs }) {
  const router = useRouter();
  const sub = latestExamSub(subs, row.id, tab.key);
  const isQuestion = QUESTION_SKILLS.includes(tab.key);

  const sw = !isQuestion ? toeicSkillSummary(subs, row.id, tab.key, meta.count) : null;
  let statusNode;
  let cta = "Start";
  if (!sub) {
    statusNode = isQuestion ? (
      <span className="muted">0/{meta.count} questions done</span>
    ) : (
      <span className="muted">Not started</span>
    );
  } else if (isQuestion) {
    statusNode = (
      <>
        <span className="muted">{meta.count}/{meta.count} questions done</span>
        <br />
        <b>Score: {sub.score}/{sub.total}</b>
      </>
    );
    cta = "Retake";
  } else if (sw) {
    statusNode = sw.complete ? <b>Graded: {sw.text}</b> : <span className="muted">Submitted — {sw.text}</span>;
    cta = "Redo";
  } else if (sub.gradingStatus === "graded") {
    statusNode = <b>Graded: {formatScore(sub)}</b>;
    cta = "Redo";
  } else {
    statusNode = <span className="muted">Submitted — pending review</span>;
    cta = "Redo";
  }

  return (
    <div className="exam-skill-box">
      <div className="exam-skill-head">
        <svg className="icon"><use href={"#icon-" + tab.icon} /></svg> <b>{tab.label}</b>
      </div>
      <div className="exam-skill-status">{statusNode}</div>
      <button
        type="button"
        className="btn secondary exam-skill-cta"
        style={{ marginTop: 8, padding: "6px 14px", fontSize: ".82rem" }}
        onClick={() => router.push(`/student/tests/${row.id}/${tab.key}`)}
      >
        {cta}
      </button>
    </div>
  );
}
