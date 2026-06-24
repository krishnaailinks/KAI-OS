# KAI-OS Deployment Guide

Deployment targets: **Docker** (production server) and **Hostinger cPanel** (shared hosting).

---

## Prerequisites

- Node.js 20+
- A Supabase project (with database, auth, and RLS configured)
- Docker and Docker Compose (for Docker deployment)
- Git access to the repository
- (Optional) Sentry account for error monitoring
- (Optional) Google Gemini API key for AI tagging

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in all values. The table below describes each variable.

| Variable                           | Required | Public/Private | Description                                        |
|------------------------------------|----------|----------------|----------------------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`         | yes      | public         | Supabase project URL (safe in browser)             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | yes      | public         | Supabase anon key (governed by RLS)                |
| `SUPABASE_SERVICE_ROLE_KEY`        | yes      | private        | Server-only. Full database admin access.           |
| `DIRECTOR_REGISTRATION_CODE`       | yes      | private        | High-entropy secret for director sign-up           |
| `FOUNDER_PASSWORD`                 | yes*     | private        | Used by `scripts/createAdmin.js` only              |
| `GEMINI_API_KEY`                   | no       | private        | Google Gemini key for AI task tagging              |
| `NEXT_PUBLIC_SENTRY_DSN`           | no       | public         | Sentry DSN for error monitoring                    |
| `HOST`                             | no       | private        | Bind address (default: `0.0.0.0`)                 |
| `PORT`                             | no       | private        | Listen port (default: `3000`)                     |

> **Security**: `SUPABASE_SERVICE_ROLE_KEY` and `DIRECTOR_REGISTRATION_CODE` must never be exposed to the client. Rotate them immediately if you suspect leakage.

---

## Docker Deployment

### Build

```bash
docker build -t kai-os:latest .
```

The Dockerfile uses a multi-stage build:

1. **deps** — Install production + dev dependencies
2. **builder** — Compile Next.js with `output: "standalone"`
3. **runner** — Minimal Alpine image with the compiled app

### Run

```bash
docker run -d \
  --name kai-os \
  -p 3000:3000 \
  --env-file .env.local \
  kai-os:latest
```

### Docker Compose (Recommended)

```bash
docker compose up -d
```

The `docker-compose.yml` includes:

- Healthcheck on `/api/health` (every 30s, 3 retries)
- `restart: unless-stopped`
- JSON-file logging (max 10 MB, 3 files)
- Auto-loads `.env.local`

Verify it's running:

```bash
curl http://localhost:3000/api/health
```

---

## Hostinger cPanel Deployment

KAI-OS ships with a `server.js` custom server for Node.js apps on shared hosting (Phusion Passenger).

### Steps

1. **Build locally** (or in a CI pipeline):

   ```bash
   npm ci
   npm run build
   ```

2. **Upload to Hostinger** via cPanel File Manager or FTP:

   Upload the entire project directory to `public_html/kai-os/` (or a subdomain root). Key files needed at minimum:

   ```
   .
   ├── .next/standalone/    # Compiled app
   ├── .next/static/        # Static assets
   ├── public/              # Public assets
   ├── node_modules/        # Production dependencies
   ├── server.js            # Custom server entry point
   ├── package.json
   └── .env.local           # Environment variables
   ```

3. **In cPanel**:
   - Go to **Setup Node.js App**
   - **Application mode**: `Production`
   - **Application root**: `/kai-os` (or wherever you uploaded)
   - **Application URL**: your domain or subdomain
   - **Application startup file**: `server.js`
   - **Passenger log file**: `passenger.log` (optional)
   - Save and start the app

4. **Verify**: Visit your domain. The app should serve the compiled Next.js application.

> **Note**: For Hostinger, ensure the `PORT` env variable is NOT hardcoded — Phusion Passenger supplies it. The `server.js` reads `process.env.PORT || 3000`.

---

## Database Setup

### Initial Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Paste the contents of `database/schema.sql`
4. Click **Run**

This creates all tables, indexes, triggers, RLS policies, and helper functions.

### Migration Strategy

KAI-OS does not currently use a migration framework. Schema changes should be:

1. Written as raw SQL in `database/` with a timestamp prefix (e.g., `2026-06-24_add_teams_table.sql`)
2. Applied manually via the Supabase SQL Editor
3. Committed to the repository for history

### Create Founder Account

After the schema is in place, create the initial director account:

```bash
export NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
export FOUNDER_PASSWORD=your-strong-password
node scripts/createAdmin.js
```

This creates a director with email `founder@krishna-ai.com` and the password you set.

---

## CI/CD (GitHub Actions)

The workflow at `.github/workflows/ci.yml` runs on pushes to `main`/`develop` and PRs to `main`.

### Jobs

| Job        | Command            | Description                         |
|------------|--------------------|-------------------------------------|
| `lint`     | `npm run lint`     | ESLint check                        |
| `typecheck`| `npm run build`    | TypeScript compilation check        |
| `test`     | `npm test`         | Jest unit tests                     |
| `e2e`      | `npx playwright test` | Playwright end-to-end tests      |

### Required Secrets/Variables

The E2E job requires these configured in the GitHub repository:

| Name                            | Type      | Source              |
|---------------------------------|-----------|---------------------|
| `NEXT_PUBLIC_SUPABASE_URL`       | variable  | Supabase dashboard  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`  | variable  | Supabase dashboard  |
| `SUPABASE_SERVICE_ROLE_KEY`      | secret    | Supabase dashboard  |

