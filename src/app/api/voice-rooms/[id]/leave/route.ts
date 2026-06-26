import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog } from '@/lib/server/auth';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Proxy-Aware Client IP Rate Limiting Layer
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    // Protect mutation hooks from automated script or multi-click button spam
    const rl = rateLimit(`voice-rooms:leave:${clientIp}`, 20, 60_000); 
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Strict Authentication Context Gate Check
    const { adminDb, userId, profile } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const { id } = await params;

    // 3. Database State Transition Mutation Execution
    // Scopes the query to both the room_id and the verified active user session context
    const { data: updatedData, error } = await adminDb
      .from('voice_room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', id)
      .eq('user_id', userId)
      .is('left_at', null) // Avoid executing unnecessary updates if they already left
      .select('id');

    if (error) throw error;

    // 4. Hardened Non-Blocking Audit Trail Integration
    // Only fire an audit entry if a record row was actually manipulated by the request step
    if (updatedData && updatedData.length > 0) {
      const actorName = profile?.full_name || userId;
      await writeAuditLog(
        adminDb,
        'communication',
        `User ${actorName} left meeting room context`,
        userId,
        'low',
      ).catch((logErr) => console.error('Non-blocking leave audit log failure:', logErr));
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
