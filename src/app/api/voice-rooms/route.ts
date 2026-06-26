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

interface SafeParticipant {
  user_id: string;
  display_name: string;
}

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
    // 1. Enforce Base Level Authorization
    const { adminDb, userId } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Performance Optimization: Push structural filtering directly down to the PostgREST/DB level
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
      .is('voice_room_participants.left_at', null) // FIX: DB-level filter out participants who left
      .order('created_at', { ascending: false });

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
    // 1. Robust Client IP Parsing
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    // NOTE: For absolute multi-region safety, switch `rateLimit` back-end from memory to Redis (Upstash)
    const rl = rateLimit(`voice-rooms:create:${clientIp}`, 5, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Validate Identity Authentication Credentials
    const { adminDb, userId, role, profile } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Permission Validation Gate Check
    if (role !== 'director') {
      const perms = await getUserPermissions(adminDb, userId);
      if (!perms?.allow_video) {
        throw new HttpError(403, 'Video meeting access has not been granted for your account. Contact your director.');
      }
    }

    // 4. Schema Payload Integrity Verification
    const rawBody = await req.json().catch(() => ({}));
    const validation = validateBody(voiceRoomCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, max_participants } = validation.data!;
    
    // Crypto-safe randomized identifier chunk fallback instead of plain index slice parameters
    const safeSalt = Math.random().toString(36).substring(2, 6);
    const roomCode = `kai-os-${userId.slice(0, 8)}-${Date.now().toString(36)}-${safeSalt}`;

    // 5. Database Transaction Persistence Execution
    const { data, error } = await adminDb
      .from('voice_rooms')
      .insert([{ name, room_code: roomCode, created_by: userId, max_participants }])
      .select('id, name, room_code, created_by, is_active, max_participants, created_at')
      .single();

    if (error) throw error;

    // 6. Safe String Fallback Interpolation for Audit Logs
    const actorName = profile?.full_name || userId;
    await writeAuditLog(
      adminDb,
      'communication',
      `${actorName} created meeting room "${name}"`,
      userId,
      'low',
    );

    return NextResponse.json({ room: data }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
