// Phase 12 G4 bước 4: mã đề (shuffleExam), zipWrite, Word (.docx), route xuất đề.
// Toàn bộ chạy với model giả — KHÔNG kết nối DB / mạng thật.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const { shuffleExam, makeRng } = require("../lib/exam/shuffleExam");
const { rewriteBlanks } = require("../lib/exam/blanks");
const { writeZip, crc32 } = require("../lib/zipWrite");
const { listEntries, readEntry } = require("../lib/zipRead");
const { readDocx } = require("../lib/docxRead");
const { renderExamDocx, renderAnswerKeyDocx } = require("../lib/exam/docx");
const { buildExam } = require("../lib/exam/buildExam");
const { GENERAL_LABELS } = require("../lib/generalFormats");
const Test = require("../lib/models/Test");
const Image = require("../lib/models/Image");
const WorkspaceMember = require("../lib/models/WorkspaceMember");
const Workspace = require("../lib/models/Workspace");
const AuditLog = require("../lib/models/AuditLog");
const { signUserToken } = require("../lib/auth");
const { clearTenantCache } = require("../lib/tenant");

// ---------------------------------------------------------------- dữ liệu mẫu

// 1x1 PNG thật.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

function mcq(id, label, opts, correct, formatLabel = GENERAL_LABELS.mcq) {
  return {
    id,
    formatLabel,
    label,
    type: "choice",
    options: opts.map((t, i) => ({ value: "o" + id + "_" + i, label: t })),
    answers: ["o" + id + "_" + correct],
    selectCount: 1,
  };
}
const fillQ = (id, label, answers) => ({ id, formatLabel: GENERAL_LABELS.wform, label, type: "fill", pre: "", post: "", answers, options: [], tokens: [] });

// Phần 1: 10 câu trắc nghiệm đều; mỗi câu đáp án đúng là lựa chọn đầu "right<id>".
function mcqPart(name, n, start = 1) {
  return {
    name,
    passageText: "",
    fields: Array.from({ length: n }, (_, i) => {
      const id = start + i;
      return mcq(id, "Question " + id, ["right" + id, "wrong a" + id, "wrong b" + id, "wrong c" + id], 0);
    }),
  };
}

const labelsOf = (part) => part.questions.map((q) => q.label);
const optionLabels = (q) => q.options.map((o) => o.label);

// ---------------------------------------------------------------- shuffleExam

test("shuffle: cùng seed ra đúng cùng đề, khác mã đề ra thứ tự khác", () => {
  const skills = { reading: { sections: [mcqPart("Part 1", 10)] } };
  const a = shuffleExam(skills, { seed: "t1", code: 1 });
  const b = shuffleExam(skills, { seed: "t1", code: 1 });
  assert.deepEqual(a, b);
  const c = shuffleExam(skills, { seed: "t1", code: 2 });
  assert.notDeepEqual(labelsOf(a.parts[0]), labelsOf(c.parts[0]));
  const d = shuffleExam(skills, { seed: "t2", code: 1 });
  assert.notDeepEqual(labelsOf(a.parts[0]), labelsOf(d.parts[0]));
});

test("shuffle: không dùng Math.random và không sửa đầu vào", () => {
  const src = fs.readFileSync(path.join(__dirname, "../lib/exam/shuffleExam.js"), "utf8");
  assert.ok(!/Math\.random/.test(src));
  const skills = { reading: { sections: [mcqPart("Part 1", 6)] } };
  const before = structuredClone(skills);
  shuffleExam(skills, { seed: "x", code: 3 });
  assert.deepEqual(skills, before);
  const r1 = makeRng("abc");
  const r2 = makeRng("abc");
  assert.equal(r1(), r2());
});

