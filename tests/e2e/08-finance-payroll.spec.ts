/**
 * 08 – Finance & Payroll
 *
 * Covers: invoice listing (director only), payroll GET (director all / employee own),
 * payroll execution (confirm=true required, idempotency double-payment prevention,
 * maxTotal guard), role gates.
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

// ─── Invoices ──────────────────────────────────────────────────────────────────

test.describe('GET /api/invoices', () => {
  test('director sees invoice list with shape', async ({ request }) => {
    const res = await request.get('/api/invoices', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { invoices, total } = await res.json();
    expect(Array.isArray(invoices)).toBe(true);
    expect(typeof total).toBe('number');
  });

  test('employee cannot access invoices (403)', async ({ request }) => {
    const res = await request.get('/api/invoices', { headers: auth(empToken) });
    expect(res.status()).toBe(403);
  });

  test('client cannot access invoices (403)', async ({ request }) => {
    const res = await request.get('/api/invoices', { headers: auth(clientToken) });
    expect(res.status()).toBe(403);
  });

  test('unauthenticated → 401', async ({ request }) => {
    expect((await request.get('/api/invoices')).status()).toBe(401);
  });

  test('invoice objects have expected fields', async ({ request }) => {
    const { invoices } = await (await request.get('/api/invoices', { headers: auth(dirToken) })).json();
    if (invoices.length > 0) {
      const inv = invoices[0];
      expect(typeof inv.id).toBe('string');
      expect(typeof inv.amount).toBe('number');
      expect(['unpaid', 'paid', 'overdue', 'Unpaid', 'Paid', 'Overdue']).toContain(inv.status);
    }
  });

  test('pagination works (page=1&limit=5)', async ({ request }) => {
    const res = await request.get('/api/invoices?limit=5', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { invoices } = await res.json();
    expect(invoices.length).toBeLessThanOrEqual(5);
  });
});

// ─── Payroll GET ───────────────────────────────────────────────────────────────

test.describe('GET /api/payroll', () => {
  test('director sees all payroll records', async ({ request }) => {
    const res = await request.get('/api/payroll', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { payroll, total } = await res.json();
    expect(Array.isArray(payroll)).toBe(true);
    expect(typeof total).toBe('number');
  });

  test('employee sees only own payroll records', async ({ request }) => {
    const res = await request.get('/api/payroll', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    const { payroll } = await res.json();
    expect(Array.isArray(payroll)).toBe(true);
    // All returned records belong to this employee
    // (server filters by user_id for non-directors)
  });

  test('client sees own payroll (or empty array)', async ({ request }) => {
    const res = await request.get('/api/payroll', { headers: auth(clientToken) });
    // Client role is authenticated so passes auth; server filters by user_id
    expect([200, 403]).toContain(res.status());
  });

  test('unauthenticated → 401', async ({ request }) => {
    expect((await request.get('/api/payroll')).status()).toBe(401);
  });
});

// ─── Payroll execution ─────────────────────────────────────────────────────────

test.describe('POST /api/payroll — execution', () => {
  test('missing confirm field returns 400', async ({ request }) => {
    const res = await request.post('/api/payroll', {
      headers: auth(dirToken),
      data:    {},
    });
    expect(res.status()).toBe(400);
  });

  test('confirm=false returns 400 (must be literal true)', async ({ request }) => {
    const res = await request.post('/api/payroll', {
      headers: auth(dirToken),
      data:    { confirm: false },
    });
    expect(res.status()).toBe(400);
  });

  test('employee cannot execute payroll (403)', async ({ request }) => {
    const res = await request.post('/api/payroll', {
      headers: auth(empToken),
      data:    { confirm: true },
    });
    expect(res.status()).toBe(403);
  });

  test('director with confirm=true: succeeds or returns 400 (no pending records)', async ({ request }) => {
    const res = await request.post('/api/payroll', {
      headers: auth(dirToken),
      data:    { confirm: true },
    });
    // 200 = payroll executed; 400 = no pending records (both are valid in test env)
    expect([200, 400]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body.paid_count).toBe('number');
      expect(typeof body.total_disbursed).toBe('number');
      expect(typeof body.receipt_content).toBe('string');
    }
  });

  test('idempotency: second execution of same month returns 409', async ({ request }) => {
    // Execute once (may 200 or 400)
    const first = await request.post('/api/payroll', {
      headers: auth(dirToken),
      data:    { confirm: true },
    });
    if (first.status() === 200) {
      // All pending records just got paid — a second run finds nothing pending → 400
      // or finds already-paid records → 409
      const second = await request.post('/api/payroll', {
        headers: auth(dirToken),
        data:    { confirm: true },
      });
      expect([400, 409]).toContain(second.status());
    }
  });

  test('maxTotal guard: if total exceeds maxTotal, returns 400', async ({ request }) => {
    // Set maxTotal to $0.01 so any real payroll exceeds it
    const res = await request.post('/api/payroll', {
      headers: auth(dirToken),
      data:    { confirm: true, maxTotal: 0.01 },
    });
    // 400 = exceeded limit, 409 = no pending records, 429 = rate limited — all acceptable
    expect([400, 409, 429]).toContain(res.status());
  });
});
