/**
 * Multi-user E2E tests for KAI-OS
 *
 * Each test opens two independent browser contexts simultaneously,
 * simulating real concurrent users on different machines.
 *
 * Test accounts are created automatically by global-setup.ts
 * and cleaned up by global-teardown.ts — no manual steps required.
 *
 * Run: npx playwright test tests/e2e/multiuser.spec.ts --headed
 */

import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { getTokens } from './setup/helpers';

// ─── Credentials (created by global-setup.ts) ──────────────────────────────

const DIRECTOR = {
  email:    'test.director@kai-os.test',
  password: 'TestKaiDirector2026!',
};
const EMPLOYEE = {
  email:    'test.employee@kai-os.test',
  password: 'TestKaiEmployee2026!',
};
const EMPLOYEE2 = {
  email:    'test.employee2@kai-os.test',
  password: 'TestKaiEmployee2026!',
};

// ─── Helpers ───────────────────────────────────────────────────────────────

async function loginAs(
  context: BrowserContext,
  creds: { email: string; password: string },
): Promise<Page> {
  const page = await context.newPage();
  await page.goto('/login');

  // Login page uses type="text" on the email field (branded as "Email or Personnel ID")
  await page.locator('input[placeholder*="Email"], input[placeholder*="Personnel"]').fill(creds.email);
  await page.locator('input[type="password"]').fill(creds.password);
  await page.locator('button[type="submit"]').click();

  // Wait for redirect to dashboard
  await page.waitForURL(/\/dashboard\//, { timeout: 20_000 });

  // Wait for the dashboard sidebar to actually render (verifyRole completes)
  await page.locator('[data-testid="nav-team-hub"]').waitFor({ state: 'visible', timeout: 15_000 });

  return page;
}

async function openTeamHub(page: Page) {
  await page.locator('[data-testid="nav-team-hub"]').click();
  // Wait for at least one channel button to appear — confirms channels loaded from API
  await page.locator('[data-testid^="channel-btn-"]').first().waitFor({ state: 'visible', timeout: 12_000 });
}

// ─── Tests ─────────────────────────────────────────────────────────────────

test.describe('Multi-user: Authentication & Role Routing', () => {
  test('Director lands on /dashboard/director, Employee on /dashboard/employee', async ({ browser }) => {
    const [ctxDir, ctxEmp] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);

    const [dirPage, empPage] = await Promise.all([
      loginAs(ctxDir, DIRECTOR),
      loginAs(ctxEmp, EMPLOYEE),
    ]);

    expect(dirPage.url()).toContain('/dashboard/director');
    expect(empPage.url()).toContain('/dashboard/employee');

    await Promise.all([ctxDir.close(), ctxEmp.close()]);
  });

  test('Employee cannot access director dashboard (redirected)', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await page.goto('/dashboard/director');
    await page.waitForURL(/\/dashboard\//, { timeout: 10_000 });
    expect(page.url()).not.toContain('/dashboard/director');
    await ctx.close();
  });
});

