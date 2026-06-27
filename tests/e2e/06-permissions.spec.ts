/**
 * 06 – Permission System
 *
 * Covers: director grant/revoke allow_video and allow_audit,
 * system_lockout (block all API), real-time reflection.
 * Every test cleans up its changes in finally blocks.
 */
import { test, expect } from '@playwright/test';
import { DIRECTOR, EMPLOYEE, getTokens, getUserId, setPermission } from './setup/helpers';

let dirToken = '';
let empToken = '';
let empId    = '';
let dirId    = '';

test.beforeAll(async () => {
  const tokens = getTokens();
  dirToken = tokens.director;
  empToken = tokens.employee;
  [empId, dirId] = await Promise.all([
    getUserId(EMPLOYEE.email),
    getUserId(DIRECTOR.email),
  ]);
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── Read own permissions ──────────────────────────────────────────────────────

test('Employee can read own permissions via GET /api/permissions', async ({ request }) => {
  const res  = await request.get('/api/permissions', { headers: auth(empToken) });
  expect(res.status()).toBe(200);
  const { permissions } = await res.json();
  expect(typeof permissions.allow_video).toBe('boolean');
  expect(typeof permissions.allow_audit).toBe('boolean');
  expect(typeof permissions.system_lockout).toBe('boolean');
});

test('Director can read all permissions (array)', async ({ request }) => {
  const res  = await request.get('/api/permissions', { headers: auth(dirToken) });
  expect(res.status()).toBe(200);
  const { permissions } = await res.json();
  expect(Array.isArray(permissions)).toBe(true);
});

// ─── allow_video grant / revoke ────────────────────────────────────────────────

test.describe('allow_video', () => {
  test('revoking allow_video blocks voice room creation and re-granting restores it', async ({ request }) => {
    await setPermission(empId, 'allow_video', false);
    try {
      // Employee can no longer create voice rooms
      const createRes = await request.post('/api/voice-rooms', {
        headers: auth(empToken),
        data:    { name: 'Should-fail-room' },
      });
      expect(createRes.status()).toBe(403);

      // Employee cannot join either
      // First create a room as director
      const dirRoom = await request.post('/api/voice-rooms', {
        headers: auth(dirToken),
        data:    { name: 'Dir-Room-PermTest' },
      });
      const { room } = await dirRoom.json();

      const joinRes = await request.post(`/api/voice-rooms/${room.id}/join`, { headers: auth(empToken) });
      expect(joinRes.status()).toBe(403);

      await request.delete(`/api/voice-rooms/${room.id}`, { headers: auth(dirToken) });
    } finally {
      await setPermission(empId, 'allow_video', true);
    }
  });

  test('restoring allow_video lets employee join again', async ({ request }) => {
    // Ensure allow_video is true (should be after previous test's finally)
    await setPermission(empId, 'allow_video', true);
    const createRes = await request.post('/api/voice-rooms', {
      headers: auth(dirToken),
      data:    { name: 'Re-grant-Test-Room' },
    });
    const { room } = await createRes.json();
    const joinRes  = await request.post(`/api/voice-rooms/${room.id}/join`, { headers: auth(empToken) });
    expect(joinRes.status()).toBe(200);
    await request.post(`/api/voice-rooms/${room.id}/leave`, { headers: auth(empToken) });
    await request.delete(`/api/voice-rooms/${room.id}`, { headers: auth(dirToken) });
  });
});

// ─── allow_audit grant / revoke ───────────────────────────────────────────────
//
// The /api/audit endpoint uses requireDirector() first, then checks allow_audit.
// Employees are always rejected by the director gate. Tests here use the director.

test.describe('allow_audit', () => {
  test('employee always gets 403 on audit endpoint (not a director)', async ({ request }) => {
    const res = await request.get('/api/audit', { headers: auth(empToken) });
    expect(res.status()).toBe(403);
  });

  test('director without allow_audit gets 403', async ({ request }) => {
    await setPermission(dirId, 'allow_audit', false);
    try {
      const res = await request.get('/api/audit', { headers: auth(dirToken) });
      expect(res.status()).toBe(403);
    } finally {
      await setPermission(dirId, 'allow_audit', true);
    }
  });

  test('director with allow_audit gets 200 and logs array', async ({ request }) => {
    // Ensure it is set (global setup grants it to directors, but be explicit)
    await setPermission(dirId, 'allow_audit', true);
    const res = await request.get('/api/audit', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).logs)).toBe(true);
  });
});

// ─── system_lockout ────────────────────────────────────────────────────────────

test.describe('system_lockout', () => {
  test('locked user receives 423 on any authenticated API call', async ({ request }) => {
    await setPermission(empId, 'system_lockout', true);
    try {
      // /api/me is the lightest endpoint
      const res = await request.get('/api/me', { headers: auth(empToken) });
      expect(res.status()).toBe(423);

      // Tasks, channels, messages all return 423 too
      const tasks = await request.get('/api/tasks', { headers: auth(empToken) });
      expect(tasks.status()).toBe(423);

      const channels = await request.get('/api/channels', { headers: auth(empToken) });
      expect(channels.status()).toBe(423);
    } finally {
      await setPermission(empId, 'system_lockout', false);
    }
  });

  test('unlocking restores full access', async ({ request }) => {
    // Lockout was removed in the finally above; verify access is back
    const res = await request.get('/api/me', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
  });
});

// ─── Permission update via API ─────────────────────────────────────────────────

test.describe('PATCH /api/permissions/[id]', () => {
  test('director can update employee allow_video via API', async ({ request }) => {
    const res = await request.patch(`/api/permissions/${empId}`, {
      headers: auth(dirToken),
      data:    { allow_video: false },
    });
    expect(res.status()).toBe(200);

    // Restore
    await request.patch(`/api/permissions/${empId}`, {
      headers: auth(dirToken),
      data:    { allow_video: true },
    });
  });

  test('employee cannot update another user permissions (403)', async ({ request }) => {
    const res = await request.patch(`/api/permissions/${empId}`, {
      headers: auth(empToken),
      data:    { allow_video: true },
    });
    expect(res.status()).toBe(403);
  });
});
