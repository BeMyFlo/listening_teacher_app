// One-off backfill: convert legacy mini-markup strings to TipTap/ProseMirror
// JSON for the two WYSIWYG surfaces —
//   * Unit.categories[].theory.html            -> theory.doc
//   * <section>.noteText  (Test skills + Unit exercises/topics/groups) -> noteText -> noteDoc
//
// Purely additive: legacy strings are left untouched, docs are only written
// where they are still null/absent. Idempotent — safe to re-run. The lazy
// converters in the editors/renderers cover anything created after this runs.
//
// Dry-run by default; pass --apply to write.
//   node scripts/migrate-rich-content.js
//   node scripts/migrate-rich-content.js --apply
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env.local") });
const { connectDB } = require("../lib/db");
const mongoose = require("mongoose");
const { theoryToDoc } = require("../lib/tiptap/theoryConvert");
const { noteTextToDoc } = require("../lib/tiptap/noteConvert");
const { docIsEmpty } = require("../lib/tiptap/doc");

const APPLY = process.argv.includes("--apply");
const stats = { theory: 0, noteSections: 0, units: 0, tests: 0 };

function migrateSections(sections) {
  let changed = false;
  for (const s of sections || []) {
    if (s && s.noteText && String(s.noteText).trim() && (!s.noteDoc || !s.noteDoc.content)) {
      const doc = noteTextToDoc(s.noteText);
      if (!docIsEmpty(doc)) {
        s.noteDoc = doc;
        stats.noteSections += 1;
        changed = true;
      }
    }
  }
  return changed;
}

(async () => {
  await connectDB();
  const db = mongoose.connection.db;

  // ---- Units ----
  const units = db.collection("units");
  for await (const u of units.find({})) {
    let changed = false;
    for (const c of u.categories || []) {
      if (c.theory && c.theory.html && String(c.theory.html).trim() && (!c.theory.doc || !c.theory.doc.content)) {
        const doc = theoryToDoc(c.theory.html);
        if (!docIsEmpty(doc)) {
          c.theory.doc = doc;
          stats.theory += 1;
          changed = true;
        }
      }
      for (const ex of c.exercises || []) changed = migrateSections(ex.sections) || changed;
      for (const t of c.topics || []) for (const ex of t.exercises || []) changed = migrateSections(ex.sections) || changed;
      for (const g of c.groups || []) for (const ex of g.exercises || []) changed = migrateSections(ex.sections) || changed;
    }
    if (changed) {
      stats.units += 1;
      if (APPLY) await units.updateOne({ _id: u._id }, { $set: { categories: u.categories } });
    }
  }

  // ---- Tests ----
  const tests = db.collection("tests");
  for await (const t of tests.find({})) {
    let changed = false;
    for (const key of ["listening", "reading"]) {
      const sk = t.skills && t.skills[key];
      if (sk) changed = migrateSections(sk.sections) || changed;
    }
    if (changed) {
      stats.tests += 1;
      if (APPLY) await tests.updateOne({ _id: t._id }, { $set: { skills: t.skills } });
    }
  }

  console.log(APPLY ? "APPLIED" : "DRY RUN — pass --apply to write");
  console.log(stats);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
