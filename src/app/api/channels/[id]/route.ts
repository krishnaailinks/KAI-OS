import { NextResponse } from 'next/server';
import { jsonError, requireDirector, writeAuditLog } from '@/lib/server/auth';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    // 1. Proxy-Aware Client IP Rate Limiting Layer
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    // Protect destructive mutation hooks from script spamming or accidental double-clicking
    const rl = rateLimit(`channels:delete:${clientIp}`, 15, 60_000); 
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Secure Authorization Context Verification (Strictly locked to Directors)
    const { adminDb, userId } = await requireDirector(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    const { id } = await params;

    // 3. Fetch Targeted Resource Context
    const { data: channel, error: fetchErr } = await adminDb
      .from('channels')
      .select('id, slug, name')
      .eq('id', id)
      .eq('is_archived', false)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    
    // If the channel does not exist or has already been soft-deleted, return a clean 404
    if (!channel) {
      return NextResponse.json({ error: 'Channel not found or already archived' }, { status: 404 });
    }
    
    // Core Platform Guard: Prevent systemic workspace breakage by protecting the primary communication hub
    if (channel.slug === 'general') {
      return NextResponse.json({ error: 'The general channel cannot be deleted' }, { status: 400 });
    }

    // 4. Database State Transition Mutation Execution (Soft-delete pipeline)
    const { error } = await adminDb
      .from('channels')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) throw error;

    // 5. Hardened Non-Blocking Security Governance Audit Log
    // Wrapped defensively to ensure logging table connection spikes do not discard a successful mutation
    await writeAuditLog(
      adminDb,
      'communication',
      `Director archived channel #${channel.slug}`,
      userId,
      'medium',
    ).catch((logErr) => console.error('Non-blocking channel delete audit log failure:', logErr));

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
