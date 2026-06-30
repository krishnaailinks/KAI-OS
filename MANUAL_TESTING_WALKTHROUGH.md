# KAI-OS — Component-by-Component Manual Testing Walkthrough

> Test **every component** of KAI-OS, step by step, with working credentials.
> This is the hands-on companion to [`TESTING_GUIDE.md`](TESTING_GUIDE.md) (which covers automated suites + the API matrix). Here we click through **each UI component** in order.

**App:** Next.js 16 + Supabase enterprise console · **Roles:** Director / Employee / Client
**Last verified:** 2026-06-30

---

## 0. Before you start

### 0.1 Credentials (verified working)

| Role | Email | Password | Lands on |
|------|-------|----------|----------|
| **Director** | `demo.director@demo.kai-os.local` | `DemoDirector#2026` | `/dashboard/director` |
| **Employee** | `demo.employee@demo.kai-os.local` | `DemoEmployee#2026` | `/dashboard/employee` |
| **Client**   | `demo.client@demo.kai-os.local`  | `DemoClient#2026`   | `/dashboard/client`   |

- Director registration code (for the Register page): **`kai-admin-2026`**
- Real admin/dashboard secrets are **not** in this file — see the gitignored `CREDENTIALS.local.md`.
- Lost/changed the demo accounts? Recreate them: `node scripts/provisionDemoAccounts.js`.

### 0.2 Start the app
```bash
npm run build && npm run start     # stable, recommended
# or: npm run dev                  # hot reload
# → open http://localhost:3000
```
Or test the live deploy at **https://krishnaailinks.com**.

### 0.3 How to read this doc
Each component has: **Who** (roles that see it) · **Where** (how to open it) · **Steps** · **Expected**. Tick the box when it passes. A 🔒 means the control is permission/role gated.

---

## 1. Login Page  (`/login`)
**Who:** everyone (unauthenticated) · **Where:** open `/` → auto-redirects to `/login`

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 1.1 | Open `/` while logged out | Redirected to `/login`; KAI-OS logo + email + password + submit shown | ☐ |
| 1.2 | Submit empty form | Inline validation error; no navigation | ☐ |
| 1.3 | Enter a wrong password | Error message ("Invalid credentials"), stays on `/login` | ☐ |
| 1.4 | Log in as **Director** | Redirect to `/dashboard/director` | ☐ |
| 1.5 | Log out, log in as **Employee** | Redirect to `/dashboard/employee` | ☐ |
| 1.6 | Log out, log in as **Client** | Redirect to `/dashboard/client` | ☐ |
| 1.7 | "Register here" link | Navigates to `/register` | ☐ |

---

## 2. Register Page  (`/register`)
**Who:** everyone · **Where:** `/register`. Two tabs: **Employee** / **Director**. (Clients can't self-register — they're provisioned by a Director, see §15.)

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 2.1 | Type a password and watch the strength meter | Meter goes None→Weak→Fair→Good→Strong as you add length/upper/number/symbol | ☐ |
| 2.2 | Employee tab → submit with a **weak** password | Blocked: "Password is too weak" | ☐ |
| 2.3 | Employee tab → valid name/email/strong password → Submit | "Successfully registered as EMPLOYEE", routed to `/login` | ☐ |
| 2.4 | Director tab → leave access code empty → Submit | Blocked: "Director access code is required" | ☐ |
| 2.5 | Director tab → **wrong** code → Submit | Error toast; API returns 403; no account created | ☐ |
| 2.6 | Director tab → code `kai-admin-2026` → Submit | Director account created, routed to `/login` | ☐ |
| 2.7 | Log in with the account you just created | Lands on the matching dashboard | ☐ |

---

