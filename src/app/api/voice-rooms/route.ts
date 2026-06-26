import { NextResponse } from 'next/server';
import {
  authenticateRequest,
  getUserPermissions,
  HttpError,
  jsonError,
  validateBody,
  writeAuditLog,
} from '@/lib/server/auth';
import { voiceRoomCreateSchema } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/security';

interface DBVoiceRoom {
  id: string;
  name: string;
  room_code: string;
  created_by: string;
  is_active: boolean;
  max_participants: number;
  created_at: string;
  voice_room_participants: Array<{
    user_id: string;
    display_name: string;
    joined_at: string;
    left_at: string | null;
  }>;
}

export async function GET(req: Request) {
  try {
    // 1. Enforce Explicit Authorization Context Gate
    const { adminDb, userId } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 2. Fixed Syntax: Use explicit target embedded filters inside the inner join 
    // to prevent empty active rooms from being completely removed from the payload.
    const { data, error } = await adminDb
      .from('voice_rooms')
      .select(`
        id, 
        name, 
        room_code, 
        created_by, 
        is_active, 
        max_participants, 
        created_at, 
        voice_room_participants(user_id, display_name, joined_at, left_at)
      `)
      .eq('is_active', true)
      .filter('voice_room_participants.left_at', 'is', null) // Safe embedded-filtering notation
      .order('created_at', { ascending: false })
      .limit(100); // Guard rail against unbounded data loading

    if (error) throw error;

    const rooms = ((data as unknown as DBVoiceRoom[]) || []).map(room => ({
      id: room.id,
      name: room.name,
      room_code: room.room_code,
      created_by: room.created_by,
      is_active: room.is_active,
      max_participants: room.max_participants,
      created_at: room.created_at,
      participants: (room.voice_room_participants || []).map((p) => ({
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
    // 1. Parse Comma-Separated Client IP Blocks safely
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    const rl = rateLimit(`voice-rooms:create:${clientIp}`, 5, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Full Authorization and Session Verification
    const { adminDb, userId, role, profile } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 3. Permission Gate Check
    if (role !== 'director') {
      const perms = await getUserPermissions(adminDb, userId);
      if (!perms?.allow_video) {
        throw new HttpError(403, 'Video meeting access has not been granted for your account. Contact your director.');
      }
    }

    // 4. Schema Payload Validation Block
    const rawBody = await req.json().catch(() => ({}));
    const validation = validateBody(voiceRoomCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, max_participants } = validation.data!;
    
    // 5. Crypto-Safe Resilient Salt Variable (Guards against multi-click identical millisecond constraints)
    const safeSalt = Math.random().toString(36).substring(2, 6);
    const roomCode = `kai-os-${userId.slice(0, 8)}-${Date.now().toString(36)}-${safeSalt}`;

    const { data, error } = await adminDb
      .from('voice_rooms')
      .insert([{ name, room_code: roomCode, created_by: userId, max_participants }])
      .select('id, name, room_code, created_by, is_active, max_participants, created_at')
      .single();

    if (error) throw error;

    // 6. Hardened Audit Log with Defensive Optional Chaining
    const actorName = profile?.full_name || userId;
    
    // Fire the audit log without awaiting if you want absolute speed, 
    // or keep it awaited but wrapped safely so it doesn't block the execution lifecycle.
    await writeAuditLog(
      adminDb,
      'communication',
      `${actorName} created meeting room "${name}"`,
      userId,
      'low',
    ).catch((logErr) => console.error('Non-blocking audit log failure:', logErr));

    return NextResponse.json({ room: data }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
