/**
 * Shared helpers for KAI-OS E2E tests.
 *
 * Every spec file imports from here instead of duplicating logic.
 */
import fs from 'fs';
import path from 'path';
import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

// ─── Test-user credentials ────────────────────────────────────────────────────

export const DIRECTOR = {
  email:    'test.director@kai-os.test',
  password: 'TestKaiDirector2026!',
};
export const EMPLOYEE = {
  email:    'test.employee@kai-os.test',
  password: 'TestKaiEmployee2026!',
};
export const EMPLOYEE2 = {
  email:    'test.employee2@kai-os.test',
  password: 'TestKaiEmployee2026!',
};
export const CLIENT = {
  email:    'test.client@kai-os.test',
  password: 'TestKaiClient2026!',
};

// ─── Token helpers ────────────────────────────────────────────────────────────

/** Tokens written by global-setup; loaded once per process. */
let _cachedTokens: Record<string, string> | null = null;

export function getTokens(): Record<string, string> {
  if (!_cachedTokens) {
    const p = path.resolve(__dirname, '.tokens.json');
    _cachedTokens = JSON.parse(fs.readFileSync(p, 'utf-8'));
  }
  return _cachedTokens!;
}

/** Auth headers for the named role. */
export function authHeaders(role: 'director' | 'employee' | 'employee2' | 'client') {
  const token = getTokens()[role];
  if (!token) throw new Error(`No token for role "${role}". Did global-setup run?`);
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** Fetch tokens fresh from Supabase (use in beforeAll when you need a guaranteed-fresh token). */
export async function fetchToken(
  request: APIRequestContext,
  creds: { email: string; password: string },
): Promise<string> {
  const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const ANON_KEY      = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const res = await request.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    data:    { email: creds.email, password: creds.password },
  });
  const data = await res.json();
  if (!data.access_token) throw new Error(`Login failed for ${creds.email}: ${JSON.stringify(data)}`);
  return data.access_token;
}

// ─── Browser login helper ────────────────────────────────────────────────────

/**
 * Opens a new page in `context`, logs in with `creds`, and waits for the
 * dashboard sidebar to confirm the DashboardContainer has fully rendered.
 */
export async function loginAs(
  context: BrowserContext,
  creds: { email: string; password: string },
): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/login');

  // Email field uses type="text" — match by placeholder
  await page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.locator('button[type="submit"]').click();

  await page.waitForURL(/\/dashboard\//, { timeout: 25_000 });
  // Sidebar button rendered by DashboardContainer (non-client path)
  await page.locator('[data-testid="nav-team-hub"]').waitFor({ state: 'visible', timeout: 20_000 });

  return page;
}

// ─── Unique name generator ────────────────────────────────────────────────────

/** Generate a unique, slug-safe name for test entities. */
export function uid(prefix = 'test'): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Supabase admin helper ────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SK           = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const adminHeaders = {
  apikey:         SK,
  Authorization:  `Bearer ${SK}`,
  'Content-Type': 'application/json',
};

/** Direct Supabase REST call using the service-role key (bypasses RLS). */
export async function supabaseAdmin(
  table: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  query = '',
  body?: object,
): Promise<unknown> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${query}`, {
    method,
    headers: {
      ...adminHeaders,
      ...(body ? { Prefer: 'return=representation' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) throw new Error(`supabaseAdmin ${method} ${table}${query} → ${res.status}: ${await res.text()}`);
  return res.json().catch(() => null);
}

/** Look up the DB user_id for a given email. */
export async function getUserId(email: string): Promise<string> {
  const res  = await fetch(
    `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`,
    { headers: adminHeaders },
  );
  const data = await res.json();
  const user = (data.users ?? []).find((u: { email: string }) => u.email === email);
  if (!user) throw new Error(`getUserId: user not found for ${email}`);
  return user.id;
}

/** Force-set a permission field for a test user. Restores on cleanup. */
export async function setPermission(
  userId: string,
  field: 'allow_video' | 'allow_audit' | 'system_lockout',
  value: boolean,
) {
  await fetch(
    `${SUPABASE_URL}/rest/v1/personnel_permissions?user_id=eq.${userId}`,
    {
      method:  'PATCH',
      headers: adminHeaders,
      body:    JSON.stringify({ [field]: value }),
    },
  );
}
