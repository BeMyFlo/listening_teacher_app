const test = require("node:test");
const assert = require("node:assert/strict");
const Z = require("../lib/zipRead");
const { readWorkbook } = require("../lib/xlsxRead");
const { makeZip } = require("./helpers/makeZip");

test("zipRead: khứ hồi stored và deflated", () => {
  for (const store of [true, false]) {
    const buf = makeZip({ "a.txt": "hello", "dir/b.txt": Buffer.from("world ".repeat(50)) }, { store });
    const es = Z.listEntries(buf);
    assert.deepEqual(es.map((e) => e.name), ["a.txt", "dir/b.txt"]);
    assert.equal(es[0].method, store ? 0 : 8);
    assert.equal(Z.readEntry(buf, es[0], { maxBytes: 1000 }).toString(), "hello");
    assert.equal(Z.readText(buf, es, "dir/b.txt", 1000), "world ".repeat(50));
    assert.equal(Z.readText(buf, es, "none.txt", 1000), "");
  }
});

test("zipRead: size khai báo vượt maxBytes bị chặn trước khi giải nén", () => {
  const buf = makeZip({ "a.txt": "x".repeat(5000) });
  const [e] = Z.listEntries(buf);
  assert.throws(() => Z.readEntry(buf, e, { maxBytes: 1000 }), /too large after decompression/);
  const st = makeZip({ "a.txt": "x".repeat(5000) }, { store: true });
  assert.throws(() => Z.readEntry(st, Z.listEntries(st)[0], { maxBytes: 1000 }), /too large/);
});

test("zipRead: zip bomb khai báo size nhỏ vẫn bị chặn khi giải nén", () => {
  const buf = makeZip({ "bomb.bin": Buffer.alloc(5 * 1024 * 1024) });
  const [e] = Z.listEntries(buf);
  assert.ok(e.compSize < 100 * 1024);
  assert.throws(() => Z.readEntry(buf, { ...e, size: 10 }, { maxBytes: 1024 * 1024 }), /File is too large after decompression/);
  assert.throws(() => Z.readEntry(buf, e, { maxBytes: 1024 * 1024 }), /File is too large after decompression/);
});

test("zipRead: không có EOCD -> báo lỗi", () => {
  assert.throws(() => Z.listEntries(Buffer.from("not a zip at all, just text".repeat(5))), /ZIP central directory not found/);
});

test("zipRead: quá 2000 entry -> báo lỗi", () => {
  const files = {};
  for (let i = 0; i < 2001; i++) files["f" + i] = "x";
  assert.throws(() => Z.listEntries(makeZip(files, { store: true })), /too many entries/);
});

test("zipRead: phương pháp nén lạ -> báo lỗi", () => {
  const buf = makeZip({ "a.txt": "hi" }, { store: true });
  const [e] = Z.listEntries(buf);
  assert.throws(() => Z.readEntry(buf, { ...e, method: 12 }, { maxBytes: 100 }), /unsupported/);
});

test("xlsxRead.readWorkbook vẫn đọc workbook nhỏ (shared + inline + số)", () => {
  const buf = makeZip({
    "xl/workbook.xml": '<workbook><sheets><sheet name="Q" sheetId="1" r:id="rId1"/></sheets></workbook>',
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/sharedStrings.xml": "<sst><si><t>Question &amp; one</t></si><si><t>B</t></si></sst>",
    "xl/worksheets/sheet1.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
      '<row r="2"><c r="A2" t="inlineStr"><is><t>inline</t></is></c><c r="C2"><v>42</v></c></row></sheetData></worksheet>',
  });
  const wb = readWorkbook(buf);
  assert.deepEqual(wb.Q, [["Question & one", "B"], ["inline", "", "42"]]);
});

test("xlsxRead: nhiều sheet trỏ cùng 1 file lớn bị chặn bởi trần tổng", () => {
  const sheets = Array.from({ length: 6 }, (_, i) => `<sheet name="S${i}" sheetId="${i + 1}" r:id="rId1"/>`).join("");
  const buf = makeZip({
    "xl/workbook.xml": `<workbook><sheets>${sheets}</sheets></workbook>`,
    "xl/_rels/workbook.xml.rels": '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
    "xl/worksheets/sheet1.xml": "<worksheet>" + " ".repeat(15 * 1024 * 1024) + "</worksheet>",
  });
  assert.throws(() => readWorkbook(buf), /too large after decompression/);
});
