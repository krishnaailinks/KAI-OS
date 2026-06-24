/**
 * @jest-environment node
 */

jest.mock('@/lib/server/auth', () => ({
  requireDirector: jest.fn(),
  jsonError: (err: unknown) => {
    const e = err as { status?: number; message?: string };
    return new Response(JSON.stringify({ error: e?.message ?? String(err) }), { status: e?.status ?? 500 });
  },
}));

import { GET } from '@/app/api/health/route';

const makeReq = (path = '/api/health') => new Request(`http://localhost${path}`);

describe('GET /api/health', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 200 with { status: ok } publicly (no auth)', async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  it('does not expose sensitive metrics publicly', async () => {
    const res = await GET(makeReq());
    const body = await res.json();
    expect(body.uptime).toBeUndefined();
    expect(body.memory).toBeUndefined();
    expect(body.nodeVersion).toBeUndefined();
  });

  it('returns detailed metrics for director with ?detail=true', async () => {
    const { requireDirector } = require('@/lib/server/auth');
    (requireDirector as jest.Mock).mockResolvedValue({ userId: 'dir-001', role: 'director' });

    const res = await GET(makeReq('/api/health?detail=true'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('healthy');
    expect(typeof body.uptime).toBe('number');
    expect(body.memory).toBeDefined();
  });

  it('returns 403 for non-director requesting ?detail=true', async () => {
    const { requireDirector } = require('@/lib/server/auth');
    (requireDirector as jest.Mock).mockRejectedValue(
      Object.assign(new Error('Director clearance required'), { status: 403 }),
    );

    const res = await GET(makeReq('/api/health?detail=true'));
    expect(res.status).toBe(403);
  });
});