## 3. Dashboard Shell — Sidebar Navigation
**Who:** Director + Employee (clients get a single "Service Desk" item — see §16) · **Where:** left sidebar after login.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 3.1 | As **Director**, read the sidebar | Shows: Dashboard, Team Hub, Live Meeting, Audit Logs, Finance (FMS), HR Directory, **Executive Audit**, Projects & ERP, **Live Admin** | ☐ |
| 3.2 | As **Employee**, read the sidebar | Same list **without Executive Audit and Live Admin** (director-only) | ☐ |
| 3.3 | Note the 🔒 shield icons | Employee sees a red shield on **Finance (FMS)** and **Audit Logs** (gated); 🔒 on **Live Meeting** if `allow_video` is off | ☐ |
| 3.4 | Bottom user card | Shows the role badge (`DIRECTOR` / `EMPLOYEE`) + "Online" dot | ☐ |
| 3.5 | Click each nav item | The main panel swaps to that component without a full page reload | ☐ |

---

## 4. Dashboard Shell — Top Navbar controls
**Who:** as noted per control · **Where:** top bar (right side).

| # | Control | Who | Step → Expected | ✓ |
|---|---------|-----|------------------|---|
| 4.1 | **Theme toggle** (sun/moon) | all | Click → entire UI switches light/dark; persists on refresh | ☐ |
| 4.2 | **Focus Mode** (layout icon) | all | Click → sidebar hides for a distraction-free view; click again to restore | ☐ |
| 4.3 | **Lock Session** (lock icon) | Director/Employee | Click → full-screen lock overlay (see §13) | ☐ |
| 4.4 | **Global Search** ("Search globally…" / Ctrl+K) | Director/Employee | Opens the Command Palette (see §12) | ☐ |
| 4.5 | **DIRECTOR PANEL** button | 🔒 Director only | Opens the Director Mode slide-over (see §14) | ☐ |
| 4.6 | **Export Logs** button | 🔒 Director only | Downloads a `.txt` of the in-session audit log | ☐ |
| 4.7 | **Logout** (red door icon) | all | Returns to `/login`; visiting a dashboard URL after = redirect to `/login` | ☐ |

---

## 5. Dashboard Tab — Stat Cards
**Who:** Director/Employee · **Where:** sidebar → **Dashboard** (default tab).

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 5.1 | Open Dashboard | Four cards: **Total Tasks, In Progress, In Review, Completed** with live counts | ☐ |
| 5.2 | Create/move a task (see §6), return to Dashboard | Counts update to reflect the change | ☐ |

---

## 6. KanbanBoard  (component: `KanbanBoard` + `CreateTaskModal` + `TaskCard` + `TaskDetailsModal`)
**Who:** Director (full) / Employee (limited) · **Where:** **Dashboard** tab shows the board below the stat cards.
Columns: **Backlog** (TODO) · **Active Workload** (IN_PROGRESS) · **Awaiting Clearance** (IN_REVIEW) · **Completed**.

### As Director
| # | Step | Expected | ✓ |
|---|------|----------|---|
| 6.1 | Click **+ / Create Task** | Create Task modal opens (title, description, priority, column, budget, tools, project) | ☐ |
| 6.2 | Use **AI tagging** in the modal | Priority + tool stack auto-suggested (needs `GEMINI_API_KEY`; else falls back to STANDARD + defaults) | ☐ |
| 6.3 | Submit a task | Appears in the chosen column; `POST /api/tasks` → 201 | ☐ |
| 6.4 | Drag a task to another column | Moves and persists after refresh | ☐ |
| 6.5 | Click a task → **Task Details modal** | Shows full fields; editable (title/priority/budget) | ☐ |
| 6.6 | Approve / reject an employee's pending update | Status flips `pending_review` → approved/rejected; toast shown | ☐ |
| 6.7 | Move a task with **budget > 0** to **Completed** | An invoice is auto-generated (verify in §9 Finance) | ☐ |

### As Employee
| # | Step | Expected | ✓ |
|---|------|----------|---|
| 6.8 | Open the board | Sees tasks; can edit **column** and **progress** only | ☐ |
| 6.9 | Move a task to a new column | Enters **Awaiting Clearance** as `pending_review` (needs director approval) | ☐ |
| 6.10 | Try to change title/budget | Not permitted (director-only fields) | ☐ |