test.describe('Multi-user: Real-time Messaging', () => {
  test('Message sent by Director appears for Employee without page reload', async ({ browser }) => {
    const [ctxDir, ctxEmp] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);

    const [dirPage, empPage] = await Promise.all([
      loginAs(ctxDir, DIRECTOR),
      loginAs(ctxEmp, EMPLOYEE),
    ]);

    // Both navigate to Team Hub and wait for channels
    await Promise.all([openTeamHub(dirPage), openTeamHub(empPage)]);

    // Click #general channel on both sides (data-testid is reliable)
    await dirPage.locator('[data-testid="channel-btn-general"]').click();
    await empPage.locator('[data-testid="channel-btn-general"]').click();

    // Wait for message input to be ready
    await dirPage.locator('[data-testid="msg-input"]').waitFor({ state: 'visible', timeout: 5000 });
    await empPage.locator('[data-testid="msg-input"]').waitFor({ state: 'visible', timeout: 5000 });

    // Director sends a unique message
    const msgText = `RT-test-${Date.now()}`;
    await dirPage.locator('[data-testid="msg-input"]').fill(msgText);
    await dirPage.locator('[data-testid="msg-input"]').press('Enter');

    // Employee should see it within 8 seconds (Supabase Realtime)
    await expect(empPage.locator(`text=${msgText}`).first()).toBeVisible({ timeout: 10_000 });

    await Promise.all([ctxDir.close(), ctxEmp.close()]);
  });

  test('Message sent by Employee appears for Director without page reload', async ({ browser }) => {
    const [ctxDir, ctxEmp] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    const [dirPage, empPage] = await Promise.all([
      loginAs(ctxDir, DIRECTOR),
      loginAs(ctxEmp, EMPLOYEE),
    ]);

    await Promise.all([openTeamHub(dirPage), openTeamHub(empPage)]);

    await dirPage.locator('[data-testid="channel-btn-general"]').click();
    await empPage.locator('[data-testid="channel-btn-general"]').click();

    await empPage.locator('[data-testid="msg-input"]').waitFor({ state: 'visible', timeout: 5000 });

    const msgText = `EMP-msg-${Date.now()}`;
    await empPage.locator('[data-testid="msg-input"]').fill(msgText);
    await empPage.locator('[data-testid="msg-input"]').press('Enter');

    await expect(dirPage.locator(`text=${msgText}`).first()).toBeVisible({ timeout: 10_000 });

    await Promise.all([ctxDir.close(), ctxEmp.close()]);
  });

  test('Three users can chat simultaneously', async ({ browser }) => {
    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);
    const [dirPage, emp1Page, emp2Page] = await Promise.all([
      loginAs(contexts[0], DIRECTOR),
      loginAs(contexts[1], EMPLOYEE),
      loginAs(contexts[2], EMPLOYEE2),
    ]);

    await Promise.all([
      openTeamHub(dirPage),
      openTeamHub(emp1Page),
      openTeamHub(emp2Page),
    ]);

    // All join #general
    await Promise.all([
      dirPage.locator('[data-testid="channel-btn-general"]').click(),
      emp1Page.locator('[data-testid="channel-btn-general"]').click(),
      emp2Page.locator('[data-testid="channel-btn-general"]').click(),
    ]);

    // Wait for all inputs ready
    await Promise.all([
      dirPage.locator('[data-testid="msg-input"]').waitFor({ state: 'visible', timeout: 5000 }),
      emp1Page.locator('[data-testid="msg-input"]').waitFor({ state: 'visible', timeout: 5000 }),
      emp2Page.locator('[data-testid="msg-input"]').waitFor({ state: 'visible', timeout: 5000 }),
    ]);

    const stamp = Date.now();
    const msg1 = `Dir-says-${stamp}`;
    const msg2 = `Emp1-says-${stamp}`;
    const msg3 = `Emp2-says-${stamp}`;

    await dirPage.locator('[data-testid="msg-input"]').fill(msg1);
    await dirPage.locator('[data-testid="msg-input"]').press('Enter');
    await emp1Page.locator('[data-testid="msg-input"]').fill(msg2);
    await emp1Page.locator('[data-testid="msg-input"]').press('Enter');
    await emp2Page.locator('[data-testid="msg-input"]').fill(msg3);
    await emp2Page.locator('[data-testid="msg-input"]').press('Enter');

    // Each user sees all three messages
    for (const [page, label] of [[dirPage,'director'],[emp1Page,'employee1'],[emp2Page,'employee2']] as const) {
      await expect(page.locator(`text=${msg1}`).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.locator(`text=${msg2}`).first()).toBeVisible({ timeout: 12_000 });
      await expect(page.locator(`text=${msg3}`).first()).toBeVisible({ timeout: 12_000 });
      console.log(`✓ ${label} sees all three messages`);
    }

    await Promise.all(contexts.map(c => c.close()));
  });
});

