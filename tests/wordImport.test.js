const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const formidablePkg = require("formidable");

const {
  splitForAi,
  WORD_IMPORT_SYSTEM,
  buildWordPrompt,
  WORD_SCHEMA,
  buildImport,
} = require("../lib/wordImport");
const { makeDocx } = require("./helpers/makeZip");
const gemini = require("../lib/gemini");
const AppSetting = require("../lib/models/AppSetting");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

// -------------------------------------------------------------
// 1. splitForAi
// -------------------------------------------------------------
test("splitForAi: tách đề có 3 phần lớn thành đúng số khúc", () => {
  // Mỗi phần dài ~5000 ký tự -> 3 phần tổng ~15000 ký tự -> thành 3 khúc vì mỗi phần <= 8000 nhưng 2 phần gộp > 8000
  const part1 = "PART 1. PHONETICS\n" + "Question 1. Pronunciation\n" + "A. watched B. stopped C. looked D. decided\n".repeat(120);
  const part2 = "PART 2. VOCABULARY\n" + "Question 21. Word choice\n" + "She is very interested in reading science books.\n".repeat(110);
  const part3 = "PART 3. READING\n" + "Read the passage and choose the best answer.\n" + "Passage text goes here and there for testing.\n".repeat(110);

  const full = `${part1}\n\n${part2}\n\n${part3}`;
  const res = splitForAi(full);

  assert.equal(res.error, undefined);
  assert.equal(res.chunks.length, 3);
  assert.match(res.chunks[0], /PART 1/);
  assert.match(res.chunks[1], /PART 2/);
  assert.match(res.chunks[2], /PART 3/);
});

test("splitForAi: khối 'ĐÁP ÁN' ở 40% cuối được tách ra keyText và không nằm trong khúc đề", () => {
  // Tạo đề có phần câu hỏi và đáp án ở cuối
  const qText = "PART 1. GRAMMAR\n" + "Question 1. Choose A, B, C or D.\n".repeat(40);
  const keyContent = "ĐÁP ÁN CHI TIẾT\n1. A  2. B  3. C  4. D\n5. A  6. B  7. C  8. D";
  const full = `${qText}\n\n${keyContent}`;

  const res = splitForAi(full);
  assert.equal(res.error, undefined);
  assert.ok(res.keyText.includes("ĐÁP ÁN CHI TIẾT"));
  assert.ok(res.keyText.includes("1. A  2. B"));

  // Mọi khúc đề không được chứa "ĐÁP ÁN"
  for (const chunk of res.chunks) {
    assert.doesNotMatch(chunk, /ĐÁP ÁN CHI TIẾT/);
  }
});

test("splitForAi: phần quá dài (> 8000 ký tự) cắt theo câu và lặp lại dòng hướng dẫn", () => {
  const instruction = "PART I. Choose the word or phrase that best completes each sentence:";
  const questions = [];
  for (let i = 1; i <= 60; i++) {
    questions.push(`Question ${i}. This is sentence number ${i} testing English grammar and vocabulary options.\nA. option A B. option B C. option C D. option D`);
  }
  const longPart = instruction + "\n\n" + questions.join("\n\n");
  assert.ok(longPart.length > 8000, "Part must be > 8000 chars for this test");

  const res = splitForAi(longPart);
  assert.equal(res.error, undefined);
  assert.ok(res.chunks.length >= 2, "Should be split into at least 2 chunks");

  // Mọi khúc đều phải có dòng hướng dẫn lặp lại ở đầu
  for (let i = 0; i < res.chunks.length; i++) {
    assert.ok(
      res.chunks[i].includes("PART I. Choose the word or phrase"),
      `Chunk ${i} must include instruction`
    );
  }
});

test("splitForAi: quá 6 khúc -> trả error hướng dẫn chia nhỏ file", () => {
  // 7 phần, mỗi phần ~5000 ký tự -> không thể gộp các phần vì 2 phần > 8000 -> sinh ra 7 khúc > 6 khúc
  const parts = [];
  for (let i = 1; i <= 7; i++) {
    parts.push(`PART ${i}. Heading\n` + "Some content line for the test.\n".repeat(160));
  }
  const hugeText = parts.join("\n\n");

  const res = splitForAi(hugeText);
  assert.ok(res.error);
  assert.match(res.error, /This file is too long — split it into smaller files/);
  assert.equal(res.chunks.length, 0);
});

