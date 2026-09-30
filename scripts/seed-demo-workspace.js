// Dựng workspace DEMO công khai: 1 giáo viên + lớp + học sinh + bài học + bài thi
// + bài nộp/chấm + điểm danh, để người ngoài đăng nhập xem app chạy thế nào.
//
//   node scripts/seed-demo-workspace.js --dev  --teacher tobi.demo             # xem trước
//   node scripts/seed-demo-workspace.js --live --teacher tobi.demo --apply     # ghi thật
//   node scripts/seed-demo-workspace.js --live --teacher tobi.demo --apply --reset   # dựng lại từ đầu (làm mới ngày, khôi phục sau khi khách nghịch)
//   node scripts/seed-demo-workspace.js --live --wipe --apply                  # xoá sạch workspace demo
//
// AN TOÀN
// - Mặc định DRY-RUN; --live/--dev bắt buộc (scripts/dbTarget.js).
// - Chỉ chạm tài liệu thuộc workspace có settings.demo === true; không bao giờ
//   xoá/đổi user không thuộc workspace demo. Trùng username với user khác → dừng.
// - KHÔNG nạp .env.local (chỉ dbTarget đọc URI) nên mailer/Gemini không có khoá:
//   script không thể gửi email hay tốn tiền AI.
const mongoose = require("mongoose");
const { resolveTarget } = require("./dbTarget");
const users = require("../lib/users");
const { gradeSubmission } = require("../lib/grade");
const { overallBand, resolveVariant } = require("../lib/grading/rubric");
const { validateAnnotations } = require("../lib/grading/annotate");
const { notifyTeachersOfSubmission } = require("../lib/notifications/teacher");
const { notifyStudentGraded } = require("../lib/notifications/student");
const { CHANGELOG } = require("../lib/changelog");
const C = require("./demo/content");

const User = require("../lib/models/User");
const Teacher = require("../lib/models/Teacher");
const Student = require("../lib/models/Student");
const Class = require("../lib/models/Class");
const Unit = require("../lib/models/Unit");
const Test = require("../lib/models/Test");
const Audio = require("../lib/models/Audio");
const Image = require("../lib/models/Image");
const Submission = require("../lib/models/Submission");
const StudentNote = require("../lib/models/StudentNote");
const Notification = require("../lib/models/Notification");
const AttendanceSession = require("../lib/models/AttendanceSession");
const GradingJob = require("../lib/models/GradingJob");
const DeadlineEmailJob = require("../lib/models/DeadlineEmailJob");
const Workspace = require("../lib/models/Workspace");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const AuditLog = require("../lib/models/AuditLog");
const AiLog = require("../lib/models/AiLog");
const Ticket = require("../lib/models/Ticket");

const USAGE =
  "Usage: node scripts/seed-demo-workspace.js <--live|--dev|URI> --teacher <username> [--password 123456] " +
  "[--teacher-name \"Demo Teacher\"] [--name \"Demo English Center\"] [--apply] [--reset]\n" +
  "       node scripts/seed-demo-workspace.js <--live|--dev|URI> --wipe [--apply]";

const argv = process.argv.slice(2);
const APPLY = argv.includes("--apply");
const RESET = argv.includes("--reset");
const WIPE = argv.includes("--wipe");
const arg = (flag, fallback = null) => {
  const i = argv.indexOf(flag);
  return i !== -1 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : fallback;
};

// Mọi collection có workspaceId của workspace demo (thứ tự xoá: con trước cha).
const WS_MODELS = [
  ["notifications", Notification], ["studentnotes", StudentNote], ["submissions", Submission],
  ["attendancesessions", AttendanceSession], ["gradingjobs", GradingJob], ["deadlineemailjobs", DeadlineEmailJob],
  ["units", Unit], ["tests", Test], ["audios", Audio], ["images", Image], ["classes", Class],
  ["students", Student], ["teachers", Teacher], ["workspacemembers", WorkspaceMember],
  ["auditlogs", AuditLog], ["ailogs", AiLog], ["tickets", Ticket],
];

// ---- thời gian ------------------------------------------------------------
const NOW = Date.now();
const DAY = 24 * 3600 * 1000;
const at = (daysAgo, hour = 9) => {
  const d = new Date(NOW - daysAgo * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};
const dueIn = (days) => at(-days, 23); // hạn nộp: 23:00 của ngày đó
const vnDate = (d) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);

