# BeMyFlo — Product & Business Summary

> Purpose of this file: give another AI (or a new teammate) enough context to understand
> **what this product is, who it is for, and what it can do** from a business point of view.
> It is deliberately not a technical spec. Status is accurate as of **2026-10-07**; items marked
> *(planned)* or *(not decided)* do not exist yet.

---

## 1. What it is, in one paragraph

**BeMyFlo** is a web-based learning-management platform (LMS) for **English language teachers and
teaching centers**, built first around **IELTS** exam preparation. A teacher builds lessons and
mock tests, assigns them to classes with deadlines, and students complete them online. The platform
auto-grades what it can (listening, reading, grammar, vocabulary) and helps the teacher grade what it
can't (writing, speaking), including with AI assistance. It also covers day-to-day class
operations: attendance, homework tracking, notifications, class chat and a teacher dashboard that
shows who needs attention.

It started as a single-teacher app for one IELTS teacher ("IELTS with Ms Nhi", the first and
currently only live customer) and is being turned into a **multi-tenant B2B SaaS**: many
independent teachers/centers, each in a fully isolated "workspace".

## 2. Who uses it (user roles)

| Role | Who | What they do |
|---|---|---|
| **Platform admin** | The product owner (BeMyFlo staff) | Creates customer accounts/workspaces, monitors usage, AI spend, storage, support tickets, audit logs |
| **Teacher** (workspace owner) | An IELTS teacher or center owner | Builds content, manages classes and students, assigns work, grades, reads analytics |
| **Student** | The teacher's learners | Logs in, does assigned lessons/tests, reviews results, keeps a personal notebook, chats with the class |

Customers are **teachers/centers (B2B)**. Students never pay BeMyFlo directly and never sign up on
their own; their accounts are created by their teacher.

## 3. Business model & go-to-market (current decisions)

- **B2B, contract-based.** There is **no self-signup**. Only the platform admin creates teacher
  accounts, and only for customers who have signed a contract. This is deliberate: it controls who
  uses the product and prevents strangers from burning the shared AI budget.
- **One workspace per customer.** Each teacher/center gets an isolated workspace: their own
  students, classes, content, branding and settings. No data is shared between workspaces.
- **Own address per customer.** Each workspace gets `<slug>.bemyflo.com` (e.g. the first customer
  is `ieltswithnhi.bemyflo.com`), with a branded login page. The root domain `bemyflo.com` also
  keeps working.
- **White-label-ish.** A workspace can set its own display name, logo/colors; the platform name
  appears in emails and UI only as a default. Aimed at being sold to centers under their own look.
- **Pricing / plans: *(not decided)*.** No billing, subscription tiers or per-workspace quotas
  exist yet. AI budget is currently **shared across the whole platform**, so one heavy workspace
  could exhaust it for everyone — per-workspace limits are an open question.
- **Brand:** BeMyFlo, domain bemyflo.com (chosen 2026-10-05; international, B2B, warm tone).
  Trademark search (Vietnam + WIPO) has **not** been done.
- **Public demo:** a demo workspace (`demo`) exists on the live system for showing prospects the
  product on social media. AI grading and email are disabled in the demo to avoid cost/abuse.
- **Interface language:** all UI is in **English** (the learners are English students). The first
  customer and her students are in Vietnam; spreadsheet import templates are in Vietnamese.

## 4. Core product: what a teacher can do

### 4.1 Build content once, reuse it
- **Lessons ("Units")** organized by level and by **6 skill categories**: Grammar, Vocabulary,
  Listening, Reading, Writing, Speaking. A Unit bundles theory, exercises and prompts.
- **Rich question bank** supporting the IELTS question types: fill-in-the-blank, multiple choice
  (single and multi-select), True/False/Not Given, Yes/No/Not Given, matching (headings, features,
  information, sentence endings), labelling, note/summary completion.
- **WYSIWYG editor** for theory content and note-completion tasks.
- **Grammar & Vocabulary lessons** with structured theory (formula, when to use, common mistakes,
  examples, YouTube video) and **flashcard** vocabulary study.
- **Per-question explanations** shown to students after grading (for right and wrong answers).
- **Media library** for audio (listening tracks) and images, stored in the cloud.
- **Bulk import from Excel**: teachers who already keep their question banks in spreadsheets
  (IELTS Reading/Listening templates, Grammar/Vocab lesson + exercise files) upload the `.xlsx` and
  the platform converts it into lessons/tests — no re-typing.

### 4.2 Mock tests (full IELTS exam simulation)
- A mock test bundles **all 4 skills** (Listening, Reading, Writing, Speaking) in one exam.
- Scheduled: locked until its opening date, then students see four skill cards with progress, and
  a combined result when available.
- Listening/Reading are auto-graded; Writing/Speaking are graded by the teacher (or AI-assisted).

### 4.3 Classes and assignment
- **Classes** carry the level (a student's level = their class's level). Students belong to a class.
- Lessons and tests are **assigned to classes**, with **deadlines** (per whole Unit or per skill).
- **Per-class skill locks:** the same Unit can be open for one class and partly locked for another
  class that is at a different pace (e.g., Class A sees all skills, Class B only Listening/Reading).
- Unassigned students see nothing.

