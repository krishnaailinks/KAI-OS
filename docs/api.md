# KAI-OS API Reference

Base URL: `https://your-domain.com` (or `http://localhost:3000` for development)

All API routes are prefixed with `/api`. Authenticated endpoints require a `Bearer` token in the `Authorization` header obtained from Supabase Auth.

---

## Authentication

Most endpoints require a valid Supabase session token. Pass it as:

```
Authorization: Bearer <supabase-access-token>
```

Token is obtained by logging in via `supabase.auth.signInWithPassword()` on the client.

---

## Common Query Parameters

| Param    | Type   | Description                                      | Applies To                         |
|----------|--------|--------------------------------------------------|------------------------------------|
| `page`   | int    | Page number (1-indexed, default: 1)               | All paginated endpoints            |
| `limit`  | int    | Items per page (capped per endpoint, see notes)   | All paginated endpoints            |
| `tz`     | string | UTC offset in minutes (e.g., `-300` for EST)      | attendance, daily-reports, live-stats |

---

## Endpoints

### Health Check

```
GET /api/health
```

No auth required. Returns server status, uptime, memory usage, and Node version.

**Response `200`**

```json
{
  "status": "healthy",
  "uptime": 123456,
  "uptimeFormatted": "1d 10h 17m",
  "nodeVersion": "v20.x.x",
  "memory": {
    "heapUsed": "50.2 MB",
    "heapTotal": "70.1 MB",
    "rss": "120.5 MB"
  },
  "timestamp": "2026-06-24T12:00:00.000Z"
}
```

---

### Register

```
POST /api/auth/register
```

No auth required. Rate-limited: 5 requests per minute per IP.

**Request Body**

```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "Str0ng!Pass",
  "accountType": "employee",
  "accessCode": "director-secret-code"
}
```

| Field         | Type   | Required | Description                                      |
|---------------|--------|----------|--------------------------------------------------|
| name          | string | yes      | 1–200 characters                                 |
| email         | string | yes      | Valid email, max 320 characters                  |
| password      | string | yes      | Min 8 chars, incl. uppercase, number, and symbol |
| accountType   | string | yes      | `"employee"` or `"director"`                     |
| accessCode    | string | no       | Required if `accountType` is `"director"`        |

**Response `201`**

```json
{
  "user_id": "uuid-here",
  "role": "employee"
}
```

---

### Get Current User

```
GET /api/me
```

Auth required. Returns the authenticated user's profile.

**Response `200`**

```json
{
  "profile": {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "employee",
    "status": "Online"
  }
}
```

---

### Tasks

#### List Tasks

```
GET /api/tasks?page=1&limit=100
```

Auth required. Paginated (max limit: 500, default: 100).

Returns tasks as a record keyed by task ID (for frontend convenience).

**Response `200`**

```json
{
  "tasks": {
    "TASK-ABC1-1234": {
      "id": "TASK-ABC1-1234",
      "title": "Build login page",
      "description": "...",
      "priority": "STANDARD",
      "progress": 50,
      "column_id": "IN_PROGRESS",
      "status": "approved",
      "project_id": "uuid-or-null",
      "budget": 0,
      "tool_stack": ["React", "Node.js"],
      "task_type": "feature",
      "assignee_id": "uuid-or-null",
      "created_at": "...",
      "updated_at": "..."
    }
  },
  "total": 42
}
```

#### Create Task

```
POST /api/tasks
```

Auth required. Director role required. Rate-limited: 30 requests per minute per IP.

**Request Body**

```json
{
  "title": "Implement dark mode",
  "description": "Add theme toggle",
  "priority": "STANDARD",
  "progress": 0,
  "column_id": "TODO",
  "budget": 500.00,
  "tool_stack": ["React", "Tailwind"],
  "project_id": "uuid-optional"
}
```

