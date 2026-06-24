/**
 * @jest-environment node
 *
 * Unit tests for /api/channels and /api/channels/[id].
 * Uses per-test from() chains to avoid shared-mock state conflicts.
 */

// ── Auth mock (no variable references — jest.mock is hoisted) ────────────────
jest.mock('@/lib/server/auth', () => ({
  authenticateRequest: jest.fn(),
  requireDirector: jest.fn(),
  jsonError: (err: unknown) => {
    const e = err as { status?: number; message?: string };
    return new Response(JSON.stringify({ error: e?.message || String(err) }), { status: e?.status || 500 });
  },
  validateBody: jest.fn((schema, body) => {
    const r = schema.safeParse(body);
    if (!r.success) return { error: new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 }) };
    return { data: r.data };
  }),
  writeAuditLog: jest.fn().mockResolvedValue(undefined),
  HttpError: class HttpError extends Error {
    status: number;
    constructor(status: number, msg: string) { super(msg); this.status = status; }
  },
}));

jest.mock('@/lib/security', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 9, resetAt: Date.now() + 60000 }),
  rateLimitResponse: jest.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

// ── Test data ─────────────────────────────────────────────────────────────────

const DIRECTOR = {
  userId: 'director-uuid',
  email: 'director@test.com',
  role: 'director',
  profile: { id: 'director-uuid', email: 'director@test.com', full_name: 'Director', role: 'director', status: 'Online' },
  db: {} as never,
  adminDb: {} as never,
};

const EMPLOYEE = {
  ...DIRECTOR,
  userId: 'emp-uuid',
  role: 'employee',
  profile: { ...DIRECTOR.profile, id: 'emp-uuid', role: 'employee' },
};

// Build an adminDb that uses per-query from() chains
function makeAdminDb(...queryResults: Array<unknown>) {
  const queue = [...queryResults];
  return {
    from: jest.fn(() => {
      const result = queue.shift() ?? { data: null, error: null };
      return {
        select: jest.fn().mockReturnThis(),
        insert: jest.fn().mockReturnThis(),
        update: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue(result),
        maybeSingle: jest.fn().mockResolvedValue(result),
        single: jest.fn().mockResolvedValue(result),
      };
    }),
  };
}

import { GET, POST } from '@/app/api/channels/route';
import { DELETE } from '@/app/api/channels/[id]/route';

const { requireDirector, authenticateRequest, writeAuditLog } = require('@/lib/server/auth');

const req = (url: string, opts?: RequestInit) => new Request(url, opts);
const postReq = (body: object) =>
  req('http://localhost/api/channels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ── GET /api/channels ─────────────────────────────────────────────────────────

describe('GET /api/channels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns channel list', async () => {
    const channelData = [
      { id: '1', name: 'General', slug: 'general', type: 'text', description: null, created_by: null, created_at: '2026-01-01' },
    ];
    const db = makeAdminDb({ data: channelData, error: null });
    authenticateRequest.mockResolvedValue({ ...DIRECTOR, adminDb: db });

    const res = await GET(req('http://localhost/api/channels'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.channels).toHaveLength(1);
    expect(body.channels[0].slug).toBe('general');
  });

  it('propagates DB errors as 500', async () => {
    const db = makeAdminDb({ data: null, error: new Error('DB down') });
    authenticateRequest.mockResolvedValue({ ...DIRECTOR, adminDb: db });

    const res = await GET(req('http://localhost/api/channels'));
    expect(res.status).toBe(500);
  });

  it('returns 401 when auth fails', async () => {
    authenticateRequest.mockRejectedValue(
      Object.assign(new Error('Missing bearer token'), { status: 401 }),
    );
    const res = await GET(req('http://localhost/api/channels'));
    expect(res.status).toBe(401);
  });
});

// ── POST /api/channels ────────────────────────────────────────────────────────

describe('POST /api/channels', () => {
  beforeEach(() => jest.clearAllMocks());

  it('creates a text channel and returns 201', async () => {
    const created = { id: 'new-id', name: 'Design', slug: 'design', type: 'text', description: null, created_by: 'director-uuid', created_at: '2026-01-01' };
    const db = makeAdminDb({ data: created, error: null });
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: db });
    writeAuditLog.mockResolvedValue(undefined);

    const res = await POST(postReq({ name: 'Design' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.channel.slug).toBe('design');
  });

  it('creates an announcement channel', async () => {
    const created = { id: 'ann-id', name: 'News', slug: 'news', type: 'announcement', description: null, created_by: 'director-uuid', created_at: '2026-01-01' };
    const db = makeAdminDb({ data: created, error: null });
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: db });
    writeAuditLog.mockResolvedValue(undefined);

    const res = await POST(postReq({ name: 'News', type: 'announcement' }));
    expect(res.status).toBe(201);
  });

  it('returns 409 on duplicate slug', async () => {
    const db = makeAdminDb({ data: null, error: { code: '23505', message: 'duplicate key' } });
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: db });

    const res = await POST(postReq({ name: 'General' }));
    expect(res.status).toBe(409);
  });

  it('returns 400 for empty channel name', async () => {
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: makeAdminDb() });
    const res = await POST(postReq({ name: '' }));
    expect(res.status).toBe(400);
  });

  it('returns 403 when called by employee', async () => {
    requireDirector.mockRejectedValue(
      Object.assign(new Error('Director clearance required'), { status: 403 }),
    );
    const res = await POST(postReq({ name: 'Secret' }));
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    const { rateLimit } = require('@/lib/security');
    rateLimit.mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: makeAdminDb() });

    const res = await POST(postReq({ name: 'test' }));
    expect(res.status).toBe(429);
  });
});

// ── DELETE /api/channels/[id] ─────────────────────────────────────────────────

describe('DELETE /api/channels/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  const makeParams = (id: string) => Promise.resolve({ id });

  it('director can archive a channel', async () => {
    const db = {
      from: jest.fn()
        .mockReturnValueOnce({
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'ch1', slug: 'design', name: 'Design' }, error: null }),
        })
        .mockReturnValueOnce({
          update: jest.fn().mockReturnThis(),
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
    };
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: db });
    writeAuditLog.mockResolvedValue(undefined);

    const res = await DELETE(req('http://localhost/api/channels/ch1', { method: 'DELETE' }), { params: makeParams('ch1') });
    expect(res.status).toBe(200);
  });

  it('refuses to delete the general channel', async () => {
    const db = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'gen', slug: 'general', name: 'General' }, error: null }),
      }),
    };
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: db });

    const res = await DELETE(req('http://localhost/api/channels/gen', { method: 'DELETE' }), { params: makeParams('gen') });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown channel id', async () => {
    const db = {
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };
    requireDirector.mockResolvedValue({ ...DIRECTOR, adminDb: db });

    const res = await DELETE(req('http://localhost/api/channels/ghost', { method: 'DELETE' }), { params: makeParams('ghost') });
    expect(res.status).toBe(404);
  });

  it('returns 403 when called by employee', async () => {
    requireDirector.mockRejectedValue(
      Object.assign(new Error('Director clearance required'), { status: 403 }),
    );
    const res = await DELETE(req('http://localhost/api/channels/ch1', { method: 'DELETE' }), { params: makeParams('ch1') });
    expect(res.status).toBe(403);
  });
});
