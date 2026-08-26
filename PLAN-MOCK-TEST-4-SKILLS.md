# Mock Test redesign: 4 skills in one bundled exam

## Goal (from user request)

Today "Mock Tests" on the student side shows 2 skill cards (Listening, Reading) because `Test.subject` only supports those two. The teacher wants every Mock Test to be a single bundled exam with all 4 IELTS skills (Listening, Reading, Writing, Speaking), set up once by the teacher, that:

- Is **locked** for the student until its scheduled `opensAt` date, then unlocks to reveal **4 skill boxes** to work through.
- Each skill box shows **progress** (e.g. "8/10 questions done" for Listening/Reading, "Submitted — pending review" for Writing/Speaking).
- Shows the **result** on the test's summary once available.

**Decisions confirmed with the user:**
1. Writing/Speaking reuse the existing **Prompt** mechanism (essay text / audio recording, manually graded by the teacher) — the same one already used in Lesson Units. Not the question/fill/choice engine.
2. This **replaces** the current single-skill Test model entirely — no more creating a Listening-only or Reading-only mock test going forward. Existing published tests are migrated in place (kept as-is, single skill filled in; teacher can add the missing skills later).

## Current architecture (confirmed by direct code tracing)

- `lib/models/Test.js`: `subject` enum `["listening","reading"]`, one flat `sections` array, one shared `opensAt`/`closesAt`/`durationMinutes`. No bundling model exists anywhere.
- `lib/models/Submission.js`: `kind` enum `["test","exercise","writing","speaking"]` already exists in one flat collection. `testId` field already exists and is structurally reusable for any kind — today it's just never populated for `kind="writing"|"speaking"`, because those always reference `unitId`+`categoryKey`+`promptId` (a Lesson Unit prompt), never a `Test`.
- `lib/models/Unit.js`: `PromptSchema` (`title`, `instructions`, `imageId`) is defined inline inside `Unit.js`, not shared — needs extracting so `Test.js` can reuse it.
- Schedule enforcement (`api/tests.js:75-88`, `api/submissions.js`) is **hide-if-outside-window**, not **show-locked**: a not-yet-open or closed test is simply excluded from the list today. No "locked" UI exists anywhere in `assets/student.js`.
- No per-test progress ("X/Y done") exists on the Mock Tests list today. The pattern *does* already exist for Lesson Unit exercises/prompts via `latestSubmissionOf()` (`assets/student.js:749-767, 820-837`) matching against `mySubmissionsCache` — this is the template to copy for Mock Tests.
- Grading queue (`api/admin/submissions.js`) already treats `writing`/`speaking` submissions generically regardless of where they came from (Lesson vs future Test) — good, minimal change needed there beyond showing which test+skill a submission belongs to.

---

## Data model changes

### 1. Extract `PromptSchema` into a shared file
`lib/models/schemas/promptSchema.js` — move the existing `PromptSchema` out of `Unit.js` (byte-identical shape: `title`, `instructions`, `imageId`), export it, `require` it from both `Unit.js` (no behavior change there) and the new `Test.js`.

### 2. `lib/models/Test.js` — full restructure
```js
const TestSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    unit: { type: String, default: "" },
    level: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    opensAt: { type: Date, default: null },
    closesAt: { type: Date, default: null },
    skills: {
      listening: {
        durationMinutes: { type: Number, default: null },
        instructions: { type: String, default: "" },
        sections: { type: [SectionSchema], default: [] }
      },
      reading: {
        durationMinutes: { type: Number, default: null },
        instructions: { type: String, default: "" },
        sections: { type: [SectionSchema], default: [] }
      },
      writing: {
        durationMinutes: { type: Number, default: null },
        instructions: { type: String, default: "" },
        prompts: { type: [PromptSchema], default: [] }
      },
      speaking: {
        durationMinutes: { type: Number, default: null },
        instructions: { type: String, default: "" },
        prompts: { type: [PromptSchema], default: [] }
      }
    }
  },
  { timestamps: true }
);
```
- Drop `subject` enum and the old flat `sections`/`instructions`/`durationMinutes` (superseded by per-skill fields — real IELTS timing differs per skill: ~30/60/60/14 min).
- Drop `publishAt` (grep confirms unused outside its own declaration — dead field from an earlier, never-finished feature; removing it is cleanup, not scope creep, since the whole document is being rewritten anyway).
- A test is only allowed `status: "published"` when **all 4 skills have content** (`sections.length > 0` for L/R, `prompts.length > 0` for W/S) — enforced in `api/admin/tests.js`, mirroring today's `validateSections` pattern. Migrated old tests can stay `published` with only one skill filled in (grandfathered) but can never be **re-published** after edit until complete — prevents new incomplete tests while not breaking old ones.

