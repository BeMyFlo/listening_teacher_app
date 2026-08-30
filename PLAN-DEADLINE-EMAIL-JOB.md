# Plan — Email students when a lesson deadline is assigned (background job)

## Goal
When a teacher saves a deadline (whole-unit or per-skill) for a **published** Unit
against a class, every student in that class is notified:

- **in-app bell** (already how `deadline_soon` works), and
- **email** (via the existing Gmail SMTP `lib/mailer.js`).

The email sending must **not** block the "Save" request — it runs in a background
job, mirroring the existing AI-grading job pattern (`GradingJob` +
`/api/admin/grading-jobs`).

## What already exists (reuse, don't reinvent)
- `lib/notifications/index.js` → `emit({...})` — creates a `Notification` (idempotent
  by `dedupeKey`) and fans out to the channels enabled for its `type` in
  `CHANNEL_CONFIG`. In-app + email are both already implemented channels.
- `lib/notifications/channels/email.js` — renders + sends, records
  `deliveries.email.status` (`sent|skipped|failed`). Skips cleanly when
  `GMAIL_*` env is missing or the student has no `email`.
- `lib/deadlines.js` → `distinctDeadlines(unit, classId)` — the distinct deadline
  markers for a class.
- `lib/completion.js` → `CATEGORY_LABELS`.
- `lib/models/GradingJob.js` + `pages/api/admin/grading-jobs.js` — the "job doc +
  atomic claim + run in a later request + stale-reset + TTL index" pattern to copy.
- `pages/api/cron/deadline-scan.js` (daily Vercel cron) — safety-net sweep point.
- Deadlines are written in exactly **one** place: `PUT /api/admin/units?id=` in
  `pages/api/admin/units.js` (Settings tab of the Unit editor). No other code path
  sets `unit.deadlines`.

---

## New / changed files

### 1. `lib/models/Notification.js` — add the new type
- Add `"deadline_assigned"` to the `type` enum.
- Extend the doc comment block:
  `deadline_assigned : teacher just set/changed a deadline for the student's class — 1 per student per (unit, scope, dueAt)`.

### 2. `lib/notifications/index.js` — enable channels for it
```js
const CHANNEL_CONFIG = {
  deadline_soon:        ["inapp", "email"],
  deadline_assigned:    ["inapp", "email"],   // NEW
  submission_late:      ["inapp", "email"],
  submission_received:  ["inapp", "email"],
};
```
No other change — `emit()` already handles everything.

### 3. `lib/models/DeadlineEmailJob.js` — NEW job model
```js
const DeadlineEmailJobSchema = new mongoose.Schema({
  unitId:      { type: ObjectId, ref: "Unit",  required: true, index: true },
  classId:     { type: ObjectId, ref: "Class", required: true },
  categoryKey: { type: String, default: null },      // null = whole-unit deadline
  dueAt:       { type: Date, required: true },
  status:      { type: String, enum: ["pending","running","done","error"], default: "pending", index: true },
  recipientIds:{ type: [ObjectId], ref: "Student", default: [] }, // roster snapshot at creation
  cursor:      { type: Number, default: 0 },         // next index into recipientIds
  progress:    {
    total:        { type: Number, default: 0 },
    notified:     { type: Number, default: 0 },      // emit() calls that succeeded
    emailSent:    { type: Number, default: 0 },
    emailSkipped: { type: Number, default: 0 },
    emailFailed:  { type: Number, default: 0 },
  },
  requestedBy: { type: ObjectId, ref: "Teacher" },
  error:       String,
  startedAt:   Date,                                 // heartbeat — updated each batch
  finishedAt:  Date,
  createdAt:   { type: Date, default: Date.now },
});
DeadlineEmailJobSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3 * 24 * 60 * 60 });
DeadlineEmailJobSchema.index({ status: 1, createdAt: 1 });
```
Rationale: `recipientIds` is a snapshot so a roster change mid-send can't drop or
double students; `cursor` lets a long class be drained across several invocations
(Vercel 60s cap); TTL auto-cleans like `GradingJob`.

### 4. `lib/notifications/deadlineAssign.js` — NEW, the actual logic