// -------------------------------------------------------------
// 2. buildWordPrompt & WORD_SCHEMA
// -------------------------------------------------------------
test("WORD_IMPORT_SYSTEM & buildWordPrompt: nhãn format lấy từ GENERAL_LABELS và nhúng keyText", () => {
  assert.ok(WORD_IMPORT_SYSTEM.includes("Multiple choice"));
  assert.ok(WORD_IMPORT_SYSTEM.includes("Pronunciation — odd one out"));
  assert.ok(WORD_IMPORT_SYSTEM.includes("Error identification"));
  assert.ok(WORD_IMPORT_SYSTEM.includes("<u>...</u>"));
  assert.ok(WORD_IMPORT_SYSTEM.includes("[IMGn]"));

  const prompt = buildWordPrompt("Chunk text here", "1. A  2. B", { subject: "grammar" });
  assert.match(prompt, /Subject context: grammar/);
  assert.match(prompt, /--- ANSWER KEY \(from document\) ---/);
  assert.match(prompt, /1\. A  2\. B/);
  assert.match(prompt, /--- TEST DOCUMENT CHUNK ---/);
  assert.match(prompt, /Chunk text here/);

  assert.equal(WORD_SCHEMA.type, "object");
  assert.ok(WORD_SCHEMA.properties.sections);
});

// -------------------------------------------------------------
// 3. buildImport
// -------------------------------------------------------------
test("buildImport: gộp section bị cắt giữa 2 khúc liền nhau nếu cùng instruction và format", () => {
  const chunk1 = {
    ok: true,
    data: {
      sections: [
        {
          instruction: "Choose the best option A, B, C or D.",
          format: "g-mcq",
          questions: [
            { number: 1, text: "Question 1", options: ["A", "B", "C", "D"], answer: "A", answerSource: "document" },
            { number: 2, text: "Question 2", options: ["A", "B", "C", "D"], answer: "B", answerSource: "document" },
          ],
        },
      ],
    },
  };
  const chunk2 = {
    ok: true,
    data: {
      sections: [
        {
          instruction: "Choose the best option A, B, C or D.",
          format: "g-mcq",
          questions: [
            { number: 3, text: "Question 3", options: ["A", "B", "C", "D"], answer: "C", answerSource: "document" },
            { number: 4, text: "Question 4", options: ["A", "B", "C", "D"], answer: "D", answerSource: "document" },
          ],
        },
      ],
    },
  };

  const res = buildImport([chunk1, chunk2], { subject: "grammar" });
  assert.equal(res.sections.length, 1);
  assert.equal(res.sections[0].name, "Choose the best option A, B, C or D.");
  assert.equal(res.sections[0].fields.length, 4);
});

test("buildImport: writing bị bỏ kèm warning, other chuyển g-gap khi có answer hoặc bỏ khi thiếu", () => {
  const chunk = {
    ok: true,
    data: {
      sections: [
        {
          instruction: "Write a paragraph about your hobby.",
          format: "writing",
          questions: [{ number: 1, text: "Write 120 words." }],
        },
        {
          instruction: "Miscellaneous questions",
          format: "other",
          questions: [
            { number: 2, text: "She ____ to school yesterday.", answer: "went" },
            { number: 3, text: "Open question without any answer key" },
          ],
        },
      ],
    },
  };

  const res = buildImport([chunk], { subject: "grammar" });
  // writing bị bỏ hoàn toàn
  assert.equal(res.sections.length, 1);
  // other có 1 câu có answer chuyển thành g-gap
  assert.equal(res.sections[0].fields.length, 1);
  assert.equal(res.sections[0].fields[0].formatLabel, "Gap fill");

  const warnStr = res.warnings.join("\n");
  assert.match(warnStr, /Writing tasks are not imported yet \(1 question skipped\)/);
  assert.match(warnStr, /Unrecognized question type without answer skipped \(1 question\)/);
  assert.match(warnStr, /Unrecognized question type converted to gap fill \(1 question\)/);
});

