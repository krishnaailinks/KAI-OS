import { NextResponse } from 'next/server';
import { authenticateRequest, HttpError, jsonError, writeAuditLog } from '@/lib/server/auth';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Proxy-Aware Client IP Rate Limiting Layer
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    // Protect destructive mutation hooks from automated script burst spam
    const rl = rateLimit(`voice-rooms:delete:${clientIp}`, 15, 60_000); 
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Strict Authentication Context Gate Check
    const { adminDb, userId, role } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const { id } = await params;

    // 3. Fetch Target Resource Context
    const { data: room, error: fetchErr } = await adminDb
      .from('voice_rooms')
      .select('id, name, created_by, is_active')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!room) return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 });
    
    // Use HTTP 410 Gone if resource state has already transitioned permanently
    if (!room.is_active) return NextResponse.json({ error: 'Meeting has already ended' }, { status: 410 });

    // 4. Multi-Tenant Role Permission Boundary Gate
    if (room.created_by !== userId && role !== 'director') {
      throw new HttpError(403, 'Only the room creator or a director can end this meeting');
    }

    // 5. Database State Transition Mutation Execution
    const { error } = await adminDb
      .from('voice_rooms')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    // 6. Hardened Non-Blocking Audit Trail Integration
    // Wrapped defensively to prevent transient network drops from crashing an otherwise successful workflow
    await writeAuditLog(
      adminDb,
      'communication',
      `Meeting room "${room.name}" ended`,
      userId,
      'low',
    ).catch((logErr) => console.error('Non-blocking delete audit log failure:', logErr));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
