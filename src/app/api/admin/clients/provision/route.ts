import { NextResponse } from 'next/server';
import { requireDirector, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { z } from 'zod';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/security';

const provisionSchema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
  contactEmail: z.string().email("Invalid email format"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`provision:${getClientIp(req)}`, 10, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const auth = await requireDirector(req);

    const rawBody = await req.json();
    const validation = validateBody(provisionSchema, rawBody);
    if (validation.error) return validation.error;

    const { companyName, contactEmail, password } = validation.data!;
    
    // Create auth user
    const { data: createdUser, error: createUserError } = await auth.adminDb.auth.admin.createUser({
      email: contactEmail.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: companyName,
        role: 'client',
      },
    });

    if (createUserError || !createdUser.user) {
      throw createUserError || new Error('Unable to create client user');
    }

    // Upsert profile
    const { error: profileError } = await auth.adminDb
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email: contactEmail,
        full_name: companyName,
        role: 'client',
        status: 'Offline',
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    // Create client record
    const { error: clientError } = await auth.adminDb
      .from('clients')
      .insert([{
        company_name: companyName,
        contact_email: contactEmail,
      }]);

    if (clientError) throw clientError;

    await writeAuditLog(
      auth.adminDb,
      'security',
      `Client account provisioned for ${companyName} (${contactEmail})`,
      auth.userId,
      'medium'
    );

    return NextResponse.json({ success: true, user_id: createdUser.user.id }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