test("shuffle: đáp án đúng theo chữ cái mới (mcq), không mất lựa chọn, số câu liền 1..N", () => {
  const skills = { reading: { sections: [mcqPart("Part 1", 8), mcqPart("Part 2", 7, 9)] } };
  for (const code of [1, 2, 3, 4]) {
    const ex = shuffleExam(skills, { seed: "tt", code });
    const nums = ex.parts.flatMap((p) => p.questions.map((q) => q.number));
    assert.deepEqual(nums, Array.from({ length: 15 }, (_, i) => i + 1));
    assert.equal(ex.answers.length, 15);
    for (const p of ex.parts) {
      for (const q of p.questions) {
        const id = q.label.replace("Question ", "");
        // không mất lựa chọn
        assert.deepEqual(optionLabels(q).slice().sort(), ["right" + id, "wrong a" + id, "wrong b" + id, "wrong c" + id].sort());
        // chữ cái A.. theo vị trí
        assert.deepEqual(q.options.map((o) => o.letter), ["A", "B", "C", "D"]);
        const key = ex.answers.find((a) => a.number === q.number);
        const correct = q.options.find((o) => o.letter === key.answer);
        assert.equal(correct.label, "right" + id);
      }
    }
    // phần giữ nguyên thứ tự phần
    assert.deepEqual(ex.parts.map((p) => p.name), ["Part 1", "Part 2"]);
  }
  // Có ít nhất một mã làm lựa chọn đúng không còn ở A.
  const moved = [1, 2, 3, 4].some((code) => {
    const ex = shuffleExam(skills, { seed: "tt", code });
    return ex.answers.some((a) => a.answer !== "A");
  });
  assert.ok(moved);
});

test("shuffle: câu chọn nhiều đáp án map đủ chữ cái", () => {
  const f = mcq(1, "Pick two", ["a", "b", "c", "d", "e"], 0);
  f.answers = ["o1_0", "o1_3"];
  f.selectCount = 2;
  const ex = shuffleExam({ reading: { sections: [{ name: "P", fields: [f] }] } }, { seed: "m", code: 2 });
  const q = ex.parts[0].questions[0];
  const letters = ex.answers[0].answer.split(", ");
  assert.equal(letters.length, 2);
  assert.deepEqual(letters.map((l) => q.options.find((o) => o.letter === l).label).sort(), ["a", "d"]);
});

test("D7: dạng không trộn lựa chọn (Error identification, True/False, T/F/NG, Insert, Arrange)", () => {
  for (const fmt of [GENERAL_LABELS.error, GENERAL_LABELS.tf, GENERAL_LABELS.tfng, GENERAL_LABELS.insert, GENERAL_LABELS.arrange]) {
    const f = mcq(1, "Q", ["one", "two", "three", "four"], 2, fmt);
    for (const code of [1, 2, 3, 4]) {
      const ex = shuffleExam({ reading: { sections: [{ name: "P", fields: [f] }] } }, { seed: "d7", code });
      assert.deepEqual(optionLabels(ex.parts[0].questions[0]), ["one", "two", "three", "four"], fmt);
      assert.equal(ex.answers[0].answer, "C");
    }
  }
});

test("D7: [I]-[IV], All/None of the above, Both...and, Neither...nor giữ nguyên thứ tự lựa chọn", () => {
  const sets = [
    ["[I]", "[II]", "[III]", "[IV]"],
    ["red", "blue", "green", "All of the above"],
    ["red", "None of the above", "blue", "green"],
    ["A only", "B only", "Both A and B", "Neither"],
    ["x", "Neither x nor y", "y", "z"],
  ];
  for (const opts of sets) {
    const f = mcq(1, "Q", opts, 1);
    for (const code of [1, 2, 3, 4]) {
      const ex = shuffleExam({ reading: { sections: [{ name: "P", fields: [f] }] } }, { seed: "d7b", code });
      assert.deepEqual(optionLabels(ex.parts[0].questions[0]), opts);
    }
  }
});