test("buildImport: cờ vàng cho answerSource=ai, confidence=low, pron/stress, imageRef thiếu, đáp án lệch options", () => {
  const chunk = {
    ok: true,
    data: {
      sections: [
        {
          instruction: "Phonetics & Stress",
          format: "g-pron",
          questions: [
            {
              number: 1,
              text: "",
              options: ["pl<u>a</u>y", "st<u>a</u>y", "s<u>a</u>y", "s<u>a</u>id"],
              answer: "said",
              answerSource: "document",
            },
          ],
        },
        {
          instruction: "Grammar multiple choice",
          format: "g-mcq",
          questions: [
            {
              number: 2,
              text: "AI solved this question",
              options: ["one", "two", "three", "four"],
              answer: "one",
              answerSource: "ai",
            },
            {
              number: 3,
              text: "Unsure question",
              options: ["A", "B", "C", "D"],
              answer: "A",
              confidence: "low",
              note: "Handwriting was blurry",
            },
            {
              number: 4,
              text: "Question with missing image [IMG9]",
              options: ["Stop", "Go", "Turn", "Wait"],
              answer: "Stop",
              imageRef: "IMG9",
            },
            {
              number: 5,
              text: "Mismatch answer question",
              options: ["apple", "banana", "orange", "grape"],
              answer: "watermelon", // không khớp bất kỳ option nào
            },
          ],
        },
      ],
    },
  };

  const res = buildImport([chunk], { subject: "vocabulary", images: [{ ref: "IMG1" }] });
  assert.ok(res.flags.length >= 5);

  const flagReasons = res.flags.map((f) => f.reason).join(" | ");
  assert.match(flagReasons, /Pronunciation\/stress — please double-check/);
  assert.match(flagReasons, /Answer suggested by AI — not found in the file/);
  assert.match(flagReasons, /AI was unsure how to read this question: Handwriting was blurry/);
  assert.match(flagReasons, /Image not found in the file/);
  assert.match(flagReasons, /Answer does not match any option — choose the correct one/);

  // Câu 5 có đáp án lệch: answer bị để trống
  const sec2 = res.sections[1];
  const q5Field = sec2.fields.find((f) => f.label.includes("Mismatch"));
  assert.ok(q5Field);
  assert.deepEqual(q5Field.answers, []);
});

test("buildImport: trùng số câu chỉ giữ câu đầu + warning", () => {
  const chunk = {
    ok: true,
    data: {
      sections: [
        {
          instruction: "MCQ section",
          format: "g-mcq",
          questions: [
            { number: 10, text: "First occurrence of question 10", options: ["A", "B"], answer: "A" },
            { number: 10, text: "First occurrence of question 10", options: ["A", "B"], answer: "B" },
          ],
        },
      ],
    },
  };

  const res = buildImport([chunk], { subject: "grammar" });
  assert.equal(res.sections[0].fields.length, 1);
  assert.equal(res.sections[0].fields[0].label, "First occurrence of question 10");
  assert.ok(res.warnings.some((w) => w.includes("Duplicate question number 10 — kept first occurrence")));
});

test("buildImport: khúc lỗi vẫn trả các khúc thành công + warning; passage chỉ giữ ở reading", () => {
  const failedChunk = {
    ok: false,
    snippet: "Corrupted text from scanned part",
    error: "AI parsing error",
  };
  const successChunk = {
    ok: true,
    data: {
      sections: [
        {
          instruction: "Read the text",
          format: "g-tf",
          passage: "This is a reading passage about wildlife.",
          questions: [
            { number: 1, text: "Tigers live in groups.", answer: "False" },
          ],
        },
      ],
    },
  };

  // 1. Khi subject là grammar (không giữ passage)
  const resGrammar = buildImport([failedChunk, successChunk], { subject: "grammar" });
  assert.equal(resGrammar.sections.length, 1);
  assert.equal(resGrammar.sections[0].passageText, "");
  assert.ok(resGrammar.warnings.some((w) => w.includes("Corrupted text from scanned") && w.includes("could not be read")));
  assert.ok(resGrammar.warnings.some((w) => w.includes("Passages are only kept in Reading / Mock Test")));

  // 2. Khi subject là reading (giữ passage)
  const resReading = buildImport([successChunk], { subject: "reading" });
  assert.equal(resReading.sections.length, 1);
  assert.equal(resReading.sections[0].passageText, "This is a reading passage about wildlife.");
});