// PRNG có seed cố định -> chạy lại ra cùng điểm số
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- xoá workspace demo ---------------------------------------------------
async function demoWorkspace() {
  return Workspace.findOne({ "settings.demo": true });
}

async function countDemo(ws) {
  const out = {};
  for (const [name, M] of WS_MODELS) out[name] = await M.countDocuments({ workspaceId: ws._id });
  return out;
}

async function wipeDemo(ws) {
  if (!ws || !ws.settings || ws.settings.demo !== true) throw new Error("REFUSING: not a demo workspace");
  const [teachers, students] = await Promise.all([
    Teacher.find({ workspaceId: ws._id }).select("_id").lean(),
    Student.find({ workspaceId: ws._id }).select("_id").lean(),
  ]);
  await User.deleteMany({
    $or: [{ teacherId: { $in: teachers.map((t) => t._id) } }, { studentId: { $in: students.map((s) => s._id) } }],
  });
  for (const [, M] of WS_MODELS) await M.deleteMany({ workspaceId: ws._id });
  await Workspace.deleteOne({ _id: ws._id, "settings.demo": true });
}

// ---- dựng dữ liệu ---------------------------------------------------------
function findExercise(unit, catKey, title) {
  const cat = unit.categories.find((c) => c.key === catKey);
  const lists = [cat.exercises, ...(cat.topics || []).map((t) => t.exercises), ...(cat.groups || []).map((g) => g.exercises)];
  for (const list of lists) {
    const ex = list.find((e) => e.title === title);
    if (ex) return ex;
  }
  throw new Error(`exercise not found: ${catKey}/${title}`);
}
const findPrompt = (unit, catKey, title) => {
  const p = unit.categories.find((c) => c.key === catKey).prompts.find((x) => x.title === title);
  if (!p) throw new Error(`prompt not found: ${title}`);
  return p;
};

function makeAnswers(block, skill, rand) {
  const answers = {};
  for (const sec of block.sections || []) {
    for (const f of sec.fields || []) {
      const ok = rand() < skill;
      if (f.type === "choice") {
        const wrong = (f.options || []).find((o) => !(f.answers || []).includes(o.value));
        answers[f.id] = ok ? f.answers[0] : (wrong && wrong.value) || "";
      } else {
        const right = (f.answers || [""])[0];
        answers[f.id] = ok ? right : rand() < 0.35 ? "" : right.slice(0, Math.max(1, right.length - 2)) + "x";
      }
    }
  }
  return answers;
}

// Hạn áp cho (lớp, kỹ năng): hạn riêng kỹ năng thắng hạn chung của Unit.
function deadlineFor(unit, classId, catKey) {
  const own = (unit.deadlines || []).filter((d) => String(d.classId) === String(classId));
  const hit = own.find((d) => d.categoryKey === catKey) || own.find((d) => !d.categoryKey);
  return hit ? hit.dueAt : null;
}

