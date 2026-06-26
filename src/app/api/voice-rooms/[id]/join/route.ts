import { NextResponse } from 'next/server';
import { authenticateRequest, getUserPermissions, HttpError, jsonError, writeAuditLog } from '@/lib/server/auth';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Proxy-Aware Client IP Rate Limiting Layer
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    // Protect the join hook from burst spam or automation scripts
    const rl = rateLimit(`voice-rooms:join:${clientIp}`, 20, 60_000); 
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Strict Authentication Context Gate Check
    const { adminDb, userId, role, profile } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 3. Multi-Tenant Permission Gate Check
    if (role !== 'director') {
      const perms = await getUserPermissions(adminDb, userId);
      if (!perms?.allow_video) {
        throw new HttpError(403, 'Video meeting access has not been granted for your account.');
      }
    }

    const { id } = await params;

    // 4. Fetch Targeted Room State Matrix
    const { data: room, error: fetchErr } = await adminDb
      .from('voice_rooms')
      .select('id, name, room_code, is_active, max_participants')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!room) return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 });
    if (!room.is_active) return NextResponse.json({ error: 'This meeting has already ended' }, { status: 410 });

    // 5. Room Capacity Guard Rail Verification
    // Switches to 'exact' counting logic strictly scoped to active live participants
    const { count, error: countErr } = await adminDb
      .from('voice_room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', id)
      .is('left_at', null);

    if (countErr) throw countErr;

    if ((count ?? 0) >= room.max_participants) {
      return NextResponse.json({ error: 'Meeting room is full' }, { status: 409 });
    }

    // 6. Secure Profile Traversal Fallback Extraction
    const activeDisplayName = profile?.full_name || profile?.email || `User (${userId.slice(0, 8)})`;

    // 7. Upsert Resource State: Thread-safe re-join tracking session
    const { error: upsertErr } = await adminDb
      .from('voice_room_participants')
      .upsert(
        [
          {
            room_id: id,
            user_id: userId,
            display_name: activeDisplayName,
            joined_at: new Date().toISOString(),
            left_at: null,
          },
        ],
        { onConflict: 'room_id,user_id' },
      );

    if (upsertErr) throw upsertErr;

    // 8. Hardened Non-Blocking Audit Trail Execution
    await writeAuditLog(
      adminDb,
      'communication',
      `${profile?.full_name || activeDisplayName} joined meeting "${room.name}"`,
      userId,
      'low',
    ).catch((logErr) => console.error('Non-blocking join audit log failure:', logErr));

    return NextResponse.json({ 
      room_code: room.room_code, 
      room_name: room.name, 
      room_id: id 
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