// -------------------------------------------------------------
// 4. API Route pages/api/admin/import-word.js
// -------------------------------------------------------------
test("route import-word: docx hợp lệ + mock generateJSON -> 200 với sections, flags, images", async () => {
  process.env.JWT_SECRET = "test-secret-word-import";
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-gemini-key";

  const origGenerateJSON = gemini.generateJSON;
  const origIsEnabled = gemini.isEnabled;
  const origFormidable = formidablePkg.formidable;
  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;
  const origAppSettingFindOne = AppSetting.findOne;

  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};

  // Tạo file docx giả
  const docxBuf = makeDocx({
    body: "<w:p><w:r><w:t>PART 1. GRAMMAR</w:t></w:r></w:p><w:p><w:r><w:t>Question 1. Choose A, B, C or D.</w:t></w:r></w:p>",
  });
  const tmpDocxPath = path.join(os.tmpdir(), `test-word-${Date.now()}.docx`);
  fs.writeFileSync(tmpDocxPath, docxBuf);

  try {
    gemini.isEnabled = () => true;
    gemini.generateJSON = async () => ({
      data: {
        sections: [
          {
            instruction: "PART 1. GRAMMAR",
            format: "g-mcq",
            questions: [
              {
                number: 1,
                text: "Question 1. Choose A, B, C or D.",
                options: ["Apple", "Banana", "Orange", "Grape"],
                answer: "Apple",
                answerSource: "document",
              },
            ],
          },
        ],
      },
      model: "mock-gemini-model",
      logId: "log-1",
    });

    WorkspaceMember.findOne = () => ({
      select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
    });
    Workspace.findById = () => ({
      select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }),
    });
    AppSetting.findOne = () => ({ lean: async () => ({ value: "gemini-2.5-flash" }) });
    clearTenantCache();

    // Mock formidable trả về file và fields
    formidablePkg.formidable = () => ({
      parse: async () => [
        { program: "general", subject: "grammar" },
        {
          file: {
            filepath: tmpDocxPath,
            originalFilename: "test.docx",
            mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        },
      ],
    });

    delete require.cache[require.resolve("../pages/api/admin/import-word")];
    const importWordRoute = require("../pages/api/admin/import-word");

    const token = signUserToken({ _id: "t1", role: "teacher", name: "Teacher One" });
    const req = {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/import-word",
      ws: { workspaceId: "ws1", demo: false },
    };

    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) {
        statusCode = c;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };

    await importWordRoute(req, res);

    assert.equal(statusCode, 200, `Expected 200, got ${statusCode}: ${JSON.stringify(payload)}`);
    assert.equal(payload.ok, true);
    assert.equal(payload.sections.length, 1);
    assert.equal(payload.sections[0].fields.length, 1);
    assert.equal(payload.stats.questions, 1);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.generateJSON = origGenerateJSON;
    gemini.isEnabled = origIsEnabled;
    formidablePkg.formidable = origFormidable;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    AppSetting.findOne = origAppSettingFindOne;
    clearTenantCache();
    if (fs.existsSync(tmpDocxPath)) {
      try { fs.unlinkSync(tmpDocxPath); } catch {}
    }
  }
});

test("route import-word: program ielts -> 400", async () => {
  process.env.JWT_SECRET = "test-secret-word-import";
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-gemini-key";
  const origIsEnabled = gemini.isEnabled;
  const origFormidable = formidablePkg.formidable;
  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;

  const tmpDocxPath = path.join(os.tmpdir(), `test-word-ielts-${Date.now()}.docx`);
  fs.writeFileSync(tmpDocxPath, Buffer.from("PK test"));

  try {
    gemini.isEnabled = () => true;
    WorkspaceMember.findOne = () => ({
      select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
    });
    Workspace.findById = () => ({
      select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }),
    });
    clearTenantCache();

    formidablePkg.formidable = () => ({
      parse: async () => [
        { program: "ielts", subject: "reading" },
        { file: { filepath: tmpDocxPath, originalFilename: "test.docx" } },
      ],
    });

    delete require.cache[require.resolve("../pages/api/admin/import-word")];
    const importWordRoute = require("../pages/api/admin/import-word");

    const token = signUserToken({ _id: "t1", role: "teacher", name: "Teacher One" });
    const req = {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/import-word",
      ws: { workspaceId: "ws1", demo: false },
    };

    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) {
        statusCode = c;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };

    await importWordRoute(req, res);
    assert.equal(statusCode, 400);
    assert.match(payload.error, /Word import is not supported for this program/);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.isEnabled = origIsEnabled;
    formidablePkg.formidable = origFormidable;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    clearTenantCache();
    if (fs.existsSync(tmpDocxPath)) {
      try { fs.unlinkSync(tmpDocxPath); } catch {}
    }
  }
});

test("route import-word: demo workspace -> 403", async () => {
  process.env.JWT_SECRET = "test-secret-word-import";
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-gemini-key";
  const origIsEnabled = gemini.isEnabled;
  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;

  try {
    gemini.isEnabled = () => true;
    WorkspaceMember.findOne = () => ({
      select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
    });
    Workspace.findById = () => ({
      select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: { demo: true } }) }),
    });
    clearTenantCache();

    delete require.cache[require.resolve("../pages/api/admin/import-word")];
    const importWordRoute = require("../pages/api/admin/import-word");

    const token = signUserToken({ _id: "t1", role: "teacher", name: "Teacher One" });
    const req = {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/import-word",
      ws: { workspaceId: "ws1", demo: true }, // Demo workspace
    };

    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) {
        statusCode = c;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };

    await importWordRoute(req, res);
    assert.equal(statusCode, 403);
    assert.match(payload.error, /demo workspace/);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.isEnabled = origIsEnabled;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    clearTenantCache();
  }
});

