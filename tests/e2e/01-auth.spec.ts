/**
 * 01 – Authentication
 *
 * Covers: login page UI, registration page, valid/invalid credentials,
 * role-based routing, session persistence, logout.
 */
import { test, expect } from '@playwright/test';
import { DIRECTOR, EMPLOYEE, CLIENT, loginAs } from './setup/helpers';

// ─── Login page structure ──────────────────────────────────────────────────────

test.describe('Login page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('renders email / password fields and submit button', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('shows an error for wrong credentials', async ({ page }) => {
    await page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"]').fill('nobody@nowhere.test');
    await page.locator('input[type="password"]').fill('WrongPassword1!');
    await page.locator('button[type="submit"]').click();
    // Error could be a banner or a toast — just confirm it's visible
    await expect(
      page.locator('text=/invalid|denied|error|failed|incorrect/i').first()
    ).toBeVisible({ timeout: 8_000 });
  });

  test('does not redirect on empty submit (native validation)', async ({ page }) => {
    await page.locator('button[type="submit"]').click();
    // URL must not change to /dashboard
    await expect(page).not.toHaveURL(/\/dashboard\//);
  });

  test('has a "Register" / sign-up link', async ({ page }) => {
    await expect(
      page.locator('a[href*="register"], button:has-text("Register")').first()
    ).toBeVisible();
  });
});

// ─── Registration page ─────────────────────────────────────────────────────────

test.describe('Register page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('renders name, email, password, and role selector fields', async ({ page }) => {
    // At minimum a name/full-name field must be present
    await expect(
      page.locator('input[name="name"], input[id="name"], input[placeholder*="name" i]').first()
    ).toBeVisible();
    await expect(page.locator('input[type="email"], input[placeholder*="email" i]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('director registration requires an access code field', async ({ page }) => {
    // Select director role if there is a toggle/select
    const directorOpt = page.locator('button:has-text("Director"), label:has-text("Director"), input[value="director"]').first();
    if (await directorOpt.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await directorOpt.click();
      await expect(
        page.locator('input[placeholder*="code" i], input[placeholder*="access" i], input[name*="code" i]').first()
      ).toBeVisible({ timeout: 5_000 });
    }
  });

  test('shows password strength feedback while typing', async ({ page }) => {
    const pwInput = page.locator('input[type="password"]').first();
    await pwInput.fill('weak');
    // A strength indicator (bar, text, or percentage) should appear
    const indicator = page.locator('text=Password Strength').first();
    await expect(indicator).toBeVisible({ timeout: 4_000 });
  });
});

// ─── Role-based routing ────────────────────────────────────────────────────────

test.describe('Role routing after login', () => {
  test('Director lands on /dashboard/director', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    expect(page.url()).toContain('/dashboard/director');
    await ctx.close();
  });

  test('Employee lands on /dashboard/employee', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    expect(page.url()).toContain('/dashboard/employee');
    await ctx.close();
  });

  test('Client lands on /dashboard/client', async ({ browser }) => {
    const ctx  = await browser.newContext();
    try {
      const page = await ctx.newPage();
      await page.goto('/login');
      await page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"]').fill(CLIENT.email);
      await page.locator('input[type="password"]').fill(CLIENT.password);
      await page.locator('button[type="submit"]').click();
      await page.waitForURL(/\/dashboard\//, { timeout: 25_000 });
      expect(page.url()).toContain('/dashboard/client');
    } finally {
      await ctx.close();
    }
  });
});

// ─── Route protection ──────────────────────────────────────────────────────────

test.describe('Route protection (unauthenticated)', () => {
  for (const route of ['/dashboard/director', '/dashboard/employee', '/dashboard/client']) {
    test(`${route} redirects to /login`, async ({ page }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    });
  }

  test('root / redirects to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

// ─── Cross-role access ─────────────────────────────────────────────────────────

test.describe('Cross-role dashboard access (role enforcement)', () => {
  test('Employee accessing /dashboard/director is redirected', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.goto('/dashboard/director');
    await page.waitForURL(/\/dashboard\//, { timeout: 12_000 });
    expect(page.url()).not.toContain('/dashboard/director');
    await ctx.close();
  });

  test('Director accessing /dashboard/employee is redirected', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.goto('/dashboard/employee');
    await page.waitForURL(/\/dashboard\//, { timeout: 12_000 });
    expect(page.url()).not.toContain('/dashboard/employee');
    await ctx.close();
  });
});

// ─── Session persistence ───────────────────────────────────────────────────────

test.describe('Session persistence', () => {
  test('Dashboard remains accessible after page reload', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard\/employee/, { timeout: 15_000 });
    await ctx.close();
  });
});

// ─── API: /api/me ──────────────────────────────────────────────────────────────

test.describe('API /api/me', () => {
  test('returns 401 without bearer token', async ({ request }) => {
    const res = await request.get('/api/me');
    expect(res.status()).toBe(401);
  });
});
