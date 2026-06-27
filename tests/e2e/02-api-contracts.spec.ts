/**
 * 02 – API Contracts
 *
 * Every endpoint is tested for:
 *   • 401 when called without a bearer token
 *   • 403 when called by a role that is not permitted
 *   • 200 / 201 / 204 for the happy path with the correct role
 *   • Correct response shape (presence of top-level keys)
 *
 * Tests are pure API — no browser, no UI.  All token-based.
 */
import { test, expect } from '@playwright/test';
import { DIRECTOR, EMPLOYEE, getTokens } from './setup/helpers';

let dirToken  = '';
let empToken  = '';
let clientToken = '';

test.beforeAll(() => {
  const tokens = getTokens();
  dirToken    = tokens.director;
  empToken    = tokens.employee;
  clientToken = tokens.client;
});

function auth(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

// ─── Health ────────────────────────────────────────────────────────────────────

test.describe('GET /api/health', () => {
  test('returns 200 and { status: "ok" } without auth', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    expect((await res.json()).status).toBe('ok');
  });

  test('?detail=true without auth returns public-only body (no memory/uptime)', async ({ request }) => {
    const res  = await request.get('/api/health?detail=true');
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.node_version).toBeUndefined();
    expect(body.memory).toBeUndefined();
  });

  test('?detail=true with director token returns extended info', async ({ request }) => {
    const res  = await request.get('/api/health?detail=true', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    // Directors see extra fields
    expect(body.uptime ?? body.node_version ?? body.memory).toBeDefined();
  });
});

// ─── /api/me ──────────────────────────────────────────────────────────────────

test.describe('GET /api/me', () => {
  test('401 without token', async ({ request }) => {
    expect((await request.get('/api/me')).status()).toBe(401);
  });

  test('director gets own profile', async ({ request }) => {
    const res  = await request.get('/api/me', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.profile.role).toBe('director');
    expect(body.profile.email).toBe(DIRECTOR.email);
  });

  test('employee gets own profile', async ({ request }) => {
    const res  = await request.get('/api/me', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    expect((await res.json()).profile.role).toBe('employee');
  });
});

// ─── /api/permissions ──────────────────────────────────────────────────────────

test.describe('/api/permissions', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/permissions')).status()).toBe(401);
  });

  test('GET employee permissions (own)', async ({ request }) => {
    const res  = await request.get('/api/permissions', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.permissions?.allow_video).toBe('boolean');
  });

  test('GET director sees all permissions', async ({ request }) => {
    const res  = await request.get('/api/permissions', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.permissions)).toBe(true);
    expect(body.permissions.length).toBeGreaterThan(0);
  });

  test('PATCH permission by employee returns 403', async ({ request }) => {
    const res = await request.patch('/api/permissions/some-id', {
      headers: auth(empToken),
      data:    { allow_video: true },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── /api/tasks ───────────────────────────────────────────────────────────────

test.describe('/api/tasks', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/tasks')).status()).toBe(401);
  });

  test('GET returns tasks object for director', async ({ request }) => {
    const res  = await request.get('/api/tasks', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(typeof (await res.json()).tasks).toBe('object');
  });

  test('POST task by employee returns 403', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(empToken),
      data:    { title: 'Sneaky task', priority: 'LOW', column_id: 'TODO' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST task without title returns 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { priority: 'LOW', column_id: 'TODO' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── /api/channels ────────────────────────────────────────────────────────────

test.describe('/api/channels', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/channels')).status()).toBe(401);
  });

  test('GET returns non-archived channels', async ({ request }) => {
    const res  = await request.get('/api/channels', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.channels)).toBe(true);
    body.channels.forEach((ch: { is_archived: boolean }) => {
      expect(ch.is_archived).toBe(false);
    });
  });

  test('POST channel by employee returns 403', async ({ request }) => {
    const res = await request.post('/api/channels', {
      headers: auth(empToken),
      data:    { name: 'emp-attempt', type: 'text' },
    });
    expect(res.status()).toBe(403);
  });

  test('POST channel without name returns 400', async ({ request }) => {
    const res = await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { type: 'text' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── /api/messages ────────────────────────────────────────────────────────────

test.describe('/api/messages', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/messages?channel=general')).status()).toBe(401);
  });

  test('GET messages from general channel', async ({ request }) => {
    const res  = await request.get('/api/messages?channel=general', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).messages)).toBe(true);
  });

  test('GET messages from non-existent channel returns 404', async ({ request }) => {
    const res = await request.get('/api/messages?channel=does-not-exist-xyzzy', { headers: auth(empToken) });
    expect(res.status()).toBe(404);
  });

  test('POST message without body returns 400', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(empToken),
      data:    { channel_id: 'general' },
    });
    expect(res.status()).toBe(400);
  });

  test('POST message without auth returns 401', async ({ request }) => {
    expect((await request.post('/api/messages', { data: { channel_id: 'general', body: 'hi' } })).status()).toBe(401);
  });
});