test("route import-word: không phải docx -> 400 đúng thông báo", async () => {
  process.env.JWT_SECRET = "test-secret-word-import";
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-gemini-key";
  const origIsEnabled = gemini.isEnabled;
  const origFormidable = formidablePkg.formidable;
  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;

  const tmpBadFilePath = path.join(os.tmpdir(), `test-bad-file-${Date.now()}.docx`);
  fs.writeFileSync(tmpBadFilePath, Buffer.from("plain text not a zip or docx"));

  try {
    gemini.isEnabled = () => true;
    WorkspaceMember.findOne = () => ({
      select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
    });
    Workspace.findById = () => ({
      select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }),
    });
    clearTenantCache();

    formidablePkg.formidable = () => ({
      parse: async () => [
        { program: "general", subject: "grammar" },
        { file: { filepath: tmpBadFilePath, originalFilename: "bad.docx" } },
      ],
    });

    delete require.cache[require.resolve("../pages/api/admin/import-word")];
    const importWordRoute = require("../pages/api/admin/import-word");

    const token = signUserToken({ _id: "t1", role: "teacher", name: "Teacher One" });
    const req = {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/import-word",
      ws: { workspaceId: "ws1", demo: false },
    };

    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) {
        statusCode = c;
        return this;
      },
      json(p) {
        payload = p;
        return this;
      },
    };

    await importWordRoute(req, res);
    assert.equal(statusCode, 400);
    assert.match(payload.error, /This is not a \.docx file\. In Word choose File → Save As → Word Document \(\.docx\)\./);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.isEnabled = origIsEnabled;
    formidablePkg.formidable = origFormidable;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    clearTenantCache();
    if (fs.existsSync(tmpBadFilePath)) {
      try { fs.unlinkSync(tmpBadFilePath); } catch {}
    }
  }
});

test("route import-word: mọi khúc lỗi -> 502; budget exceeded -> 429", async () => {
  process.env.JWT_SECRET = "test-secret-word-import";
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-gemini-key";
  const origGenerateJSON = gemini.generateJSON;
  const origIsEnabled = gemini.isEnabled;
  const origFormidable = formidablePkg.formidable;
  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;
  const origAppSettingFindOne = AppSetting.findOne;

  const docxBuf = makeDocx({
    body: "<w:p><w:r><w:t>PART 1. Question 1. Test question</w:t></w:r></w:p>",
  });
  const tmpDocxPath = path.join(os.tmpdir(), `test-err-${Date.now()}.docx`);
  fs.writeFileSync(tmpDocxPath, docxBuf);

  try {
    gemini.isEnabled = () => true;
    WorkspaceMember.findOne = () => ({
      select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }),
    });
    Workspace.findById = () => ({
      select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }),
    });
    AppSetting.findOne = () => ({ lean: async () => ({ value: "gemini-2.5-flash" }) });
    clearTenantCache();

    formidablePkg.formidable = () => ({
      parse: async () => [
        { program: "general", subject: "grammar" },
        { file: { filepath: tmpDocxPath, originalFilename: "test.docx" } },
      ],
    });

    delete require.cache[require.resolve("../pages/api/admin/import-word")];
    const importWordRoute = require("../pages/api/admin/import-word");
    const token = signUserToken({ _id: "t1", role: "teacher", name: "Teacher One" });

    // 1. Mọi khúc lỗi thường -> 502
    gemini.generateJSON = async () => {
      throw new Error("Internal AI model timeout");
    };

    let status502 = 200;
    let payload502 = null;
    await importWordRoute(
      {
        method: "POST",
        headers: { authorization: "Bearer " + token },
        url: "/api/admin/import-word",
        ws: { workspaceId: "ws1", demo: false },
      },
      {
        setHeader() {},
        status(c) { status502 = c; return this; },
        json(p) { payload502 = p; return this; },
      }
    );
    assert.equal(status502, 502);
    assert.match(payload502.error, /AI request failed: Internal AI model timeout/);

    // 2. Lỗi ngân sách AI -> 429
    // Cần tạo lại file vì file cũ đã bị unlinked trong finally
    fs.writeFileSync(tmpDocxPath, docxBuf);
    gemini.generateJSON = async () => {
      const err = new Error("Monthly AI token budget reached");
      err.code = "AI_BUDGET_EXCEEDED";
      err.error = "Monthly AI budget exceeded for this workspace";
      throw err;
    };

    let status429 = 200;
    let payload429 = null;
    await importWordRoute(
      {
        method: "POST",
        headers: { authorization: "Bearer " + token },
        url: "/api/admin/import-word",
        ws: { workspaceId: "ws1", demo: false },
      },
      {
        setHeader() {},
        status(c) { status429 = c; return this; },
        json(p) { payload429 = p; return this; },
      }
    );
    assert.equal(status429, 429);
    assert.match(payload429.error, /budget exceeded/i);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.generateJSON = origGenerateJSON;
    gemini.isEnabled = origIsEnabled;
    formidablePkg.formidable = origFormidable;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    AppSetting.findOne = origAppSettingFindOne;
    clearTenantCache();
    if (fs.existsSync(tmpDocxPath)) {
      try { fs.unlinkSync(tmpDocxPath); } catch {}
    }
  }
});

