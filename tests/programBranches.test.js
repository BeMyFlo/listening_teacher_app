const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

// Danh sách các nhánh === "toeic", !== "toeic", === "ielts", !== "ielts" ĐƯỢC PHÉP.
// So sánh theo đường dẫn file (slash /) + đoạn code chứa trong dòng (snippet), KHÔNG theo số dòng.
const ALLOWED_BRANCHES = [
  // --- Mục 2: Các dòng GIỮ ---
  {
    file: "lib/curriculum.js",
    snippet: 'không viết `if (program === "toeic")` rải rác',
    reason: '#1 Chú thích trong lib/curriculum.js',
  },
  {
    file: "lib/teacher/questionFormats.js",
    snippet: 'if (program === "toeic") {',
    reason: '#13 questionFormatsFor: TOEIC có bộ format riêng (Reading Part 5-7, Listening Part 1-4)',
  },
  {
    file: "components/teacher/PromptsEditor.js",
    snippet: '// program === "toeic" (Phase 8B)',
    reason: '#19 Chú thích trong PromptsEditor',
  },
  {
    file: "components/teacher/PromptsEditor.js",
    snippet: 'const toeic = program === "toeic"; // G5: general.writing',
    reason: '#20 PromptsEditor Writing/Speaking: General chưa mở Writing/Speaking (0.3)',
  },
  {
    file: "app/student/tests/[testId]/[skill]/page.js",
    snippet: 'programOf(test) === "toeic" &&',
    reason: '#23 Runner ToeicSpeakingRunner: chỉ dùng cho đề thi TOEIC Speaking',
  },
  {
    file: "app/student/tests/[testId]/[skill]/page.js",
    snippet: 'const toeicWriting = skill === "writing" && programOf(test) === "toeic";',
    reason: '#24 Gom đề Writing TOEIC theo Part',
  },
  {
    file: "app/teacher/lessons/[unitId]/page.js",
    snippet: 'if (programOf(unit) === "toeic") {',
    reason: '#25 Kiểm tra prompt TOEIC trước khi lưu Unit',
  },
  {
    file: "app/teacher/tests/[testId]/page.js",
    snippet: 'if (b.program === "toeic") {',
    reason: '#26 Kiểm tra prompt TOEIC trước khi lưu Test',
  },
  {
    file: "app/teacher/tests/[testId]/page.js",
    snippet: 'firstId={b.program === "toeic" && activeKey === "reading" ? 101 : 1}',
    reason: '#27 TOEIC Reading đánh số từ 101; General và IELTS đánh từ 1',
  },

  // --- Mục 2.1: Các dòng GIỮ ---
  {
    file: "lib/testSections.js",
    snippet: 'if (program !== "toeic") {',
    reason: 'A1: General cấm taskType — đúng luật',
  },
  {
    file: "app/teacher/lessons/[unitId]/page.js",
    snippet: 'const aiScope = branding.slug + (unit && programOf(unit) !== "ielts" ? ":" + programOf(unit) : "");',
    reason: 'A3: General nhớ tuỳ chọn AI riêng theo chương trình',
  },
  {
    file: "pages/api/admin/ai-lesson.js",
    snippet: '...(input.program && input.program !== "ielts" ? { program: input.program } : {}),',
    reason: 'A4: Ghi log AI có program khi không phải IELTS',
  },
  {
    file: "pages/api/admin/ai-vocab-review.js",
    snippet: '...(input.program && input.program !== "ielts" ? { program: input.program } : {}),',
    reason: 'A4: Ghi log AI có program khi không phải IELTS',
  },
  {
    file: "lib/teacher/useVocabReviewAi.js",
    snippet: '...(ctx.program && ctx.program !== "ielts" ? { program: ctx.program } : {}),',
    reason: 'A4: Gửi program trong request AI khi không phải IELTS',
  },

  // --- TODO bước 4: Các dòng ĐỔI #2–#12 trong lib/ai/* (bước 4 sẽ gỡ) ---
  {
    file: "lib/ai/common.js",
    snippet: 'if (program === "toeic") {',
    reason: 'TODO bước 4 (#2): levelTier xử lý trình độ TOEIC',
  },
  {
    file: "lib/ai/common.js",
    snippet: 'if (program === "toeic") {',
    reason: 'TODO bước 4 (#3): describeStudentLevel xử lý trình độ TOEIC',
  },
  {
    file: "lib/ai/grammarLesson.js",
    snippet: 'const tierGuideFor = (program, tier) => (program === "toeic" ? TOEIC_TIER_GUIDE : TIER_GUIDE)[tier];',
    reason: 'TODO bước 4 (#4): grammar tier guide rẽ nhánh TOEIC',
  },
  {
    file: "lib/ai/grammarLesson.js",
    snippet: 'const systemFor = (program) => (program === "toeic" ? TOEIC_SYSTEM : SYSTEM);',
    reason: 'TODO bước 4 (#5): grammar system prompt rẽ nhánh TOEIC',
  },
  {
    file: "lib/ai/grammarLesson.js",
    snippet: 'const optCount = program === "toeic" || (band != null && band >= 6) ? 4 : 3;',
    reason: 'TODO bước 4 (#6): grammar option count',
  },
  {
    file: "lib/ai/vocabLesson.js",
    snippet: 'const tierGuideFor = (program, tier) => (program === "toeic" ? TOEIC_TIER_GUIDE : TIER_GUIDE)[tier];',
    reason: 'TODO bước 4 (#7): vocab tier guide rẽ nhánh TOEIC',
  },
  {
    file: "lib/ai/vocabLesson.js",
    snippet: 'const systemFor = (program) => (program === "toeic" ? TOEIC_SYSTEM : SYSTEM);',
    reason: 'TODO bước 4 (#8): vocab system prompt rẽ nhánh TOEIC',
  },
  {
    file: "lib/ai/vocabLesson.js",
    snippet: 'const optCount = program === "toeic" || (band != null && band >= 6) ? 4 : 3;',
    reason: 'TODO bước 4 (#9): vocab option count',
  },
  {
    file: "lib/ai/vocabLesson.js",
    snippet: 'program === "toeic"',
    reason: 'TODO bước 4 (#10): ví dụ tên nhóm từ',
  },
  {
    file: "lib/ai/vocabReview.js",
    snippet: 'const systemFor = (program) => (program === "toeic" ? TOEIC_SYSTEM : SYSTEM);',
    reason: 'TODO bước 4 (#11): vocab review system prompt rẽ nhánh TOEIC',
  },
  {
    file: "lib/ai/vocabReview.js",
    snippet: 'program === "toeic"',
    reason: 'TODO bước 4 (#12): dòng Prefer cho TOEIC',
  },
];

