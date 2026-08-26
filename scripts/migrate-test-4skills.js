// One-off migration: Test went from "1 test = 1 skill" (subject: listening|
// reading, flat sections/instructions/durationMinutes) to "1 test = 4 skills"
// (skills.listening/reading/sections, skills.writing/speaking.prompts, one
// shared opensAt/closesAt). This moves every existing Test document's old
// flat content into skills.<subject>, leaving the other 3 skills empty, and
// backfills Submission.testSkill from the test's old subject.
//
// Uses the raw collection (not the Mongoose model) to read the OLD shape —
// the Test model in lib/models/Test.js has already been rewritten to the
// NEW schema, so a normal Mongoose read here would silently drop the old
// fields (subject/sections/instructions/durationMinutes) we need.
//
// Dry-run by default; pass --apply to actually write.
//   node scripts/migrate-test-4skills.js          # dry run, prints a diff
//   node scripts/migrate-test-4skills.js --apply   # writes for real
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { connectDB } = require("../lib/db");
const mongoose = require("mongoose");

const APPLY = process.argv.includes("--apply");

(async () => {
  await connectDB();
  const db = mongoose.connection.db;
  const testsCol = db.collection("tests");
  const subsCol = db.collection("submissions");

  const oldShapeTests = await testsCol.find({ subject: { $exists: true } }).toArray();
  console.log(`Found ${oldShapeTests.length} test(s) in the old single-skill shape.`);

  // subject của từng test, ghi lại TRƯỚC khi sửa test — dùng để backfill
  // Submission.testSkill ở bước sau.
  const subjectByTestId = new Map();

  for (const t of oldShapeTests) {
    const subject = t.subject === "reading" ? "reading" : "listening";
    subjectByTestId.set(String(t._id), subject);

    const skills = {
      listening: { durationMinutes: null, instructions: "", sections: [] },
      reading: { durationMinutes: null, instructions: "", sections: [] },
      writing: { durationMinutes: null, instructions: "", prompts: [] },
      speaking: { durationMinutes: null, instructions: "", prompts: [] }
    };
    skills[subject] = {
      durationMinutes: t.durationMinutes != null ? t.durationMinutes : null,
      instructions: t.instructions || "",
      sections: Array.isArray(t.sections) ? t.sections : []
    };

    console.log(`- "${t.title}" (${t._id}): subject=${subject}, ${skills[subject].sections.length} section(s) -> skills.${subject}`);

    if (APPLY) {
      await testsCol.updateOne(
        { _id: t._id },
        {
          $set: { skills },
          $unset: { subject: "", sections: "", instructions: "", durationMinutes: "", publishAt: "" }
        }
      );
    }
  }

  // Backfill testSkill trên các Submission kind="test" đã có testId trỏ tới
  // 1 trong các test vừa migrate — trước đây 1 test chỉ có 1 skill nên
  // testId là đủ; giờ cần thêm testSkill để phân biệt.
  const testSubmissions = await subsCol
    .find({ kind: "test", testId: { $exists: true, $ne: null }, testSkill: { $exists: false } })
    .toArray();
  console.log(`Found ${testSubmissions.length} kind="test" submission(s) missing testSkill.`);

  let backfilled = 0;
  for (const s of testSubmissions) {
    const subject = subjectByTestId.get(String(s.testId));
    if (!subject) continue; // test đã bị xoá hoặc không nằm trong tập vừa migrate
    backfilled++;
    if (APPLY) {
      await subsCol.updateOne({ _id: s._id }, { $set: { testSkill: subject } });
    }
  }
  console.log(`${backfilled} submission(s) ${APPLY ? "backfilled" : "would be backfilled"}.`);

  if (!APPLY) {
    console.log("\nDry run only — nothing written. Re-run with --apply to write these changes.");
  } else {
    console.log("\nDone.");
  }
  process.exit(0);
})();