// ---- Review fixes G3 bước 4 ----

test("isKeyHeading / splitForAi: chỉ nhận dòng tiêu đề đáp án đứng riêng", () => {
  const { isKeyHeading } = require("../lib/wordImport");
  for (const ok of ["ĐÁP ÁN", "Đáp án", "DAP AN", "ANSWER KEY", "Answer keys:", "ANSWERS", "KEY", "KEYS",
    "ĐÁP ÁN:", "ĐÁP ÁN ĐỀ 1", "ANSWERS TEST 2", "ANSWER KEY (Đề A)", "--- ĐÁP ÁN ---", "** ĐÁP ÁN **"]) {
    assert.equal(isKeyHeading(ok), true, ok);
  }
  for (const no of [
    "Answer the questions below in complete sentences.",
    "Answer: B",
    "Answer",
    "Key words",
    "The key to success is practice",
    "Key: 1. A 2. B",
    "ĐÁP ÁN của câu 1 là gì và vì sao như vậy, hãy giải thích",
  ]) {
    assert.equal(isKeyHeading(no), false, no);
  }

  // Câu hướng dẫn "Answer the questions…" ở 40% cuối không được cắt mất phần đọc hiểu
  const head = "PART 1. GRAMMAR\n" + "Question 1. Choose A, B, C or D.\n".repeat(20);
  const reading = "PART 2. READING\nAnswer the questions below in complete sentences.\n" + "Question 21. Why?\n".repeat(30);
  const res = splitForAi(head + reading);
  assert.equal(res.keyText, "");
  assert.ok(res.chunks.join("\n").includes("Answer the questions below"));
  assert.ok(res.chunks.join("\n").includes("Question 21"));

  // Tiêu đề thật vẫn tách
  const res2 = splitForAi(head + reading + "\n--- ĐÁP ÁN ---\n1. A 2. B");
  assert.ok(res2.keyText.startsWith("--- ĐÁP ÁN ---"));
  assert.ok(res2.chunks.join("\n").includes("Answer the questions below"));
});

test("buildImport: số câu đánh lại từ 1 ở mỗi phần -> giữ hết; lặp ở ranh giới khúc -> giữ 1", () => {
  const mk = (n, t) => ({ number: n, text: t, options: ["a", "b"], answer: "a", answerSource: "document" });
  const res = buildImport([
    { ok: true, data: { sections: [
      { instruction: "Part 1", format: "g-mcq", questions: [mk(1, "p1 q1"), mk(2, "p1 q2"), mk(3, "p1 q3")] },
      { instruction: "Part 2", format: "g-mcq", questions: [mk(1, "p2 q1"), mk(2, "p2 q2"), mk(3, "p2 q3")] },
    ] } },
  ], { subject: "grammar" });
  assert.equal(res.stats.questions, 6);
  assert.ok(!res.warnings.some((w) => /Duplicate/.test(w)));

  // Cùng số nhưng khác nội dung trong một section -> giữ
  const res2 = buildImport([
    { ok: true, data: { sections: [{ instruction: "P", format: "g-mcq", questions: [mk(1, "one"), mk(1, "other")] }] } },
  ], { subject: "grammar" });
  assert.equal(res2.stats.questions, 2);

  // Section lặp qua ranh giới khúc với cùng câu (khác hoa thường) -> giữ 1
  const res3 = buildImport([
    { ok: true, data: { sections: [{ instruction: "P", format: "g-mcq", questions: [mk(5, "Same question")] }] } },
    { ok: true, data: { sections: [{ instruction: "P", format: "g-mcq", questions: [mk(5, " same QUESTION ")] }] } },
  ], { subject: "grammar" });
  assert.equal(res3.stats.questions, 1);
  assert.ok(res3.warnings.some((w) => w.includes("Duplicate question number 5")));
});

