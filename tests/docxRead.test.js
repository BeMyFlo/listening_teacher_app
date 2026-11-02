const test = require("node:test");
const assert = require("node:assert/strict");
const { readDocx } = require("../lib/docxRead");
const { makeDocx, makeZip } = require("./helpers/makeZip");

const run = (t, rpr = "") => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const para = (...runs) => `<w:p>${runs.join("")}</w:p>`;
const U = '<w:u w:val="single"/>';
const read = (o) => readDocx(makeDocx(o));

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(20, 1)]);
const NOT_DOCX = /This is not a \.docx file/;

test("gạch chân qua 2 run liền nhau -> 1 thẻ <u>", () => {
  const { text } = read({ body: para(run("The "), run("ea", U), run("rth", U), run(" is round")) });
  assert.equal(text, "The <u>earth</u> is round");
});

test("u val=none bị bỏ qua", () => {
  assert.equal(read({ body: para(run("plain", '<w:u w:val="none"/>')) }).text, "plain");
});

test("run gạch chân chỉ có khoảng trắng / toàn gạch dưới -> ____", () => {
  assert.equal(read({ body: para(run("She "), run("   ", U), run(" home")) }).text, "She ____ home");
  assert.equal(read({ body: para(run("a "), run("______", U), run(" b")) }).text, "a ____ b");
});

test("chỗ trống ______, ……, .... -> ____", () => {
  assert.equal(read({ body: para(run("I ______ go ……… and ....... ok")) }).text, "I ____ go ____ and ____ ok");
});

test("highlight / màu chữ / shd -> <mark>, lồng với <u>", () => {
  const hl = read({ body: para(run("A. "), run("cat", '<w:highlight w:val="yellow"/>')) }).text;
  assert.equal(hl, "A. <mark>cat</mark>");
  assert.equal(read({ body: para(run("dog", '<w:color w:val="FF0000"/>')) }).text, "<mark>dog</mark>");
  assert.equal(read({ body: para(run("dog", '<w:color w:val="auto"/><w:shd w:fill="auto"/>')) }).text, "dog");
  assert.equal(read({ body: para(run("x", '<w:shd w:val="clear" w:fill="FFFF00"/>')) }).text, "<mark>x</mark>");
  const both = read({ body: para(run("a", '<w:highlight w:val="green"/>' + U), run("b", '<w:highlight w:val="green"/>' + U)) }).text;
  assert.equal(both, "<mark><u>ab</u></mark>");
});

test("textbox trong mc:AlternateContent không bị lặp", () => {
  const body =
    '<w:p><w:r><mc:AlternateContent><mc:Choice Requires="wps"><w:drawing><wps:txbx><w:txbxContent>' +
    para(run("Box text")) +
    "</w:txbxContent></wps:txbx></w:drawing></mc:Choice><mc:Fallback><w:pict><v:textbox><w:txbxContent>" +
    para(run("Box text")) +
    "</w:txbxContent></v:textbox></w:pict></mc:Fallback></mc:AlternateContent></w:r>" +
    run("After") +
    "</w:p>";
  const { text } = read({ body });
  assert.equal(text.split("Box text").length - 1, 1);
  assert.equal(text, "Box text\nAfter");
});

const NUM =
  '<w:abstractNum w:abstractNumId="0"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="upperLetter"/><w:lvlText w:val="%1."/></w:lvl>' +
  '<w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%2)"/></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="12"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="2"><w:lvl w:ilvl="0"><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>' +
  '<w:abstractNum w:abstractNumId="3"><w:lvl w:ilvl="0"><w:numFmt w:val="bullet"/><w:lvlText w:val="o"/></w:lvl></w:abstractNum>' +
  '<w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num><w:num w:numId="2"><w:abstractNumId w:val="1"/></w:num>' +
  '<w:num w:numId="3"><w:abstractNumId w:val="2"/></w:num><w:num w:numId="4"><w:abstractNumId w:val="3"/></w:num>' +
  '<w:num w:numId="5"><w:abstractNumId w:val="1"/><w:lvlOverride w:ilvl="0"><w:startOverride w:val="3"/></w:lvlOverride></w:num>';
const np = (id, il, t) =>
  `<w:p><w:pPr><w:numPr><w:ilvl w:val="${il}"/><w:numId w:val="${id}"/></w:numPr></w:pPr>${run(t)}</w:p>`;

