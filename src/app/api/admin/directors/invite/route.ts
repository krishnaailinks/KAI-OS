import { NextResponse } from 'next/server';
import { requireDirector, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { z } from 'zod';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/security';

const inviteSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`invite:${getClientIp(req)}`, 10, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const auth = await requireDirector(req);

    const rawBody = await req.json();
    const validation = validateBody(inviteSchema, rawBody);
    if (validation.error) return validation.error;

    const { email } = validation.data!;
    
    // Generate secure token (64 hex chars)
    const token = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');

    // Store in director_invites table
    const { error: inviteError } = await auth.adminDb
      .from('director_invites')
      .insert([{
        token,
        email: email.toLowerCase().trim(),
        created_by: auth.userId,
      }]);

    if (inviteError) throw inviteError;

    await writeAuditLog(
      auth.adminDb,
      'security',
      `Director invite generated for ${email}`,
      auth.userId,
      'high'
    );

    return NextResponse.json({ success: true, token }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