### 3. `lib/models/Submission.js` — minimal addition
Add one field: `testSkill: { type: String, enum: ["listening","reading","writing","speaking"] }` — set whenever `testId` is present (for all 4 kinds now, not just `kind="test"`). Disambiguates *which* skill-attempt this row is, since one `Test` now yields up to 4 independent submission rows (one per skill) instead of exactly one.
- `kind="test"` stays for auto-graded Listening/Reading skill attempts (`testId` + `testSkill` + existing `answers`/`score`/`total`).
- `kind="writing"|"speaking"` gains the ability to carry `testId` + `testSkill` (in addition to the existing `unitId`+`categoryKey` path for Lesson prompts, which is untouched) — `promptId` continues to identify which specific prompt subdocument within `test.skills.writing.prompts` / `.speaking.prompts`.

### 4. Migration script — `scripts/migrate-test-4skills.js`
For every existing `Test` document (old shape: `subject` + flat `sections` + flat `instructions`/`durationMinutes`):
- Build `skills.<subject> = { sections: oldSections, durationMinutes: oldDurationMinutes, instructions: oldInstructions }`; the other 3 skills stay empty (`sections: []`/`prompts: []`).
- Unset `subject`, `sections`, `instructions` (top-level), `durationMinutes` (top-level), `publishAt`.
- For every `Submission` with `kind="test"` and a `testId`, backfill `testSkill` from that test's *pre-migration* `subject` (read before mutating, or run this pass first in the same script) — old submissions become attributable to the correct skill.
- Style/safety: modeled on `scripts/migrate-add-level.js` — dry-run flag first, print a per-document diff count, require explicit `--apply` to write, connect via `lib/db`, idempotent (skip docs that already have `skills`).

---

## Teacher builder (`assets/teacher.js`)

