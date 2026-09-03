// Bảng xếp hạng trong 1 lớp — điểm TÍCH LUỸ (all-time).
//
// Điểm mỗi học sinh = tổng số câu đúng ở mọi bài tập + mock test
//                   + tổng band Writing/Speaking đã được chấm.
// Cả lớp học cùng nội dung (lọc theo level lớp) nên tổng câu như nhau -> so sánh công bằng.
// Mỗi bài chỉ tính LẦN LÀM MỚI NHẤT.

// Khoá định danh 1 "item" để chống tính trùng khi học sinh làm lại.
function itemKey(s) {
  if (s.kind === "exercise") return s.exerciseId ? "ex:" + s.exerciseId : null;
  if (s.kind === "test") return s.testId ? "ts:" + s.testId + ":" + (s.testSkill || "") : null;
  if (s.kind === "writing" || s.kind === "speaking") {
    if (s.promptId) return "pr:" + s.promptId;
    if (s.testId) return "tw:" + s.testId + ":" + (s.testSkill || s.kind);
  }
  return null;
}

function pointsFor(s) {
  if (s.kind === "exercise" || s.kind === "test") return Number(s.score) || 0;
  if ((s.kind === "writing" || s.kind === "speaking") && s.gradingStatus === "graded") {
    return Number(s.manualScore) || 0;
  }
  return 0;
}

// students: [{ _id, name }]; submissions: mọi submission của học sinh trong lớp.
// -> { rows: [{ studentId, name, points, rank, isMe }], myRank, myPoints }
function buildClassLeaderboard({ students = [], submissions = [], meId } = {}) {
  const me = String(meId || "");

  // Gom submission theo học sinh, giữ bản mới nhất cho mỗi item.
  const byStudent = new Map();
  for (const st of students) {
    byStudent.set(String(st._id), { studentId: String(st._id), name: st.name || "Student", seen: new Map() });
  }
  const ordered = (submissions || [])
    .slice()
    .sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0));
  for (const s of ordered) {
    const row = byStudent.get(String(s.studentId));
    if (!row) continue;
    const key = itemKey(s);
    if (!key || row.seen.has(key)) continue; // đã có bản mới hơn
    row.seen.set(key, pointsFor(s));
  }

  const rows = [...byStudent.values()]
    .map((r) => ({
      studentId: r.studentId,
      name: r.name,
      points: [...r.seen.values()].reduce((a, b) => a + b, 0),
    }))
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));

  // Xếp hạng kiểu thi đấu: hoà điểm cùng hạng (1,2,2,4).
  let rank = 0;
  let prev = null;
  rows.forEach((r, i) => {
    if (prev === null || r.points !== prev) rank = i + 1;
    r.rank = rank;
    r.isMe = r.studentId === me;
    prev = r.points;
  });

  const mine = rows.find((r) => r.isMe) || null;

  // Top 5 + luôn kèm dòng của học sinh đang xem.
  const top = rows.slice(0, 5);
  if (mine && !top.some((r) => r.isMe)) top.push(mine);

  return {
    rows: top,
    myRank: mine ? mine.rank : null,
    myPoints: mine ? mine.points : 0,
  };
}

module.exports = { buildClassLeaderboard, itemKey, pointsFor };
