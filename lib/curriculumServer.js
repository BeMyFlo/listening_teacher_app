// Phần của registry chương trình cần DB — chỉ dùng ở server. Phần dùng chung
// với client nằm ở lib/curriculum.js (không import mongoose).
const { tenantFilter } = require("./tenant");
const { PROGRAM_KEYS, DEFAULT_PROGRAM, isProgram, programOf } = require("./curriculum");

// Chương trình workspace đang dùng, SUY RA từ dữ liệu (Lớp + Unit + Test) chứ
// không lưu (PLAN-PHASE8-TOEIC.md mục 3.5, C4). null/thiếu field tính là IELTS.
// Workspace mới tinh chưa có gì -> ["ielts"]. Kết quả theo thứ tự PROGRAM_KEYS.
//
// `models` cho phép test truyền model giả; mặc định nạp model thật (lazy, để
// require file này không kéo mongoose models khi chỉ cần import).
async function activePrograms(ws, models) {
  const list = models || [
    require("./models/Class"),
    require("./models/Unit"),
    require("./models/Test"),
  ];
  const seen = new Set();
  for (const M of list) {
    for (const p of await M.distinct("program", tenantFilter(ws))) {
      seen.add(p || DEFAULT_PROGRAM);
    }
  }
  return finalizePrograms(seen);
}

// Set các program đã thấy -> danh sách theo thứ tự PROGRAM_KEYS; trống/lạ -> ["ielts"].
function finalizePrograms(seen) {
  const known = PROGRAM_KEYS.filter((k) => seen.has(k));
  return known.length ? known : [DEFAULT_PROGRAM];
}

// Bản gộp cho sysadmin (mọi workspace): 1 aggregate cho mỗi collection, gom theo
// (workspaceId, program), thay vì gọi activePrograms từng workspace.
// -> { [workspaceIdString]: ["ielts", "toeic"] }; workspace không có dòng nào
// không có key (caller dùng finalizePrograms(new Set()) = ["ielts"]).
async function activeProgramsByWorkspace(models) {
  const list = models || [
    require("./models/Class"),
    require("./models/Unit"),
    require("./models/Test"),
  ];
  const seenBy = {};
  for (const M of list) {
    const rows = await M.aggregate([{ $group: { _id: { w: "$workspaceId", p: "$program" } } }]);
    for (const r of rows) {
      const w = String(r._id.w);
      (seenBy[w] = seenBy[w] || new Set()).add(r._id.p || DEFAULT_PROGRAM);
    }
  }
  const out = {};
  for (const w of Object.keys(seenBy)) out[w] = finalizePrograms(seenBy[w]);
  return out;
}

// ---------------------------------------------------------------------------
// Khoá đổi chương trình (C7, PLAN-PHASE8-TOEIC.md 3.4.5): chỉ cho đổi khi chưa
// có gì dựa vào chương trình hiện tại.
//   - Lớp: không Unit/Test nào trong workspace nhắc tới lớp (classIds,
//     deadlines.classId, skillLocks.classId).
//   - Unit/Test: chưa giao lớp nào (classIds/deadlines/skillLocks rỗng) VÀ chưa
//     có bài nộp nào (Submission.unitId / testId).
// Mọi truy vấn đều lọc theo workspace. `models` cho test truyền model giả:
// { Unit, Test, Submission }; mặc định nạp model thật (lazy).

const LOCK_MESSAGES = {
  class: "This class already has lessons or tests assigned, so its program can't be changed.",
  unit: "This unit is already assigned to a class or has submissions, so its program can't be changed.",
  test: "This mock test is already assigned to a class or has submissions, so its program can't be changed.",
};

function realModels() {
  return {
    Unit: require("./models/Unit"),
    Test: require("./models/Test"),
    Submission: require("./models/Submission"),
  };
}

const hasItems = (a) => Array.isArray(a) && a.length > 0;

// -> chuỗi lý do nếu đang bị khoá, null nếu đổi được.
// kind: "class" | "unit" | "test".
async function programLockReason(ws, kind, doc, models) {
  if (!LOCK_MESSAGES[kind]) throw new Error("programLockReason: unknown kind " + kind);
  const m = models || realModels();
  const id = doc._id;
  if (kind === "class") {
    const inUnit = await m.Unit.exists(
      tenantFilter(ws, {
        $or: [{ classIds: id }, { "deadlines.classId": id }, { "skillLocks.classId": id }],
      })
    );
    if (inUnit) return LOCK_MESSAGES.class;
    // Test chỉ có classIds (không có deadlines/skillLocks).
    const inTest = await m.Test.exists(tenantFilter(ws, { classIds: id }));
    return inTest ? LOCK_MESSAGES.class : null;
  }
  if (hasItems(doc.classIds) || hasItems(doc.deadlines) || hasItems(doc.skillLocks)) {
    return LOCK_MESSAGES[kind];
  }
  const field = kind === "unit" ? "unitId" : "testId";
  const hasSub = await m.Submission.exists(tenantFilter(ws, { [field]: id }));
  return hasSub ? LOCK_MESSAGES[kind] : null;
}

async function isProgramLocked(ws, kind, doc, models) {
  return !!(await programLockReason(ws, kind, doc, models));
}

// Ném lỗi 409 nếu không đổi được (cho caller thích try/catch).
async function assertProgramChangeable(ws, kind, doc, models) {
  const reason = await programLockReason(ws, kind, doc, models);
  if (reason) {
    const err = new Error(reason);
    err.name = "ProgramLockedError";
    err.statusCode = 409;
    throw err;
  }
}

// Quyết định cho PUT có `program` trong body.
//   -> { changed: false }                    không gửi, hoặc gửi lại đúng giá trị cũ
//   -> { changed: true }                     đổi được (caller gán doc.program)
//   -> { error, status: 400 | 409 }          sai giá trị / đang bị khoá
// Doc cũ thiếu field tính là IELTS nên gửi "ielts" không phải là đổi.
async function resolveProgramChange(ws, kind, doc, requested, models) {
  if (requested == null) return { changed: false };
  if (!isProgram(requested)) return { changed: false, error: "Invalid program", status: 400 };
  if (requested === programOf(doc)) return { changed: false };
  const reason = await programLockReason(ws, kind, doc, models);
  if (reason) return { changed: false, error: reason, status: 409 };
  return { changed: true };
}

// Danh sách lớp (dạng Set<string>) đang được Unit/Test nào đó nhắc tới — dùng
// cho GET danh sách lớp: 2 truy vấn cho cả workspace thay vì 2 truy vấn mỗi lớp.
async function referencedClassIds(ws, models) {
  const m = models || realModels();
  const [units, tests] = await Promise.all([
    m.Unit.find(tenantFilter(ws)).select("classIds deadlines.classId skillLocks.classId").lean(),
    m.Test.find(tenantFilter(ws)).select("classIds").lean(),
  ]);
  const set = new Set();
  for (const u of units) {
    for (const id of u.classIds || []) set.add(String(id));
    for (const d of u.deadlines || []) if (d && d.classId) set.add(String(d.classId));
    for (const l of u.skillLocks || []) if (l && l.classId) set.add(String(l.classId));
  }
  for (const t of tests) for (const id of t.classIds || []) set.add(String(id));
  return set;
}

module.exports = {
  activePrograms,
  activeProgramsByWorkspace,
  finalizePrograms,
  programLockReason,
  isProgramLocked,
  assertProgramChangeable,
  resolveProgramChange,
  referencedClassIds,
};
