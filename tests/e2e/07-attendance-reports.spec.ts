/**
 * 07 – Attendance & Daily Reports
 *
 * Covers: employee check-in, check-out, double check-in prevention,
 * daily report submit + upsert, director timesheet / report views,
 * client 403 rejection, date validation.
 */
import { test, expect } from '@playwright/test';
import { getTokens } from './setup/helpers';

let dirToken    = '';
let empToken    = '';
let clientToken = '';

test.beforeAll(() => {
  const tokens = getTokens();
  dirToken    = tokens.director;
  empToken    = tokens.employee;
  clientToken = tokens.client;
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── Attendance ────────────────────────────────────────────────────────────────

test.describe('Attendance: check-in', () => {
  test('employee checks in → 201, record has check_in timestamp', async ({ request }) => {
    // Check if already checked in today (idempotent test runs)
    const existing = await request.get('/api/attendance', { headers: auth(empToken) });
    const existingBody = await existing.json();
    if (existingBody.log?.check_in) {
      // Already checked in — just verify the record exists
      expect(existingBody.log.check_in).toBeTruthy();
      return;
    }

    const res  = await request.post('/api/attendance', {
      headers: auth(empToken),
      data:    { action: 'check_in', tz: 'Asia/Kolkata' },
    });
    expect(res.status()).toBe(201);
    const { log } = await res.json();
    expect(log.check_in).toBeTruthy();
    expect(log.check_out).toBeFalsy();
    expect(log.status).toBe('present');
  });

  test('double check-in on the same day returns 409', async ({ request }) => {
    // Ensure we're already checked in
    const first = await request.post('/api/attendance', {
      headers: auth(empToken),
      data:    { action: 'check_in' },
    });
    // If first one already succeeded or we were already in, try a second
    if ([201, 409].includes(first.status())) {
      if (first.status() === 201) {
        const second = await request.post('/api/attendance', {
          headers: auth(empToken),
          data:    { action: 'check_in' },
        });
        expect(second.status()).toBe(409);
      }
    }
  });

  test('client cannot check in (403)', async ({ request }) => {
    const res = await request.post('/api/attendance', {
      headers: auth(clientToken),
      data:    { action: 'check_in' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Attendance: check-out', () => {
  test('employee checks out → check_out timestamp is set', async ({ request }) => {
    // Ensure checked in first
    await request.post('/api/attendance', {
      headers: auth(empToken),
      data:    { action: 'check_in' },
    });

    const res  = await request.post('/api/attendance', {
      headers: auth(empToken),
      data:    { action: 'check_out', tz: 'Asia/Kolkata' },
    });
    expect([200, 201]).toContain(res.status());
    const { log } = await res.json();
    expect(log.check_out).toBeTruthy();
  });
});

test.describe('Attendance: director view', () => {
  test('director sees all employees attendance with date filter', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const res   = await request.get(
      `/api/attendance?all=true&startDate=${today}&endDate=${today}`,
      { headers: auth(dirToken) },
    );
    expect(res.status()).toBe(200);
    const { logs } = await res.json();
    expect(Array.isArray(logs)).toBe(true);
  });

  test('invalid date format returns 400', async ({ request }) => {
    const res = await request.get(
      '/api/attendance?all=true&startDate=not-a-date',
      { headers: auth(dirToken) },
    );
    expect([400, 422]).toContain(res.status());
  });

  test('employee cannot view all attendance (403)', async ({ request }) => {
    const res = await request.get('/api/attendance?all=true', { headers: auth(empToken) });
    expect(res.status()).toBe(403);
  });
});

// ─── Daily reports ─────────────────────────────────────────────────────────────

test.describe('Daily reports: submit', () => {
  test('employee submits a daily report → 201', async ({ request }) => {
    const text = `Daily standup: worked on feature X — ${Date.now()}`;
    const res  = await request.post('/api/daily-reports', {
      headers: auth(empToken),
      data:    { report_text: text, tz: 'Asia/Kolkata' },
    });
    expect([200, 201]).toContain(res.status());
    const { report } = await res.json();
    expect(report.report_text).toBe(text);
  });

  test('submitting again on same day updates the report (upsert)', async ({ request }) => {
    const updated = `Updated report — ${Date.now()}`;
    const first   = await request.post('/api/daily-reports', {
      headers: auth(empToken),
      data:    { report_text: 'Initial report' },
    });
    const second  = await request.post('/api/daily-reports', {
      headers: auth(empToken),
      data:    { report_text: updated },
    });
    expect([200, 201]).toContain(second.status());
    const { report } = await second.json();
    expect(report.report_text).toBe(updated);
    // Should have the same id (upserted, not duplicated)
    const firstReport  = (await first.json()).report;
    const secondReport = report;
    expect(secondReport.id).toBe(firstReport.id);
  });

  test('empty report_text returns 400', async ({ request }) => {
    const res = await request.post('/api/daily-reports', {
      headers: auth(empToken),
      data:    { report_text: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('client cannot submit daily report (403)', async ({ request }) => {
    const res = await request.post('/api/daily-reports', {
      headers: auth(clientToken),
      data:    { report_text: 'Client report attempt' },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('Daily reports: director view', () => {
  test('director sees all reports with date filter', async ({ request }) => {
    const today = new Date().toISOString().split('T')[0];
    const res   = await request.get(
      `/api/daily-reports?all=true&startDate=${today}&endDate=${today}`,
      { headers: auth(dirToken) },
    );
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).reports)).toBe(true);
  });

  test('employee cannot view all reports (403)', async ({ request }) => {
    const res = await request.get('/api/daily-reports?all=true', { headers: auth(empToken) });
    expect(res.status()).toBe(403);
  });

  test('employee sees only own report via GET /api/daily-reports', async ({ request }) => {
    const res = await request.get('/api/daily-reports', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    const { report } = await res.json();
    // report is null if not submitted today, or an object if submitted
    if (report !== null) {
      expect(typeof report.report_text).toBe('string');
    }
  });
});
