import { NextResponse } from 'next/server';
import { authenticateRequest, HttpError, jsonError, validateBody, writeAuditLog } from '@/lib/server/auth';
import { messageSchema } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const channelSlug = (searchParams.get('channel') || 'general').toLowerCase();

    // Validate channel exists (not hardcoded — live from DB)
    const { data: channel, error: chErr } = await adminDb
      .from('channels')
      .select('slug, type')
      .eq('slug', channelSlug)
      .eq('is_archived', false)
      .maybeSingle();

    if (chErr) throw chErr;
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

    const { data, error } = await adminDb
      .from('team_messages')
      .select('id, channel_id, user_id, author_name, body, created_at')
      .eq('channel_id', channelSlug)
      .order('created_at', { ascending: true })
      .limit(100);

    if (error) throw error;

    return NextResponse.json({ messages: data || [] });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`messages:${clientIp}`, 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, userId, profile, role } = await authenticateRequest(req);
    const rawBody = await req.json();
    const validation = validateBody(messageSchema, rawBody);
    if (validation.error) return validation.error;

    const channelSlug = (validation.data!.channel_id || 'general').toLowerCase();

    // Validate channel exists and fetch its type
    const { data: channel, error: chErr } = await adminDb
      .from('channels')
      .select('slug, type')
      .eq('slug', channelSlug)
      .eq('is_archived', false)
      .maybeSingle();

    if (chErr) throw chErr;
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });

    // Announcement channels: only directors may post
    if (channel.type === 'announcement' && role !== 'director') {
      throw new HttpError(403, 'Only directors can post in announcement channels');
    }

    const { data, error } = await adminDb
      .from('team_messages')
      .insert([{
        channel_id: channelSlug,
        user_id: userId,
        author_name: profile.full_name || profile.email,
        body: validation.data!.body,
      }])
      .select('id, channel_id, user_id, author_name, body, created_at')
      .single();

    if (error) throw error;

    await writeAuditLog(adminDb, 'communication', `Message posted in #${channelSlug}`, userId, 'low');

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
