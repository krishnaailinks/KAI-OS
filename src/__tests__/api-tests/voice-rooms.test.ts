/**
 * @jest-environment node
 *
 * Unit tests for voice room endpoints.
 * Each test builds its own adminDb with explicit per-query chain objects,
 * avoiding shared mock-state conflicts between tests.
 *
 * Route → terminal Supabase call mapping:
 *   GET    voice-rooms            .order()          → { data: [...] }
 *   POST   voice-rooms            .single()         → { data: room }
 *   DELETE voice-rooms/[id]       SELECT .maybeSingle() + UPDATE terminal .eq()
 *   POST   voice-rooms/[id]/join  .maybeSingle() + .is() + .upsert()
 *   POST   voice-rooms/[id]/leave .update().eq().eq() (last eq is terminal)
 */

// ── Auth mock ─────────────────────────────────────────────────────────────────
// NOTE: Variables used inside the factory must NOT be declared before the mock
//       (hoisting TDZ). We use a mutable `let` captured via closure at call time.

let _mockAuthCtx: {
  userId: string;
  email: string;
  role: string;
  adminDb: unknown;
  db: unknown;
  profile: { id: string; email: string; full_name: string; role: string; status: string };
} | null = null;

jest.mock('@/lib/server/auth', () => ({
  authenticateRequest: jest.fn().mockImplementation(() => Promise.resolve(_mockAuthCtx)),
  requireDirector: jest.fn().mockImplementation(() => {
    if (_mockAuthCtx?.role !== 'director') {
      const e = Object.assign(new Error('Director clearance required'), { status: 403 });
      return Promise.reject(e);
    }
    return Promise.resolve(_mockAuthCtx);
  }),
  getUserPermissions: jest.fn(),
  jsonError: (err: unknown) => {
    const e = err as { status?: number; message?: string };
    return new Response(JSON.stringify({ error: e?.message ?? String(err) }), { status: e?.status ?? 500 });
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
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 4, resetAt: Date.now() + 60_000 }),
  rateLimitResponse: jest.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { GET, POST } from '@/app/api/voice-rooms/route';
import { DELETE as DELETE_ROOM } from '@/app/api/voice-rooms/[id]/route';
import { POST as JOIN } from '@/app/api/voice-rooms/[id]/join/route';
import { POST as LEAVE } from '@/app/api/voice-rooms/[id]/leave/route';

// ── Test contexts ─────────────────────────────────────────────────────────────

const makeCtx = (role: string, userId = `${role}-001`, adminDb: unknown = null) => ({
  userId,
  email: `${role}@test.com`,
  role,
  adminDb,
  db: adminDb,
  profile: { id: userId, email: `${role}@test.com`, full_name: role === 'director' ? 'The Director' : 'Alice', role, status: 'Online' },
});

// ── DB helpers ────────────────────────────────────────────────────────────────

/** Simple select chain: .select()?.eq()?.maybeSingle() */
function selectMaybeSingle(result: unknown) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn(),
    maybeSingle: jest.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  return chain;
}

/** Simple select chain ending in .eq()?.order() */
function selectOrder(result: unknown) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn().mockResolvedValue(result),
    is: jest.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.is.mockReturnValue(chain);
  return chain;
}

