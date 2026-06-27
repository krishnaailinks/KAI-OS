/**
 * 12 – Secure Admin Workflows
 *
 * Covers: 
 * - POST /api/admin/directors/invite (Director only, generates invite)
 * - POST /api/auth/register (Registers new director with invite)
 * - POST /api/admin/clients/provision (Director only, provisions a client)
 */
import { test, expect } from '@playwright/test';
import { DIRECTOR, EMPLOYEE, getTokens, getUserId } from './setup/helpers';

let dirToken = '';
let empToken = '';

test.beforeAll(async () => {
  const tokens = getTokens();
  dirToken = tokens.director;
  empToken = tokens.employee;
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── POST /api/admin/directors/invite ────────────────────────────────────────

test.describe('POST /api/admin/directors/invite', () => {
  test('employee gets 403 (requireDirector gate)', async ({ request }) => {
    const res = await request.post('/api/admin/directors/invite', {
      headers: auth(empToken),
      data: { email: 'newdir@example.com' }
    });
    expect(res.status()).toBe(403);
  });

  test('director generates invite token successfully', async ({ request }) => {
    const res = await request.post('/api/admin/directors/invite', {
      headers: auth(dirToken),
      data: { email: 'test_director_invite@example.com' }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.token).toBeDefined();
    expect(body.token.length).toBe(64);
  });
});

// ─── POST /api/auth/register (Director Invite Flow) ──────────────────────────

test.describe('POST /api/auth/register (Director)', () => {
  let inviteToken = '';
  const uniqueEmail = `registered_director_${Date.now()}@example.com`;

  test.beforeAll(async ({ request }) => {
    // Generate an invite token to use for registration
    const res = await request.post('/api/admin/directors/invite', {
      headers: auth(dirToken),
      data: { email: uniqueEmail }
    });
    const body = await res.json();
    inviteToken = body.token;
  });

  test('rejects registration with invalid token', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: 'hacker@example.com',
        password: 'Password123!',
        name: 'Hacker',
        accountType: 'director',
        accessCode: 'invalid_token_xyz'
      }
    });
    expect(res.status()).toBe(403);
  });

  test('registers successfully with valid token', async ({ request }) => {
    const res = await request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: uniqueEmail,
        password: 'Password123!',
        name: 'New Director',
        accountType: 'director',
        accessCode: inviteToken
      }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user_id).toBeDefined();
    expect(body.role).toBe('director');
  });

  test('rejects registration with used token', async ({ request }) => {
    // Attempting to register again with the same token should fail
    const res = await request.post('/api/auth/register', {
      headers: { 'Content-Type': 'application/json' },
      data: {
        email: 'another_director@example.com',
        password: 'Password123!',
        name: 'Another Director',
        accountType: 'director',
        accessCode: inviteToken
      }
    });
    expect(res.status()).toBe(403);
  });
});

// ─── POST /api/admin/clients/provision ───────────────────────────────────────

test.describe('POST /api/admin/clients/provision', () => {
  test('employee gets 403 (requireDirector gate)', async ({ request }) => {
    const res = await request.post('/api/admin/clients/provision', {
      headers: auth(empToken),
      data: { 
        companyName: 'Test Client', 
        contactEmail: 'client@example.com',
        password: 'Password123!'
      }
    });
    expect(res.status()).toBe(403);
  });

  test('director provisions a new client successfully', async ({ request }) => {
    const clientEmail = `client_${Date.now()}@example.com`;
    const res = await request.post('/api/admin/clients/provision', {
      headers: auth(dirToken),
      data: { 
        companyName: 'Acme Corp', 
        contactEmail: clientEmail,
        password: 'Password123!'
      }
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.user_id).toBeDefined();
    expect(body.success).toBe(true);
  });

  test('rejects provisioning if email already exists', async ({ request }) => {
    // Try to provision using the DIRECTOR's email
    const res = await request.post('/api/admin/clients/provision', {
      headers: auth(dirToken),
      data: { 
        companyName: 'Acme Corp 2', 
        contactEmail: DIRECTOR.email,
        password: 'Password123!'
      }
    });
    expect(res.status()).not.toBe(201);
  });
});