async function seed({ teacherUsername, password, teacherName, workspaceName }) {
  const rand = rng(20260930);
  const stats = {};
  const bump = (k, n = 1) => (stats[k] = (stats[k] || 0) + n);

  // 1) giáo viên + workspace (đánh dấu demo NGAY sau khi tạo)
  const { user: tUser, teacher, workspace } = await users.createTeacherWithWorkspace({
    name: teacherName, username: teacherUsername, password, workspaceName,
  });
  await Workspace.updateOne({ _id: workspace._id }, { $set: { "settings.demo": true, locale: "en" } });
  const wsId = workspace._id;
  const changelog = CHANGELOG[0] && CHANGELOG[0].version;
  if (changelog) await Teacher.updateOne({ _id: teacher._id }, { $set: { lastSeenChangelogVersion: changelog } });

  // 2) lớp + học sinh
  const classes = {};
  for (const c of C.CLASSES) classes[c.key] = await Class.create({ workspaceId: wsId, name: c.name, level: c.level });
  bump("classes", C.CLASSES.length);

  const students = {};
  for (const s of C.STUDENTS) {
    const { student } = await users.createStudent({
      name: s.name, username: `demo.${s.user}`, password, classId: classes[s.cls]._id, workspaceId: wsId,
    });
    if (changelog) await Student.updateOne({ _id: student._id }, { $set: { lastSeenChangelogVersion: changelog } });
    students[s.key] = { doc: student, def: s };
  }
  bump("students", C.STUDENTS.length);

  // 3) Unit (đủ 6 kỹ năng ở Unit 1)
  const cid = (k) => classes[k]._id;
  const mkUnit = async (def, extra) => {
    const payload = { workspaceId: wsId, name: def.name, level: def.level, order: def.order, status: def.status, ...extra };
    if (def.categories) payload.categories = def.categories;
    return Unit.create(payload);
  };
  // classIds rỗng = CHƯA giao cho lớp nào (học sinh không thấy) -> luôn giao rõ cho lớp.
  const uA1 = await mkUnit(C.unitA1(), {
    classIds: [cid("A")],
    deadlines: [
      { classId: cid("A"), categoryKey: "grammar", dueAt: dueIn(-6) },
      { classId: cid("A"), categoryKey: "vocabulary", dueAt: dueIn(-2) },
      { classId: cid("A"), categoryKey: "listening", dueAt: dueIn(7) },
      { classId: cid("A"), categoryKey: "reading", dueAt: dueIn(3) },
      { classId: cid("A"), categoryKey: "writing", dueAt: dueIn(5) },
    ],
  });
  const uA2 = await mkUnit(C.unitA2(), { classIds: [cid("A")], deadlines: [{ classId: cid("A"), categoryKey: null, dueAt: dueIn(10) }] });
  const uB1 = await mkUnit(C.unitB1(), {
    classIds: [cid("B")],
    deadlines: [
      { classId: cid("B"), categoryKey: "grammar", dueAt: dueIn(-4) },
      { classId: cid("B"), categoryKey: "reading", dueAt: dueIn(2) },
      { classId: cid("B"), categoryKey: "writing", dueAt: dueIn(6) },
    ],
  });
  await mkUnit(C.unitB2Draft(), { classIds: [cid("B")] });
  bump("units", 4);

  // 4) bài thi thử
  const testDef = C.mockTest();
  const test = await Test.create({ workspaceId: wsId, ...testDef, classIds: [cid("A")] });
  bump("tests");

  // 5) bài nộp tự chấm (exercise)
  const unitObj = (u) => u.toObject();
  async function submitExercise(u, catKey, title, sKey, daysAgoN, hour = 10) {
    const st = students[sKey];
    const uo = unitObj(u);
    const ex = findExercise(uo, catKey, title);
    const answers = makeAnswers(ex, st.def.skill, rand);
    const { score, total, detail } = gradeSubmission(ex, answers);
    const submittedAt = at(daysAgoN, hour);
    const dueAt = deadlineFor(uo, st.doc.classId, catKey);
    await Submission.create({
      workspaceId: wsId, studentId: st.doc._id, studentName: st.doc.name, kind: "exercise",
      unitId: u._id, categoryKey: catKey, exerciseId: ex._id, exerciseTitle: ex.title,
      answers, detail, score, total, isLate: !!dueAt && submittedAt > dueAt, dueAt: dueAt || undefined, submittedAt,
    });
    bump("submissions");
  }

  const A = ["a0", "a1", "a2", "a3", "a4", "a5"];
  const B = ["b0", "b1", "b2", "b3", "b4"];
  // Unit A1
  for (const [i, k] of A.entries()) await submitExercise(uA1, "grammar", "Choose the correct form", k, 8 - (i % 2));
  for (const k of ["a0", "a1", "a2", "a3", "a5"]) await submitExercise(uA1, "grammar", "How often?", k, 7);
  for (const [k, d] of [["a0", 5], ["a1", 4], ["a2", 3], ["a5", 3], ["a3", 1]]) await submitExercise(uA1, "vocabulary", "Fill in the blank", k, d); // a3 nộp trễ
  for (const [k, d] of [["a0", 2], ["a1", 2], ["a2", 1], ["a5", 1]]) await submitExercise(uA1, "reading", "Passage 1 — Cycling to work", k, d);
  await submitExercise(uA1, "listening", "Section 1 — Booking a table", "a0", 1);
  // Unit A2
  for (const k of ["a0", "a5"]) await submitExercise(uA2, "grammar", "Quantifiers", k, 1);
  await submitExercise(uA2, "reading", "Passage 1 — Sleep and health", "a0", 1, 15);
  // Unit B1
  for (const [k, d] of [["b0", 6], ["b1", 6], ["b3", 5], ["b2", 3]]) await submitExercise(uB1, "grammar", "Active to passive", k, d); // b2 trễ
  for (const k of ["b0", "b1", "b3"]) await submitExercise(uB1, "reading", "Passage 1 — Smartphones in class", k, 1);
  for (const k of ["b0", "b3"]) await submitExercise(uB1, "vocabulary", "Complete the sentences", k, 2);

  // 6) bài thi thử: reading + listening
  const tObj = test.toObject();
  for (const [k, d] of [["a0", 5], ["a1", 4], ["a2", 4], ["a5", 3]]) {
    const st = students[k];
    const answers = makeAnswers(tObj.skills.reading, st.def.skill, rand);
    const { score, total, detail } = gradeSubmission(tObj.skills.reading, answers);
    await Submission.create({
      workspaceId: wsId, studentId: st.doc._id, studentName: st.doc.name, kind: "test", testId: test._id,
      testTitle: `${test.unit} · ${test.title}`, testSkill: "reading", answers, detail, score, total, submittedAt: at(d, 14),
    });
    bump("submissions");
  }
  for (const k of ["a0", "a1"]) {
    const st = students[k];
    const answers = makeAnswers(tObj.skills.listening, st.def.skill, rand);
    const { score, total, detail } = gradeSubmission(tObj.skills.listening, answers);
    await Submission.create({
      workspaceId: wsId, studentId: st.doc._id, studentName: st.doc.name, kind: "test", testId: test._id,
      testTitle: `${test.unit} · ${test.title}`, testSkill: "listening", answers, detail, score, total, submittedAt: at(4, 16),
    });
    bump("submissions");
  }

  // 7) bài Writing: đã chấm + đang chờ chấm
  async function submitWriting({ unit, sKey, promptTitle, essayKey, submittedDaysAgo, graded, gradedDaysAgo }) {
    const st = students[sKey];
    const uo = unitObj(unit);
    const prompt = findPrompt(uo, "writing", promptTitle);
    const essay = C.ESSAYS[essayKey];
    const submittedAt = at(submittedDaysAgo, 20);
    const dueAt = deadlineFor(uo, st.doc.classId, "writing");
    const doc = {
      workspaceId: wsId, studentId: st.doc._id, studentName: st.doc.name, kind: "writing", unitId: unit._id,
      categoryKey: "writing", promptId: prompt._id, essayText: essay.text, attemptNumber: 1,
      rubricVariant: resolveVariant("writing", prompt.writingTask), gradingStatus: "submitted",
      isLate: !!dueAt && submittedAt > dueAt, dueAt: dueAt || undefined, submittedAt,
    };
    if (graded) {
      const annotations = essay.annotations.map((a, i) => {
        const start = essay.text.indexOf(a.quote);
        if (start < 0) throw new Error(`annotation quote not found in ${essayKey}: ${a.quote}`);
        return {
          id: `an${i + 1}`, start, end: a.action === "insert" ? start : start + a.quote.length, quote: a.quote,
          action: a.action, insertText: a.insertText || "", category: a.category, criterion: a.criterion || null,
          comment: a.comment || "", severity: a.severity || null, source: "teacher",
        };
      });
      const bad = validateAnnotations(essay.text, annotations);
      if (bad) throw new Error(`invalid annotations for ${essayKey}: ${bad}`);
      Object.assign(doc, {
        gradingStatus: "graded", criteria: essay.criteria, manualScore: overallBand(essay.criteria),
        manualFeedback: essay.feedback, annotations, gradeSource: "teacher", gradedAt: at(gradedDaysAgo, 11),
        gradedBy: teacher._id, priorities: essay.priorities, topicVocabulary: essay.topicVocabulary,
        improvedSample: essay.improvedSample,
      });
    }
    const sub = await Submission.create(doc);
    bump("submissions");
    bump(graded ? "writing graded" : "writing pending");
    const lean = { _id: st.doc._id, name: st.doc.name, classId: st.doc.classId };
    if (graded) {
      await notifyStudentGraded({ submission: sub.toObject(), teacherName: teacherName });
      await Notification.updateMany({ submissionId: sub._id, type: "submission_graded" }, { $set: { createdAt: sub.gradedAt } });
    } else {
      await notifyTeachersOfSubmission({
        ws: { workspaceId: wsId }, student: lean, submission: sub.toObject(), unitOrTestName: unit.name, skill: "writing", itemLabel: prompt.title,
      });
      await Notification.updateMany({ submissionId: sub._id, type: "submission_received" }, { $set: { createdAt: submittedAt } });
    }
  }
  await submitWriting({ unit: uA1, sKey: "a0", promptTitle: "Task 2 — Working from home", essayKey: "a0_wfh", submittedDaysAgo: 4, graded: true, gradedDaysAgo: 3 });
  await submitWriting({ unit: uA1, sKey: "a1", promptTitle: "Task 2 — Working from home", essayKey: "a1_wfh", submittedDaysAgo: 3, graded: true, gradedDaysAgo: 2 });
  await submitWriting({ unit: uA1, sKey: "a2", promptTitle: "Task 2 — Working from home", essayKey: "a2_wfh", submittedDaysAgo: 1, graded: false });
  await submitWriting({ unit: uA1, sKey: "a3", promptTitle: "Task 1 — Free-time activities", essayKey: "a3_free", submittedDaysAgo: 0, graded: false });
  await submitWriting({ unit: uB1, sKey: "b0", promptTitle: "Task 2 — Technology and children", essayKey: "b0_tech", submittedDaysAgo: 3, graded: true, gradedDaysAgo: 1 });
  await submitWriting({ unit: uB1, sKey: "b1", promptTitle: "Task 2 — Technology and children", essayKey: "b1_tech", submittedDaysAgo: 1, graded: false });

  // 8) điểm danh
  const attendance = async (classKey, keys, sessions, teacherId) => {
    for (const [i, s] of sessions.entries()) {
      await AttendanceSession.create({
        workspaceId: wsId, classId: cid(classKey), number: i + 1, date: vnDate(at(s.daysAgo)), note: s.note || "",
        takenBy: teacherId,
        records: keys.map((k) => ({
          studentId: students[k].doc._id,
          status: (s.status && s.status[k]) || "present",
          note: "",
          homework: (s.hw && s.hw[k]) || "done",
          homeworkAuto: !(s.manualHw && s.manualHw.includes(k)),
        })),
      });
      bump("attendance sessions");
    }
  };
  await attendance("A", A, [
    { daysAgo: 20, note: "Introduction and placement review", hw: { a4: "missing" } },
    { daysAgo: 13, status: { a4: "absent" }, hw: { a3: "partial", a4: "missing" } },
    { daysAgo: 6, status: { a3: "late", a2: "excused" }, hw: { a2: "partial", a4: "missing" }, manualHw: ["a2"] },
    { daysAgo: 1, note: "Unit 1 review", status: { a4: "absent" }, hw: { a3: "partial", a4: "missing" } },
  ], teacher._id);
  await attendance("B", B, [
    { daysAgo: 19, hw: { b4: "partial" } },
    { daysAgo: 12, status: { b4: "late" }, hw: { b2: "partial", b4: "missing" } },
    { daysAgo: 5, hw: { b2: "partial" } },
  ], teacher._id);

  // 9) sổ tay học sinh
  const noteBase = { workspaceId: wsId };
  await StudentNote.create({
    ...noteBase, studentId: students.a0.doc._id, pinned: true, color: "yellow",
    quote: "State verbs such as know, like, want are not used in the continuous.",
    body: "Remember: no -ing with know / like / want!",
    source: { kind: "lesson", unitId: uA1._id, contextName: "Unit 1 — Daily Life", skill: "grammar", itemLabel: "Present Simple vs Present Continuous", href: `/student/lessons/${uA1._id}` },
  });
  await StudentNote.create({ ...noteBase, studentId: students.a0.doc._id, body: "Ask the teacher: much vs many with uncountable nouns.", quote: "", color: "yellow", source: { kind: "free" } });
  await StudentNote.create({
    ...noteBase, studentId: students.a1.doc._id, color: "green", quote: "regular exercise reduces the risk of heart disease",
    body: "Good sentence to reuse in Writing Task 2 (health).",
    source: { kind: "lesson", unitId: uA1._id, contextName: "Unit 1 — Daily Life", skill: "reading", itemLabel: "Passage 1 — Cycling to work", href: `/student/lessons/${uA1._id}` },
  });
  bump("notes", 3);

  return { stats, teacherUser: tUser, workspace };
}

