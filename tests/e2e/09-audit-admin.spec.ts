/**
 * 09 – Audit Logs, AI Report Generation, Live Stats, Health
 *
 * Covers: GET /api/audit (requires director + allow_audit),
 * POST /api/audit (director creates entry), POST /api/audit/generate-report (AI, may be 500 without key),
 * GET /api/admin/live-stats (director only), GET /api/health (public).
 */
import { test, expect } from '@playwright/test';
import { DIRECTOR, getTokens, getUserId, setPermission } from './setup/helpers';

let dirToken = '';
let empToken = '';
let dirId    = '';

test.beforeAll(async () => {
  const tokens = getTokens();
  dirToken = tokens.director;
  empToken = tokens.employee;
  dirId = await getUserId(DIRECTOR.email);
  // Ensure director has allow_audit for these tests
  await setPermission(dirId, 'allow_audit', true);
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── GET /api/audit ────────────────────────────────────────────────────────────

test.describe('GET /api/audit', () => {
  test('director with allow_audit=true gets 200 and logs array', async ({ request }) => {
    const res = await request.get('/api/audit', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { logs, total } = await res.json();
    expect(Array.isArray(logs)).toBe(true);
    expect(typeof total).toBe('number');
  });

  test('employee always gets 403 (requireDirector gate)', async ({ request }) => {
    expect((await request.get('/api/audit', { headers: auth(empToken) })).status()).toBe(403);
  });

  test('unauthenticated → 401', async ({ request }) => {
    expect((await request.get('/api/audit')).status()).toBe(401);
  });

  test('pagination via ?limit=5 works', async ({ request }) => {
    const res = await request.get('/api/audit?limit=5', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { logs } = await res.json();
    expect(logs.length).toBeLessThanOrEqual(5);
  });

  test('log objects have required fields', async ({ request }) => {
    const res = await request.get('/api/audit?limit=1', { headers: auth(dirToken) });
    const { logs } = await res.json();
    if (logs.length > 0) {
      expect(typeof logs[0].event_type).toBe('string');
      expect(typeof logs[0].message).toBe('string');
      expect(typeof logs[0].timestamp).toBe('string');
      expect(['low', 'medium', 'high', 'critical']).toContain(logs[0].severity);
    }
  });
});

// ─── POST /api/audit ───────────────────────────────────────────────────────────

test.describe('POST /api/audit', () => {
  test('director creates an audit entry → returns the new log', async ({ request }) => {
    const res = await request.post('/api/audit', {
      headers: auth(dirToken),
      data:    {
        event_type: 'test',
        message:    `E2E test audit entry — ${Date.now()}`,
        severity:   'low',
      },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.event_type).toBe('test');
    expect(body.severity).toBe('low');
    // triggered_by must be server-set (not client-supplied)
    expect(typeof body.triggered_by).toBe('string');
  });

  test('missing event_type → 400', async ({ request }) => {
    const res = await request.post('/api/audit', {
      headers: auth(dirToken),
      data:    { message: 'No event type' },
    });
    expect(res.status()).toBe(400);
  });

  test('employee cannot create audit entries (403)', async ({ request }) => {
    const res = await request.post('/api/audit', {
      headers: auth(empToken),
      data:    { event_type: 'test', message: 'Employee attempt' },
    });
    expect(res.status()).toBe(403);
  });

  test('invalid severity value → 400', async ({ request }) => {
    const res = await request.post('/api/audit', {
      headers: auth(dirToken),
      data:    { event_type: 'test', message: 'Bad severity', severity: 'extreme' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── POST /api/audit/generate-report (AI) ────────────────────────────────────

test.describe('POST /api/audit/generate-report', () => {
  test('employee cannot generate audit report (403)', async ({ request }) => {
    const res = await request.post('/api/audit/generate-report', {
      headers: auth(empToken),
      data:    {},
    });
    expect(res.status()).toBe(403);
  });

  test('director gets 200 or 500/502 (Gemini may not be configured in test env)', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const res   = await request.post('/api/audit/generate-report', {
      headers: auth(dirToken),
      data:    { startDate: today, endDate: today },
    });
    // 200 = Gemini ran; 500/502 = key missing or API error — all acceptable in test env
    expect([200, 500, 502, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body.report).toBe('string');
      expect(body.report.length).toBeGreaterThan(0);
      // Email addresses in logs should be redacted
      expect(body.report).not.toMatch(/[a-zA-Z0-9._%+\-]+@kai-os\.test/);
      expect(typeof body.logsCount).toBe('number');
    }
  });

  test('invalid startDate format → 400', async ({ request }) => {
    const res = await request.post('/api/audit/generate-report', {
      headers: auth(dirToken),
      data:    { startDate: 'not-a-date' },
    });
    expect(res.status()).toBe(400);
  });

  test('unauthenticated → 401', async ({ request }) => {
    expect((await request.post('/api/audit/generate-report', { data: {} })).status()).toBe(401);
  });
});

// ─── GET /api/admin/live-stats ────────────────────────────────────────────────

test.describe('GET /api/admin/live-stats', () => {
  test('director receives stats object with all required fields', async ({ request }) => {
    const res = await request.get('/api/admin/live-stats', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { stats } = await res.json();
    expect(typeof stats.totalEmployees).toBe('number');
    expect(typeof stats.activeProjects).toBe('number');
    expect(typeof stats.tasksCompletedToday).toBe('number');
    expect(typeof stats.openInvoices).toBe('number');
    expect(typeof stats.totalPayroll).toBe('number');
    expect(stats.serverStatus).toBe('Healthy');
    expect(typeof stats.securityIncidents).toBe('number');
  });

  test('employee cannot access live stats (403)', async ({ request }) => {
    expect((await request.get('/api/admin/live-stats', { headers: auth(empToken) })).status()).toBe(403);
  });

  test('unauthenticated → 401', async ({ request }) => {
    expect((await request.get('/api/admin/live-stats')).status()).toBe(401);
  });

  test('?tz=Asia/Kolkata does not break the response', async ({ request }) => {
    const res = await request.get('/api/admin/live-stats?tz=Asia/Kolkata', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect(typeof (await res.json()).stats.tasksCompletedToday).toBe('number');
  });
});

// ─── GET /api/health ──────────────────────────────────────────────────────────

test.describe('GET /api/health', () => {
  test('returns 200 without any auth token', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
  });

  test('response contains status field', async ({ request }) => {
    const body = await (await request.get('/api/health')).json();
    expect(body.status ?? body.ok ?? body.message ?? body.health).toBeTruthy();
  });
});
