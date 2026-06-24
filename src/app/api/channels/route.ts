import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, requireDirector, validateBody, writeAuditLog } from '@/lib/server/auth';
import { channelCreateSchema } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);

    const { data, error } = await adminDb
      .from('channels')
      .select('id, name, slug, type, description, created_by, created_at')
      .eq('is_archived', false)
      .order('created_at', { ascending: true });

    if (error) throw error;

    return NextResponse.json({ channels: data || [] });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`channels:create:${clientIp}`, 10, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, userId } = await requireDirector(req);
    const rawBody = await req.json();
    const validation = validateBody(channelCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, type, description } = validation.data!;
    // Derive slug: lowercase, non-alphanumeric → hyphen, trim leading/trailing hyphens
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const { data, error } = await adminDb
      .from('channels')
      .insert([{ name, slug, type, description: description || null, created_by: userId }])
      .select('id, name, slug, type, description, created_by, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A channel with that name already exists' }, { status: 409 });
      }
      throw error;
    }

    await writeAuditLog(
      adminDb,
      'communication',
      `Director created ${type} channel #${slug}`,
      userId,
      'medium',
    );

    return NextResponse.json({ channel: data }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
