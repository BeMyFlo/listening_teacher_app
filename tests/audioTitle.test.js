const test = require("node:test");
const assert = require("node:assert/strict");

test("audioTitleFromFile: bỏ đuôi và dấu nối, tên rỗng có mặc định", async () => {
  const { audioTitleFromFile } = await import("../lib/teacher/audioTitle.js");
  assert.equal(audioTitleFromFile("Unit_2-listening.mp3"), "Unit 2 listening");
  assert.equal(audioTitleFromFile("track.final.wav"), "track.final");
  assert.equal(audioTitleFromFile(""), "Audio track");
  assert.equal(audioTitleFromFile("x".repeat(200) + ".mp3").length, 120);
});