test.describe('Multi-user: Channel Management', () => {
  test('Director creates a channel; Employee can see it without reload', async ({ browser }) => {
    const [ctxDir, ctxEmp] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    const [dirPage, empPage] = await Promise.all([
      loginAs(ctxDir, DIRECTOR),
      loginAs(ctxEmp, EMPLOYEE),
    ]);

    await Promise.all([openTeamHub(dirPage), openTeamHub(empPage)]);

    const chName = `test-ch-${Date.now()}`;

    // The + button has opacity-0 (shown on hover). Use force:true to click it.
    await dirPage.locator('[data-testid="add-channel-btn"]').click({ force: true });

    // Fill channel name in the modal
    const nameInput = dirPage.locator('input[placeholder*="design"], input[placeholder*="marketing"]').first();
    await nameInput.waitFor({ state: 'visible', timeout: 5000 });
    await nameInput.fill(chName);

    // Click "Create Channel" button
    await dirPage.locator('button').filter({ hasText: /create channel/i }).first().click();

    // Employee should see the new channel in sidebar within 10s (Realtime)
    await expect(empPage.locator(`[data-testid="channel-btn-${chName.toLowerCase()}"]`).first())
      .toBeVisible({ timeout: 12_000 });

    await Promise.all([ctxDir.close(), ctxEmp.close()]);
  });

  test('Employee cannot post in announcement channel', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await loginAs(ctx, EMPLOYEE);
    await openTeamHub(page);

    const alertsBtn = page.locator('[data-testid="channel-btn-alerts"]');
    const alertsVisible = await alertsBtn.isVisible().catch(() => false);
    if (!alertsVisible) {
      console.log('Alerts channel not found — skipping');
      await ctx.close();
      return;
    }
    await alertsBtn.click();

    // Message input should be disabled (read-only for non-directors)
    const input = page.locator('[data-testid="msg-input"]');
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await expect(input).toBeDisabled({ timeout: 5000 });
    await ctx.close();
  });
});

