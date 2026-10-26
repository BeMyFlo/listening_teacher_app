// Logic thuần (không mongoose, không I/O) của API quản lý level: pages/api/admin/levels.js.
// Level thuộc về Lớp; tên level lưu ở Workspace.levelNames. Xem docs/plans/PLAN-LEVEL-NAMES.md.
//
// `usage` = mức dùng của MỘT chương trình, do route đọc từ DB:
//   { classCounts: { [level]: số lớp }, unitLevels: [level...], testLevels: [level...] }
const { PROGRAMS, programOf } = require("./curriculum");
const { LEVEL_MAX, NAME_MAX, sanitizeLevelNames } = require("./levelNames");

const validLevel = (n) => Number.isInteger(n) && n >= 1 && n <= LEVEL_MAX;
const fixedLevelsOf = (program) => PROGRAMS[programOf({ program })].fixedLevels;

// Tên bắt buộc, trim, tối đa NAME_MAX (quá dài thì báo lỗi, không cắt âm thầm).
function cleanName(raw) {
  const name = typeof raw === "string" ? raw.trim() : "";
  if (!name) return { error: "Level name is required" };
  if (name.length > NAME_MAX) return { error: `Level name must be at most ${NAME_MAX} characters` };
  return { name };
}

// Số lớp dùng từng level + tập level đang được Lớp/Unit/Test dùng.
function usageOf(usage) {
  const classCounts = new Map();
  const used = new Set();
  const counts = (usage && usage.classCounts) || {};
  for (const k of Object.keys(counts)) {
    const lv = Number(k);
    const n = Number(counts[k]) || 0;
    if (Number.isInteger(lv) && lv >= 1 && n > 0) {
      classCounts.set(lv, n);
      used.add(lv);
    }
  }
  for (const list of [usage && usage.unitLevels, usage && usage.testLevels]) {
    for (const lv of list || []) if (Number.isInteger(lv) && lv >= 1) used.add(lv);
  }
  return { classCounts, used };
}

const namesOfProgram = (levelNames, program) =>
  (Array.isArray(levelNames) ? levelNames : []).filter((x) => x && x.program === program && x.name);

// Gộp tên đã lưu với các level đang được dùng -> [{ level, name, classCount, inUse }] tăng dần.
// Level đang dùng mà chưa có tên có name "". Chương trình có fixedLevels luôn có đủ các khối cố định.
function mergeLevels(levelNames, program, usage) {
  const { classCounts, used } = usageOf(usage);
  const byLevel = new Map();
  const fixed = fixedLevelsOf(program);
  if (Array.isArray(fixed)) for (const lv of fixed) byLevel.set(lv, "");
  for (const lv of used) byLevel.set(lv, "");
  for (const x of namesOfProgram(levelNames, program)) byLevel.set(x.level, x.name);
  return [...byLevel.keys()]
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      name: byLevel.get(level),
      classCount: classCounts.get(level) || 0,
      inUse: used.has(level),
    }));
}

// Số level tiếp theo = lớn nhất (đã đặt tên hoặc đang dùng) + 1; chưa có gì -> 1.
// Quá trần LEVEL_MAX -> null.
function nextLevelNumber(levelNames, program, usage) {
  const rows = mergeLevels(levelNames, program, usage);
  const next = rows.length ? rows[rows.length - 1].level + 1 : 1;
  return next > LEVEL_MAX ? null : next;
}

// Cùng luật trùng-khoá và sắp xếp với sanitizeLevelNames (tái dùng, không tự viết lại).
function setName(levelNames, program, level, name) {
  const kept = (Array.isArray(levelNames) ? levelNames : []).filter(
    (x) => !(x.program === program && x.level === level)
  );
  return sanitizeLevelNames([...kept, { program, level, name }]);
}

// Tạo level mới: -> { status, levelNames, level, name } hoặc { status, error }.
function planCreate(levelNames, program, rawName, usage) {
  if (Array.isArray(fixedLevelsOf(program))) {
    return { status: 400, error: "General English uses grades 6–12; rename a grade instead." };
  }
  const n = cleanName(rawName);
  if (n.error) return { status: 400, error: n.error };
  const level = nextLevelNumber(levelNames, program, usage);
  if (level == null) return { status: 400, error: `Levels go up to ${LEVEL_MAX}` };
  const r = setName(levelNames, program, level, n.name);
  if (r.error) return { status: 400, error: r.error };
  return { status: 201, levelNames: r.levelNames, level, name: n.name };
}

// Đổi tên: level phải đã có tên hoặc đang được dùng (chưa tên mà đang dùng -> đặt tên lần đầu).
function planRename(levelNames, program, level, rawName, usage) {
  const n = cleanName(rawName);
  if (n.error) return { status: 400, error: n.error };
  const known = mergeLevels(levelNames, program, usage).some((r) => r.level === level);
  if (!known) return { status: 404, error: "Level not found" };
  const r = setName(levelNames, program, level, n.name);
  if (r.error) return { status: 400, error: r.error };
  return { status: 200, levelNames: r.levelNames, level, name: n.name };
}

// Xoá: 400 nếu là khối cố định, 404 nếu không có, 409 nếu Lớp/Unit/Test đang dùng, ngược lại bỏ dòng tên.
function planDelete(levelNames, program, level, usage) {
  const fixed = fixedLevelsOf(program);
  if (Array.isArray(fixed) && fixed.includes(level)) {
    return { status: 400, error: "Grades can't be deleted." };
  }
  const row = mergeLevels(levelNames, program, usage).find((r) => r.level === level);
  if (!row) return { status: 404, error: "Level not found" };
  if (row.inUse) {
    return {
      status: 409,
      error: row.classCount > 0
        ? `Level ${level} is used by ${row.classCount} class${row.classCount === 1 ? "" : "es"}`
        : `Level ${level} is used by lessons or mock tests`,
    };
  }
  return {
    status: 200,
    levelNames: (Array.isArray(levelNames) ? levelNames : []).filter(
      (x) => !(x.program === program && x.level === level)
    ),
  };
}

module.exports = { validLevel, cleanName, mergeLevels, nextLevelNumber, planCreate, planRename, planDelete };
