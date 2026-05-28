# KAI-OS

Production-oriented enterprise console for Krishna AI Links Pvt. Ltd. built with Next.js, Supabase, Tailwind CSS, PWA support, and Gemini-powered task tagging.

## Tech Stack

- Next.js App Router with React and TypeScript
- Supabase Auth, Postgres, Realtime, and Row Level Security
- Tailwind CSS v4
- Playwright and Jest
- PWA service worker via `@ducanh2912/next-pwa`

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.local.example` and fill every required value.

3. Run `database/schema.sql` in the Supabase SQL editor.

4. Start development:

```bash
npm run dev
```

## Required Environment

`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are used by the browser client.

`SUPABASE_SERVICE_ROLE_KEY` is required by API routes for verified server-side writes. Never expose it to the client.

`DIRECTOR_REGISTRATION_CODE` controls director account creation and must be a private, high-entropy secret.

`GEMINI_API_KEY` is optional. Without it, AI task tagging returns a manual fallback.

## Production Checks

```bash
npm run lint
npm test -- --runInBand
npm run build
```

The API layer validates Supabase bearer tokens server-side; client-supplied role headers are not trusted.