test.describe('Multi-user: Voice Rooms', () => {
  test('Director creates room; Employee sees it listed within 15 s', async ({ browser }) => {
    const [ctxDir, ctxEmp] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    const [dirPage, empPage] = await Promise.all([
      loginAs(ctxDir, DIRECTOR),
      loginAs(ctxEmp, EMPLOYEE),
    ]);

    await Promise.all([openTeamHub(dirPage), openTeamHub(empPage)]);

    const roomName = `Standup-${Date.now()}`;

    // + button for voice rooms is also opacity-0
    await dirPage.locator('[data-testid="add-voice-room-btn"]').click({ force: true });

    const roomInput = dirPage.locator('input[placeholder*="Daily"], input[placeholder*="Standup"], input[placeholder*="Sprint"]').first();
    await roomInput.waitFor({ state: 'visible', timeout: 5000 });
    await roomInput.fill(roomName);
    await dirPage.locator('button').filter({ hasText: /create room/i }).first().click();

    // Employee polls every 10 s — room name should appear within 15 s
    await expect(empPage.locator(`text=${roomName}`).first()).toBeVisible({ timeout: 15_000 });

    await Promise.all([ctxDir.close(), ctxEmp.close()]);
  });

  test('Joining a meeting switches to Live Meeting tab with Jitsi iframe', async ({ browser }) => {
    const ctx = await browser.newContext();
    const page = await loginAs(ctx, DIRECTOR);
    await openTeamHub(page);

    // Create a room first (director always can)
    await page.locator('[data-testid="add-voice-room-btn"]').click({ force: true });
    const roomInput = page.locator('input[placeholder*="Daily"], input[placeholder*="Standup"], input[placeholder*="Sprint"]').first();
    await roomInput.waitFor({ state: 'visible', timeout: 5000 });
    await roomInput.fill(`Auto-Test-${Date.now()}`);
    await page.locator('button').filter({ hasText: /create room/i }).first().click();

    // Wait for the room row to appear then hover to reveal the Join button
    const roomRow = page.locator('[data-testid^="voice-room-row-"]').first();
    await roomRow.waitFor({ state: 'visible', timeout: 8000 });
    await roomRow.hover();

    // Click Join (force because it becomes visible only after hover)
    const joinBtn = page.locator('[data-testid^="voice-room-join-"]').first();
    await joinBtn.click({ force: true });

    // Should switch to LIVE_MEETING tab with Jitsi iframe
    await expect(
      page.locator('iframe[title*="Meeting"], iframe[src*="meet.jit.si"]').first()
    ).toBeVisible({ timeout: 15_000 });

    await ctx.close();
  });

  test('Participant count updates for other users when someone joins', async ({ browser }) => {
    const [ctxDir, ctxEmp] = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);
    const [dirPage, empPage] = await Promise.all([
      loginAs(ctxDir, DIRECTOR),
      loginAs(ctxEmp, EMPLOYEE),
    ]);

    await Promise.all([openTeamHub(dirPage), openTeamHub(empPage)]);

    const roomName = `CountTest-${Date.now()}`;

    // Director creates a room
    await dirPage.locator('[data-testid="add-voice-room-btn"]').click({ force: true });
    const roomInput = dirPage.locator('input[placeholder*="Daily"], input[placeholder*="Standup"], input[placeholder*="Sprint"]').first();
    await roomInput.waitFor({ state: 'visible', timeout: 5000 });
    await roomInput.fill(roomName);
    await dirPage.locator('button').filter({ hasText: /create room/i }).first().click();

    // Director joins the room
    const roomRow = dirPage.locator('[data-testid^="voice-room-row-"]').first();
    await roomRow.waitFor({ state: 'visible', timeout: 8000 });
    await roomRow.hover();
    await dirPage.locator('[data-testid^="voice-room-join-"]').first().click({ force: true });

    // Employee should see "1 in call" in their voice room list within 15 s (polling)
    await expect(empPage.locator('text=1 in call').first()).toBeVisible({ timeout: 15_000 });

    await Promise.all([ctxDir.close(), ctxEmp.close()]);
  });
});