---

## 7. TeamMessaging — "Team Hub"  (component: `TeamMessaging`)
**Who:** Director/Employee/Client · **Where:** sidebar → **Team Hub**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 7.1 | Open Team Hub | Channel list incl. **General, Engineering, Alerts** | ☐ |
| 7.2 | Select **General**, type a message, press Enter | Message appears instantly in the thread | ☐ |
| 7.3 | **Real-time test:** open a 2nd browser/incognito as Employee in General | Director's message appears for the Employee **without refresh** (and vice-versa) | ☐ |
| 7.4 | As **Director**, post in **Alerts** (announcement) | Allowed | ☐ |
| 7.5 | As **Employee**, try to post in **Alerts** | 🔒 Blocked (403) — employees can't post in announcement channels | ☐ |
| 7.6 | As **Director**, create a new channel | Appears for other users in real time | ☐ |
| 7.7 | Start a meeting from a channel (if shown) | Switches to the Live Meeting tab with the room joined (see §8) | ☐ |

---

## 8. LiveMeeting  (component: `LiveMeeting`)
**Who:** Director/Employee with `allow_video` · **Where:** sidebar → **Live Meeting**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 8.1 | Open Live Meeting (with video allowed) | Room UI loads without error | ☐ |
| 8.2 | Create a room | Room appears; another user sees it listed within ~15 s | ☐ |
| 8.3 | Join a room | Switches to the live view (Jitsi iframe); participant count updates for others | ☐ |
| 8.4 | Leave / end the room | You're removed; only the creator (or a director) can **end** a room | ☐ |
| 8.5 | 🔒 As a user with `allow_video=false` (e.g. set it off in §11, or test the Client) | Shows **"Meeting Access Restricted"** instead of the room | ☐ |

---

## 9. FinancePanel — "Finance (FMS)"  (component: `FinancePanel`)
**Who:** 🔒 Director (Employee sees a shield/limited view) · **Where:** sidebar → **Finance (FMS)**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 9.1 | Open Finance as Director | Invoices list (unpaid/paid/overdue) + payroll section | ☐ |
| 9.2 | Find the invoice auto-generated in §6.7 | Present, linked to the completed task, amount = budget | ☐ |
| 9.3 | Run **payroll execution** with confirm | Pending/approved records → **Paid**; a receipt is produced | ☐ |
| 9.4 | Run payroll with a `maxTotal` below the total | Fails safely (no over-disbursement) | ☐ |
| 9.5 | As **Employee**, open Finance | 🔒 Restricted (director-only data not shown) | ☐ |

---

## 10. CompanyDirectory — "HR Directory"  (component: `CompanyDirectory`)
**Who:** Director (full) / Employee (limited) · **Where:** sidebar → **HR Directory**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 10.1 | Open HR Directory as Director | All personnel with full fields (job title, phone, salary, address) | ☐ |
| 10.2 | Edit an employee's salary / job title | Saved (director-only writable fields) | ☐ |
| 10.3 | As **Employee**, open it | Sees colleagues but **not** salary/sensitive fields | ☐ |
| 10.4 | As **Employee**, edit your **own** profile (name/phone/address/avatar) | Saved | ☐ |

---

## 11. Permissions (via Live Admin) + enforcement
**Who:** 🔒 Director sets them; all users are affected · **Where:** **Live Admin** → permissions (see §15) and the API.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 11.1 | As Director, toggle an employee's **allow_video** off | The employee's **Live Meeting** tab shows "Meeting Access Restricted" (real-time) | ☐ |
| 11.2 | Toggle **system_lockout** on for a user | That user's session shows the **Session Locked** overlay (§13) | ☐ |
| 11.3 | Toggle **allow_audit** | Controls the employee's access to Audit Logs | ☐ |