- Replace the Listening/Reading subject-toggle in "Create New Mock Test" with **4 tabs**: Listening, Reading, Writing, Speaking. All 4 are edited in the same create/edit session (not a subject choice — there's no longer a "subject" concept for a Test, only per-skill content).
- Listening/Reading tabs: **reuse `renderSectionsEditor(wrap, sectionsArr, subject)` verbatim** (already generic over `"listening"`/`"reading"`, confirmed unaffected by any Phase 1-4 IELTS-question-type work) — now called once per skill, each with its own `sections` array (`test.skills.listening.sections`, `test.skills.reading.sections`), instead of once for whichever subject was picked.
- Writing/Speaking tabs: **extract the existing Lesson-Unit prompt editor** (currently inline in the `cat.prompts` rendering block, ~teacher.js:2121-2160) into a standalone `renderPromptsEditor(wrap, promptsArr, rerender)` function, reused both here (for `test.skills.writing.prompts` / `.speaking.prompts`) and in the Unit builder (no behavior change there, pure extraction).
- One shared header: Title, Unit, Level, Opens/Closes schedule (single window — the whole exam unlocks/locks together). Per-skill: its own Instructions + Duration.
- Save/Publish validation: block "Save & Publish" (allow "Save Draft") unless every skill has ≥1 section/prompt — surface which skill(s) are missing, same convention as today's `notice error` banner.

## Student side (`assets/student.js`)

- Mock Tests list becomes a flat list of exam cards (title, level, unit) — no more Listening/Reading picker step.
- **Locked state** (`now < opensAt`): card shows title/level/unit and an "Opens <date>" badge, not clickable into content. Requires `api/tests.js`'s list endpoint to **stop hiding** upcoming tests — return them with a `locked: true`/`opensAt` flag instead of excluding them from the query (closed tests: keep returning them too, so students can still see their `closesAt` result afterward, distinct from "not yet open").
- **Unlocked state**: expands to 4 skill boxes (only for skills that actually have content — handles grandfathered single-skill migrated tests gracefully). Each box, using the same `latestSubmissionOf()` pattern already used for exercises/prompts:
  - Listening/Reading: "Last score: X/Y" if attempted, else "Start".
  - Writing/Speaking: "Graded: N pts" / "Submitted — pending review" / "Start", matching the existing Lesson-prompt copy exactly.
- A combined result summary renders above the 4 boxes once at least one skill has a result (auto-graded score for L/R, manual score for W/S once graded) — reuses the existing score-display conventions from `renderStudentStats`.
- Taking a skill: existing question-rendering (`renderSectionBlock`/`renderSectionFields`) and existing prompt-submission UI (essay textarea / audio recorder) are reused unchanged, just now scoped to `testId + skill` instead of `testId` alone.

## API changes

- `api/tests.js`: list endpoint returns tests across all schedule states (not just currently-open) with a computed `locked`/`opensAt`/`closesAt` per row; detail endpoint still 404s the *content* fetch while locked but the list card needs enough metadata (title/level/skills-present) to render the locked card without exposing questions early — detail endpoint should return `{ locked: true, title, level, opensAt }` (no `skills` content) instead of a bare 404 when called before `opensAt`.
- `api/submissions.js`: extend the `kind="writing"|"speaking"` branch to accept `{ testId, skill, promptId, ... }` as an alternative to `{ unitId, categoryKey, promptId }`, re-running the same `opensAt`/`closesAt` window check already done for `kind="test"`. Extend `kind="test"` to require `{ testId, skill, answers }` and grade against `test.skills[skill]` instead of the whole test.
- `api/admin/tests.js`: rewrite create/update body handling for the nested `skills` shape; publish-validation loop over all 4 skills (reusing `validateSections` for L/R, a new lightweight `validatePrompts` for W/S — "at least 1 prompt with non-empty title+instructions").
- `api/admin/submissions.js`: grading queue row needs to resolve+display "Test title — Skill" when `testId`+`testSkill` are present (today it only resolves Unit-based writing/speaking submissions to a lesson title).

---

## Sequencing

1. **Schema + migration** (`Test.js`, `Submission.js`, `promptSchema.js` extraction, migration script) — run against production with `--apply` only after a dry-run review together.
2. **Admin API** (`api/admin/tests.js`, `api/admin/submissions.js`) — server-side first so the teacher builder has something correct to talk to.
3. **Teacher builder UI** (`assets/teacher.js`) — 4-tab builder, prompt-editor extraction, publish validation.
4. **Student API** (`api/tests.js`, `api/submissions.js`) — locked-state list/detail, skill-scoped submission.
5. **Student UI** (`assets/student.js`) — locked card, 4 skill boxes, progress, result summary.
6. **Regression**: verify every migrated old test still opens correctly for its one populated skill; verify a fresh 4-skill test end-to-end (create → publish → student takes all 4 → teacher grades W/S → student sees combined result).

## Verification

- Run the migration dry-run first, inspect the diff count against the real Atlas data (small: today's DB has 0 tests, per earlier exploration in this session — low risk, but still dry-run first as a habit).
- After each phase, exercise it live against `msnhi` as done for Phases 1-4 of the question-types work, cleaning up any QA test data afterward.
- End-to-end: teacher creates one 4-skill test with a near-future `opensAt` → confirm student sees it locked → move `opensAt` to the past (via direct edit) → confirm it unlocks into 4 boxes → complete Listening/Reading, submit Writing/Speaking → teacher grades W/S from the submissions queue → confirm the student's combined result appears.