test("D7: phần có đoạn văn giữ thứ tự câu, chỗ trống được viết lại theo số mới", () => {
  const passage = {
    name: "Cloze",
    passageText: "He (10) to school and (11) a book, then (12) home.",
    fields: [10, 11, 12].map((id) => mcq(id, "Blank " + id, ["w" + id, "x" + id, "y" + id, "z" + id], 0, GENERAL_LABELS.cloze)),
  };
  const skills = { reading: { sections: [mcqPart("Part 1", 3), passage] } };
  for (const code of [1, 2, 3]) {
    const ex = shuffleExam(skills, { seed: "ps", code });
    const p2 = ex.parts[1];
    assert.deepEqual(p2.questions.map((q) => q.label), ["Blank 10", "Blank 11", "Blank 12"]);
    assert.deepEqual(p2.questions.map((q) => q.number), [4, 5, 6]);
    assert.equal(p2.passageText, "He (4) to school and (5) a book, then (6) home.");
  }
  // Mã gốc: giữ nguyên số và đoạn văn.
  const orig = shuffleExam(skills, { seed: "ps", code: 0 });
  assert.equal(orig.parts[1].passageText, passage.passageText);
  assert.deepEqual(orig.parts[1].questions.map((q) => q.number), [10, 11, 12]);
});

test("mã đề 0 hoặc bỏ trống: giữ nguyên thứ tự, số câu và lựa chọn", () => {
  const skills = { reading: { sections: [mcqPart("Part 1", 6)] } };
  for (const code of [0, "0", undefined, ""]) {
    const ex = shuffleExam(skills, { seed: "o", code });
    assert.deepEqual(labelsOf(ex.parts[0]), Array.from({ length: 6 }, (_, i) => "Question " + (i + 1)));
    for (const q of ex.parts[0].questions) assert.equal(q.options[0].label, "right" + q.number);
    assert.ok(ex.answers.every((a) => a.answer === "A"));
  }
});

test("shuffle: câu điền liệt kê mọi đáp án chấp nhận, reorder trộn mảnh theo seed", () => {
  const re = { id: 2, formatLabel: GENERAL_LABELS.reorder, label: "", type: "fill", tokens: ["the", "cat", "sat", "down", "."], answers: ["The cat sat down."], options: [] };
  const skills = { reading: { sections: [{ name: "P", fields: [fillQ(1, "He ___ (go).", ["goes", "is going"]), re] }] } };
  const a = shuffleExam(skills, { seed: "r", code: 1 });
  const b = shuffleExam(skills, { seed: "r", code: 1 });
  const fill = a.answers.find((x) => x.answer.includes("goes"));
  assert.equal(fill.answer, "goes / is going");
  const t1 = a.parts[0].questions.find((q) => q.tokens.length).tokens;
  assert.deepEqual(t1, b.parts[0].questions.find((q) => q.tokens.length).tokens);
  assert.deepEqual(t1.slice().sort(), re.tokens.slice().sort());
  // mã gốc giữ nguyên thứ tự mảnh như đã lưu
  assert.deepEqual(shuffleExam(skills, { seed: "r", code: 0 }).parts[0].questions[1].tokens, re.tokens);
});

test("rewriteBlanks dùng chung: re-export từ fillFromBank vẫn là cùng hàm", () => {
  const fb = require("../lib/teacher/fillFromBank");
  assert.equal(fb.rewriteBlanks, rewriteBlanks);
  assert.equal(rewriteBlanks("a (3) b", new Map([[3, 9]])).text, "a (9) b");
});

// ---------------------------------------------------------------- zipWrite

