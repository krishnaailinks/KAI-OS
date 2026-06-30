# KAI-OS — Complete Self-Testing Guide

> A step-by-step manual + automated testing playbook for **Krishna AI Links Pvt. Ltd. (KAI-OS)**.
> Follow this top-to-bottom to verify every feature, from every role, with working credentials at each step.

**Last verified:** 2026-06-30
**App under test:** Next.js 16 + Supabase + Tailwind v4 enterprise console
**Roles:** Director · Employee · Client

---

## Table of Contents

1. [Test Accounts & Credentials](#1-test-accounts--credentials)
2. [Environment Setup](#2-environment-setup)
3. [Automated Test Suites (run these first)](#3-automated-test-suites-run-these-first)
4. [Manual Testing — Authentication (all roles)](#4-manual-testing--authentication-all-roles)
5. [Manual Testing — Director profile](#5-manual-testing--director-profile)
6. [Manual Testing — Employee profile](#6-manual-testing--employee-profile)
7. [Manual Testing — Client profile](#7-manual-testing--client-profile)
8. [API / Black-Box Testing (curl, per role)](#8-api--black-box-testing-curl-per-role)
9. [Security & Access-Control Testing](#9-security--access-control-testing)
10. [Known Issues & Required Manual Steps](#10-known-issues--required-manual-steps)
11. [Test Results Checklist](#11-test-results-checklist)

---

## 1. Test Accounts & Credentials

Three **persistent demo accounts** (one per role) are pre-provisioned in the live Supabase project. They use the `@demo.kai-os.local` domain so the automated E2E teardown never deletes them. Re-create / reset them any time with `node scripts/provisionDemoAccounts.js`.

| Role         | Email                            | Password            | Lands on              |
|--------------|----------------------------------|---------------------|-----------------------|
| **Director** | `demo.director@demo.kai-os.local`| `DemoDirector#2026` | `/dashboard/director` |
| **Employee** | `demo.employee@demo.kai-os.local`| `DemoEmployee#2026` | `/dashboard/employee` |
| **Client**   | `demo.client@demo.kai-os.local`  | `DemoClient#2026`   | `/dashboard/client`   |

> ✅ All three were verified to log in and resolve to the correct role via `/api/me` on 2026-06-30.

### Other secrets you may need

| Purpose                          | Value                                   |
|----------------------------------|-----------------------------------------|
| **Director registration code**   | `kai-admin-2026` (used at `/register`)  |
| **Supabase project**              | `https://supabase.com/dashboard/project/vkmhayiyrybovmyerhje` |
| **Supabase dashboard login**      | See `CREDENTIALS.local.md` (gitignored — not committed) |

> ⚠️ Real human/admin secrets (Supabase dashboard login, service-role key, Gemini key, Sentry token) live **only** in the **gitignored** `CREDENTIALS.local.md`. They are intentionally kept out of this committed guide. Never commit them.

### Self-service account creation (alternative)

- **Employee**: open `/register`, pick the **Employee** tab, fill name/email/password (password must be "Fair" or stronger — needs length > 8 plus at least two of: uppercase, number, symbol). No code needed.
- **Director**: open `/register`, pick the **Director** tab, and enter the access code `kai-admin-2026`.
- **Client**: clients **cannot self-register**. A Director provisions them from **Live Admin → Provision Client Account** (see [§5.8](#58-live-admin-director-only)).

---

## 2. Environment Setup

### Prerequisites
- Node.js 20+
- npm
- The repo cloned, with a populated `.env.local` (already present locally).

### Install & verify config
```bash
npm install            # if not already installed
```

`.env.local` must contain (already set locally):
```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DIRECTOR_REGISTRATION_CODE=kai-admin-2026
GEMINI_API_KEY=...            # optional (AI tagging + audit report)
```

### Run the app locally

**Development** (hot reload, compiles on demand):
```bash
npm run dev
# → http://localhost:3000
```

**Production-like** (recommended for stable manual + E2E testing — uses far less memory):
```bash
npm run build
npm run start
# → http://localhost:3000
```

> **Production URL (live):** `https://krishnaailinks.com` (Vercel). You can run every manual test there instead of localhost — just replace the base URL. Note that writes there hit the real production database.

---

## 3. Automated Test Suites (run these first)

Run all four gates. Current baseline (verified 2026-06-30) shown on the right.

| Step | Command | What it covers | Baseline result |
|------|---------|----------------|-----------------|
| 1 | `npm run lint` | ESLint (code quality) | ✅ 0 errors, 0 warnings |
| 2 | `npm test` | Jest unit tests (validation, security, API handlers) | ✅ **120 passed** / 9 suites |
| 3 | `npm run build` | TypeScript typecheck + production build (28 routes) | ✅ Compiled successfully |
| 4 | `npx playwright test` | 273 E2E tests — every endpoint, every role, every error code, full browser journeys | ✅ **273 passed** |

### Running the E2E suite

The E2E suite **creates temporary test users** in Supabase, runs against a local server, and cleans up afterward.

**Recommended (stable):** build first, then run against the production server —
```bash
npm run build
USE_PROD_SERVER=1 npx playwright test
```

**Quick (dev server):** Playwright will auto-start `npm run dev`. The dev server's heap is raised to 4 GB in `playwright.config.ts` so the full parallel suite no longer crashes:
```bash
npx playwright test
```

**Useful flags:**
```bash
npx playwright test tests/e2e/01-auth.spec.ts   # one file
npx playwright test --reporter=list              # live per-test output
npx playwright show-report                        # open the HTML report after a run
```

> The E2E test users (`*@kai-os.test`) are **deleted** by the teardown. Use the `@demo.kai-os.local` accounts from §1 for manual testing — those persist.

---

## 4. Manual Testing — Authentication (all roles)

Open `http://localhost:3000` (or the production URL). You should be redirected to `/login` when not authenticated.

| # | Step | Expected result |
|---|------|-----------------|
| 4.1 | Visit `/` while logged out | Redirected to `/login` |
| 4.2 | Login page loads | Shows email field, password field, submit button, KAI-OS logo |
| 4.3 | Submit empty form | Validation error shown, no navigation |
| 4.4 | Login with **wrong** password | Inline error ("Invalid credentials" style), stays on `/login` |
| 4.5 | Login as **Director** (`demo.director@demo.kai-os.local` / `DemoDirector#2026`) | Redirected to `/dashboard/director`, sidebar shows **DIRECTOR** badge |
| 4.6 | Login as **Employee** | Redirected to `/dashboard/employee`, sidebar shows **EMPLOYEE** badge |
| 4.7 | Login as **Client** | Redirected to `/dashboard/client` (client portal) |
| 4.8 | **Cross-role guard**: while logged in as Employee, visit `/dashboard/director` | Redirected away (back to `/dashboard/employee` or `/login`) — never shows the director dashboard |
| 4.9 | **Session persistence**: refresh the dashboard (F5) | Stays logged in, dashboard re-renders (not bounced to login) |
| 4.10 | **Logout** (sidebar Logout / Sign-out button) | Redirected to `/login` |
| 4.11 | After logout, visit `/dashboard/employee` directly | Redirected to `/login` |

### Registration flow
| # | Step | Expected result |
|---|------|-----------------|
| 4.12 | `/register` → Employee tab → fill valid details → Submit | "Successfully registered as EMPLOYEE", routed to `/login` |
| 4.13 | `/register` → Director tab **without** code | Blocked: "Director access code is required" |
| 4.14 | `/register` → Director tab with **wrong** code | API returns 403, error toast shown (no account created) |
| 4.15 | `/register` → Director tab with code `kai-admin-2026` | Director account created, routed to `/login` |
| 4.16 | Register with a **weak** password (e.g. `abc`) | Blocked: "Password is too weak" (strength meter must reach Fair+) |

---

## 5. Manual Testing — Director profile

Login as **Director**. The left sidebar shows these nav buttons: **Dashboard, Team Hub, Live Meeting, Projects & ERP, Finance (FMS), HR Directory, Executive Audit, Live Admin**. (Executive Audit + Live Admin are **director-only** — confirm they're absent for employees in §6.)

### 5.1 Dashboard (Tasks / Kanban)
| Step | Expected |
|------|----------|
| Open **Dashboard** | Kanban board with columns (Backlog/Active Workload → In Progress → In Review → Completed) |
| Create a task (title, description, priority, budget, tools) | Task appears in the chosen column; `POST /api/tasks` returns 201 |
| Drag a task between columns | Column updates and persists after refresh |
| Use **AI tagging** when creating a task | Priority + tool stack auto-suggested (requires `GEMINI_API_KEY`; otherwise falls back to STANDARD + default tools) |
| Approve / reject an employee's pending task update | Status changes from `pending_review` to `approved`/rejected |
| Move a task with `budget > 0` to **Completed** | An **invoice is auto-generated** (verify under Finance) |

### 5.2 Team Hub (Messaging)
| Step | Expected |
|------|----------|
| Open **Team Hub** | Channel list incl. **General**, **Engineering**, **Alerts** |
| Select **General**, type a message, press Enter | Message appears instantly; visible to other logged-in users in real time |
| Post in **Alerts** (announcement channel) as Director | Allowed (directors may post announcements) |

### 5.3 Live Meeting (Voice/Video rooms)
| Step | Expected |
|------|----------|
| Open **Live Meeting** | Voice/meeting room UI loads without error |
| Create a room | Room appears in the list; other users see it within ~15 s |
| Join a room | Switches to the live meeting view (Jitsi iframe); participant count updates for others |
| Leave / end the room | You're removed; only the creator (or director) can end a room |

### 5.4 Projects & ERP
| Step | Expected |
|------|----------|
| Open **Projects & ERP** | Project list with statuses (Planning/Active/On Hold/Completed) + task counts |
| Create a project (name required; optional status/dates) | `POST /api/projects` → 201, project appears |
| **Generate document** on a project | Markdown lifecycle document is produced (task breakdown, progress, audit trail) |
| Create with a blank name | Rejected with 400 validation error |

### 5.5 Finance (FMS) — Invoices & Payroll
| Step | Expected |
|------|----------|
| Open **Finance (FMS)** | Invoices list (unpaid/paid/overdue) + payroll section |
| Check the auto-generated invoice from §5.1 | Present, linked to the completed task, amount = task budget |
| Run **payroll execution** with `confirm: true` | Pending/approved records marked **Paid**; a receipt is generated |
| Try payroll with a `maxTotal` lower than the total | Fails safely (does not over-disburse) |

### 5.6 HR Directory
| Step | Expected |
|------|----------|
| Open **HR Directory** | All personnel profiles with full fields (job title, phone, salary, address) |
| Edit an employee's salary / job title | Saved (director-only writable fields update) |

### 5.7 Executive Audit (director-only)
| Step | Expected |
|------|----------|
| Open **Executive Audit** | Audit log viewer (event type, message, severity, timestamp) |
| Generate the **AI audit report** | Markdown summary returned (requires `GEMINI_API_KEY`; otherwise returns an actionable 503/502, **not** a generic 500) |

### 5.8 Live Admin (director-only)
| Step | Expected |
|------|----------|
| Open **Live Admin** | Live stats (employees, active projects, tasks completed today, open invoices, payroll total, server status) |
| **Provision Client Account** (name + email + password) | New client created; you can now log in as that client |
| **Generate Director Invite** (enter email) | A single-use invite token is generated (expires in 7 days) |
| Toggle a user's **permissions** (allow_video / allow_audit / system_lockout) | Saved; effect visible to that user (e.g. video access, lockout) |

---

## 6. Manual Testing — Employee profile

Login as **Employee** (`demo.employee@demo.kai-os.local` / `DemoEmployee#2026`).

| # | Step | Expected |
|---|------|----------|
| 6.1 | Sidebar contents | Shows Dashboard, Team Hub, Live Meeting, etc. **Executive Audit and Live Admin are NOT present** |
| 6.2 | Role badge | Shows **EMPLOYEE** |
| 6.3 | **Dashboard / Kanban** | Sees assigned tasks; can update **column** and **progress** only |
| 6.4 | Move a task to a new column | Update enters `pending_review` (awaits director approval) |
| 6.5 | Try to edit a task's title/budget | Not permitted (those are director-only fields) |
| 6.6 | **Team Hub** → General | Can send/read messages |
| 6.7 | Post in **Alerts** (announcement channel) | **Blocked** (employees cannot post in announcement channels) — 403 |
| 6.8 | **Attendance**: clock in | Today's record created with check-in time |
| 6.9 | Attendance: clock out | Check-out time recorded |
| 6.10 | **Daily report**: submit today's report | Saved (upserts — re-submitting updates the same day) |
| 6.11 | **Profile**: update name / phone / address / avatar | Saved (own profile only) |
| 6.12 | Try to view another employee's salary | Not exposed to employees |
| 6.13 | **Payroll**: view own records | Visible (read-only); cannot execute payroll |
| 6.14 | **Live Meeting** | Works if `allow_video` is true; otherwise shows "Meeting Access Restricted" |

---

## 7. Manual Testing — Client profile

Login as **Client** (`demo.client@demo.kai-os.local` / `DemoClient#2026`).

| # | Step | Expected |
|---|------|----------|
| 7.1 | Lands on `/dashboard/client` | Client portal layout (not the staff dashboard) |
| 7.2 | **Projects** | Sees only **Active** projects; internal fields (task counts, internal metadata) are **omitted** |
| 7.3 | **Invoices** | Can view invoices addressed to them |
| 7.4 | Attempt to access `/dashboard/director` or `/dashboard/employee` | Redirected away |
| 7.5 | Client has **no video access** by default (`allow_video=false`) | Meeting features restricted |
| 7.6 | Try staff-only API calls (tasks create, payroll, audit) | 403 Forbidden |

---

## 8. API / Black-Box Testing (curl, per role)

### 8.1 Get an access token for a role
```bash
# Load anon key + URL from .env.local first
SUPABASE_URL="https://vkmhayiyrybovmyerhje.supabase.co"
ANON_KEY="<NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>"

# Director token
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo.director@demo.kai-os.local","password":"DemoDirector#2026"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")
echo "$TOKEN"
```
Swap the email/password to get an **employee** or **client** token.

### 8.2 Expected status codes by endpoint & role

| Request | No token | Employee | Client | Director |
|---------|----------|----------|--------|----------|
| `GET /api/health` | 200 | 200 | 200 | 200 |
| `GET /api/me` | 401 | 200 | 200 | 200 |
| `GET /api/tasks` | 401 | 200 | 200 | 200 |
| `POST /api/tasks` | 401 | 403 | 403 | 201 |
| `GET /api/projects` | 401 | 200 (all) | 200 (Active only) | 200 (all) |
| `POST /api/projects` | 401 | 403 | 403 | 201 |
| `GET /api/payroll` | 401 | 403 | 403 | 200 |
| `POST /api/payroll` | 401 | 403 | 403 | 200 |
| `GET /api/invoices` | 401 | 403 | 403 | 200 |
| `GET /api/audit` | 401 | 403 | 403 | 200 |
| `POST /api/audit` | 401 | 201 | 201 | 201 |
| `POST /api/audit/generate-report` | 401 | 403 | 403 | 200 / 502 / 503 |
| `GET /api/admin/live-stats` | 401 | 403 | 403 | 200 |
| `POST /api/admin/directors/invite` | 401 | 403 | 403 | 200 |
| `POST /api/admin/clients/provision` | 401 | 403 | 403 | 200/201 |
| `GET /api/messages?channel=general` | 401 | 200 | 200 | 200 |
| `POST /api/channels` | 401 | 403 | 403 | 201 |

### 8.3 Example calls
```bash
BASE="http://localhost:3000"      # or https://krishnaailinks.com

# Authenticated profile
curl -s "$BASE/api/me" -H "Authorization: Bearer $TOKEN"

# Create a task (director only) — expect 201
curl -s -X POST "$BASE/api/tasks" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"API smoke test","priority":"STANDARD","column_id":"TODO"}'

# Same call with an EMPLOYEE token — expect 403
# Unauthenticated — expect 401
curl -s -o /dev/null -w "%{http_code}\n" -X POST "$BASE/api/tasks" -d '{}'

# Validation error — expect 400 (missing required title)
curl -s -X POST "$BASE/api/projects" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d '{}'
```

> Full field-level request/response schemas for every endpoint are in [`docs/api.md`](docs/api.md).

---

## 9. Security & Access-Control Testing

| # | Test | Expected |
|---|------|----------|
| 9.1 | All protected endpoints **without** a token | `401` (never 200) |
| 9.2 | Staff-only endpoints with an **employee/client** token | `403` (RLS + role gate) |
| 9.3 | Security headers on `/login` | `X-Frame-Options`, `X-Content-Type-Options: nosniff` present |
| 9.4 | Security headers on API responses | `X-Content-Type-Options: nosniff` present |
| 9.5 | `/api/health` public body | No memory/uptime details unless `?detail=true` **with a director token** |
| 9.6 | Invalid input (bad enum, oversized string, malformed date) | `400` with a descriptive error — **not** 500 |
| 9.7 | Missing `DIRECTOR_REGISTRATION_CODE` server-side | Register returns actionable `503`, invalid code returns `403` |
| 9.8 | Missing `GEMINI_API_KEY` | AI report returns `503`; upstream Gemini failure returns `502` (not a generic 500) |
| 9.9 | Rate limiting (see §10) | `POST /api/auth/register` etc. should return `429` after the limit — **requires the migration in §10 to be applied** |

---

## 10. Known Issues & Required Manual Steps

### 🔴 REQUIRED: Apply the rate-limit migration fix to the live database

A bug was found and **fixed in the codebase** during this test pass:
`database/migrations/006_rate_limit_counters.sql` aliased the table `AS rl` but the `RETURNING`
clause referenced the original table name, causing Postgres to reject the query
(`invalid reference to FROM-clause entry for table "rate_limit_counters"`). The rate limiter was
**silently failing open** (allowing all requests) on every call.

The fix (`RETURNING rl.count, rl.reset_at`) is in the repo, but the **function in the live Supabase
database still has the old, broken definition** and must be re-applied manually (no direct DB
credentials are available to automation):

1. Open the Supabase SQL editor: `https://supabase.com/dashboard/project/vkmhayiyrybovmyerhje/sql`
2. Paste and run the **entire** contents of `database/migrations/006_rate_limit_counters.sql`
   (the `CREATE OR REPLACE FUNCTION` is idempotent and safe to re-run).
3. Verify: rate-limited endpoints (register, payroll, tasks) should now return `429` after exceeding
   their limits, and the server log should no longer print
   `[rate_limit] DB check failed, failing open`.

Until applied, the app **works** but rate limiting is a no-op in production.

### ℹ️ Notes
- `next start` prints a warning that it "does not work with `output: standalone`". The app still
  serves correctly for testing; for the canonical standalone deployment use
  `node .next/standalone/server.js` (Vercel handles this automatically).
- The E2E **dev server** previously crashed mid-run with an out-of-memory error under parallel
  compile load. Fixed by raising the dev server heap to 4 GB in `playwright.config.ts`. For the most
  stable runs, use `USE_PROD_SERVER=1` after a build.

---

## 11. Test Results Checklist

Copy this into a test report and tick as you go.

```
AUTOMATED
[ ] npm run lint            → 0 errors / 0 warnings
[ ] npm test                → 120 passed
[ ] npm run build           → compiled successfully
[ ] npx playwright test     → 273 passed   (USE_PROD_SERVER=1 recommended)

MANUAL — AUTH
[ ] Login (director / employee / client) lands on correct dashboard
[ ] Wrong password rejected
[ ] Cross-role route guard works
[ ] Session persists on refresh
[ ] Logout + post-logout guard

MANUAL — DIRECTOR
[ ] Tasks CRUD + drag + approve/reject
[ ] AI tagging
[ ] Auto-invoice on completed task with budget
[ ] Team Hub messaging (+ announcement post allowed)
[ ] Live Meeting create/join/leave/end
[ ] Projects CRUD + generate document
[ ] Finance: invoices + payroll execution + receipt
[ ] HR Directory edit
[ ] Executive Audit + AI report
[ ] Live Admin: stats, provision client, invite director, permissions

MANUAL — EMPLOYEE
[ ] No Executive Audit / Live Admin in sidebar
[ ] Task column/progress update → pending_review
[ ] Announcement post blocked (403)
[ ] Attendance check-in/out
[ ] Daily report submit
[ ] Own profile update
[ ] Payroll read-only

MANUAL — CLIENT
[ ] Client portal loads
[ ] Sees only Active projects, no internal fields
[ ] Invoices visible
[ ] Staff routes/APIs blocked (403 / redirect)

SECURITY / API
[ ] 401 without token everywhere protected
[ ] 403 for wrong role
[ ] 400 on invalid input (not 500)
[ ] Security headers present
[ ] Rate limiting returns 429 (after applying §10 migration)
```

---

*Generated as part of a full test pass on 2026-06-30. Baselines (lint 0/0, unit 120, build ✓, E2E 273) were observed on this machine; re-run §3 to confirm on yours.*