| Field         | Type     | Required | Default      | Description                               |
|---------------|----------|----------|--------------|-------------------------------------------|
| title         | string   | yes      | —            | 1–500 chars                               |
| description   | string   | no       | `""`         | Max 5000 chars                            |
| priority      | string   | no       | `"STANDARD"` | LOW, STANDARD, ELEVATED, CRITICAL         |
| progress      | int      | no       | 0            | 0–100                                     |
| column_id     | string   | no       | `"TODO"`     | TODO, IN_PROGRESS, IN_REVIEW, COMPLETED   |
| budget        | number   | no       | 0            | Max 999,999,999.99                        |
| tool_stack    | string[] | no       | `[]`         | Array of tool names                       |
| project_id    | string   | no       | null         | UUID of a project                         |
| task_type     | string   | no       | —            | feature, bug, task                        |
| git_branch    | string   | no       | —            | Max 500 chars                             |
| git_commit    | string   | no       | —            | Max 500 chars                             |
| git_pr        | string   | no       | —            | Max 500 chars                             |
| bug_severity  | string   | no       | —            | low, medium, high, critical               |
| bug_environment| string  | no       | —            | development, staging, production          |
| bug_steps     | string   | no       | —            | Max 5000 chars                            |
| bug_expected  | string   | no       | —            | Max 2000 chars                            |
| bug_actual    | string   | no       | —            | Max 2000 chars                            |
| logged_hours  | number   | no       | —            | 0–10000                                   |

**Response `201`**

```json
{
  "id": "TASK-ABC1-1234",
  "title": "Implement dark mode",
  "...": "..."
}
```

---

### Update Task

```
PATCH /api/tasks/:id
```

Auth required. Director can update all fields. Employee can only update `column_id` and `progress` (triggers `pending_review` status).

**Request Body**

```json
{
  "column_id": "IN_REVIEW",
  "progress": 80,
  "action": "approve"
}
```

| Field       | Type   | Required | Description                                             |
|-------------|--------|----------|---------------------------------------------------------|
| title       | string | no       | 1–500 chars (director only)                             |
| description | string | no       | Max 5000 chars (director only)                          |
| priority    | string | no       | LOW, STANDARD, ELEVATED, CRITICAL (director only)       |
| progress    | int    | no       | 0–100                                                   |
| column_id   | string | no       | TODO, IN_PROGRESS, IN_REVIEW, COMPLETED                 |
| budget      | number | no       | (director only)                                         |
| action      | string | no       | `"approve"` or `"reject"` (director only, clears pending_updates) |
| status      | string | no       | (director only)                                         |

When a task moves to `COMPLETED` with a `budget > 0`, an invoice is auto-generated.

**Response `200`**

```json
{
  "id": "TASK-ABC1-1234",
  "status": "approved",
  "column_id": "IN_REVIEW",
  "...": "..."
}
```

---

### Projects

#### List Projects

```
GET /api/projects?page=1&limit=20
```

Auth required. Paginated (max limit: 100, default: 20). Includes task count per project.

**Response `200`**

```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Website Redesign",
      "description": "...",
      "status": "Active",
      "start_date": "2026-01-01",
      "end_date": null,
      "created_by": "uuid",
      "tasks": [{ "count": 12 }],
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "total": 5
}
```

#### Create Project

```
POST /api/projects
```

Auth required. Director role required.

**Request Body**

```json
{
  "name": "Website Redesign",
  "description": "Complete overhaul",
  "status": "Planning",
  "start_date": "2026-01-01",
  "end_date": "2026-06-30"
}
```

| Field       | Type   | Required | Default      | Description                        |
|-------------|--------|----------|--------------|------------------------------------|
| name        | string | yes      | —            | 1–500 chars                        |
| description | string | no       | —            | Max 5000 chars                     |
| status      | string | no       | `"Planning"` | Planning, Active, On Hold, Completed |
| start_date  | string | no       | —            | ISO date string                    |
| end_date    | string | no       | —            | ISO date string                    |

**Response `201`**

```json
{
  "project": { "id": "uuid", "name": "Website Redesign", "..." }
}
```

---

### Generate Project Document