/** SELECT capacity chain ending in .is() */
function selectIs(result: unknown) {
  const chain: Record<string, jest.Mock> = {
    select: jest.fn(),
    eq: jest.fn(),
    is: jest.fn().mockResolvedValue(result),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

/** UPDATE chain where last .eq() is the terminal (awaited) call */
function updateLastEq(result: unknown) {
  const terminal = { eq: jest.fn().mockResolvedValue(result) };
  const chain = { update: jest.fn().mockReturnValue(terminal), eq: jest.fn().mockReturnValue(terminal) };
  return chain;
}

/** Two-level UPDATE chain: .update().eq('a').eq('b') — last eq is terminal */
function updateTwoEq(result: unknown) {
  const terminalChain = { eq: jest.fn().mockResolvedValue(result) };
  const midChain = { eq: jest.fn().mockReturnValue(terminalChain) };
  return { update: jest.fn().mockReturnValue(midChain) };
}

/** INSERT chain ending in .select().single() */
function insertSingle(result: unknown) {
  const chain: Record<string, jest.Mock> = {
    insert: jest.fn(),
    select: jest.fn(),
    single: jest.fn().mockResolvedValue(result),
  };
  chain.insert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  return chain;
}

/** Build adminDb whose from() calls return chains in order */
function makeAdminDb(...chains: Array<Record<string, jest.Mock>>) {
  const queue = [...chains];
  return { from: jest.fn().mockImplementation(() => queue.shift()!) };
}

// ── Request helpers ───────────────────────────────────────────────────────────

const makeReq = (url: string, opts?: RequestInit) => new Request(url, opts);
const makeParams = (id: string) => Promise.resolve({ id });
const jsonPost = (url: string, body: object) =>
  makeReq(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

// ── Tests: GET /api/voice-rooms ───────────────────────────────────────────────

describe('GET /api/voice-rooms', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns room list with only active participants', async () => {
    const adminDb = makeAdminDb(
      selectOrder({
        data: [{
          id: 'room-1', name: 'Standup', room_code: 'kai-os-abc', created_by: 'director-001',
          is_active: true, max_participants: 20, created_at: '2026-01-01',
          voice_room_participants: [
            { user_id: 'u1', display_name: 'Alice', joined_at: '2026-01-01', left_at: null },
            { user_id: 'u2', display_name: 'Bob', joined_at: '2026-01-01', left_at: '2026-01-01T10:00:00Z' },
          ],
        }],
        error: null,
      }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await GET(makeReq('http://localhost/api/voice-rooms'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rooms).toHaveLength(1);
    expect(body.rooms[0].participants).toHaveLength(1);   // Bob (left_at set) filtered out
    expect(body.rooms[0].participants[0].display_name).toBe('Alice');
  });

  it('returns 401 when unauthenticated', async () => {
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockRejectedValue(
      Object.assign(new Error('No token'), { status: 401 }),
    );
    const res = await GET(makeReq('http://localhost/api/voice-rooms'));
    expect(res.status).toBe(401);
  });
});

// ── Tests: POST /api/voice-rooms ──────────────────────────────────────────────

describe('POST /api/voice-rooms', () => {
  beforeEach(() => jest.clearAllMocks());

  it('director creates a room (no permission check)', async () => {
    const adminDb = makeAdminDb(insertSingle({ data: { id: 'r1', name: 'Sprint Review', room_code: 'kai-os-test', created_by: 'director-001', is_active: true, max_participants: 20, created_at: '2026-01-01' }, error: null }));
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest, writeAuditLog } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (writeAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await POST(jsonPost('http://localhost/api/voice-rooms', { name: 'Sprint Review' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.room.name).toBe('Sprint Review');
  });

  it('employee with allow_video creates a room', async () => {
    const adminDb = makeAdminDb(insertSingle({ data: { id: 'r2', name: 'Design Review', room_code: 'kai-os-xyz', created_by: 'emp-001', is_active: true, max_participants: 20, created_at: '2026-01-01' }, error: null }));
    _mockAuthCtx = makeCtx('employee', 'emp-001', adminDb);
    const { authenticateRequest, getUserPermissions, writeAuditLog } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (getUserPermissions as jest.Mock).mockResolvedValue({ allow_video: true });
    (writeAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await POST(jsonPost('http://localhost/api/voice-rooms', { name: 'Design Review' }));
    expect(res.status).toBe(201);
  });

  it('employee without allow_video gets 403', async () => {
    const adminDb = makeAdminDb();
    _mockAuthCtx = makeCtx('employee', 'emp-002', adminDb);
    const { authenticateRequest, getUserPermissions } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (getUserPermissions as jest.Mock).mockResolvedValue({ allow_video: false });

    const res = await POST(jsonPost('http://localhost/api/voice-rooms', { name: 'Secret Room' }));
    expect(res.status).toBe(403);
  });

  it('returns 429 when rate limited', async () => {
    const { rateLimit } = require('@/lib/security');
    (rateLimit as jest.Mock).mockReturnValue({ allowed: false, remaining: 0, resetAt: Date.now() + 60_000 });
    _mockAuthCtx = makeCtx('director', 'director-001', makeAdminDb());
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await POST(jsonPost('http://localhost/api/voice-rooms', { name: 'test' }));
    expect(res.status).toBe(429);
  });
});

// ── Tests: DELETE /api/voice-rooms/[id] ──────────────────────────────────────

describe('DELETE /api/voice-rooms/[id]', () => {
  beforeEach(() => jest.clearAllMocks());

  it('director can end any room', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r1', name: 'Standup', created_by: 'emp-001', is_active: true }, error: null }),
      updateLastEq({ error: null }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest, writeAuditLog } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (writeAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await DELETE_ROOM(makeReq('http://localhost/api/voice-rooms/r1', { method: 'DELETE' }), { params: makeParams('r1') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('employee who created the room can end it', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r2', name: 'My Room', created_by: 'emp-001', is_active: true }, error: null }),
      updateLastEq({ error: null }),
    );
    _mockAuthCtx = makeCtx('employee', 'emp-001', adminDb);
    const { authenticateRequest, writeAuditLog } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (writeAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await DELETE_ROOM(makeReq('http://localhost/api/voice-rooms/r2', { method: 'DELETE' }), { params: makeParams('r2') });
    expect(res.status).toBe(200);
  });

  it('non-creator employee gets 403', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r3', name: "Director's Room", created_by: 'director-001', is_active: true }, error: null }),
    );
    _mockAuthCtx = makeCtx('employee', 'emp-002', adminDb);  // different userId than creator
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await DELETE_ROOM(makeReq('http://localhost/api/voice-rooms/r3', { method: 'DELETE' }), { params: makeParams('r3') });
    expect(res.status).toBe(403);
  });

  it('returns 404 for non-existent room', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: null, error: null }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await DELETE_ROOM(makeReq('http://localhost/api/voice-rooms/ghost', { method: 'DELETE' }), { params: makeParams('ghost') });
    expect(res.status).toBe(404);
  });

  it('returns 410 for already-ended room', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r5', name: 'Old', created_by: 'director-001', is_active: false }, error: null }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await DELETE_ROOM(makeReq('http://localhost/api/voice-rooms/r5', { method: 'DELETE' }), { params: makeParams('r5') });
    expect(res.status).toBe(410);
  });
});

// ── Tests: POST /api/voice-rooms/[id]/join ────────────────────────────────────

describe('POST /api/voice-rooms/[id]/join', () => {
  beforeEach(() => jest.clearAllMocks());

  it('director can join without allow_video check', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r1', name: 'Standup', room_code: 'kai-os-abc', is_active: true, max_participants: 20 }, error: null }),
      selectIs({ count: 2, error: null }),
      { upsert: jest.fn().mockResolvedValue({ error: null }) },
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest, writeAuditLog } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (writeAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await JOIN(makeReq('http://localhost/api/voice-rooms/r1/join', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.room_code).toBe('kai-os-abc');
  });

  it('employee with allow_video can join', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r1', name: 'Standup', room_code: 'kai-os-abc', is_active: true, max_participants: 20 }, error: null }),
      selectIs({ count: 3, error: null }),
      { upsert: jest.fn().mockResolvedValue({ error: null }) },
    );
    _mockAuthCtx = makeCtx('employee', 'emp-001', adminDb);
    const { authenticateRequest, getUserPermissions, writeAuditLog } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (getUserPermissions as jest.Mock).mockResolvedValue({ allow_video: true });
    (writeAuditLog as jest.Mock).mockResolvedValue(undefined);

    const res = await JOIN(makeReq('http://localhost/api/voice-rooms/r1/join', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.room_code).toBe('kai-os-abc');
  });

  it('employee without allow_video gets 403', async () => {
    const adminDb = makeAdminDb();
    _mockAuthCtx = makeCtx('employee', 'emp-002', adminDb);
    const { authenticateRequest, getUserPermissions } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);
    (getUserPermissions as jest.Mock).mockResolvedValue({ allow_video: false });

    const res = await JOIN(makeReq('http://localhost/api/voice-rooms/r1/join', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(403);
  });

  it('returns 404 when room does not exist', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: null, error: null }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await JOIN(makeReq('http://localhost/api/voice-rooms/ghost/join', { method: 'POST' }), { params: makeParams('ghost') });
    expect(res.status).toBe(404);
  });

  it('returns 410 when room has ended', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r1', name: 'Old', room_code: 'kai-os-old', is_active: false, max_participants: 20 }, error: null }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await JOIN(makeReq('http://localhost/api/voice-rooms/r1/join', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(410);
  });

  it('returns 409 when room is full', async () => {
    const adminDb = makeAdminDb(
      selectMaybeSingle({ data: { id: 'r1', name: 'Full Room', room_code: 'kai-os-full', is_active: true, max_participants: 5 }, error: null }),
      selectIs({ count: 5, error: null }),
    );
    _mockAuthCtx = makeCtx('director', 'director-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await JOIN(makeReq('http://localhost/api/voice-rooms/r1/join', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(409);
  });
});

// ── Tests: POST /api/voice-rooms/[id]/leave ───────────────────────────────────

describe('POST /api/voice-rooms/[id]/leave', () => {
  beforeEach(() => jest.clearAllMocks());

  it('successfully marks participant as left', async () => {
    const adminDb = makeAdminDb(updateTwoEq({ error: null }));
    _mockAuthCtx = makeCtx('employee', 'emp-001', adminDb);
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockResolvedValue(_mockAuthCtx);

    const res = await LEAVE(makeReq('http://localhost/api/voice-rooms/r1/leave', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const { authenticateRequest } = require('@/lib/server/auth');
    (authenticateRequest as jest.Mock).mockRejectedValue(
      Object.assign(new Error('No token'), { status: 401 }),
    );

    const res = await LEAVE(makeReq('http://localhost/api/voice-rooms/r1/leave', { method: 'POST' }), { params: makeParams('r1') });
    expect(res.status).toBe(401);
  });
});
