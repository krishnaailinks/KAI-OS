/**
 * @jest-environment node
 */
import { POST } from '@/app/api/auth/register/route';

jest.mock('@/lib/security', () => ({
  ...jest.requireActual('@/lib/security'),
  checkRateLimit: jest.fn().mockResolvedValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60000 }),
  rateLimitResponse: jest.fn(),
}));

jest.mock('@/lib/server/auth', () => ({
  jsonError: (err: unknown) => {
    const message = err instanceof Error ? err.message : 'Server error';
    return new Response(JSON.stringify({ error: message }), { status: 500 });
  },
  validateBody: (schema: { safeParse: (data: unknown) => { success: boolean; error?: { format: () => unknown }; data?: unknown } }, data: unknown) => {
    const result = schema.safeParse(data);
    if (!result.success) {
      return { error: new Response(JSON.stringify({ error: 'Validation failed', details: result.error?.format() }), { status: 400 }) };
    }
    return { data: result.data };
  },
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'test-user-id' } }, error: null }),
      },
    },
    from: () => ({
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'test-profile-id' }, error: null }),
        }),
      }),
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

function createRequest(body: unknown): Request {
  return new Request('http://localhost:3000/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/register', () => {
  it('returns 400 for empty body', async () => {
    const req = createRequest({});
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing email', async () => {
    const req = createRequest({ password: 'TestPass123!', name: 'Test User', code: 'SECRET123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid email', async () => {
    const req = createRequest({ email: 'not-an-email', password: 'TestPass123!', name: 'Test User', code: 'SECRET123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for short password', async () => {
    const req = createRequest({ email: 'test@test.com', password: '123', name: 'Test User', code: 'SECRET123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing name', async () => {
    const req = createRequest({ email: 'test@test.com', password: 'TestPass123!', code: 'SECRET123' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing registration code', async () => {
    const req = createRequest({ email: 'test@test.com', password: 'TestPass123!', name: 'Test User' });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