---

## 12. Command Palette  (Ctrl/⌘+K)
**Who:** Director/Employee · **Where:** Ctrl+K anywhere, or the "Search globally…" button.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 12.1 | Press **Ctrl+K** | Palette opens with "Suggestions" (Go to Dashboard, Join Active Meeting) | ☐ |
| 12.2 | Type part of a task title/ID | Matching tasks listed; clicking one opens its Task Details modal | ☐ |
| 12.3 | Press **Esc** | Palette closes | ☐ |

---

## 13. Session Lock
**Who:** Director/Employee · **Where:** Lock icon in the navbar, or auto-triggered by `system_lockout`.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 13.1 | Click the **Lock** icon | Full-screen "Session Locked" overlay; the app behind is blurred & non-interactive | ☐ |
| 13.2 | Enter the **wrong** password → unlock | "Invalid password. Access denied." | ☐ |
| 13.3 | Enter your **correct** password (your login password) → Enter | Unlocks, returns to where you were | ☐ |

---

## 14. DirectorModePanel — "DIRECTOR PANEL"  (component: `DirectorModePanel`)
**Who:** 🔒 Director only · **Where:** blue **DIRECTOR PANEL** button in the navbar.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 14.1 | Click **DIRECTOR PANEL** | Slide-over opens with director controls (permissions, task overrides) | ☐ |
| 14.2 | Toggle a permission switch | Reflected in state/UI | ☐ |
| 14.3 | Close the panel | Slide-over dismisses, dashboard unaffected | ☐ |
| 14.4 | Log in as Employee | The DIRECTOR PANEL button is **absent** | ☐ |

---

## 15. ProjectManager — "Projects & ERP"  (component: `ProjectManager`)
**Who:** Director (CRUD) / Employee (view) · **Where:** sidebar → **Projects & ERP**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 15.1 | Open Projects & ERP | Project list with statuses (Planning/Active/On Hold/Completed) + task counts | ☐ |
| 15.2 | Create a project (name required) | `POST /api/projects` → 201; appears in the list | ☐ |
| 15.3 | Create with a blank name | Rejected with a 400 validation error | ☐ |
| 15.4 | **Generate document** on a project | Markdown lifecycle doc produced (tasks, progress, audit trail) | ☐ |
| 15.5 | As **Employee**, try to create a project | 🔒 403 / not allowed | ☐ |

---

## 16. ExecutiveAuditCenter + AuditReportGenerator  (Director only)
**Who:** 🔒 Director · **Where:** sidebar → **Executive Audit**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 16.1 | Open Executive Audit | Audit log viewer (event type, message, severity, timestamp) | ☐ |
| 16.2 | Generate the **AI audit report** | Markdown summary returned (needs `GEMINI_API_KEY`); without it → actionable **503/502**, never a generic 500 | ☐ |
| 16.3 | Also check the **Audit Logs** sidebar tab | Lists system events; gated by `allow_audit`/director | ☐ |

---

## 17. AdminSuperPanel — "Live Admin"  (component: `AdminSuperPanel`, Director only)
**Who:** 🔒 Director · **Where:** sidebar → **Live Admin**.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 17.1 | Open Live Admin | Live stats: employees, active projects, tasks completed today, open invoices, payroll total, server status | ☐ |
| 17.2 | **Provision Client Account** (name + email + password) → submit | "Success! Client … provisioned"; you can now log in as that client | ☐ |
| 17.3 | Try to provision with an **existing** email | Rejected (duplicate) | ☐ |
| 17.4 | **Generate Director Invite** (enter email) → submit | A single-use invite token is generated (expires in 7 days) | ☐ |
| 17.5 | Manage **permissions** (allow_video / allow_audit / system_lockout) per user | Saved; effect is live for that user (§11) | ☐ |
| 17.6 | Log in as Employee | Live Admin tab is **absent** | ☐ |

---

