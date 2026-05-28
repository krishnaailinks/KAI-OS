import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog } from '@/lib/server/auth';

const allowedChannels = new Set(['general', 'engineering', 'alerts', 'nishant', 'alice']);

const normalizeChannel = (channel: string | null) => {
  if (!channel) return 'general';
  return allowedChannels.has(channel) ? channel : 'general';
};

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const channel = normalizeChannel(searchParams.get('channel'));

    const { data, error } = await adminDb
      .from('team_messages')
      .select('id, channel_id, user_id, author_name, body, created_at')
      .eq('channel_id', channel)
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
    const { adminDb, userId, profile } = await authenticateRequest(req);
    const body = await req.json();
    const channel = normalizeChannel(typeof body.channel_id === 'string' ? body.channel_id : null);
    const messageBody = typeof body.body === 'string' ? body.body.trim() : '';

    if (!messageBody) {
      return NextResponse.json({ error: 'Message body is required' }, { status: 400 });
    }

    const { data, error } = await adminDb
      .from('team_messages')
      .insert([{
        channel_id: channel,
        user_id: userId,
        author_name: profile.full_name || profile.email,
        body: messageBody,
      }])
      .select('id, channel_id, user_id, author_name, body, created_at')
      .single();

    if (error) throw error;

    await writeAuditLog(adminDb, 'communication', `Message posted in #${channel}`, userId, 'low');

    return NextResponse.json({ message: data }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
