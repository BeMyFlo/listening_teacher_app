// Thống kê % đúng theo chủ điểm (Phase 12 G4, D9). CommonJS thuần, không DB.
// Nhãn lấy từ field.topic HIỆN TẠI của đề; đúng/sai lấy từ submission.detail ({ id, correct }).

const { topicLabel, DIFFICULTIES } = require("../generalTopics");
const { PROGRAMS, programOf } = require("../curriculum");

const S = (v) => (v == null ? "" : String(v));

// Khoá nhóm của 1 submission: id field chỉ duy nhất trong 1 skill (Mock Test) / 1 exercise (Unit).
function subKey(sub) {
  if (sub.kind === "test" && sub.testSkill) return "skill:" + S(sub.testSkill);
  if (sub.kind === "exercise" && sub.exerciseId) return "ex:" + S(sub.exerciseId);
  return "";
}

// sectionsList: [{ key: "skill:listening" | "ex:<exerciseId>", sections }]
// submissions: mọi lần nộp (có thể nhiều học sinh / nhiều lần); chỉ lần MỚI NHẤT mỗi học sinh mỗi nhóm được tính.
function aggregateByTopic(sectionsList, submissions) {
  const groups = new Map(); // key -> Map(fieldId -> { topic, difficulty })
  const topics = new Map(); // topic -> { questions, attempts, correct, diff }
  const entry = (topic) => {
    if (!topics.has(topic)) topics.set(topic, { questions: 0, attempts: 0, correct: 0, diff: {} });
    return topics.get(topic);
  };

  (sectionsList || []).forEach((g) => {
    const fm = new Map();
    ((g && g.sections) || []).forEach((sec) =>
      (sec.fields || []).forEach((f) => {
        const topic = S(f.topic).trim();
        if (!topic) return;
        fm.set(S(f.id), { topic, difficulty: S(f.difficulty) });
        entry(topic).questions += 1;
      })
    );
    groups.set(S(g.key), fm);
  });
  if (!topics.size) return [];

  // Lần nộp mới nhất theo (học sinh, nhóm).
  const latest = new Map();
  (submissions || []).forEach((s) => {
    const key = subKey(s);
    if (!key || !groups.has(key) || !Array.isArray(s.detail)) return;
    const lk = S(s.studentId) + "|" + key;
    const prev = latest.get(lk);
    if (!prev || new Date(s.submittedAt) > new Date(prev.submittedAt)) latest.set(lk, s);
  });

  latest.forEach((s, lk) => {
    const fm = groups.get(subKey(s));
    s.detail.forEach((d) => {
      const f = fm.get(S(d.id));
      if (!f) return;
      const t = entry(f.topic);
      const ok = !!d.correct && !d.partial; // trả lời một phần coi là chưa đúng
      t.attempts += 1;
      if (ok) t.correct += 1;
      if (f.difficulty) {
        const b = t.diff[f.difficulty] || (t.diff[f.difficulty] = { attempts: 0, correct: 0 });
        b.attempts += 1;
        if (ok) b.correct += 1;
      }
    });
  });

  const out = [];
  topics.forEach((t, topic) => {
    const diffKeys = DIFFICULTIES.map((x) => x.key).filter((k) => t.diff[k]);
    out.push({
      topic,
      label: topicLabel(topic),
      ...(diffKeys.length
        ? { difficultyBreakdown: diffKeys.map((k) => ({ difficulty: k, ...t.diff[k], pct: Math.round((t.diff[k].correct / t.diff[k].attempts) * 100) })) }
        : {}),
      questions: t.questions,
      attempts: t.attempts,
      correct: t.correct,
      pct: t.attempts ? Math.round((t.correct / t.attempts) * 100) : null,
    });
  });
  // Yếu nhất lên đầu; chủ điểm chưa có lượt làm xuống cuối.
  out.sort((a, b) => {
    if (a.pct == null && b.pct == null) return a.label.localeCompare(b.label);
    if (a.pct == null) return 1;
    if (b.pct == null) return -1;
    return a.pct - b.pct || a.label.localeCompare(b.label);
  });
  return out;
}

function testSectionsList(test) {
  const skills = (test && test.skills) || {};
  return ["listening", "reading"].map((k) => ({ key: "skill:" + k, sections: (skills[k] && skills[k].sections) || [] }));
}

function unitSectionsList(unit) {
  const out = [];
  const add = (ex) => out.push({ key: "ex:" + S(ex._id), sections: ex.sections || [] });
  (unit.categories || []).forEach((cat) => {
    (cat.exercises || []).forEach(add);
    (cat.topics || []).forEach((t) => (t.exercises || []).forEach(add));
    (cat.groups || []).forEach((g) => (g.exercises || []).forEach(add));
  });
  return out;
}

// Trả mảng topicStats, hoặc null khi chương trình không bật questionBank / đề chưa gắn chủ điểm
// (API chỉ thêm key `topicStats` khi khác null -> IELTS/TOEIC không đổi).
function finish(doc, list, submissions) {
  if (!PROGRAMS[programOf(doc)].questionBank) return null;
  const stats = aggregateByTopic(list, submissions);
  return stats.length ? stats : null;
}
const topicStatsForTest = (test, submissions) => finish(test, testSectionsList(test), submissions);
const topicStatsForUnit = (unit, submissions) => finish(unit, unitSectionsList(unit), submissions);

module.exports = { aggregateByTopic, topicStatsForTest, topicStatsForUnit };