## 18. Client Portal — "Service Desk"  (Client role)
**Who:** Client only · **Where:** log in as Client → single **Service Desk** view.

| # | Step | Expected | ✓ |
|---|------|----------|---|
| 18.1 | Log in as Client | Lands on the Service Desk (not the staff dashboard); header badge shows client portal | ☐ |
| 18.2 | Top stats row | **Total tickets filed, In Active Pipeline, Completed Delivery, Average Progress** | ☐ |
| 18.3 | **Active Project Milestones** | Shows only **Active** projects with progress bars (no internal/staff fields) | ☐ |
| 18.4 | **Active Tickets Tracker** | Lists the client's tickets with status badges | ☐ |
| 18.5 | **File Service Ticket** form: title + select a project + type + priority + details → Submit | Ticket filed (`POST /api/tasks`); appears in the tracker; success toast | ☐ |
| 18.6 | Submit with no project selected | Submit disabled / blocked (project is required) | ☐ |
| 18.7 | Click a ticket | Opens its details modal | ☐ |
| 18.8 | Try to open `/dashboard/director` or `/dashboard/employee` | Redirected away | ☐ |
| 18.9 | Client has **no** Lock/Search/Director controls in the navbar | Confirmed (those are staff-only) | ☐ |

---

## 19. Cross-cutting checks

| # | Area | Step | Expected | ✓ |
|---|------|------|----------|---|
| 19.1 | **Role routing** | As Employee, visit `/dashboard/director` | Redirected to `/dashboard/employee` | ☐ |
| 19.2 | **Session persistence** | Refresh any dashboard (F5) | Stays logged in; component re-renders | ☐ |
| 19.3 | **Real-time** | Two browsers: a task moved by Director updates the Employee board | Updates without refresh | ☐ |
| 19.4 | **Error boundaries** | (Dev) force a section error | A section shows a contained error, not a white screen | ☐ |
| 19.5 | **PWA** | In Chrome, check "Install app" / offline | Service worker registered; installable | ☐ |
| 19.6 | **Security headers** | DevTools → Network → `/login` response | `X-Frame-Options`, `X-Content-Type-Options: nosniff` present | ☐ |

---

## 20. Quick API spot-checks (optional, per role)

Get a token, then hit the API (full matrix in [`TESTING_GUIDE.md`](TESTING_GUIDE.md) §8 and [`docs/api.md`](docs/api.md)):
```bash
SUPABASE_URL="https://vkmhayiyrybovmyerhje.supabase.co"
ANON_KEY="<NEXT_PUBLIC_SUPABASE_ANON_KEY from .env.local>"
TOKEN=$(curl -s "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo.director@demo.kai-os.local","password":"DemoDirector#2026"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

BASE="http://localhost:3000"
curl -s "$BASE/api/me" -H "Authorization: Bearer $TOKEN"                 # 200 + profile
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/api/payroll"             # director 200 / employee 403 / none 401
```

| Endpoint | No token | Employee | Client | Director |
|----------|----------|----------|--------|----------|
| `POST /api/tasks` | 401 | 403 | 403 | 201 |
| `GET /api/payroll` | 401 | 403 | 403 | 200 |
| `GET /api/admin/live-stats` | 401 | 403 | 403 | 200 |
| `POST /api/admin/clients/provision` | 401 | 403 | 403 | 200/201 |

---

## 21. Known issue to verify after fix

Rate limiting currently **fails open** in the live DB until the corrected `check_rate_limit()` function
is re-applied (the SQL fix is in `database/migrations/006_rate_limit_counters.sql`). After applying it
in the Supabase SQL editor, repeatedly hammering a rate-limited endpoint (e.g. `POST /api/auth/register`)
should return **429**. See [`TESTING_GUIDE.md`](TESTING_GUIDE.md) §10 for the exact steps.

---

*Every component above maps to a real file under `src/components/`. If a step's UI label differs from what you see, the code is the source of truth — file an issue with the screenshot.*