test("đánh số tự động: A./B./C., cấp lồng reset, start, roman, bullet, override", () => {
  const body =
    np(1, 0, "one") + np(1, 1, "sub1") + np(1, 1, "sub2") + np(1, 0, "two") + np(1, 1, "sub-again") + np(1, 0, "three") +
    np(2, 0, "x") + np(2, 0, "y") + np(3, 0, "r1") + np(3, 0, "r2") + np(4, 0, "b") + np(5, 0, "ov");
  const lines = read({ body, numbering: NUM }).text.split("\n");
  assert.deepEqual(lines, [
    "A. one", "1) sub1", "2) sub2", "B. two", "1) sub-again", "C. three",
    "12. x", "13. y", "i. r1", "ii. r2", "- b", "3. ov",
  ]);
});

test("bảng: mỗi hàng 1 dòng, ô nối bằng ' | ', đoạn trong ô nối bằng dấu cách", () => {
  const cell = (...ps) => `<w:tc>${ps.join("")}</w:tc>`;
  const body =
    "<w:tbl><w:tr>" + cell(para(run("a"))) + cell(para(run("b1")), para(run("b2"))) + "</w:tr>" +
    "<w:tr>" + cell(para(run("c"))) + cell(para(run("d"))) + "</w:tr></w:tbl>" + para(run("end"));
  assert.equal(read({ body }).text, "a | b1 b2\nc | d\nend");
});

test("tab, xuống dòng, entity, dòng trống gộp", () => {
  const body =
    para(run("a"), "<w:r><w:tab/></w:r>", run("b &amp; c &lt;d&gt;"), "<w:r><w:br/></w:r>", run("next")) +
    para() + para() + para() + para(run("tail   "));
  assert.equal(read({ body }).text, "a\tb & c <d>\nnext\n\ntail");
});

test("ảnh png -> [IMG1] + images[0]; emf -> marker + warning, không có image", () => {
  const draw = (id) =>
    `<w:r><w:drawing><wp:inline><a:graphic><a:graphicData><pic:pic><pic:blipFill><a:blip r:embed="${id}"/></pic:blipFill></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
  const pict = (id) => `<w:r><w:pict><v:shape><v:imagedata r:id="${id}"/></v:shape></w:pict></w:r>`;
  const r = read({
    body: para(run("Q1 "), draw("rId1")) + para(run("Q2 "), pict("rId2")) + para(draw("rId3")),
    rels: [
      { id: "rId1", target: "media/a.png" },
      { id: "rId2", target: "media/b.emf" },
      { id: "rId3", target: "media/gone.png" },
    ],
    media: { "a.png": PNG, "b.emf": Buffer.from("EMF-data-0000000000") },
  });
  assert.equal(r.text, "Q1 [IMG1]\nQ2 [IMG2]\n[IMG3]");
  assert.equal(r.images.length, 1);
  assert.equal(r.images[0].ref, "IMG1");
  assert.equal(r.images[0].mimeType, "image/png");
  assert.ok(r.images[0].buffer.equals(PNG));
  assert.equal(r.warnings.length, 2);
  assert.match(r.warnings[0], /Image 2 is in a format the app can't show/);
  assert.match(r.warnings[1], /Image 3/);
});

test("quá 20 ảnh: bỏ ảnh sau nhưng giữ marker", () => {
  const draw = (id) => `<w:r><w:drawing><a:blip r:embed="${id}"/></w:drawing></w:r>`;
  const rels = [], media = {}, ps = [];
  for (let i = 1; i <= 22; i++) {
    rels.push({ id: "r" + i, target: `media/i${i}.png` });
    media[`i${i}.png`] = PNG;
    ps.push(para(draw("r" + i)));
  }
  const r = read({ body: ps.join(""), rels, media });
  assert.equal(r.images.length, 20);
  assert.match(r.text, /\[IMG22\]/);
  assert.equal(r.warnings.length, 2);
});

test("không phải ZIP / thiếu document.xml / .doc cũ -> báo lỗi hướng dẫn", () => {
  assert.throws(() => readDocx(Buffer.from("just plain text, not a docx")), NOT_DOCX);
  assert.throws(() => readDocx(makeZip({ "foo.txt": "x" })), NOT_DOCX);
  assert.throws(() => readDocx(Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0]), Buffer.alloc(600)])), NOT_DOCX);
});

test("text quá dài -> báo lỗi", () => {
  const body = para(run("x".repeat(30000))) + para(run("y".repeat(31000)));
  assert.throws(() => read({ body }), /This file is too long/);
});

test("công thức m:oMath bị bỏ qua; thay đổi theo dõi (rPrChange) không tạo gạch chân", () => {
  const body = para(
    run("a "),
    "<m:oMath><m:r><m:t>x+1</m:t></m:r></m:oMath>",
    run("b", `<w:rPrChange w:id="1"><w:rPr>${U}</w:rPr></w:rPrChange>`)
  );
  assert.equal(read({ body }).text, "a b");
});