```js
const DAY = 24*60*60*1000;
const STALE_MS = 90 * 1000;          // matches grading-jobs
const BATCH = 10;                    // students per DB/emit loop slice
const TIME_BUDGET_MS = 50 * 1000;    // stop before Vercel kills the function

// scopeLabel + body text
function announceText(unit, categoryKey, dueAt) {
  const scope = categoryKey
    ? `the ${CATEGORY_LABELS[categoryKey]} part of "${unit.name}"`
    : `"${unit.name}"`;
  return {
    title: "New assignment deadline",
    body: `A deadline was set for ${scope} — due ${fmtDateTime(dueAt)}. `
        + `Complete and submit your work before then.`,
  };
}

// ---- called from PUT /api/admin/units after unit.save() ----
// prevDeadlines: array of { classId:String, categoryKey:String|null, dueAtMs:Number }
//                captured BEFORE unit.deadlines was reassigned
// announceAll:   true when this save flipped the unit draft -> published
async function announceDeadlines(unit, prevDeadlines, { requestedBy, announceAll }) {
  if (unit.status !== "published") return [];        // students can't see drafts

  const prev = new Map(
    prevDeadlines.map(d => [`${d.classId}|${d.categoryKey || ""}`, d.dueAtMs])
  );

  const created = [];
  for (const d of unit.deadlines) {
    const key = `${d.classId}|${d.categoryKey || ""}`;
    const wasMs = prev.get(key);
    const nowMs = +new Date(d.dueAt);
    const isNewOrMoved = announceAll || wasMs == null || wasMs !== nowMs;
    if (!isNewOrMoved) continue;

    // Skip a deadline that is already in the past (nothing to remind about).
    if (nowMs <= Date.now()) continue;

    // Don't stack duplicate jobs for the same marker.
    const dup = await DeadlineEmailJob.findOne({
      unitId: unit._id, classId: d.classId,
      categoryKey: d.categoryKey || null, dueAt: d.dueAt,
      status: { $in: ["pending", "running"] },
    }).select("_id").lean();
    if (dup) { created.push(dup._id); continue; }

    const students = await Student.find({ classId: d.classId })
      .select("_id").lean();

    const job = await DeadlineEmailJob.create({
      unitId: unit._id,
      classId: d.classId,
      categoryKey: d.categoryKey || null,
      dueAt: d.dueAt,
      recipientIds: students.map(s => s._id),
      progress: { total: students.length, notified:0, emailSent:0, emailSkipped:0, emailFailed:0 },
      requestedBy,
    });
    created.push(job._id);
  }
  return created;   // job ids
}

// ---- run one job (called by the run endpoint and the cron sweep) ----
async function runDeadlineEmailJob(jobId) {
  let job = await DeadlineEmailJob.findById(jobId);
  if (!job) return;
  // stale-reset (function was killed mid-run)
  if (job.status === "running" && job.startedAt && Date.now() - job.startedAt > STALE_MS) {
    job.status = "pending"; await job.save();
  }
  if (job.status === "done" || job.status === "error") return job;

  // atomic claim
  const claimed = await DeadlineEmailJob.findOneAndUpdate(
    { _id: jobId, status: { $in: ["pending", "running"] } },
    { $set: { status: "running", startedAt: new Date() } },
    { new: true }
  );
  if (!claimed) return DeadlineEmailJob.findById(jobId);
  job = claimed;

  const unit = await Unit.findById(job.unitId).select("name status").lean();
  const { title, body } = announceText(unit, job.categoryKey, job.dueAt);
  const t0 = Date.now();

  try {
    while (job.cursor < job.recipientIds.length && Date.now() - t0 < TIME_BUDGET_MS) {
      const slice = job.recipientIds.slice(job.cursor, job.cursor + BATCH);
      for (const studentId of slice) {
        try {
          const notif = await emit({
            studentId,
            type: "deadline_assigned",
            dedupeKey: `${studentId}:${job.unitId}:${job.categoryKey || "unit"}:deadline_assigned:${+job.dueAt}`,
            unitId: job.unitId,
            dueAt: job.dueAt,
            link: `/student/lessons/${job.unitId}`,
            title, body,
          });
          job.progress.notified++;
          const st = notif?.deliveries?.email?.status;
          if (st === "sent")    job.progress.emailSent++;
          else if (st === "failed")  job.progress.emailFailed++;
          else if (st === "skipped") job.progress.emailSkipped++;
        } catch (err) {
          // E11000 (concurrent sweep already emitted) -> treat as done, not a failure
          if (err.code !== 11000) job.progress.emailFailed++;
        }
      }
      job.cursor += slice.length;
      job.startedAt = new Date();          // heartbeat
      await job.save();
    }

    if (job.cursor >= job.recipientIds.length) {
      job.status = "done";
      job.finishedAt = new Date();
    } else {
      job.status = "pending";              // more to do -> next run / cron resumes
    }
    await job.save();
  } catch (err) {
    job.status = "error";
    job.error = String(err.message || err).slice(0, 500);
    await job.save();
  }
  return job;
}

// ---- safety-net sweep (cron) ----
async function sweepDeadlineEmailJobs() {
  const jobs = await DeadlineEmailJob.find({
    $or: [
      { status: "pending" },
      { status: "running", startedAt: { $lt: new Date(Date.now() - STALE_MS) } },
    ],
  }).select("_id").lean();
  let ran = 0;
  for (const j of jobs) { try { await runDeadlineEmailJob(j._id); ran++; } catch {} }
  return { swept: jobs.length, ran };
}

module.exports = { announceDeadlines, runDeadlineEmailJob, sweepDeadlineEmailJobs };
```