// ─── /api/voice-rooms ─────────────────────────────────────────────────────────

test.describe('/api/voice-rooms', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/voice-rooms')).status()).toBe(401);
  });

  test('GET returns active rooms list', async ({ request }) => {
    const res = await request.get('/api/voice-rooms', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).rooms)).toBe(true);
  });

  test('POST without name returns 400', async ({ request }) => {
    const res = await request.post('/api/voice-rooms', {
      headers: auth(dirToken),
      data:    { max_participants: 5 },
    });
    expect(res.status()).toBe(400);
  });

  test('POST /[id]/join without auth returns 401', async ({ request }) => {
    expect((await request.post('/api/voice-rooms/fake-uuid/join')).status()).toBe(401);
  });

  test('POST /[id]/join with employee and allow_video=true succeeds on valid room', async ({ request }) => {
    // Create a room as director first
    const createRes = await request.post('/api/voice-rooms', {
      headers: auth(dirToken),
      data:    { name: 'Contract-Test-Room', max_participants: 10 },
    });
    expect(createRes.status()).toBe(201);
    const { room } = await createRes.json();

    // Employee (allow_video=true from setup) joins
    const joinRes = await request.post(`/api/voice-rooms/${room.id}/join`, {
      headers: auth(empToken),
    });
    expect(joinRes.status()).toBe(200);
    const joined = await joinRes.json();
    expect(joined.room_code).toBeTruthy();

    // Cleanup
    await request.post(`/api/voice-rooms/${room.id}/leave`, { headers: auth(empToken) });
    await request.delete(`/api/voice-rooms/${room.id}`, { headers: auth(dirToken) });
  });

  test('DELETE /[id] by non-creator employee returns 403', async ({ request }) => {
    const createRes = await request.post('/api/voice-rooms', {
      headers: auth(dirToken),
      data:    { name: 'Ownership-Contract-Room' },
    });
    const { room } = await createRes.json();
    const delRes = await request.delete(`/api/voice-rooms/${room.id}`, { headers: auth(empToken) });
    expect(delRes.status()).toBe(403);
    // Cleanup
    await request.delete(`/api/voice-rooms/${room.id}`, { headers: auth(dirToken) });
  });
});

// ─── /api/attendance ──────────────────────────────────────────────────────────

test.describe('/api/attendance', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/attendance')).status()).toBe(401);
  });

  test('GET 403 for client role', async ({ request }) => {
    const res = await request.get('/api/attendance', { headers: auth(clientToken) });
    expect(res.status()).toBe(403);
  });

  test('POST 403 for client role', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      headers: auth(clientToken),
      data:    { action: 'check_in' },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── /api/daily-reports ───────────────────────────────────────────────────────

test.describe('/api/daily-reports', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/daily-reports')).status()).toBe(401);
  });

  test('GET 403 for client role', async ({ request }) => {
    expect((await request.get('/api/daily-reports', { headers: auth(clientToken) })).status()).toBe(403);
  });

  test('POST 403 for client role', async ({ request }) => {
    const res = await request.post('/api/daily-reports', {
      headers: auth(clientToken),
      data:    { report_text: 'test' },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── /api/invoices ────────────────────────────────────────────────────────────

test.describe('/api/invoices', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/invoices')).status()).toBe(401);
  });

  test('GET 403 for employee', async ({ request }) => {
    expect((await request.get('/api/invoices', { headers: auth(empToken) })).status()).toBe(403);
  });

  test('GET 200 for director', async ({ request }) => {
    const res = await request.get('/api/invoices', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).invoices)).toBe(true);
  });
});