---

## Backup

The `scripts/backup-db.sh` script creates timestamped, gzipped PostgreSQL dumps.

### Usage

```bash
export SUPABASE_DB_URL="postgresql://user:password@host:6543/postgres"
./scripts/backup-db.sh
```

### Scheduled Backup (cron)

```cron
0 3 * * * cd /path/to/kai-os && ./scripts/backup-db.sh
```

This runs daily at 3 AM. Backups are stored in `./backups/` by default (override with `BACKUP_DIR` env var). Backups older than 30 days are automatically cleaned up.

### Database Connection String

In Supabase: **Project Settings → Database → Connection string (URI)**. Use the **Session pooler** URI with your database password.

---

## Monitoring

### Health Endpoint

`GET /api/health` returns:

- `status`: `"healthy"`
- `uptime`: server uptime in seconds
- `uptimeFormatted`: human-readable uptime
- `nodeVersion`: Node.js runtime version
- `memory`: heap used, heap total, RSS (in MB)
- `timestamp`: ISO timestamp

Use this endpoint for load balancer health checks or uptime monitoring (e.g., UptimeRobot, Better Uptime).

### Sentry

Sentry is configured via `next.config.ts` and the following files:

- `sentry.client.config.ts`
- `sentry.edge.config.ts`
- `sentry.server.config.ts`

To enable Sentry:

1. Create a project at [sentry.io](https://sentry.io)
2. Set `NEXT_PUBLIC_SENTRY_DSN` in `.env.local`
3. Optionally set `SENTRY_ORG` and `SENTRY_PROJECT` (default to `krishna-ai-links` and `kai-os`)
4. Source maps are uploaded during `npm run build`

Errors are tunneled through `/monitoring` to avoid ad-blocker interference.

### Docker Healthcheck

The `docker-compose.yml` includes a healthcheck that pings `/api/health` every 30 seconds. Use `docker ps` to see container health status.

---

## Security Checklist

- [ ] **Rotate keys before production**
  - `SUPABASE_SERVICE_ROLE_KEY` — rotate in Supabase dashboard
  - `DIRECTOR_REGISTRATION_CODE` — generate a new high-entropy string
  - `FOUNDER_PASSWORD` — use a strong, unique password
- [ ] **Verify Content Security Policy**
  - The middleware (`src/middleware.ts`) applies a strict CSP
  - Modify allowed origins if you add external scripts/fonts
- [ ] **Rate limiting**
  - Registration: 5 req/min per IP
  - Task creation: 30 req/min per IP
  - Payroll execution: 5 req/min per IP
  - Adjust values in route handlers if needed
- [ ] **CSRF protection**
  - `generateCsrfToken()` and `validateCsrfToken()` are available in `src/lib/security.ts`
- [ ] **Security headers**
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains`
  - `Permissions-Policy` restricts camera, microphone, geolocation
- [ ] **Supabase RLS**
  - All tables have Row Level Security enabled
  - Only directors can write to projects, tasks, permissions, invoices, and payroll
  - Employees can only update their own attendance, reports, and profile
- [ ] **No secrets in client code**
  - `SUPABASE_SERVICE_ROLE_KEY` is server-only
  - All API routes validate tokens server-side
- [ ] **HTTPS**
  - Enforce HTTPS at the load balancer or cPanel level
  - The CSP includes `upgrade-insecure-requests`
- [ ] **Database backups**
  - Schedule `scripts/backup-db.sh` via cron (see [Backup](#backup) section)
- [ ] **Sentry alerts**
  - Configure alert rules in Sentry for `high` and `critical` severity errors
  - The `/api/health` endpoint can be used for external uptime monitoring