### 4.4 Grading and feedback
- **Auto-grading** for objective questions, with instant results and explanations for students.
- **Writing:** the teacher marks up the student's essay non-destructively — inline corrections
  (replace/delete/insert/comment), error categories, IELTS criteria (TR/CC/LR/GRA) and band scores.
  Original essay text is never altered.
- **AI grading (Google Gemini):** one click produces an AI-drafted grade and inline corrections for
  Writing, and listens to the recording to grade **Speaking** (transcript, timestamped notes, FC/LR/
  GRA/PR bands). The teacher reviews and can edit; results are tagged as teacher / AI / AI-reviewed.
- **Review per Unit → Class → Student:** teachers see, for each lesson, how every student did across
  all six skills, and drill into a question-by-question breakdown.

### 4.5 Running the class
- **Attendance** per session, with **homework status** (done / partial / missing) auto-detected from
  submissions versus deadlines, and overridable by the teacher.
- **Teacher dashboard (Overview):** classes, ungraded submissions, active assignments, upcoming
  deadlines, grading queue, recent activity, and **"students to watch"** (overdue work, declining
  writing/speaking bands, inactive for 14+ days).
- **Notifications:** in-app bell plus **email** — teachers are alerted when students submit
  Writing/Speaking; students get deadline reminders (daily scheduled scan, even if they never
  open the app).
- **Class group chat:** realtime per-class chat (text and media), messages auto-delete after 30 days.
  *(Built as a separate service; deployment status should be checked before promising it to a customer.)*
- **Support tickets:** teachers and students can raise tickets to the platform admin.

## 5. What a student experiences

- Logs in with the account their teacher created; sees only content assigned to their class.
- Works through lessons by skill, with deadlines and progress shown; locked skills show a clear
  "teacher hasn't opened this yet" state.
- Takes scheduled mock tests with a timer; Listening/Reading in the IELTS style, Writing by typing,
  Speaking by recording in the browser.
- Sees results with correct answers and explanations; Writing feedback appears as inline
  corrections plus band scores.
- **Highlight & note tool** everywhere (passages, questions, theory); highlights with notes are saved
  to a personal **notebook** (search, colors, pin, free notes) that follows the student across devices.
- Notifications for deadlines and graded work; class chat.

## 6. Platform admin (BeMyFlo staff) capabilities

- Create and manage customer workspaces and teacher accounts; suspend or reactivate them.
- Overview of users, classes, storage usage, AI usage/logs, system health.
- Audit log of sensitive actions, notification overview, support-ticket inbox.
- Strict tenant isolation is enforced server-side: a teacher can never see another workspace's data.

## 7. Differentiators / value proposition

1. **Built for IELTS specifically** — real question types, 4-skill mock exams, band-score criteria,
   not a generic quiz tool.
2. **Teacher time saved on the hardest part** — AI-drafted Writing and Speaking grading with the
   teacher in control, plus auto-grading for everything objective.
3. **Zero re-typing** — import existing Excel question banks.
4. **Teaching-operations in one place** — assignments, deadlines, attendance, homework tracking,
   chat, alerts and a dashboard that surfaces struggling students.
5. **Per-class pacing** — one lesson, different unlock states per class.
6. **Customer-branded** — own subdomain, name and colors per workspace.

## 8. Status & roadmap

**Live and in use (first customer, Ms Nhi's IELTS classes):** all of sections 4–6 except where noted.
Multi-tenant foundation (isolated workspaces, role separation, onboarding, workspace settings,
removal of hard-coded branding) is done and deployed.

| Item | Status |
|---|---|
| Subdomain per workspace (`<slug>.bemyflo.com`) and handing a login over from the root domain to the subdomain | Built; on a feature branch, awaiting owner merge/deploy |
| Class group chat | Built on a separate branch/service; confirm deployment |
| Taxonomy of Subject / Program / Skill (so the platform can serve TOEIC, General English, then other subjects such as Math/Science) | *(planned, Phase 8)* |
| Multiple teachers per workspace, students in multiple classes, "Organization" for multi-teacher centers, possible marketplace | *(planned, Phase 9 — not in V1)* |
| Public self-signup | *(deliberately not built; would require per-workspace AI limits first)* |
| Pricing, billing, plans, per-workspace quotas | *(not decided)* |
| Trademark search for BeMyFlo | *(not done)* |

**Long-term direction:** from one IELTS teacher → many independent teachers (V1) → multiple subjects
and programs per teacher (V2) → whole teaching centers with several teachers, possibly a marketplace (V3).

## 9. Known constraints worth knowing

- **Shared AI budget** across all customers (no per-workspace cap yet).
- **Teachers are Vietnamese-speaking, learners study English**; Vietnamese appears only in the Excel
  import templates, support conversations and the owner's internal docs.
- Real students use the live system today, so every change is rolled out cautiously, one phase at a
  time, each on its own branch that the owner merges and deploys.

## 10. Technical notes (very brief, for context only)

Next.js (React) web app with API routes, MongoDB (Mongoose), JWT auth, Cloudinary for audio/images/
recordings, Google Gemini for AI grading, Gmail SMTP for email, a small Socket.IO service for chat,
hosted on Vercel with cron jobs. For anything deeper, see `PLAN-MULTI-TENANT.md` (architecture and
phase history) and the other `PLAN-*.md` files.