const SCAN_DIRS = ["lib", "components", "app", "pages"];
const BRANCH_REGEX = /(?:===|!==)\s*["'](?:toeic|ielts)["']/;

function collectJsFiles(dir) {
  const result = [];
  if (!fs.existsSync(dir)) return result;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...collectJsFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith(".js") || entry.name.endsWith(".jsx") || entry.name.endsWith(".mjs"))) {
      result.push(fullPath);
    }
  }
  return result;
}

test("programBranches: không có nhánh ===/!== 'toeic'/'ielts' ngoài danh sách cho phép", () => {
  const root = path.resolve(__dirname, "..");
  const allHits = [];

  for (const dirName of SCAN_DIRS) {
    const dirPath = path.join(root, dirName);
    const files = collectJsFiles(dirPath);
    for (const file of files) {
      const relFile = path.relative(root, file).replace(/\\/g, "/");
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, index) => {
        if (BRANCH_REGEX.test(line)) {
          allHits.push({
            file: relFile,
            lineNum: index + 1,
            line: line.trim(),
          });
        }
      });
    }
  }

  // Đối chiếu từng hit với danh sách cho phép
  const unmatched = [];
  const usedAllowedIndices = new Set();

  for (const hit of allHits) {
    let matched = false;
    for (let i = 0; i < ALLOWED_BRANCHES.length; i++) {
      if (usedAllowedIndices.has(i)) continue;
      const allowed = ALLOWED_BRANCHES[i];
      if (hit.file === allowed.file && hit.line.includes(allowed.snippet)) {
        matched = true;
        usedAllowedIndices.add(i);
        break;
      }
    }
    if (!matched) {
      unmatched.push(hit);
    }
  }

  assert.equal(
    unmatched.length,
    0,
    `Tìm thấy ${unmatched.length} nhánh chương trình ngoài danh sách cho phép:\n` +
      unmatched.map((h) => `  - ${h.file}:${h.lineNum}: ${h.line}`).join("\n") +
      "\nĐọc registry hoặc thêm vào danh sách ALLOWED_BRANCHES kèm lý do."
  );

  // Đảm bảo mọi rule trong danh sách cho phép đều khớp với code thực tế
  const unusedAllowed = ALLOWED_BRANCHES.filter((_, idx) => !usedAllowedIndices.has(idx));
  assert.equal(
    unusedAllowed.length,
    0,
    `Có ${unusedAllowed.length} mục trong ALLOWED_BRANCHES không khớp với dòng code nào:\n` +
      unusedAllowed.map((a) => `  - ${a.file}: "${a.snippet}" (${a.reason})`).join("\n")
  );
});