// ─── /api/payroll ─────────────────────────────────────────────────────────────

test.describe('/api/payroll', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/payroll')).status()).toBe(401);
  });

  test('GET returns own payroll for employee', async ({ request }) => {
    const res = await request.get('/api/payroll', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).payroll)).toBe(true);
  });

  test('POST payroll by employee returns 403', async ({ request }) => {
    const res = await request.post('/api/payroll', {
      headers: auth(empToken),
      data:    { confirm: true },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── /api/audit ───────────────────────────────────────────────────────────────

test.describe('/api/audit', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/audit')).status()).toBe(401);
  });

  test('GET 403 for employee (no allow_audit)', async ({ request }) => {
    expect((await request.get('/api/audit', { headers: auth(empToken) })).status()).toBe(403);
  });

  test('GET 200 for director (has allow_audit)', async ({ request }) => {
    const res = await request.get('/api/audit', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).logs)).toBe(true);
  });
});

// ─── /api/admin/live-stats ────────────────────────────────────────────────────

test.describe('/api/admin/live-stats', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/admin/live-stats')).status()).toBe(401);
  });

  test('GET 403 for employee', async ({ request }) => {
    expect((await request.get('/api/admin/live-stats', { headers: auth(empToken) })).status()).toBe(403);
  });

  test('GET returns expected stat fields for director', async ({ request }) => {
    const res  = await request.get('/api/admin/live-stats', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { stats: body } = await res.json();
    for (const key of ['totalEmployees', 'activeProjects', 'tasksCompletedToday', 'openInvoices', 'totalPayroll', 'securityIncidents']) {
      expect(typeof body[key]).not.toBe('undefined');
    }
  });
});

// ─── /api/profiles ────────────────────────────────────────────────────────────

test.describe('/api/profiles', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/profiles')).status()).toBe(401);
  });

  test('GET returns profiles list for director', async ({ request }) => {
    const res = await request.get('/api/profiles', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).profiles)).toBe(true);
  });
});

// ─── /api/projects ────────────────────────────────────────────────────────────

test.describe('/api/projects', () => {
  test('GET 401 without token', async ({ request }) => {
    expect((await request.get('/api/projects')).status()).toBe(401);
  });

  test('GET returns projects for employee', async ({ request }) => {
    const res = await request.get('/api/projects', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).projects)).toBe(true);
  });

  test('POST project by employee returns 403', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(empToken),
      data:    { name: 'Sneaky project', status: 'Active' },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── Security: locked-out user ─────────────────────────────────────────────────

test.describe('system_lockout enforcement', () => {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const SK = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const H  = { apikey: SK, Authorization: `Bearer ${SK}`, 'Content-Type': 'application/json' };

  test('locked employee receives 423 on all authenticated endpoints', async ({ request }) => {
    // Find employee profile id
    const pRes  = await fetch(`${SUPABASE_URL}/rest/v1/profiles?email=eq.${EMPLOYEE.email}&select=id`, { headers: H });
    const [prof] = await pRes.json() as Array<{ id: string }>;
    if (!prof) { test.skip(true, 'Employee profile not found'); return; }

    await fetch(`${SUPABASE_URL}/rest/v1/personnel_permissions?user_id=eq.${prof.id}`, {
      method: 'PATCH', headers: H, body: JSON.stringify({ system_lockout: true }),
    });

    try {
      const res = await request.get('/api/me', { headers: auth(empToken) });
      expect(res.status()).toBe(423);
    } finally {
      // Always restore
      await fetch(`${SUPABASE_URL}/rest/v1/personnel_permissions?user_id=eq.${prof.id}`, {
        method: 'PATCH', headers: H, body: JSON.stringify({ system_lockout: false }),
      });
    }
  });
});