### 5. `pages/api/admin/units.js` — hook into the PUT

In the `PUT` branch:

```js
// --- before touching unit.deadlines ---
const wasPublished = unit.status === "published";
const prevDeadlines = unit.deadlines.map(d => ({
  classId: String(d.classId),
  categoryKey: d.categoryKey || null,
  dueAtMs: d.dueAt ? +new Date(d.dueAt) : null,
}));
```

`unit.status` is assigned a few lines further down from `status` — capture
`wasPublished` **before** that.

```js
// --- after `await unit.save();` ---
let deadlineJobIds = [];
if (deadlines != null || levelChanged || (status != null && status !== undefined)) {
  try {
    deadlineJobIds = await announceDeadlines(unit, prevDeadlines, {
      requestedBy: req.auth.teacherId,
      announceAll: unit.status === "published" && !wasPublished,
    });
  } catch (err) {
    console.error("[deadline-announce] failed:", err.message);   // never break the save
  }
}
return res.status(200).json({ ok: true, unit, deadlineJobIds });
```

> The `announceDeadlines` call itself is cheap (a diff + a couple of small
> inserts). No emails are sent here.

### 6. `pages/api/admin/deadline-jobs/run.js` — NEW (the background worker)

```js
// POST /api/admin/deadline-jobs/run
//   body { ids: [jobId, ...] }  -> run exactly those jobs
//   body {}                     -> sweepDeadlineEmailJobs()  (used by cron)
// Auth: teacher session (requireAuth) OR  Authorization: Bearer <CRON_SECRET>
// config.maxDuration = 60   (Hobby cap; batching + cursor handle overflow)

module.exports.config = { maxDuration: 60 };
```

Logic:
- accept if `req.headers.authorization === "Bearer " + process.env.CRON_SECRET`
  **or** a valid teacher token (wrap the handler so both work — check the bearer
  first, else fall through to `requireAuth`).
- `ids?.length` → `for (id of ids) await runDeadlineEmailJob(id)`, else `sweepDeadlineEmailJobs()`.
- return `{ ok:true, jobs:[{ id, status, progress }] }`.

### 7. `pages/api/admin/deadline-jobs.js` — NEW (status/self-heal, GET)

`GET /api/admin/deadline-jobs?unitId=<id>` (teacher auth) →
- list this unit's jobs from the last, say, 1h with `status`/`progress`;
- if any is `pending` (or stale `running`), `await runDeadlineEmailJob` it first
  (self-heal on view, exactly like `grading-jobs` runs a pending job when polled).

Used for an optional toast in the editor and as a manual "did it send?" check.

### 8. Client — `app/teacher/lessons/[unitId]/page.js`