```
POST /api/projects/:id/generate-doc
```

Auth required. Generates a project lifecycle markdown document including task breakdown, status, progress, assignee info, and audit trail.

**Response `200`**

```json
{
  "document_content": "# Project Lifecycle Document: Website Redesign\n\nGenerated on: ...\n..."
}
```

---

### Attendance

#### Get Attendance

```
GET /api/attendance?page=1&limit=50&all=true&startDate=2026-01-01&endDate=2026-06-30&tz=-300
```

Auth required. Paginated (max limit: 200, default: 50).

| Param     | Type    | Required | Description                                    |
|-----------|---------|----------|------------------------------------------------|
| all       | boolean | no       | If `true`, director sees all employees' logs   |
| startDate | string  | no       | Filter start (YYYY-MM-DD)                     |
| endDate   | string  | no       | Filter end (YYYY-MM-DD)                       |
| tz        | string  | no       | UTC offset in minutes                          |

Without `?all=true`, returns only the current user's attendance for today.

**Response `200`**

```json
{
  "attendance": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "date": "2026-06-24",
      "check_in": "2026-06-24T09:00:00.000Z",
      "check_out": "2026-06-24T17:30:00.000Z",
      "status": "present",
      "notes": null
    }
  ],
  "total": 1
}
```

#### Record Attendance

```
POST /api/attendance
```

Auth required. Employees clock in/out.

**Request Body**

```json
{
  "action": "check_in",
  "tz": "-300"
}
```

| Field  | Type   | Required | Description                  |
|--------|--------|----------|------------------------------|
| action | string | yes      | `"check_in"` or `"check_out"` |
| tz     | string | no       | UTC offset in minutes        |

**Response `200`**

```json
{
  "attendance": {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2026-06-24",
    "check_in": "2026-06-24T09:00:00.000Z",
    "status": "present"
  }
}
```

---

### Daily Reports

#### List Reports

```
GET /api/daily-reports?page=1&limit=50&all=true&startDate=2026-01-01&endDate=2026-06-30&tz=-300
```

Auth required. Paginated (max limit: 200, default: 50).

| Param     | Type    | Required | Description                                  |
|-----------|---------|----------|----------------------------------------------|
| all       | boolean | no       | If `true`, director sees all employees' logs |
| startDate | string  | no       | Filter start (YYYY-MM-DD)                   |
| endDate   | string  | no       | Filter end (YYYY-MM-DD)                     |
| tz        | string  | no       | UTC offset in minutes                        |

Without `?all=true`, returns only the current user's report for today.

**Response `200`**

```json
{
  "reports": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "date": "2026-06-24",
      "report_text": "Completed login page...",
      "created_at": "..."
    }
  ],
  "total": 1
}
```

#### Submit Report

```
POST /api/daily-reports
```

Auth required. Creates or updates the daily report for the current user (upserts by `user_id` + `date`).

**Request Body**

```json
{
  "report_text": "Worked on dashboard UI...",
  "tz": "-300"
}
```

| Field       | Type   | Required | Description               |
|-------------|--------|----------|---------------------------|
| report_text | string | yes      | 1–10000 characters        |
| tz          | string | no       | UTC offset in minutes     |

**Response `200`**

```json
{
  "report": {
    "id": "uuid",
    "user_id": "uuid",
    "date": "2026-06-24",
    "report_text": "Worked on dashboard UI..."
  }
}
```

---

### Messages

#### List Messages

```
GET /api/messages?channel=general
```

Auth required. Not paginated (returns last 100 messages).

| Param   | Type   | Required | Description                                     |
|---------|--------|----------|-------------------------------------------------|
| channel | string | no       | Channel name: `general` (default), `engineering`, `alerts`, `nishant`, `alice` |

**Response `200`**

```json
{
  "messages": [
    {
      "id": "uuid",
      "channel_id": "general",
      "user_id": "uuid",
      "author_name": "John Doe",
      "body": "Hello team!",
      "created_at": "..."
    }
  ]
}
```

