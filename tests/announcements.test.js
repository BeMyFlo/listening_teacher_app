const test = require("node:test");
const assert = require("node:assert/strict");
const { CHANNEL_CONFIG } = require("../lib/notifications/index");
const Notification = require("../lib/models/Notification");

test("CHANNEL_CONFIG has teacher_announcement = ['inapp']", () => {
  assert.ok(CHANNEL_CONFIG, "CHANNEL_CONFIG should be exported");
  assert.deepEqual(CHANNEL_CONFIG.teacher_announcement, ["inapp"]);
});

test("Notification schema enum contains 'teacher_announcement'", () => {
  const enumValues = Notification.schema.path("type").enumValues;
  assert.ok(Array.isArray(enumValues), "enumValues should be an array");
  assert.ok(
    enumValues.includes("teacher_announcement"),
    "enumValues must include 'teacher_announcement'"
  );
});

test("Notification schema includes optional announcement fields", () => {
  const senderNamePath = Notification.schema.path("senderName");
  assert.ok(senderNamePath, "senderName should exist on schema");
  assert.equal(senderNamePath.defaultValue, "");

  const announcementIdPath = Notification.schema.path("announcementId");
  assert.ok(announcementIdPath, "announcementId should exist on schema");

  const senderTeacherIdPath = Notification.schema.path("senderTeacherId");
  assert.ok(senderTeacherIdPath, "senderTeacherId should exist on schema");
});