test.describe('Multi-user: Permission Enforcement', () => {
  test('Employee without allow_video sees "Meeting Access Restricted" on meetings tab', async ({ browser }) => {
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const SK = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const H = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

    // Use EMPLOYEE2 so we don't invalidate EMPLOYEE's session (which API tests below need)
    const pRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.test.employee2@kai-os.test&select=id`, { headers: H });
    const [profile] = await pRes.json() as Array<{ id: string }>;
    if (!profile) { console.log('test.employee2 not found, skipping'); return; }

    const restorePermission = () =>
      fetch(`${SUPABASE_URL}/rest/v1/personnel_permissions?user_id=eq.${profile.id}`, {
        method: 'PATCH',
        headers: H,
        body: JSON.stringify({ allow_video: true }),
      });

    // Temporarily revoke allow_video
    await fetch(`${SUPABASE_URL}/rest/v1/personnel_permissions?user_id=eq.${profile.id}`, {
      method: 'PATCH',
      headers: H,
      body: JSON.stringify({ allow_video: false }),
    });

    const ctx = await browser.newContext();
    try {
      const page = await loginAs(ctx, EMPLOYEE2);

      // Navigate to Live Meeting tab
      const meetingTab = page.locator('button').filter({ hasText: /live meeting/i }).first();
      const tabVisible = await meetingTab.isVisible({ timeout: 5000 }).catch(() => false);
      if (tabVisible) {
        await meetingTab.click();
        await expect(
          page.locator('text=/Meeting Access Restricted|video.*not.*enabled|access.*restricted/i').first()
        ).toBeVisible({ timeout: 8000 });
      }
    } finally {
      await ctx.close();
      // Always restore allow_video even if the test fails mid-way, so
      // subsequent API tests that join a voice room are not blocked.
      await restorePermission();
    }
  });
});

test.describe('API: Authenticated Multi-user Scenarios', () => {
  let dirToken = '';
  let empToken = '';

  test.beforeAll(() => {
    const tokens = getTokens();
    dirToken = tokens.director ?? '';
    empToken = tokens.employee ?? '';
  });

  test('Director can create a channel; Employee can read it', async ({ request }) => {
    if (!dirToken || !empToken) test.skip();

    const channelName = `api-test-${Date.now()}`;
    const createRes = await request.post('/api/channels', {
      headers: { Authorization: `Bearer ${dirToken}`, 'Content-Type': 'application/json' },
      data: { name: channelName, type: 'text', description: 'auto test' },
    });
    expect(createRes.status()).toBe(201);
    const { channel } = await createRes.json();
    expect(channel.slug).toBeTruthy();

    const listRes = await request.get('/api/channels', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    expect(listRes.status()).toBe(200);
    const { channels } = await listRes.json();
    expect(channels.some((c: { id: string }) => c.id === channel.id)).toBe(true);
  });

  test('Employee cannot create a channel (403)', async ({ request }) => {
    if (!empToken) test.skip();
    const res = await request.post('/api/channels', {
      headers: { Authorization: `Bearer ${empToken}`, 'Content-Type': 'application/json' },
      data: { name: `emp-attempt-${Date.now()}`, type: 'text' },
    });
    expect(res.status()).toBe(403);
  });

  test('Director posts message; Employee can read it via API', async ({ request }) => {
    if (!dirToken || !empToken) test.skip();

    const msgBody = `api-msg-${Date.now()}`;
    const postRes = await request.post('/api/messages', {
      headers: { Authorization: `Bearer ${dirToken}`, 'Content-Type': 'application/json' },
      data: { channel_id: 'general', body: msgBody },
    });
    expect(postRes.status()).toBe(201);

    const getRes = await request.get('/api/messages?channel=general', {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    expect(getRes.status()).toBe(200);
    const { messages } = await getRes.json();
    expect(messages.some((m: { body: string }) => m.body === msgBody)).toBe(true);
  });

  test('Director creates voice room; Employee can join it', async ({ request }) => {
    if (!dirToken || !empToken) test.skip();

    const createRes = await request.post('/api/voice-rooms', {
      headers: { Authorization: `Bearer ${dirToken}`, 'Content-Type': 'application/json' },
      data: { name: `API-Room-${Date.now()}`, max_participants: 10 },
    });
    expect(createRes.status()).toBe(201);
    const { room } = await createRes.json();

    const joinRes = await request.post(`/api/voice-rooms/${room.id}/join`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    expect(joinRes.status()).toBe(200);
    const joined = await joinRes.json();
    expect(joined.room_code).toBeTruthy();
    expect(joined.room_id).toBe(room.id);

    await request.post(`/api/voice-rooms/${room.id}/leave`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    await request.delete(`/api/voice-rooms/${room.id}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
  });

  test('Employee cannot end a room created by the Director (403)', async ({ request }) => {
    if (!dirToken || !empToken) test.skip();

    const createRes = await request.post('/api/voice-rooms', {
      headers: { Authorization: `Bearer ${dirToken}`, 'Content-Type': 'application/json' },
      data: { name: `Ownership-Test-${Date.now()}` },
    });
    expect(createRes.status()).toBe(201);
    const { room } = await createRes.json();

    const deleteRes = await request.delete(`/api/voice-rooms/${room.id}`, {
      headers: { Authorization: `Bearer ${empToken}` },
    });
    expect(deleteRes.status()).toBe(403);

    await request.delete(`/api/voice-rooms/${room.id}`, {
      headers: { Authorization: `Bearer ${dirToken}` },
    });
  });
});
