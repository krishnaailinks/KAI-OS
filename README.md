# KAI-OS — Krishna AI Links Pvt. Ltd.

> **Enterprise Management Console** — Role-based operations platform for directors, employees, and clients.

![Build](https://img.shields.io/badge/build-passing-brightgreen)
![Tests](https://img.shields.io/badge/tests-passing-brightgreen)
![Version](https://img.shields.io/badge/version-0.1.0-blue)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features by Role](#features-by-role)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Project Structure](#project-structure)
- [Deployment](#deployment)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

KAI-OS is a full-featured enterprise management console built for **Krishna AI Links Pvt. Ltd.** It provides a unified dashboard for task management, project tracking, attendance, daily reporting, payroll, invoicing, team messaging, and AI-powered task tagging — all secured by role-based access control and Supabase Row Level Security.

**Who it's for:**
- **Directors** — manage projects, tasks, payroll, permissions, invoices, and view audit logs + live stats
- **Employees** — track tasks, log attendance, submit daily reports, update profiles, and chat with the team
- **Clients** — view project status, invoices, and communication (portal)

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (PWA)                        │
│         Next.js App Router + React 19 + Tailwind v4     │
├─────────────────────────────────────────────────────────┤
│                    Next.js API Layer                     │
│   ┌─────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │ Auth (JWT)  │  │ Rate Limiter │  │ Zod Validation│  │
│   └──────┬──────┘  └──────┬───────┘  └──────┬───────┘  │
│          │                │                  │          │
│   ┌──────┴────────────────┴──────────────────┴──────┐   │
│   │          Supabase Client (server-side)          │   │
│   │    Service Role Key → full database access      │   │
│   └─────────────────────┬───────────────────────────┘   │
├─────────────────────────┼───────────────────────────────┤
│                  ┌──────┴──────┐                        │
│                  │  Supabase   │                        │
│                  │ ┌─────────┐ │                        │
│                  │ │PostgreSQL│ │ (RLS + triggers)      │
│                  │ ├─────────┤ │                        │
│                  │ │ Auth    │ │ (JWT sessions)         │
│                  │ ├─────────┤ │                        │
│                  │ │Realtime │ │ (messaging, presence)  │
│                  │ └─────────┘ │                        │
│                  └─────────────┘                        │
├─────────────────────────────────────────────────────────┤
│  External: Sentry (error tracking), Gemini AI (tagging) │
└─────────────────────────────────────────────────────────┘
```

- **Next.js 16** (App Router) with standalone output for deployment flexibility
- **Supabase** provides authentication, PostgreSQL database, real-time subscriptions, and Row Level Security
- **Tailwind CSS v4** for utility-first styling
- **PWA** via `@ducanh2912/next-pwa` for offline-capable progressive web app
- **Docker** multi-stage build for production deployments
- **Sentry** for error monitoring and performance tracking
- **Google Gemini 2.0 Flash** for AI-powered task priority/tool tagging

---

## Features by Role

### Director
- Full task management (CRUD, approve/reject updates, auto-invoicing on completion)
- Project lifecycle management with document generation
- Payroll execution with receipt generation
- Invoice tracking (unpaid/paid/overdue)
- Personnel permissions management (video, audit, lockout)
- View all employee attendance and daily reports
- System audit log viewer
- Live dashboard statistics
- AI-powered task tagging

### Employee
- View and update assigned tasks (column, progress)
- Clock in/out with daily attendance tracking
- Submit daily work reports
- Update personal profile (name, phone, address, avatar)
- Team messaging across channels
- View own payroll records

### Client
- View project status and associated tasks
- View invoices
- Portal-based communication with the team

---

## Tech Stack

| Layer              | Technology                                         |
|--------------------|----------------------------------------------------|
| Framework          | Next.js 16 (App Router)                            |
| Language           | TypeScript 5                                       |
| UI                 | React 19, Tailwind CSS v4, Framer Motion, Recharts |
| Icons              | Lucide React                                       |
| Drag & Drop        | @hello-pangea/dnd                                  |
| Database           | PostgreSQL (via Supabase)                          |
| Auth               | Supabase Auth (JWT) + Row Level Security           |
| Validation         | Zod v4                                             |
| AI                 | Google Generative AI (Gemini 2.0 Flash)            |
| Error Tracking     | Sentry                                             |
| PWA                | @ducanh2912/next-pwa                               |
| Testing            | Jest, Playwright, Testing Library                  |
| Containerization   | Docker (multi-stage)                                |
| CI/CD              | GitHub Actions                                     |

---

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project (free tier works)
- (Optional) Google Gemini API key for AI tagging

### Clone & Install

```bash
git clone https://github.com/krishnaailinks/KAI-OS.git
cd kai-os
npm install
```

### Environment Setup

Copy the example env file and fill in your values:

```bash
cp .env.local.example .env.local
```

Required variables:

| Variable                          | Description                        |
|-----------------------------------|------------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL`         | Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`    | Supabase anonymous key (public)     |
| `SUPABASE_SERVICE_ROLE_KEY`        | Service role key (server-only)      |
| `DIRECTOR_REGISTRATION_CODE`       | Secret code for director sign-up    |

Optional variables:

| Variable              | Description                     |
|-----------------------|---------------------------------|
| `GEMINI_API_KEY`       | Google Gemini key for AI tagging |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN for error tracking  |

### Database Setup

Run `database/schema.sql` in your Supabase SQL editor to create all tables, indexes, triggers, and RLS policies.

### Run Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Create a Founder Account

```bash
export NEXT_PUBLIC_SUPABASE_URL=...
export SUPABASE_SERVICE_ROLE_KEY=...
export FOUNDER_PASSWORD=your-strong-password
node scripts/createAdmin.js
```

---

## Project Structure

```
kai-os/
├── .github/workflows/       # CI/CD pipelines (lint, typecheck, test, e2e)
├── database/
│   └── schema.sql           # Full PostgreSQL schema + RLS policies + triggers
├── docs/
│   ├── api.md               # API endpoint documentation
│   └── deployment.md        # Deployment guide
├── public/                  # Static assets, PWA manifest, service worker
├── scripts/
│   ├── backup-db.sh         # Database backup script (pg_dump + gzip)
│   └── createAdmin.js       # Founder account creation script
├── src/
│   ├── __tests__/           # Unit tests (Jest)
│   ├── app/
│   │   ├── api/             # API route handlers (Next.js App Router)
│   │   │   ├── admin/live-stats/
│   │   │   ├── ai/tagging/
│   │   │   ├── attendance/
│   │   │   ├── audit/
│   │   │   ├── auth/register/
│   │   │   ├── daily-reports/
│   │   │   ├── health/
│   │   │   ├── invoices/
│   │   │   ├── me/
│   │   │   ├── messages/
│   │   │   ├── payroll/
│   │   │   ├── permissions/
│   │   │   ├── profiles/
│   │   │   ├── projects/
│   │   │   └── tasks/
│   │   ├── dashboard/       # Dashboard pages (director, employee, client)
│   │   └── layout.tsx       # Root layout
│   ├── components/          # Shared React components
│   ├── lib/
│   │   ├── server/
│   │   │   ├── auth.ts      # Server-side auth helpers (authenticateRequest, requireDirector, etc.)
│   │   │   └── supabase.ts  # Supabase client factories
│   │   ├── security.ts      # Rate limiting, CSRF, pagination, local date helpers
│   │   └── validation.ts    # Zod schemas for all API request bodies
│   ├── proxy.ts              # Next.js middleware proxy + security headers + CSP
│   └── types/
│       └── dashboard.ts     # TypeScript type definitions
├── tests/                   # E2E tests (Playwright)
├── .dockerignore
├── .env.local.example
├── .gitignore
├── docker-compose.yml       # Production docker-compose with healthcheck
├── Dockerfile               # Multi-stage production Docker build
├── next.config.ts           # Next.js config (PWA, Sentry, standalone output)
├── package.json
├── server.js                # Custom server for Hostinger/cPanel deployment
└── tsconfig.json
```

---

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project on [vercel.com](https://vercel.com)
3. Add environment variables (see below)
4. Deploy — auto-builds on every push

### Environment Variables (Vercel)

Go to **Vercel Dashboard → Project → Settings → Environment Variables → Production** and set:

| Variable | Value | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://vkmhayiyrybovmyerhje.supabase.co` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `sb_publishable_NTV0o_GGH4cqbbk0HVCUkw_6i92nzBk` | Supabase anon (public) key |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGci...` (full key in .env.local) | Service role key — server only |
| `GEMINI_API_KEY` | `AIzaSyCZYYIBg1PTBwGH4U8l2YUOuFrV5RF35r4` | Google Gemini for AI tagging |
| `DIRECTOR_REGISTRATION_CODE` | `kai-admin-2026` | Secret code for director sign-up |
| `SENTRY_AUTH_TOKEN` | `sntrys_eyJpYXQi...` (full token in .env.local) | Sentry source map uploads |
| `NEXT_PUBLIC_SITE_URL` | `https://kai-os-lake.vercel.app` | Production URL for OG images |

> After adding variables, hit **Redeploy** to apply.

### Other Options

See [docs/deployment.md](docs/deployment.md) for:

- **Docker** — Build and run with `docker-compose`
- **Hostinger cPanel** — Deploy via Node.js app with Phusion Passenger using `server.js`
- **Database** — Apply schema and run migrations
- **CI/CD** — GitHub Actions pipelines (lint, typecheck, test, e2e)
- **Backup** — Automated PostgreSQL backups via `scripts/backup-db.sh`
- **Monitoring** — Sentry error tracking and `/api/health` endpoint
- **Security** — Key rotation, CSP headers, rate limiting, CSRF tokens

---

## Contributing

1. Branch from `develop`: `git checkout -b feature/your-feature`
2. Make changes and ensure lint/types/tests pass: `npm run lint && npm run build && npm test`
3. Open a pull request against `main`
4. PRs require passing CI checks (lint, typecheck, test, e2e)

---

## License

Proprietary — Krishna AI Links Pvt. Ltd. All rights reserved.