test("buildImport: bỏ <mark> và [IMGn] còn sót, cảnh báo ảnh nằm trong passage/instruction", () => {
  const res = buildImport([
    { ok: true, data: { sections: [{
      instruction: "Read <mark>this</mark> [IMG2]",
      format: "g-mcq",
      passage: "Passage with [IMG3] picture <mark>text</mark>",
      questions: [
        { number: 1, text: "Pick <mark>one</mark> [IMG1]", imageRef: "IMG1",
          options: ["<mark>red</mark>", "blue"], answer: "<mark>red</mark>", answerSource: "document" },
        { number: 2, text: "Look [IMG4] here", options: ["x", "y"], answer: "x", answerSource: "document" },
      ],
    }] } },
  ], { subject: "reading", images: [{ ref: "IMG1" }] });
  const sec = res.sections[0];
  const dump = JSON.stringify(res.sections);
  assert.ok(!/<\/?mark>/.test(dump));
  assert.ok(!/\[IMG\d\]/.test(dump));
  assert.equal(sec.name, "Read this");
  assert.equal(sec.passageText, "Passage with picture text");
  assert.deepEqual(res.imageLinks, [{ si: 0, fi: 0, ref: "IMG1" }]);
  assert.ok(res.warnings.includes("Image 2 is inside a passage or instruction — add it by hand."));
  assert.ok(res.warnings.includes("Image 3 is inside a passage or instruction — add it by hand."));
  assert.ok(res.warnings.includes("Image 4 is inside a passage or instruction — add it by hand."));
  assert.ok(!res.warnings.some((w) => w.startsWith("Image 1 ")));
  assert.ok(!res.flags.some((f) => /does not match/.test(f.reason)));
});

