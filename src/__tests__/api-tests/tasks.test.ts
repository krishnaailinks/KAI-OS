/**
 * @jest-environment node
 */

jest.mock('@/lib/server/auth', () => ({
  authenticateRequest: jest.fn().mockRejectedValue(new Error('Unauthorized')),
  jsonError: (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  },
}));

jest.mock('@/lib/security', () => ({
  rateLimit: jest.fn().mockReturnValue({ allowed: true, remaining: 29, resetAt: Date.now() + 60000 }),
  parsePagination: jest.fn().mockReturnValue({ limit: 50, page: 1, from: 0, to: 49 }),
}));

import { GET } from '@/app/api/tasks/route';

describe('GET /api/tasks', () => {
  it('returns 500 when not authenticated', async () => {
    const req = new Request('http://localhost:3000/api/tasks');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
