const test = require("node:test");
const assert = require("node:assert/strict");
const { usesTenPoint, tenPoint, formatTenPoint } = require("../lib/tenPoint");

test("tenPoint: các mốc, bước 0.25", () => {
  assert.equal(tenPoint(0, 40), 0);
  assert.equal(tenPoint(31, 40), 7.75);
  assert.equal(tenPoint(17, 20), 8.5);
  assert.equal(tenPoint(1, 3), 3.25);
  assert.equal(tenPoint(40, 40), 10);
});

test("tenPoint: đầu vào không hợp lệ -> null", () => {
  assert.equal(tenPoint(5, 0), null);
  assert.equal(tenPoint(NaN, 10), null);
  assert.equal(tenPoint(undefined, 10), null);
});

test("tenPoint: kẹp 0..10", () => {
  assert.equal(tenPoint(50, 40), 10);
  assert.equal(tenPoint(-3, 40), 0);
});

test("formatTenPoint", () => {
  assert.equal(formatTenPoint(31, 40), "7.75 / 10");
  assert.equal(formatTenPoint(32, 40), "8 / 10");
  assert.equal(formatTenPoint(17, 20), "8.5 / 10");
  assert.equal(formatTenPoint(0, 40), "0 / 10");
  assert.equal(formatTenPoint(1, 0), "");
  assert.equal(formatTenPoint(NaN, 5), "");
});

test("usesTenPoint đọc registry", () => {
  assert.equal(usesTenPoint("general"), true);
  assert.equal(usesTenPoint("ielts"), false);
  assert.equal(usesTenPoint("toeic"), false);
  assert.equal(usesTenPoint("bogus"), false);
  assert.equal(usesTenPoint(undefined), false);
});