test("zipWrite: crc32 chuẩn + đọc lại được bằng zipRead", () => {
  assert.equal(crc32(Buffer.from("123456789")), 0xcbf43926);
  const bin = Buffer.alloc(3000);
  for (let i = 0; i < bin.length; i++) bin[i] = (i * 7 + 3) & 0xff;
  const zip = writeZip({ "a.txt": "xin chào <&> \"'", "dir/b.bin": bin, "empty.txt": "" });
  const entries = listEntries(zip);
  assert.deepEqual(entries.map((e) => e.name), ["a.txt", "dir/b.bin", "empty.txt"]);
  const get = (n) => readEntry(zip, entries.find((e) => e.name === n));
  assert.equal(get("a.txt").toString("utf8"), "xin chào <&> \"'");
  assert.ok(get("dir/b.bin").equals(bin));
  assert.equal(get("empty.txt").length, 0);
  // CRC trong header cục bộ khớp dữ liệu
  for (const e of entries) {
    const data = readEntry(zip, e);
    assert.equal(zip.readUInt32LE(e.offset + 14), crc32(data));
  }
  // Cùng đầu vào ra cùng byte.
  assert.ok(writeZip({ "a.txt": "x" }).equals(writeZip({ "a.txt": "x" })));
});

// ---------------------------------------------------------------- docx

