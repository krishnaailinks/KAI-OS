/**
 * @jest-environment node
 *
 * Permission matrix tests for the messaging + channel system.
 *
 * Matrix:
 * ┌─────────────────────────────┬──────────────┬──────────────┬──────────────┐
 * │ Action                      │ Director     │ Employee     │ Client       │
 * ├─────────────────────────────┼──────────────┼──────────────┼──────────────┤
 * │ GET  /api/messages          │ any channel  │ any channel  │ any channel  │
 * │ POST /api/messages (text)   │ ✓            │ ✓            │ ✓            │
 * │ POST /api/messages (announ) │ ✓            │ 403          │ 403          │
 * │ POST /api/channels          │ ✓            │ 403          │ 403          │
 * │ DELETE /api/channels/[id]   │ ✓            │ 403          │ 403          │
 * │ POST /api/voice-rooms       │ ✓            │ 403 no video │ 403 no video │
 * │ DELETE /api/voice-rooms/[id]│ ✓            │ own only     │ N/A          │
 * └─────────────────────────────┴──────────────┴──────────────┴──────────────┘
 */

const mockAdminDb = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
  single: jest.fn(),
  order: jest.fn().mockReturnThis(),
};

const makeCtx = (role: string, userId = `${role}-uuid`) => ({
  userId,
  email: `${role}@test.com`,
  role,
  adminDb: mockAdminDb,
  db: mockAdminDb,
  profile: { id: userId, email: `${role}@test.com`, full_name: role, role, status: 'Online' },
});

let mockCtx = makeCtx('director');

jest.mock('@/lib/server/auth', () => ({
  authenticateRequest: jest.fn().mockImplementation(() => Promise.resolve(mockCtx)),
  requireDirector: jest.fn().mockImplementation(() => {
    if (mockCtx.role !== 'director') {
      const e = Object.assign(new Error('Director clearance required'), { status: 403 });
      return Promise.reject(e);
    }
    return Promise.resolve(mockCtx);
  }),
  getUserPermissions: jest.fn().mockResolvedValue({ allow_video: false, allow_audit: false, system_lockout: false }),
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
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60000 }),
  rateLimitResponse: jest.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

import { POST as POST_MESSAGES } from '@/app/api/messages/route';
import { POST as POST_CHANNELS } from '@/app/api/channels/route';
import { POST as POST_VOICE_ROOMS } from '@/app/api/voice-rooms/route';

const postReq = (url: string, body: Record<string, unknown>) =>
  new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

// ── Messages ──────────────────────────────────────────────────────────────────

describe('POST /api/messages — announcement channel restriction', () => {
  beforeEach(() => jest.clearAllMocks());

  const setupAnnouncementChannel = () => {
    mockAdminDb.maybeSingle.mockResolvedValueOnce({
      data: { slug: 'alerts', type: 'announcement' },
      error: null,
    });
  };

  it('director can post in announcement channel', async () => {
    mockCtx = makeCtx('director');
    setupAnnouncementChannel();
    mockAdminDb.single.mockResolvedValueOnce({
      data: { id: 'm1', channel_id: 'alerts', user_id: 'director-uuid', author_name: 'Director', body: 'Alert!', created_at: '2026-01-01' },
      error: null,
    });

    const res = await POST_MESSAGES(postReq('http://localhost/api/messages', { channel_id: 'alerts', body: 'Alert!' }));
    expect(res.status).toBe(201);
  });

  it('employee cannot post in announcement channel', async () => {
    mockCtx = makeCtx('employee');
    setupAnnouncementChannel();

    const res = await POST_MESSAGES(postReq('http://localhost/api/messages', { channel_id: 'alerts', body: 'I sneak in' }));
    expect(res.status).toBe(403);
  });

  it('client cannot post in announcement channel', async () => {
    mockCtx = makeCtx('client');
    setupAnnouncementChannel();

    const res = await POST_MESSAGES(postReq('http://localhost/api/messages', { channel_id: 'alerts', body: 'test' }));
    expect(res.status).toBe(403);
  });
});

describe('POST /api/messages — non-existent channel', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 404 for unknown channel slug', async () => {
    mockCtx = makeCtx('employee');
    mockAdminDb.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const res = await POST_MESSAGES(postReq('http://localhost/api/messages', { channel_id: 'non-existent', body: 'hi' }));
    expect(res.status).toBe(404);
  });
});

// ── Channels management ───────────────────────────────────────────────────────

describe('POST /api/channels — director-only', () => {
  beforeEach(() => jest.clearAllMocks());

  it('employee gets 403 on channel creation', async () => {
    mockCtx = makeCtx('employee');
    const res = await POST_CHANNELS(postReq('http://localhost/api/channels', { name: 'design' }));
    expect(res.status).toBe(403);
  });

  it('client gets 403 on channel creation', async () => {
    mockCtx = makeCtx('client');
    const res = await POST_CHANNELS(postReq('http://localhost/api/channels', { name: 'design' }));
    expect(res.status).toBe(403);
  });
});

// ── Voice rooms ───────────────────────────────────────────────────────────────

describe('POST /api/voice-rooms — requires allow_video', () => {
  beforeEach(() => jest.clearAllMocks());

  it('employee without allow_video gets 403', async () => {
    mockCtx = makeCtx('employee');
    const { getUserPermissions } = require('@/lib/server/auth');
    (getUserPermissions as jest.Mock).mockResolvedValueOnce({ allow_video: false, allow_audit: false, system_lockout: false });

    const res = await POST_VOICE_ROOMS(postReq('http://localhost/api/voice-rooms', { name: 'Test Room' }));
    expect(res.status).toBe(403);
  });

  it('director is never blocked by allow_video', async () => {
    mockCtx = makeCtx('director');
    mockAdminDb.single.mockResolvedValueOnce({
      data: { id: 'r1', name: 'Dir Room', room_code: 'kai-os-dir-abc123', created_by: 'director-uuid', is_active: true, max_participants: 20, created_at: '2026-01-01' },
      error: null,
    });

    const res = await POST_VOICE_ROOMS(postReq('http://localhost/api/voice-rooms', { name: 'Dir Room' }));
    expect(res.status).toBe(201);
  });
});

// ── Security: rate limiting ───────────────────────────────────────────────────

describe('Rate limiting enforcement', () => {
  beforeEach(() => jest.clearAllMocks());

  it('messages route respects rate limit', async () => {
    mockCtx = makeCtx('employee');
    const { rateLimit } = require('@/lib/security');
    (rateLimit as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST_MESSAGES(postReq('http://localhost/api/messages', { body: 'spam', channel_id: 'general' }));
    expect(res.status).toBe(429);
  });

  it('channels route respects rate limit', async () => {
    mockCtx = makeCtx('director');
    const { rateLimit } = require('@/lib/security');
    (rateLimit as jest.Mock).mockReturnValueOnce({ allowed: false, remaining: 0, resetAt: Date.now() + 60000 });

    const res = await POST_CHANNELS(postReq('http://localhost/api/channels', { name: 'test' }));
    expect(res.status).toBe(429);
  });
});
