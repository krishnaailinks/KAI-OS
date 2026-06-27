import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  HttpError,
  jsonError,
  validateBody,
  writeAuditLog,
} from '@/lib/server/auth';
import { voiceRoomCreateSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);

    const { data, error } = await adminDb
      .from('voice_rooms')
      .select('id, name, room_code, created_by, is_active, max_participants, created_at, voice_room_participants(user_id, display_name, joined_at, left_at)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Strip participants who have left
    const rooms = (data || []).map(room => ({
      id: room.id,
      name: room.name,
      room_code: room.room_code,
      created_by: room.created_by,
      is_active: room.is_active,
      max_participants: room.max_participants,
      created_at: room.created_at,
      participants: (Array.isArray(room.voice_room_participants) ? room.voice_room_participants : [])
        .filter((p: { left_at: string | null }) => !p.left_at)
        .map((p: { user_id: string; display_name: string }) => ({
          user_id: p.user_id,
          display_name: p.display_name,
        })),
    }));

    return NextResponse.json({ rooms });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`voice-rooms:create:${getClientIp(req)}`, 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, userId, role, profile, permissions } = await authenticateRequest(req);

    // allow_video permission gates meeting room creation (directors always allowed).
    // permissions.allowVideo is fetched as part of the auth join — no extra DB call.
    if (role !== 'director' && !permissions.allowVideo) {
      throw new HttpError(403, 'Video meeting access has not been granted for your account. Contact your director.');
    }

    const rawBody = await req.json().catch(() => ({}));
    const validation = validateBody(voiceRoomCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, max_participants } = validation.data!;
    // Unique room code used as the Jitsi Meet room identifier
    const roomCode = `kai-os-${userId.slice(0, 8)}-${Date.now().toString(36)}`;

    const { data, error } = await adminDb
      .from('voice_rooms')
      .insert([{ name, room_code: roomCode, created_by: userId, max_participants }])
      .select('id, name, room_code, created_by, is_active, max_participants, created_at')
      .single();

    if (error) throw error;

    await writeAuditLog(
      adminDb,
      'communication',
      `${profile.full_name || userId} created meeting room "${name}"`,
      userId,
      'low',
    );

    return NextResponse.json({ room: data }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