test("route import-word: tổng base64 ảnh > 3 MB -> bỏ ảnh lớn nhất, warning + cờ cho câu dùng ảnh", async () => {
  process.env.JWT_SECRET = "test-secret-word-import";
  const origKey = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = "dummy-gemini-key";
  const origGenerateJSON = gemini.generateJSON;
  const origIsEnabled = gemini.isEnabled;
  const origFormidable = formidablePkg.formidable;
  const origWmFindOne = WorkspaceMember.findOne;
  const origWsFindById = Workspace.findById;
  const origAppSettingFindOne = AppSetting.findOne;
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};

  const png = (n) => Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(n, 1)]);
  const draw = (id) =>
    `<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${id}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  // 1.5 MB + 1.3 MB raw = 2.8 MB (qua giới hạn đọc docx) nhưng base64 ~3.7 MB
  const docxBuf = makeDocx({
    body:
      `<w:p><w:r><w:t>Q1 </w:t></w:r>${draw("rId1")}</w:p><w:p><w:r><w:t>Q2 </w:t></w:r>${draw("rId2")}</w:p>`,
    rels: [{ id: "rId1", target: "media/a.png" }, { id: "rId2", target: "media/b.png" }],
    media: { "a.png": png(1500 * 1024), "b.png": png(1300 * 1024) },
  });
  const tmpDocxPath = path.join(os.tmpdir(), `test-word-big-${Date.now()}.docx`);
  fs.writeFileSync(tmpDocxPath, docxBuf);

  try {
    gemini.isEnabled = () => true;
    gemini.generateJSON = async () => ({
      data: { sections: [{ instruction: "Images", format: "g-mcq", questions: [
        { number: 1, text: "Q1", imageRef: "IMG1", options: ["a", "b"], answer: "a", answerSource: "ai" },
        { number: 2, text: "Q2", imageRef: "IMG2", options: ["a", "b"], answer: "a", answerSource: "document" },
      ] }] },
      model: "mock", logId: "log-1",
    });
    WorkspaceMember.findOne = () => ({ select: () => ({ lean: async () => ({ workspaceId: "ws1", role: "teacher" }) }) });
    Workspace.findById = () => ({ select: () => ({ lean: async () => ({ _id: "ws1", status: "active", settings: {} }) }) });
    AppSetting.findOne = () => ({ lean: async () => ({ value: "gemini-2.5-flash" }) });
    clearTenantCache();
    formidablePkg.formidable = () => ({
      parse: async () => [
        { program: "general", subject: "grammar" },
        { file: { filepath: tmpDocxPath, originalFilename: "big.docx", mimetype: "application/octet-stream" } },
      ],
    });

    delete require.cache[require.resolve("../pages/api/admin/import-word")];
    const route = require("../pages/api/admin/import-word");
    const token = signUserToken({ _id: "t1", role: "teacher", name: "Teacher One" });
    const req = {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      url: "/api/admin/import-word",
      ws: { workspaceId: "ws1", demo: false },
    };
    let statusCode = 200;
    let payload = null;
    const res = {
      setHeader() {},
      status(c) { statusCode = c; return this; },
      json(p) { payload = p; return this; },
    };
    await route(req, res);

    assert.equal(statusCode, 200, JSON.stringify(payload).slice(0, 300));
    assert.equal(payload.images.length, 1);
    assert.equal(payload.images[0].ref, "IMG2");
    assert.ok(payload.images.reduce((n, i) => n + i.base64.length, 0) <= 3 * 1024 * 1024);
    assert.deepEqual(payload.imageLinks, [{ si: 0, fi: 1, ref: "IMG2" }]);
    assert.ok(payload.warnings.some((w) => /Image IMG1 .* omitted/.test(w)));
    // Câu 1 đã có cờ "AI" -> gộp lý do, không nhân đôi mục
    const f0 = payload.flags.filter((f) => f.si === 0 && f.fi === 0);
    assert.equal(f0.length, 1);
    assert.match(f0[0].reason, /Answer suggested by AI/);
    assert.match(f0[0].reason, /Image could not be included — add it by hand/);
    assert.equal(payload.flags.filter((f) => f.fi === 1).length, 0);
  } finally {
    if (origKey !== undefined) process.env.GEMINI_API_KEY = origKey;
    else delete process.env.GEMINI_API_KEY;
    gemini.generateJSON = origGenerateJSON;
    gemini.isEnabled = origIsEnabled;
    formidablePkg.formidable = origFormidable;
    WorkspaceMember.findOne = origWmFindOne;
    Workspace.findById = origWsFindById;
    AppSetting.findOne = origAppSettingFindOne;
    clearTenantCache();
    if (fs.existsSync(tmpDocxPath)) { try { fs.unlinkSync(tmpDocxPath); } catch {} }
  }
});

// 4. Gemini thật: thiếu đáp án, before/after một nửa, text bịa ở pron
const REAL_GEMINI = () => ({
  sections: [
    { instruction: "Choose the word whose underlined part is pronounced differently from the others.", format: "g-pron", questions: [
      { number: 1, options: ["watch<u>ed</u>", "want<u>ed</u>", "need<u>ed</u>", "visit<u>ed</u>"], text: "<u>ed</u> endings pronunciation: A. watch<u>ed</u> B. want<u>ed</u> C. need<u>ed</u> D. visit<u>ed</u>" }] },
    { instruction: "Give the correct form of the verbs in brackets.", format: "g-verb", questions: [
      { number: 1, before: "She ", hint: "go", text: "She ____ (go) to school by bike every day." }] },
    { instruction: "Look at the sign and choose the best answer.", format: "g-sign", questions: [
      { number: 1, imageRef: "IMG1", options: ["You must stop here.", "You can park here.", "You can turn left.", "You must go fast."], text: "What does this sign mean? [IMG1]" }] },
    { instruction: "Answer the questions below in complete sentences.", format: "g-rq", passage: "Nam lives in Hue ...", questions: [{ number: 1, text: "Where does Nam live?" }] },
  ],
});

test("WORD_SCHEMA: câu hỏi bắt buộc có answer/answerSource/confidence", () => {
  const req = WORD_SCHEMA.properties.sections.items.properties.questions.items.required;
  for (const k of ["number", "text", "options", "answer", "answerSource", "confidence"]) assert.ok(req.includes(k), k);
});

test("buildImport: JSON Gemini thật thiếu đáp án -> nhãn sạch, không có 'undefined'", () => {
  const r = buildImport([{ ok: true, data: REAL_GEMINI() }], { subject: "general" });
  const fields = r.sections.flatMap((s) => s.fields);
  const verb = fields.find((f) => f.type === "fill" && /She/.test(f.label));
  assert.equal(verb.label, "She");
  assert.equal(verb.post, "to school by bike every day.");
  assert.equal(verb.hint, "(go)");
  assert.equal(fields[0].label, "");
  for (const w of r.warnings) assert.ok(!/undefined|null/.test(w), w);
  for (const f of r.flags) assert.ok(!/undefined|null/.test(f.reason), f.reason);
});

test("buildImport: có đáp án thì điền đúng và không còn cờ 'does not match'", () => {
  const d = REAL_GEMINI();
  d.sections[0].questions[0].answer = "A";
  d.sections[1].questions[0].answer = "goes";
  d.sections[2].questions[0].answer = "You must stop here.";
  d.sections[3].questions[0].answer = "He lives in Hue.";
  const r = buildImport([{ ok: true, data: d }], { subject: "general" });
  const fields = r.sections.flatMap((s) => s.fields);
  assert.equal(fields.length, 4);
  assert.deepEqual(fields[1].answers, ["goes"]);
  assert.deepEqual(fields[3].answers, ["He lives in Hue."]);
  assert.equal(fields[0].answers.length, 1);
  assert.equal(fields[2].answers.length, 1);
  for (const f of r.flags) assert.ok(!/does not match|No answer/.test(f.reason), f.reason);
  for (const w of r.warnings) assert.ok(!/does not match|undefined/.test(w), w);
});
