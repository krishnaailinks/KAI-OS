/**
 * 11 – End-to-End Browser Workflows
 *
 * Full user journeys through the browser:
 * - Director logs in, navigates all sections, sends a message
 * - Employee logs in, sees team hub, navigates kanban
 * - Cross-role routing, login/logout cycle, session persistence
 *
 * Nav buttons are targeted via getByRole('button', { name }) to avoid
 * strict-mode violations when the same text appears in both the sidebar
 * and the panel heading.
 */
import { test, expect } from '@playwright/test';
import { DIRECTOR, EMPLOYEE, loginAs } from './setup/helpers';

// ─── Director journey ─────────────────────────────────────────────────────────

test.describe('Director full journey', () => {
  test('director logs in and lands on /dashboard/director', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await expect(page).toHaveURL(/\/dashboard\/director/);
    await ctx.close();
  });

  test('director dashboard renders KAI-OS branding and role badge', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    // h1 is the most specific KAI-OS text node; use first() as fallback for any duplicates
    await expect(page.getByText('KAI-OS').first()).toBeVisible();
    // Role badge in the sidebar bottom user card (role.toUpperCase())
    await expect(page.getByText('DIRECTOR').first()).toBeVisible();
    await ctx.close();
  });

  test('director navigates to Team Hub and sees the general channel', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.getByTestId('nav-team-hub').click();
    await expect(page.locator('[data-testid="channel-btn-general"]')).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });

  test('director sends a message in the general channel', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.getByTestId('nav-team-hub').click();
    await page.locator('[data-testid="channel-btn-general"]').click();
    const msg = `UI test message ${Date.now()}`;
    await page.getByTestId('msg-input').fill(msg);
    await page.getByTestId('msg-input').press('Enter');
    await expect(page.getByText(msg)).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test('director sidebar shows Executive Audit and Live Admin (director-only nav buttons)', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    // Target the sidebar nav buttons specifically — avoids matching panel headings
    await expect(page.getByRole('button', { name: 'Executive Audit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Live Admin' })).toBeVisible();
    await ctx.close();
  });

  test('director opens Live Meeting tab without error', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.getByRole('button', { name: 'Live Meeting' }).click();
    await expect(page.getByText(/voice room|meeting|video/i).first()).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });

  test('director opens Projects & ERP tab', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.getByRole('button', { name: 'Projects & ERP' }).click();
    await expect(page.getByText(/project/i).first()).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });

  test('director opens Finance (FMS) tab', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.getByRole('button', { name: 'Finance (FMS)' }).click();
    await expect(page.getByText(/invoice|payroll|finance/i).first()).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });

  test('director opens HR Directory tab', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.getByRole('button', { name: 'HR Directory' }).click();
    await expect(page.getByText(/directory|personnel|profile/i).first()).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });
});

// ─── Employee journey ─────────────────────────────────────────────────────────

test.describe('Employee full journey', () => {
  test('employee logs in and lands on /dashboard/employee', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await expect(page).toHaveURL(/\/dashboard\/employee/);
    await ctx.close();
  });

  test('employee sidebar does NOT render Executive Audit or Live Admin buttons', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    // These buttons are conditionally rendered only for directors — they are absent from the DOM
    await expect(page.getByRole('button', { name: 'Executive Audit' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Live Admin' })).toHaveCount(0);
    await ctx.close();
  });

  test('employee sidebar shows EMPLOYEE role badge', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await expect(page.getByText('EMPLOYEE').first()).toBeVisible();
    await ctx.close();
  });

  test('employee navigates to Team Hub and can type a message', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.getByTestId('nav-team-hub').click();
    await page.locator('[data-testid="channel-btn-general"]').click();
    await expect(page.getByTestId('msg-input')).toBeVisible({ timeout: 10_000 });
    await ctx.close();
  });

  test('employee kanban board renders expected columns', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.getByRole('button', { name: 'Dashboard' }).first().click();
    await expect(page.getByText(/Backlog|Active Workload/i).first()).toBeVisible({ timeout: 15_000 });
    await ctx.close();
  });
});

// ─── Login / logout cycle ─────────────────────────────────────────────────────

test.describe('Login / logout cycle', () => {
  test('logging out redirects to /login', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.getByRole('button', { name: /log.?out|sign.?out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });

  test('visiting /dashboard after logout redirects to /login', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.getByRole('button', { name: /log.?out|sign.?out/i }).click();
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await page.goto('/dashboard/employee');
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/login/);
    await ctx.close();
  });
});

// ─── Cross-role routing enforcement ──────────────────────────────────────────

test.describe('Cross-role routing', () => {
  test('employee visiting /dashboard/director is redirected away', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.goto('/dashboard/director');
    await page.waitForURL(/\/dashboard\/employee|\/login/, { timeout: 15_000 });
    expect(page.url()).not.toContain('/dashboard/director');
    await ctx.close();
  });

  test('director visiting /dashboard/employee is redirected away', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.goto('/dashboard/employee');
    await page.waitForURL(/\/dashboard\/director|\/login/, { timeout: 15_000 });
    expect(page.url()).not.toContain('/dashboard/employee');
    await ctx.close();
  });
});

// ─── Session persistence ──────────────────────────────────────────────────────

test.describe('Session persistence', () => {
  test('refreshing the director dashboard does not log the user out', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await page.reload();
    await page.waitForURL(/\/dashboard\//, { timeout: 20_000 });
    await page.waitForSelector('[data-testid="nav-team-hub"]', { timeout: 20_000 });
    await expect(page.getByTestId('nav-team-hub')).toBeVisible();
    await ctx.close();
  });

  test('refreshing the employee dashboard does not log the user out', async ({ browser }) => {
    const ctx  = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.reload();
    await page.waitForURL(/\/dashboard\//, { timeout: 20_000 });
    await page.waitForSelector('[data-testid="nav-team-hub"]', { timeout: 20_000 });
    await expect(page.getByTestId('nav-team-hub')).toBeVisible();
    await ctx.close();
  });
});