// ---- main -----------------------------------------------------------------
(async () => {
  const { uri, name } = resolveTarget(argv, USAGE);
  await mongoose.connect(uri);
  console.log(`DB: ${name}${name === "listening_app" ? "  ⚠ LIVE" : ""}${APPLY ? "" : "   (DRY RUN — thêm --apply để ghi)"}\n`);

  const existing = await demoWorkspace();

  if (WIPE) {
    if (!existing) { console.log("Không có workspace demo — không có gì để xoá."); return; }
    console.log(`Workspace demo: "${existing.name}" (${existing.slug})`);
    console.log("Sẽ xoá:", JSON.stringify(await countDemo(existing)));
    if (!APPLY) return console.log("\nChưa xoá gì. Thêm --apply để xoá thật.");
    await wipeDemo(existing);
    return console.log("\nĐã xoá workspace demo.");
  }

  const teacherUsername = (arg("--teacher") || "").trim().toLowerCase();
  if (!teacherUsername) { console.error(USAGE); process.exit(1); }
  const password = arg("--password", "123456");
  const teacherName = arg("--teacher-name", "Demo Teacher");
  const workspaceName = arg("--name", "Demo English Center");

  // username sẽ tạo + kiểm tra trùng với user KHÔNG thuộc workspace demo
  const wanted = [teacherUsername, ...C.STUDENTS.map((s) => `demo.${s.user}`)];
  const found = await User.find({ username: { $in: wanted } }).select("username role teacherId studentId").lean();
  let ownedUsernames = new Set();
  if (existing) {
    const [ts, ss] = await Promise.all([
      Teacher.find({ workspaceId: existing._id }).select("_id").lean(),
      Student.find({ workspaceId: existing._id }).select("_id").lean(),
    ]);
    const mine = await User.find({
      $or: [{ teacherId: { $in: ts.map((t) => t._id) } }, { studentId: { $in: ss.map((s) => s._id) } }],
    }).select("username").lean();
    ownedUsernames = new Set(mine.map((u) => u.username));
  }
  const conflicts = found.filter((u) => !ownedUsernames.has(u.username));
  if (conflicts.length) {
    console.error("DỪNG — username đã dùng bởi tài khoản KHÔNG thuộc workspace demo (không đụng vào):");
    conflicts.forEach((u) => console.error(`  - ${u.username} (${u.role})`));
    console.error("Chọn --teacher khác (username là duy nhất toàn hệ thống).");
    process.exit(1);
  }

  if (existing && !RESET) {
    console.log(`Workspace demo đã có: "${existing.name}" (${existing.slug}). Không làm gì.`);
    console.log("Thêm --reset để dựng lại từ đầu (làm mới ngày, khôi phục dữ liệu).");
    return;
  }
  if (!APPLY) {
    if (existing) console.log("--reset sẽ xoá trước:", JSON.stringify(await countDemo(existing)), "\n");
    console.log("Sẽ tạo:");
    console.log(`  workspace "${workspaceName}", giáo viên "${teacherUsername}" (mật khẩu ${password})`);
    console.log(`  ${C.CLASSES.length} lớp, ${C.STUDENTS.length} học sinh (demo.<tên>, cùng mật khẩu), 4 Unit (1 nháp), 1 bài thi,`);
    console.log("  ~40 bài nộp (6 bài Writing: 3 đã chấm, 3 chờ chấm), 7 buổi điểm danh, 3 ghi chú.");
    return console.log("\nChưa ghi gì. Thêm --apply để chạy thật.");
  }

  if (existing) { await wipeDemo(existing); console.log("Đã xoá workspace demo cũ."); }
  const out = await seed({ teacherUsername, password, teacherName, workspaceName });
  console.log("Đã tạo xong:", JSON.stringify(out.stats));
  console.log(`\nWorkspace: ${out.workspace.name} (slug ${out.workspace.slug})`);
  console.log(`Giáo viên:  ${teacherUsername} / ${password}`);
  console.log(`Học sinh:   ${C.STUDENTS.map((s) => "demo." + s.user).join(", ")}  (mật khẩu ${password})`);
})()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => mongoose.disconnect());