// Kiểm XML đúng cú pháp: thẻ khớp, không có & trần, không có ký tự điều khiển.
function assertWellFormed(xml, label) {
  assert.ok(!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(xml), label + ": ký tự điều khiển");
  const re = /<([^>]*)>|([^<]+)/g;
  const stack = [];
  let m;
  while ((m = re.exec(xml))) {
    if (m[2] !== undefined) {
      assert.ok(!/&(?!(amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);)/i.test(m[2]), label + ": & trần trong chữ");
      continue;
    }
    const t = m[1];
    if (t[0] === "?" || t[0] === "!") continue;
    if (t[0] === "/") {
      const name = t.slice(1).trim();
      assert.equal(stack.pop(), name, label + ": thẻ đóng lệch " + name);
    } else {
      const name = t.split(/[\s/]/)[0];
      assert.ok(!/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(t), label + ": & trần trong thuộc tính");
      const quotes = (t.match(/"/g) || []).length;
      assert.equal(quotes % 2, 0, label + ": nháy thuộc tính lẻ");
      if (t[t.length - 1] !== "/") stack.push(name);
    }
  }
  assert.equal(stack.length, 0, label + ": thẻ chưa đóng");
}

function allXml(buf) {
  return listEntries(buf)
    .filter((e) => /\.(xml|rels)$/.test(e.name))
    .map((e) => ({ name: e.name, xml: readEntry(buf, e).toString("utf8") }));
}

const NASTY = `A < B & "C" 'D' </w:t> <script>x</script>`;

function sampleTest() {
  const errQ = mcq(3, "She __go__ to school.", ["A", "B", "C", "D"], 1, GENERAL_LABELS.error);
  errQ.options = ["A", "B", "C", "D"].map((l) => ({ value: l, label: l }));
  errQ.answers = ["B"];
  const pron = mcq(4, "Pick the odd one", ["h__ea__d", "b__ea__d", "s__ea__t", "t__ea__"], 2, GENERAL_LABELS.pron);
  return {
    _id: "507f1f77bcf86cd799439011",
    workspaceId: "ws1",
    program: "general",
    title: "Giữa kỳ 1 — Grade 10",
    level: 10,
    skills: {
      listening: { durationMinutes: 15, sections: [{ name: "Listening Part 1", fields: [mcq(1, "What did he buy?", ["a book", "a pen", "a bag"], 0)] }] },
      reading: {
        durationMinutes: 30,
        sections: [
          { name: "Part A", imageId: "img1", fields: [mcq(1, NASTY, ["o1 " + NASTY, "o2", "o3", "o4"], 0), fillQ(2, "He ____ (go) to school.", ["goes"]), errQ, pron] },
          {
            name: "Part B",
            passageText: "Tom (15) home and (16) a __big__ cake.",
            fields: [15, 16].map((id) => mcq(id, "Blank " + id, ["p", "q", "r", "s"], 0, GENERAL_LABELS.cloze)),
          },
        ],
      },
      writing: { durationMinutes: 20, prompts: [{ title: "Task 1", instructions: "Write about your day & hobbies.\nUse 80 words." }] },
      speaking: { prompts: [] },
    },
  };
}

test("docx: đủ câu, gạch chân giữ được, ký tự đặc biệt an toàn, ảnh nhúng thật, XML đúng cú pháp", () => {
  const t = sampleTest();
  const urlById = new Map([["img1", "https://res.cloudinary.com/demo/image/upload/a.png"]]);
  const { exam, meta } = buildExam(t, { urlById, code: 2 });
  const buf = renderExamDocx(exam, meta, { "https://res.cloudinary.com/demo/image/upload/a.png": { buffer: PNG } });

  for (const { name, xml } of allXml(buf)) assertWellFormed(xml, name);
  const names = listEntries(buf).map((e) => e.name);
  for (const n of ["[Content_Types].xml", "_rels/.rels", "word/document.xml", "word/_rels/document.xml.rels", "word/media/image1.png"]) {
    assert.ok(names.includes(n), n);
  }

  const out = readDocx(buf);
  // đủ câu hỏi: mọi nhãn câu có mặt
  for (const label of ["What did he buy?", NASTY, "He ____ (go) to school.", "Pick the odd one", "Blank 15", "Blank 16"]) {
    assert.ok(out.text.includes(label), "thiếu: " + label);
  }
  // gạch chân: error (đề) và pron (lựa chọn) và đoạn văn
  assert.ok(out.text.includes("<u>go</u>"), out.text);
  assert.ok(out.text.includes("<u>ea</u>"));
  assert.ok(out.text.includes("<u>big</u>"));
  // ký tự đặc biệt không phá XML và không bị mất
  assert.ok(out.text.includes('A < B & "C" \'D\''));
  // đoạn văn viết lại số, tiêu đề, tiêu đề đầu trang, ảnh
  assert.ok(out.text.includes("Tom (5) home and (6) a "), out.text);
  assert.ok(out.text.includes("Giữa kỳ 1 — Grade 10"));
  assert.ok(out.text.includes("Grade: Grade 10") && out.text.includes("Code: 102"));
  assert.ok(out.text.includes("Name: ____"));
  assert.ok(out.text.includes("Listening: audio not included"));
  assert.ok(out.text.includes("Write about your day & hobbies."));
  assert.equal(out.images.length, 1);
  assert.equal(out.images[0].mimeType, "image/png");
});

test("docx: thiếu ảnh ghi [image missing]; ký tự điều khiển bị bỏ; không có script", () => {
  const t = sampleTest();
  t.title = "Bad\u0001Title\u0008";
  t.skills.reading.sections[0].fields[0].label = "Control\u0000char\u001f?";
  const urlById = new Map([["img1", "https://res.cloudinary.com/demo/image/upload/a.png"]]);
  const { exam, meta } = buildExam(t, { urlById, code: 1 });
  const buf = renderExamDocx(exam, meta, {});
  for (const { name, xml } of allXml(buf)) assertWellFormed(xml, name);
  const out = readDocx(buf);
  assert.ok(out.text.includes("[image missing]"));
  assert.ok(out.text.includes("BadTitle"));
  assert.ok(out.text.includes("Controlchar?"));
  assert.equal(out.images.length, 0);
});

test("docx đáp án: đủ số câu, đúng chữ cái theo mã đề, XML hợp lệ", () => {
  const t = sampleTest();
  const { exam, meta } = buildExam(t, { urlById: new Map(), code: 3 });
  const buf = renderAnswerKeyDocx(exam, meta);
  for (const { name, xml } of allXml(buf)) assertWellFormed(xml, name);
  const out = readDocx(buf);
  assert.ok(out.text.includes("Answer key"));
  for (const a of exam.answers) assert.ok(out.text.includes(`${a.number}. `), "câu " + a.number);
  assert.ok(out.text.includes("goes"));
  // Đề (không đáp án) không chứa đáp án câu điền.
  const examBuf = renderExamDocx(exam, meta, {});
  assert.ok(!readDocx(examBuf).text.includes("goes"));
});

// ---------------------------------------------------------------- route

const idOf = (v) => String(v && typeof v === "object" && v._id !== undefined ? v._id : v);
function matches(doc, filter) {
  return Object.entries(filter).every(([k, cond]) => {
    if (cond && typeof cond === "object" && "$in" in cond) return cond.$in.map(idOf).includes(idOf(doc[k]));
    return idOf(doc[k]) === idOf(cond);
  });
}

function installFakes(tests, images) {
  const orig = { tf: Test.findOne, if: Image.find, wm: WorkspaceMember.findOne, ws: Workspace.findById, audit: AuditLog.create, fetch: globalThis.fetch };
  const q = (compute) => {
    const o = { select: () => o, lean: () => o, then: (res, rej) => Promise.resolve().then(() => structuredClone(compute())).then(res, rej) };
    return o;
  };
  Test.findOne = (f) => q(() => tests.find((d) => matches(d, f)) || null);
  Image.find = (f) => q(() => images.filter((d) => matches(d, f)));
  const members = { uA: "ws1", uB: "ws2" };
  WorkspaceMember.findOne = (qq) => ({ select: () => ({ lean: async () => ({ workspaceId: members[String(qq.userId)], role: "teacher" }) }) });
  Workspace.findById = (id) => ({ select: () => ({ lean: async () => ({ _id: id, status: "active", settings: {} }) }) });
  AuditLog.create = async () => {};
  process.env.JWT_SECRET = "test-secret-g4-export";
  if (!global._mongooseConn) global._mongooseConn = {};
  global._mongooseConn.conn = {};
  clearTenantCache();

  const route = require("../pages/api/admin/test-export");
  const fetched = [];
  globalThis.fetch = async (url) => {
    fetched.push(String(url));
    return new Response(PNG, { status: 200, headers: { "content-type": "image/png" } });
  };
  const call = async (userId, query, role = "teacher") => {
    const token = signUserToken({ _id: userId, role, name: "T" });
    let status = 200;
    let payload = null;
    let sent = null;
    const headers = {};
    const res = {
      setHeader(k, v) { headers[k.toLowerCase()] = v; },
      status(c) { status = c; return this; },
      json(p) { payload = p; return this; },
      send(b) { sent = b; return this; },
    };
    await route({ method: "GET", query, headers: { authorization: "Bearer " + token }, url: "/api/admin/test-export" }, res);
    return { status, body: payload, buf: sent, headers };
  };
  const restore = () => {
    Test.findOne = orig.tf;
    Image.find = orig.if;
    WorkspaceMember.findOne = orig.wm;
    Workspace.findById = orig.ws;
    AuditLog.create = orig.audit;
    globalThis.fetch = orig.fetch;
    clearTenantCache();
  };
  return { call, restore, fetched };
}

async function withRoute(fn, { tests, images } = {}) {
  const t = sampleTest();
  const fx = installFakes(
    tests || [t, { ...sampleTest(), _id: "507f1f77bcf86cd799439012", program: "ielts" }],
    images || [{ _id: "img1", workspaceId: "ws1", cloudinaryUrl: "https://res.cloudinary.com/demo/image/upload/a.png" }]
  );
  try {
    await fn(fx, t);
  } finally {
    fx.restore();
  }
}

test("route: tải .docx của đề (đủ header, ảnh lấy từ Cloudinary), đáp án, tên file ASCII", () =>
  withRoute(async ({ call, fetched }, t) => {
    const r = await call("uA", { id: t._id, code: "2", kind: "exam", format: "docx" });
    assert.equal(r.status, 200);
    assert.match(r.headers["content-type"], /wordprocessingml/);
    assert.match(r.headers["content-disposition"], /^attachment; filename="[A-Za-z0-9._-]+\.docx"$/);
    assert.equal(r.headers["x-export-warnings"], undefined);
    assert.deepEqual(fetched, ["https://res.cloudinary.com/demo/image/upload/a.png"]);
    assert.equal(readDocx(r.buf).images.length, 1);

    const k = await call("uA", { id: t._id, code: "2", kind: "key", format: "docx" });
    assert.equal(k.status, 200);
    assert.match(k.headers["content-disposition"], /answer-key/);
    assert.ok(readDocx(k.buf).text.includes("Answer key"));
  }));

test("route: ảnh không phải Cloudinary không được tải, ghi [image missing] + X-Export-Warnings", () =>
  withRoute(
    async ({ call, fetched }, t) => {
      const r = await call("uA", { id: t._id, code: "1", kind: "exam", format: "docx" });
      assert.equal(r.status, 200);
      assert.deepEqual(fetched, []);
      assert.match(r.headers["x-export-warnings"], /image missing/);
      assert.ok(readDocx(r.buf).text.includes("[image missing]"));
    },
    { images: [{ _id: "img1", workspaceId: "ws1", cloudinaryUrl: "https://evil.example.com/a.png" }] }
  ));

test("route: ảnh tải lỗi (mạng) -> vẫn xuất file, có cảnh báo", () =>
  withRoute(async ({ call }, t) => {
    globalThis.fetch = async () => {
      throw new Error("network");
    };
    const r = await call("uA", { id: t._id, code: "1", kind: "exam", format: "docx" });
    assert.equal(r.status, 200);
    assert.match(r.headers["x-export-warnings"], /image missing/);
    assert.ok(readDocx(r.buf).text.includes("[image missing]"));
  }));

test("route: giáo viên workspace khác -> 404; chương trình không có ngân hàng -> 400; học sinh bị từ chối", () =>
  withRoute(async ({ call }, t) => {
    assert.equal((await call("uB", { id: t._id, code: "1", kind: "exam", format: "docx" })).status, 404);
    assert.equal((await call("uB", { id: t._id, code: "1", format: "json" })).status, 404);
    assert.equal((await call("uA", { id: "507f1f77bcf86cd799439012", code: "1" })).status, 400);
    const s = await call("uA", { id: t._id, code: "1" }, "student");
    assert.ok([401, 403].includes(s.status));
    assert.notEqual(s.status, 200);
    assert.equal((await call("uA", { id: t._id, code: "9" })).status, 400);
    assert.equal((await call("uA", { id: t._id, code: "1", kind: "zip" })).status, 400);
    assert.equal((await call("uA", { id: "", code: "1" })).status, 404);
  }));

test("route: kind=json của đề không kèm đáp án; kind=key dạng JSON mới có đáp án", () =>
  withRoute(async ({ call }, t) => {
    const r = await call("uA", { id: t._id, code: "3", kind: "json" });
    assert.equal(r.status, 200);
    const raw = JSON.stringify(r.body);
    assert.ok(!("answers" in r.body));
    assert.ok(!raw.includes('"answer"'));
    assert.ok(!raw.includes("explanation"));
    assert.ok(r.body.exam.parts.length >= 3);
    assert.equal(r.body.meta.code, "103");

    const e = await call("uA", { id: t._id, code: "3", kind: "exam", format: "json" });
    assert.ok(!("answers" in e.body));

    const k = await call("uA", { id: t._id, code: "3", kind: "key", format: "json" });
    assert.equal(k.status, 200);
    assert.ok(Array.isArray(k.body.answers) && k.body.answers.length === 7);
    assert.ok(!("exam" in k.body));

    // Cùng mã đề xuất lại ra đúng cùng đề (D6).
    const again = await call("uA", { id: t._id, code: "3", kind: "json" });
    assert.deepEqual(again.body, r.body);
  }));

test("route: đề có Writing hiện như phần cuối không lựa chọn; Listening có ghi chú", () =>
  withRoute(async ({ call }, t) => {
    const r = await call("uA", { id: t._id, code: "0", kind: "exam", format: "docx" });
    const text = readDocx(r.buf).text;
    assert.ok(text.indexOf("Writing") > text.indexOf("Part B"));
    assert.ok(text.includes("Task 1"));
    assert.ok(text.includes("Listening: audio not included"));
  }));