#### Send Message

```
POST /api/messages
```

Auth required.

**Request Body**

```json
{
  "channel_id": "general",
  "body": "Hello team!"
}
```

| Field      | Type   | Required | Description                          |
|------------|--------|----------|--------------------------------------|
| channel_id | string | no       | Defaults to `"general"`              |
| body       | string | yes      | 1–4000 characters                    |

**Response `201`**

```json
{
  "message": {
    "id": "uuid",
    "channel_id": "general",
    "user_id": "uuid",
    "author_name": "John Doe",
    "body": "Hello team!",
    "created_at": "..."
  }
}
```

---

### Payroll

#### List Payroll

```
GET /api/payroll?page=1&limit=20
```

Auth required. Director role required. Paginated (max limit: 100, default: 20).

**Response `200`**

```json
{
  "payroll": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "month_year": "2026-06",
      "total_hours": 160,
      "base_salary": 5000,
      "calculated_salary": 5000,
      "status": "Pending",
      "name": "John Doe"
    }
  ],
  "total": 10
}
```

#### Execute Payroll

```
POST /api/payroll
```

Auth required. Director role required. Rate-limited: 5 requests per minute per IP. Marks all `Pending`/`Approved` payroll records as `Paid`.

**Request Body**

```json
{
  "confirm": true,
  "maxTotal": 50000
}
```

| Field    | Type    | Required | Description                                     |
|----------|---------|----------|-------------------------------------------------|
| confirm  | boolean | yes      | Must be `true` to execute                       |
| maxTotal | number  | no       | Safety cap — fails if total exceeds this amount |

**Response `200`**

```json
{
  "paid_count": 5,
  "total_disbursed": 25000,
  "receipt_content": "# KAI-OS Payroll Execution Receipt\n..."
}
```

---

### Invoices

```
GET /api/invoices?page=1&limit=20
```

Auth required. Director role required. Paginated (max limit: 100, default: 20). Includes client info.

**Response `200`**

```json
{
  "invoices": [
    {
      "id": "uuid",
      "invoice_number": "INV-2026-1234",
      "task_id": "TASK-...",
      "amount": 500,
      "status": "unpaid",
      "generated_at": "...",
      "due_date": "...",
      "clients": {
        "company_name": "Acme Corp",
        "contact_email": "billing@acme.com"
      }
    }
  ],
  "total": 3
}
```

---

### Profiles

#### List Employee Profiles

```
GET /api/profiles?page=1&limit=50
```

Auth required. Paginated (max limit: 200, default: 50). Directors see all fields; other roles see limited fields.

**Response `200`**

```json
{
  "profiles": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "full_name": "John Doe",
      "job_title": "Developer",
      "phone_number": "+1234567890",
      "salary_amount": 5000,
      "salary_frequency": "Monthly",
      "avatar_url": null,
      "address": "...",
      "joined_at": "..."
    }
  ],
  "total": 10
}
```

#### Update Profile

```
PATCH /api/profiles/:userId
```

Auth required. Users can update their own profile. Directors can update any profile (including salary and role).

**Request Body**

```json
{
  "full_name": "John Updated",
  "phone_number": "+9876543210",
  "job_title": "Senior Developer",
  "salary_amount": 6000,
  "address": "123 Main St",
  "avatar_url": "https://..."
}
```

| Field         | Type   | Required | Description                         |
|---------------|--------|----------|-------------------------------------|
| full_name     | string | no       | 1–200 chars                         |
| job_title     | string | no       | Max 200 chars (director-only write) |
| salary_amount | number | no       | Max 999,999,999.99 (director-only)  |
| phone_number  | string | no       | Max 50 chars                        |
| address       | string | no       | Max 500 chars                       |
| avatar_url    | string | no       | Valid URL, max 2000 chars           |

**Response `200`**

```json
{
  "profile": { "id": "uuid", "user_id": "uuid", "...": "..." }
}
```

---

### Permissions

#### List Permissions

```
GET /api/permissions?page=1&limit=50
```

