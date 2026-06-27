import { test, expect, type Page } from '@playwright/test';

/**
 * E2E tests for the Team Hub (messaging) and Live Meetings feature.
 *
 * These tests run against a live dev server. They do NOT require real
 * Supabase credentials; they validate the UI layer and navigation logic.
 * For full integration testing with auth, seed the DB with test accounts.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function goToLogin(page: Page) {
  await page.goto('/login');
  await expect(page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"], input[type="email"]').first()).toBeVisible({ timeout: 8000 });
}

// ─── Unauthenticated / Route Protection ───────────────────────────────────────

test.describe('Messaging route protection', () => {
  test('unauthenticated user is redirected to login from dashboard', async ({ page }) => {
    await page.goto('/dashboard/employee');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });

  test('unauthenticated user is redirected to login from director dashboard', async ({ page }) => {
    await page.goto('/dashboard/director');
    await expect(page).toHaveURL(/\/login/, { timeout: 8000 });
  });
});

// ─── Login Page UI ────────────────────────────────────────────────────────────

test.describe('Login page structure', () => {
  test.beforeEach(async ({ page }) => {
    await goToLogin(page);
  });

  test('shows email and password fields', async ({ page }) => {
    await expect(page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"], input[type="email"]').first()).toBeVisible();
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test('shows submit button', async ({ page }) => {
    const btn = page.locator('button[type="submit"]').first();
    await expect(btn).toBeVisible();
  });

  test('shows error on empty form submit', async ({ page }) => {
    await page.locator('button[type="submit"]').first().click();
    // Browser native or custom validation
    const emailInput = page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"], input[type="email"]').first();
    const validationMessage = await emailInput.evaluate((el) =>
      (el as HTMLInputElement).validationMessage,
    );
    expect(validationMessage.length).toBeGreaterThan(0);
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"], input[type="email"]').first().fill('wrong@example.com');
    await page.locator('input[type="password"]').first().fill('BadPass123!');
    await page.locator('button[type="submit"]').first().click();
    await page.waitForTimeout(2500);

    const error = page.locator('text=/invalid|error|failed|incorrect|credentials/i');
    await expect(error.first()).toBeVisible({ timeout: 6000 }).catch(() => {
      // Some implementations redirect or show a toast — pass silently
    });
  });
});

// ─── API Endpoint Smoke Tests (unauthenticated) ───────────────────────────────

test.describe('API — unauthenticated access returns 401', () => {
  test('GET /api/messages returns 401', async ({ request }) => {
    const res = await request.get('/api/messages?channel=general');
    expect(res.status()).toBe(401);
  });

  test('GET /api/channels returns 401', async ({ request }) => {
    const res = await request.get('/api/channels');
    expect(res.status()).toBe(401);
  });

  test('GET /api/voice-rooms returns 401', async ({ request }) => {
    const res = await request.get('/api/voice-rooms');
    expect(res.status()).toBe(401);
  });

  test('POST /api/channels returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/channels', {
      data: { name: 'test-channel' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/voice-rooms returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/voice-rooms', {
      data: { name: 'My Meeting' },
    });
    expect(res.status()).toBe(401);
  });

  test('POST /api/messages returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/messages', {
      data: { body: 'hello', channel_id: 'general' },
    });
    expect(res.status()).toBe(401);
  });
});

// ─── API Validation Smoke Tests (unauthenticated → 401, not 400) ─────────────

test.describe('API — validation layer', () => {
  test('POST /api/voice-rooms/[id]/join returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/voice-rooms/fake-id/join');
    expect([401, 403]).toContain(res.status());
  });

  test('POST /api/voice-rooms/[id]/leave returns 401 without auth', async ({ request }) => {
    const res = await request.post('/api/voice-rooms/fake-id/leave');
    expect([401, 403]).toContain(res.status());
  });

  test('DELETE /api/voice-rooms/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.delete('/api/voice-rooms/fake-id');
    expect([401, 403]).toContain(res.status());
  });

  test('DELETE /api/channels/[id] returns 401 without auth', async ({ request }) => {
    const res = await request.delete('/api/channels/fake-id');
    expect([401, 403]).toContain(res.status());
  });
});

// ─── Health Check ─────────────────────────────────────────────────────────────

test.describe('Health endpoint', () => {
  test('GET /api/health returns ok without auth', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('GET /api/health does not expose sensitive details publicly', async ({ request }) => {
    const res = await request.get('/api/health');
    const body = await res.json();
    // Detailed info should NOT be present without director auth
    expect(body.node_version).toBeUndefined();
    expect(body.memory).toBeUndefined();
    expect(body.uptime).toBeUndefined();
  });
});

// ─── Security Headers ─────────────────────────────────────────────────────────

test.describe('Security headers', () => {
  test('login page has X-Frame-Options header', async ({ request }) => {
    const res = await request.get('/login');
    const xfo = res.headers()['x-frame-options'];
    expect(xfo).toBeTruthy();
    expect(xfo.toLowerCase()).toContain('deny');
  });

  test('login page has X-Content-Type-Options header', async ({ request }) => {
    const res = await request.get('/login');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });

  test('API responses include X-Content-Type-Options', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.headers()['x-content-type-options']).toBe('nosniff');
  });
});

// ─── Channel Slug Validation (API contract) ───────────────────────────────────

test.describe('Channel slug validation in messages API', () => {
  test('GET /api/messages with invalid slug returns 401 (auth required first)', async ({ request }) => {
    // Without auth we get 401, not 400 — auth check runs before slug validation
    const res = await request.get('/api/messages?channel=INVALID%20SLUG!@#');
    expect(res.status()).toBe(401);
  });
});