`save()` currently: `await api.teacher.updateUnit(...)` then `router.push(...)`.

Change to fire a **`keepalive`** kick right before navigating, so the worker
starts even though the page unloads:

```js
const res = await api.teacher.updateUnit(unit._id, toPayload(unit, status));
if (res.deadlineJobIds?.length) {
  // keepalive => request survives the router.push navigation
  fetch("/api/admin/deadline-jobs/run", {
    method: "POST",
    keepalive: true,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + getTeacherToken(),
    },
    body: JSON.stringify({ ids: res.deadlineJobIds }),
  }).catch(() => {});
}
router.push("/teacher/lessons");
```

- Import `getTeacherToken` from `@/lib/client/session`.
- Optional: before `router.push`, set a small success note like
  *"Students in the assigned class(es) will be emailed about the new deadline."*
- `lib/client/api.js`: add `runDeadlineJobs: (ids) => request("/api/admin/deadline-jobs/run", { method:"POST", body:{ ids }, auth:"teacher" })` for reuse elsewhere (not used by the keepalive path, which needs the raw `fetch`).

### 9. `pages/api/cron/deadline-scan.js` — safety net

After `generateDeadlineNotificationsForAll()`:

```js
const swept = await sweepDeadlineEmailJobs();
return res.status(200).json({ ok: true, ...result, deadlineEmailJobs: swept });
```

Catches jobs whose `keepalive` kick never landed (browser closed at the wrong
instant, network blip) or that a 60s function left half-done. Worst-case latency
for those = time to next daily cron; the common case is delivered within seconds
of Save.

---

## Idempotency & edge cases (all handled by the design)
- **Re-save with same deadlines** → diff yields nothing → no job, no email.
- **Deadline moved** → `dueAtMs` differs → new job; `dedupeKey` includes `+dueAt`
  so students get a fresh "deadline changed" email.
- **Re-run / cron overlap** → `emit()` is idempotent by `dedupeKey`; concurrent
  `E11000` is swallowed in the runner. No double email.
- **Unpublish → republish** (same deadline) → `announceAll` re-flags it, but every
  `dedupeKey` already exists → `emit()` no-ops the channels. No spam.
- **Draft unit** → `announceDeadlines` returns `[]`. Setting the deadline while
  draft, then publishing → the publish save has `announceAll = true` and sends then.
- **Student has no email** → in-app notification still created; email channel
  records `skipped`. Counted in `progress.emailSkipped`.
- **`GMAIL_*` not configured (this local machine)** → `sendMail` returns
  `{skipped:true}`, channel records `skipped`, job still completes `done`. Nothing
  crashes. (This is why it's safe to ship untested locally.)
- **Big class vs 60s cap** → `cursor` + `TIME_BUDGET_MS`: the run endpoint drains
  what it can, leaves `status:"pending"`, cron (or a follow-up view) finishes.
- **Per-skill + whole-unit deadline both set for one class** → two separate job
  markers → two emails (one per scope). Intentional and matches how
  `distinctDeadlines` already models it.

## Deploy note
- No new env vars required. `CRON_SECRET` (already documented in `.env.example`)
  gates the `run` endpoint's bearer path; teacher-session auth is the other path.
- No `vercel.json` change (reusing the existing daily cron as the sweep).
- New Mongo collection `deadlineemailjobs` is created automatically; TTL index
  keeps it self-cleaning.

## Test checklist (manual, after Gmail is configured)
1. Publish a Unit, assign a class with ≥2 students who have emails, set a
   whole-unit deadline, Save → both students get in-app + email within seconds.
2. Re-open, Save again unchanged → no new email.
3. Move the deadline 1 day later, Save → new email ("deadline changed").
4. Add a per-skill (e.g. Writing) deadline, Save → one more email scoped to Writing.
5. Temporarily unset `GMAIL_*` → Save → job still reaches `done`, in-app only.
6. `GET /api/admin/deadline-jobs?unitId=<id>` shows `status:"done"` + progress.
7. Kill the browser right after Save (skip the keepalive) → next
   `/api/cron/deadline-scan` run reports `deadlineEmailJobs.ran ≥ 1` and emails land.