Auth required. Directors see all profiles with their permissions. Other users see only their own permissions.

**Response `200`**

```json
{
  "profiles": [
    {
      "id": "uuid",
      "full_name": "John Doe",
      "email": "john@example.com",
      "role": "employee",
      "personnel_permissions": {
        "user_id": "uuid",
        "allow_video": false,
        "allow_audit": false,
        "system_lockout": false
      }
    }
  ],
  "total": 10
}
```

Non-director response:

```json
{
  "permissions": {
    "allow_video": false,
    "allow_audit": false,
    "system_lockout": false
  }
}
```

#### Update Permissions

```
PATCH /api/permissions/:userId
```

Auth required. Director role required.

**Request Body**

```json
{
  "allow_video": true,
  "allow_audit": false,
  "system_lockout": true
}
```

All fields optional. Only included fields are updated.

**Response `200`**

```json
{
  "user_id": "uuid",
  "allow_video": true,
  "allow_audit": false,
  "system_lockout": true,
  "updated_at": "..."
}
```

---

### Audit Logs

#### List Audit Logs

```
GET /api/audit?page=1&limit=50
```

Auth required. Director role required. Paginated (max limit: 200, default: 50).

**Response `200`**

```json
{
  "logs": [
    {
      "id": "uuid",
      "timestamp": "...",
      "event_type": "task",
      "message": "Task TASK-ABC1-1234 created",
      "triggered_by": "SYSTEM",
      "severity": "low"
    }
  ],
  "total": 100
}
```

#### Create Audit Log

```
POST /api/audit
```

Auth required. Any authenticated user can create an audit entry.

**Request Body**

```json
{
  "event_type": "custom_event",
  "message": "Something happened",
  "triggered_by": "optional-user-id",
  "severity": "medium"
}
```

| Field        | Type   | Required | Description                              |
|--------------|--------|----------|------------------------------------------|
| event_type   | string | yes      | 1–200 chars                              |
| message      | string | yes      | 1–5000 chars                             |
| triggered_by | string | no       | Defaults to current user ID              |
| severity     | string | no       | `low` (default), `medium`, `high`, `critical` |

**Response `201`**

```json
{
  "id": "uuid",
  "event_type": "custom_event",
  "...": "..."
}
```

---

### Admin Live Stats

```
GET /api/admin/live-stats?tz=-300
```

Auth required. Director role required. Returns aggregate dashboard statistics.

**Response `200`**

```json
{
  "stats": {
    "totalEmployees": 15,
    "activeProjects": 3,
    "tasksCompletedToday": 5,
    "openInvoices": 12500,
    "totalPayroll": 50000,
    "serverStatus": "Healthy",
    "securityIncidents": 0
  }
}
```

---

### AI Task Tagging

```
POST /api/ai/tagging
```

Auth required. Uses Google Gemini to suggest priority and tool stack for a task. Falls back to defaults if `GEMINI_API_KEY` is not configured.

**Request Body**

```json
{
  "title": "Build user authentication",
  "description": "Implement JWT-based login and signup"
}
```

| Field       | Type   | Required | Description  |
|-------------|--------|----------|--------------|
| title       | string | yes      | Task title   |
| description | string | yes      | Task summary |

**Response `200`**

```json
{
  "priority": "HIGH",
  "tools": ["React", "Node.js", "JWT"]
}
```

Fallback (no API key):

```json
{
  "error": "GEMINI_API_KEY is not configured.",
  "priority": "STANDARD",
  "tools": ["React", "Node.js"]
}
```

---

## Error Responses

All endpoints return errors in a consistent shape:

```json
{
  "error": "Descriptive error message"
}
```

| HTTP Status | Meaning                                      |
|-------------|----------------------------------------------|
| 400         | Validation error or bad request              |
| 401         | Missing or invalid bearer token              |
| 403         | Insufficient role permissions                |
| 429         | Rate limit exceeded (check `Retry-After` header) |
| 500         | Internal server error                        |
