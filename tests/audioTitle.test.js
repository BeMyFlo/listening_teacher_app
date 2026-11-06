const test = require("node:test");
const assert = require("node:assert/strict");

test("audioTitleFromFile: bỏ đuôi và dấu nối, tên rỗng có mặc định", async () => {
  const { audioTitleFromFile } = await import("../lib/teacher/audioTitle.js");
  assert.equal(audioTitleFromFile("Unit_2-listening.mp3"), "Unit 2 listening");
  assert.equal(audioTitleFromFile("track.final.wav"), "track.final");
  assert.equal(audioTitleFromFile(""), "Audio track");
  assert.equal(audioTitleFromFile("x".repeat(200) + ".mp3").length, 120);
});

test("imageTitleFromFile: tên file thật giữ nguyên, ảnh dán (image.png) có tên theo thời điểm", async () => {
  const { imageTitleFromFile } = await import("../lib/teacher/audioTitle.js");
  assert.equal(imageTitleFromFile("Library_map-2.png"), "Library map 2");
  const at = new Date(2026, 10, 6, 9, 5);
  assert.equal(imageTitleFromFile("image.png", at), "Pasted image 2026-11-06 09:05");
  assert.equal(imageTitleFromFile("", at), "Pasted image 2026-11-06 09:05");
});
