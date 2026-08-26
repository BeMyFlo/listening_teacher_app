# Full IELTS question-type support (Reading + Listening) + dual-CSV import

## Context

The teacher (msnhi) received two Google-Sheets templates from another teacher (built with Claude) for authoring IELTS Reading and Listening content: `IELTS_Reading_Sheet.xlsx` and `IELTS_Listening_Sheet.xlsx` (both in the project root). Each has a locked dropdown restricting question type to a fixed list — 11 Reading types, 11 Listening types (a few more mentioned in the sheets' own guide text) — and a second tab holding the Reading passage / Listening track+transcript, linked to the questions tab by a Passage_ID/Track_ID.

Today the app only models 4 question "kinds" (Fill / MCQ / TFNG / Matching) and the CSV importer only imports a flat one-table question list — no passage/audio linkage, capped at 5 options, no Yes/No/Not Given, no diagram-labelling. The goal is to bring the app's question-type coverage up to full IELTS-standard, and build an import pipeline modeled on these two sheets so future content from teachers can be dropped in with minimal manual re-typing.

**Key architectural fact driving this whole plan** (confirmed by direct code tracing): the database only stores two field types, `"fill"` and `"choice"` (`lib/models/schemas/questionSchema.js:9`, a strict Mongoose enum). The 4 editor "kinds" are a **client-side-only presentational concept** in `assets/teacher.js` — `fieldToServer()` collapses kind → `{type, options, answers, selectCount}` on save, `fieldFromServer()` re-derives kind from shape on load. Grading (`lib/grade.js`) and student rendering (`assets/student.js`) never see "kind" at all, only `type`/`selectCount`/`options`/`answers`. This means most new IELTS question types can be added as **client-side sugar** over the existing fill/choice engine, with zero or minimal schema change — confirmed via a full trace (two Explore agents + a Plan-validation agent) covering teacher.js, student.js, grade.js, testSections.js, questionSchema.js, and the CSV import pipeline.

**Hard constraint:** the project is already at exactly 12 files under `api/` — Vercel Hobby's serverless function cap (confirmed by `find api -name "*.js" | wc -l` = 12, and commit `65cc539` was a prior deliberate consolidation to hit this limit). **No new API route files** — the dual-CSV import must extend `api/admin/import.js` in place.

**Also confirmed already fully working, zero new code needed:** multi-answer MCQ (checkbox ticking, exact-set grading, CSV `;`-separated correct answers) and matching with an arbitrary number of shared-bank options (no cap anywhere in the code). These two "gaps" from the original sheet comparison turned out to already be supported.

Sections (`emptySection()`, `teacher.js:665-667`) and all question-rendering/grading functions are shared 1:1 between Mock Tests and Lesson-Unit exercises via `lib/testSections.js` — every change below automatically applies to both features.

---

## Phase 1 — `field.hint` (word-limit / instruction snippet)

Real IELTS questions carry a per-question(-group) instruction like "Write NO MORE THAN TWO WORDS" — the sheets' `Word_Limit`/`Gioi_han_tu` column. Add one optional string field, threaded through the full stack. This phase is intentionally the simplest — it proves out the "add optional field end-to-end" pattern before Phase 3 reuses it for something riskier.

- `lib/models/schemas/questionSchema.js`: `FieldSchema` += `hint: { type: String, default: "" }`.
- `lib/testSections.js`: `normalizeSections`'s field-mapping (~line 12-22) += `hint: String(f.hint || "")`.
- `assets/teacher.js`:
  - `emptyField()` (~line 671-676) += `hint: ""`.
  - `renderFieldRow()` (~line 887-931): add one `<input class="f-hint" placeholder="Hint / instruction (optional), e.g. NO MORE THAN TWO WORDS">` in the shared row template (not duplicated per-kind) + one input listener.
  - `fieldToServer()`'s shared `base` object (~line 1189-1193) += `hint: f.hint || ""`.
  - `fieldFromServer()`: all 3 return branches (~line 1236-1259) += `hint: f.hint || ""`.
- `assets/student.js`: `renderSectionFields()` (~line 295-366) — render a small `<span class="field-hint">` next to the label in both the choice-row and fill-row templates, when non-empty.
- `assets/style.css`: add `.field-hint` styling near the existing question-row rules.
- `lib/csvImport.js`: optional `Word_Limit`/`Hint` column → `field.hint` (wired together with Phase 4's column table).

---

## Phase 2 — Yes/No/Not Given kind

Add as a sibling of True/False/Not Given, distinguished by using a different option-id vocabulary (`yes`/`no`/`ng` vs `true`/`false`/`ng`) so it round-trips through `fieldFromServer`'s existing shape-based classification without any new persisted discriminator or schema change.

**Two real bugs must be fixed as part of this, not just avoided** (found during plan validation):
1. `fieldFromServer()`'s `isTFNG` check (~line 1252-1253) only recognizes `valueSet === "false,ng,true"` — a Yes/No/NG field falls through to the generic `mcq` classification. Add a second check for `"ng,no,yes"` before the fallback.
2. The `.f-kind` select's change handler (~line 910-922) computes `isTfngShape` by checking ids against `["true","false","ng"]` only. If a teacher toggles a Yes/No/NG question's kind dropdown away and back, this guard is `false` and **silently overwrites the field's options with `tfngOptions()`**, discarding the Yes/No data. Must extend this guard to recognize both option-id sets.

Changes:
- `assets/teacher.js`:
  - Add `ynngOptions()` sibling to `tfngOptions()` (~line 678-684): `[{id:"yes",text:"Yes"},{id:"no",text:"No"},{id:"ng",text:"Not Given"}]`.
  - `QUESTION_KIND_LABELS` (~line 880-885) += `ynng: "Yes / No / Not Given"`; `QUESTION_KIND_BADGE` (~line 1078) += matching entry.
  - Generalize the `if (f.kind === "tfng")` render branch (~line 954-975) into one helper parameterized by which option-set to use, with `ynng` as a second one-line call site (avoid copy-pasting ~20 lines).
  - Fix `isTfngShape` guard and `fieldFromServer` classification as described above.
  - `fieldToServer()` and `fieldAnswerPreviewText()` need no changes — `ynng` already falls through the same generic "everything else" block that `mcq`/`tfng` share today (verified).
- `lib/csvImport.js`: add `"Yes/No/Not Given"` to the type-mapping table (Phase 4) with its own correct-answer normalization (`yes→yes`, `no→no`, `not given→ng`), mirroring the existing TFNG branch.
- No changes needed to `questionSchema.js`, `testSections.js`, `grade.js`, or `student.js`.

**Backward compatibility:** no existing saved question can already have ids exactly `{yes,no,ng}` (ids are teacher-typed/auto-generated, never from this vocabulary today) — the new check is strictly additive before the existing fallback, zero reclassification risk for live data.

---

## Phase 3 — Diagram / Map / Plan Labelling kind

Implemented as a **variant of "matching"**: same persisted shape (`type:"choice"`, single answer picked from the section's shared `matchBank`) — zero grading/schema-*type* changes — plus one new **optional, additive** section-level field storing where each labelling question's numbered pin sits on the section's existing `imageId` image.

### Schema
- `lib/models/schemas/questionSchema.js`: `SectionSchema` (~line 23-33) += `labelPoints: [{ fieldId: Number, x: Number, y: Number }]` (sub-schema, `{_id:false}`, x/y as 0–100 percentages so it's resolution-independent). On every pre-existing document this is `undefined`/`[]`, so nothing existing is affected.
- `lib/testSections.js`: `normalizeSections` += one line building a validated/clamped `labelPoints` array (filter out entries with non-finite `fieldId`, clamp x/y to [0,100]). `validateSections` needs no change — server-side, labelling and matching fields are byte-identical; "did you forget to place a pin" is a client-only nudge, not a server-enforced rule.

### Editor (`assets/teacher.js`)
- `fieldFromServer(f)` → `fieldFromServer(f, s)` (needs section context to see `labelPoints`, which lives on the section, not the field). Update the one call site in `sectionsToEditor()` (~line 1275-1284) to `(s.fields || []).map((f) => fieldFromServer(f, s))`.
  - Inside the `opts.length === 0` branch: `const isLabelling = (s.labelPoints || []).some(lp => String(lp.fieldId) === String(f.id)); kind = isLabelling ? "labelling" : "matching";` — an exact id-keyed lookup, not a shape guess, so no false-positive risk.
- `sectionsPayloadFrom()` (~line 1263-1272): add a sibling line rebuilding `labelPoints` fresh from the live field list every save: `labelPoints: (sec.fields||[]).filter(f => f.kind==="labelling" && f.pinX!=null && f.pinY!=null).map(f => ({fieldId:Number(f.id), x:f.pinX, y:f.pinY}))`. Rebuilding fresh means deleting a labelling question automatically prunes its orphaned pin — no separate cleanup code.
- `fieldToServer()` (~line 1208): broaden the matching-branch condition from `f.kind === "matching"` to `f.kind === "matching" || f.kind === "labelling"` (identical persisted shape).
- `fieldAnswerPreviewText()` (~line 158): same broadening — otherwise the preview/import-review modal always shows "—" for labelling questions (real bug if missed).
- `emptyField()` += `pinX: null, pinY: null`.
- `QUESTION_KIND_LABELS` += `labelling: "Diagram/Map Labelling"`; `QUESTION_KIND_BADGE` += matching entry.
- `renderQuestionDetail()`: new `'labelling'` branch — reuse the matching `<select>` UI verbatim, plus a new pin-placement widget below it.
- New function `renderLabelPointPicker(container, sec, f, rerender)` (place near `renderMatchBank`, ~line 849): resolve `sec.imageId` to its Cloudinary URL (existing image-cache lookup used by the Illustration picker), render the image in a `position:relative` wrapper; on click, compute `x = offsetX/img.clientWidth*100`, `y = offsetY/img.clientHeight*100`, write to `f.pinX`/`f.pinY`; also draw small numbered markers for every other labelling field already placed in the same section, current field's pin highlighted. If `sec.imageId` is empty, show the existing `kind-hint warn` pattern ("Add a diagram/map image to this section first") — same convention as the empty-matchBank warning at ~line 1034-1036.

### Student side
- `api/tests.js`'s `toPublicTest()` and the equivalent mapper in `api/units.js` — add `labelPoints: s.labelPoints || []` to the mapped section object (pin coordinates aren't answer-bearing, safe to expose in full).
- `assets/student.js`'s `renderSectionBlock()` (~line 193-292), both the reading-pane and listening-image branches (~211-217, ~279-285): when `sec.imageUrl && sec.labelPoints?.length`, wrap the existing `<img class="diagram-image">` in a `position:relative` container and overlay absolutely-positioned numbered markers (cross-reference `sec.fields` by `fieldId` for the question number). Purely decorative overlay for V1 — answer input stays the existing radio/select list, no click-to-answer.
- `assets/style.css`: new `.pin-marker` class near the existing `.diagram-image` rule.

This works identically for Mock Tests and Unit exercises — the "Illustration" image picker already renders unconditionally for every section regardless of subject (~line 743-752), confirmed not Reading/Listening-specific.

---

## Phase 4 — Dual-CSV import pipeline (content + questions)

**Ground-truthed against the actual teacher files** (`IELTS_Reading_Sheet.xlsx`, `IELTS_Listening_Sheet.xlsx`, both in project root — read directly via their XML, not assumed) on 2026-08-26. The two real "Dang_bai" dropdowns (`Huong dan` tab) and the real content-tab headers (`Doan van` / `Bai nghe` tabs) drove every literal string and column name below; the four gaps found against the earlier draft of this phase are fixed inline and called out where relevant.

### Content CSV templates
- Reading (from the `Doan van` tab): `Passage_ID, Tieu_de, Chu_de, Noi_dung (danh dau [A][B][C]...), Ghi_chu`. Paragraphs marked `[A][B][C]...` for Matching Headings/Information, matching the sheet's convention.
- Listening (from the `Bai nghe` tab): `Track_ID, Tieu_de, Section (1-4), Link_audio, Transcript, Ghi_chu`.
- **`parseContentCsv` must read columns by header name, not position, and silently ignore any column it doesn't need** — this is the actual real-world column set exported straight from these two tabs, which is wider than the app needs. Concretely consumed: `Passage_ID`/`Track_ID` (join key), `Tieu_de` (→ `sec.name`), `Noi_dung` (→ `passageText`, Reading only). Explicitly ignored, with reasons:
  - `Chu_de` (Reading topic) — no schema field to hold it, teacher-reference-only.
  - `Ghi_chu` (both) — teacher-reference-only, same as today's "example row" notes.
  - `Section (1-4)` (Listening — which of the 4 real IELTS Listening parts this track belongs to) — no existing schema field maps to this; the app's own "sections" concept is the *question-group* container, not the exam-part number. Dropping this is a real information loss (a teacher browsing tracks can't tell which IELTS part a track was authored for), but there's nowhere to put it without a schema change. **Flagged as a follow-up, not blocking**: add an optional `examPart: Number` to the Track/Audio model later if the teacher asks for it.
  - `Link_audio`, `Transcript` — same as before: audio must go through the existing Cloudinary Audio Library upload, never an auto-fetched URL (SSRF/abuse risk fetching an arbitrary teacher-pasted link server-side). Audio attachment stays a manual step after import.

### `lib/csvImport.js`
- New `parseContentCsv(rows)` → `Map<id, {title, passageText}>`.
- `rowsToSections(rows, contentMap)` — new **optional** 2nd parameter, must default to an empty `Map` and produce byte-identical output to today when omitted (regression-test this by diffing old vs. new output on the existing sample CSV).
- **Join-key design:** reuse the existing `Section` column (the app's own import-CSV column, distinct from the sheet's `Nhom_cau`/question-group column) as the literal join key — must equal the content CSV's `Passage_ID`/`Track_ID`. When a match is found in `contentMap`, populate `passageText` **and use the content CSV's `Tieu_de` as `sec.name`** (not the raw ID — avoids conflating "join key" with "display title"). When no match is found, fall back to the raw `Section` value as the name and emit a soft warning: `Row N: no passage text found for section "P1" — check it matches a Passage_ID in your content file, or attach it manually`.
- Extend the `typeRaw` if/else chain (~line 100-108) into a lookup table. **Uses the literal dropdown strings from the two sheets verbatim** (confirmed by direct inspection — do not retranslate to English; normalize via the existing `.toLowerCase().replace(/[^a-z]/g,"")` before matching, confirmed no collisions across all 27 literal source values):

  | Literal source value (as it appears in the sheet's dropdown) | Sheet | → kind |
  |---|---|---|
  | `Multiple Choice (1 dap an)` | R+L | `mcq` |
  | `Multiple Choice (nhieu dap an)` | R+L | `mcq` |
  | `True/False/Not Given` | R | `tfng` |
  | `Yes/No/Not Given` | R | `ynng` |
  | `Matching Headings` / `Matching Information` / `Matching Features` / `Matching Sentence Endings` | R | `matching` |
  | `Matching` | L | `matching` |
  | `Plan/Map/Diagram Labelling` | L | `labelling` |
  | `Diagram Label Completion` | R | `labelling` |
  | `Sentence Completion` | R+L | `fill` |
  | `Note Completion` / `Table Completion` / `Flow-chart Completion` | R+L | `fill` |
  | `Form Completion` | L | `fill` |
  | `Short Answer Questions` | R+L | `fill` |
  | `Summary Completion (khong co danh sach tu)` | R | `fill` |
  | `Summary Completion (co danh sach tu)` | R | `matching` (word bank = shared answer bank) |
  | `Summary Completion` **(no word-list qualifier at all)** | L | `fill` |

  **Gap fixed here:** the Listening sheet's dropdown has a single unqualified `Summary Completion` entry (unlike Reading's two qualified variants) — the original draft of this table only recognized the two qualified forms, so a real Listening import would have silently failed to classify this row. Default it to `fill` (Listening summary-completion in this sheet is always typed-answer style in practice, never a word-bank pick) and note in the modal help text that a word-bank Listening summary should be authored as Reading-style `Summary Completion (co danh sach tu)` wording if that need ever comes up.
- **Diagram-image URL is out of scope for CSV import, same rationale as audio.** The Listening `Cau hoi` tab carries a per-question `Anh_so_do_URL` column for `Plan/Map/Diagram Labelling` rows, but Phase 3's `labelPoints` design is one shared `sec.imageId` per section, attached manually via the existing Illustration picker (never a server-side URL fetch — same SSRF rationale as `Link_audio`). The importer must **ignore this column** (it's covered by the same "ignore unknown columns" rule as the content CSV) — call this out explicitly in the modal's post-import review ("Diagram image: attach manually," reusing the existing pill/warning convention) so a teacher doesn't expect the pin image to appear automatically.
- The Listening `Cau hoi` tab's `Thoi_diem (mm:ss)` column (per-question audio timestamp) is likewise teacher-reference-only with no schema field — ignored by the same "unknown column" rule, no separate handling needed.
- `optionCols` (~line 81): extend `[1,2,3,4,5]` → `[1..8]` (matches the sheets' Lua_chon_A..H).
- Update `assets/templates/question-import-template.csv` and the modal help text (~teacher.js:1089, "Option 1-5" → "Option 1-8") to match.

### `api/admin/import.js` (extend in place — no new route file)
- Accept an optional second file field (`files.contentFile`) alongside the existing `files.file`, via the same `formidable` parse already in place.
- Duplicate the existing 2MB text-length guard (~line 48) for the second file stream.
- Parse each present file, build `contentMap` via `parseContentCsv`, call `rowsToSections(rows, contentMap)`.

### Client UI (`assets/teacher.js`)
- `openSpreadsheetImportModal()` (~line 1085-1131): add an optional second `<input type="file">` ("Content file (optional) — passage text / track info"), appended to the same `FormData` before calling `Api.admin.importQuestions(fd)`. `assets/api.js` needs no change (already forwards arbitrary `FormData`).
- `renderImportReview()` (~line 1133-1184): add a per-section badge — "Passage text auto-filled" vs. "Attach manually" — reusing the existing pill/warning conventions already in that function.

---

## Sequencing

1. **Phase 1** (`field.hint`) — lowest risk, proves the additive-field pattern.
2. **Phase 2** (Yes/No/Not Given) — new client kind, zero schema change, but ships with the two bug fixes above (they're not optional — skipping them creates a live data-loss bug).
3. **Phase 3** (Labelling) — new client kind + new optional `SectionSchema.labelPoints` + `fieldFromServer` signature change + teacher pin widget + student pin overlay. Highest complexity; do it once Phase 1's pattern is proven.
4. **Phase 4** (dual-CSV import) — depends on the full kind vocabulary from Phases 1-3 existing; extends `api/admin/import.js` in place per the 12-function cap.
5. **Docs/regression** — new sample content CSVs, update the in-app help text/template, and add a small verification script (style of `scripts/migrate-add-level.js`) that loads every existing published Test/Unit and asserts each field still classifies into the *same* kind after deploy — cheap insurance given this touches live production question data.

## Verification

- After each phase, run the app locally (`npm run dev:local`, already configured in `.claude/launch.json`) and manually build one question of the new/changed kind in both the Mock Test builder and a Unit exercise, save, reload the editor (confirms `fieldFromServer` round-trips correctly), then take the test as a student and confirm grading is correct.
- Phase 2/3: specifically test the two bug-fix scenarios — toggle a Yes/No/NG question's kind dropdown away and back (options must survive); delete a labelling question and re-save (its pin must disappear from `labelPoints`, not linger).
- Phase 4: import a small sample content+questions CSV pair covering every row of the mapping table above; confirm each resulting section has the right kind, options, and (for matched sections) auto-filled passage text; confirm omitting the content file still works exactly as today (regression).
- Before trusting existing production content post-deploy: run the Phase 5 verification script against the live MongoDB (read-only) and confirm no existing field's classified kind changed.
