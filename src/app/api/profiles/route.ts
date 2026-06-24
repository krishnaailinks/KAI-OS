import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';
import { parsePagination, rateLimit, rateLimitResponse } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`profiles:${clientIp}`, 60, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, role } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const { from, to } = parsePagination(searchParams, 50, 200);

    const selectFields = role === 'director'
      ? '*'
      : 'id, user_id, full_name, avatar_url, phone_number, address, job_title, joined_at, created_at, updated_at';

    const { data: profiles, error, count } = await adminDb
      .from('employee_profiles')
      .select(selectFields, { count: 'exact' })
      .order('full_name', { ascending: true })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({ profiles, total: count ?? profiles?.length ?? 0 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
