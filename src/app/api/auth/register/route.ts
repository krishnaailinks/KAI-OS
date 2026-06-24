import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/server/supabase';
import { jsonError, validateBody } from '@/lib/server/auth';
import { rateLimit, rateLimitResponse } from '@/lib/security';
import { registerSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`register:${clientIp}`, 5, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const rawBody = await req.json();
    const validation = validateBody(registerSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, email, password, accountType, accessCode } = validation.data!;

    if (accountType === 'director') {
      const expectedCode = process.env.DIRECTOR_REGISTRATION_CODE;
      if (!expectedCode) {
        return NextResponse.json({ error: 'Director registration is not configured' }, { status: 500 });
      }

      if (accessCode !== expectedCode) {
        return NextResponse.json({ error: 'Invalid director access code' }, { status: 403 });
      }
    }

    const adminDb = getServiceSupabase();
    const { data: createdUser, error: createUserError } = await adminDb.auth.admin.createUser({
      email: email.toLowerCase().trim(),
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: accountType,
      },
    });

    if (createUserError || !createdUser.user) {
      throw createUserError || new Error('Unable to create user');
    }

    const { error: profileError } = await adminDb
      .from('profiles')
      .upsert({
        id: createdUser.user.id,
        email,
        full_name: name,
        role: accountType,
        status: 'Offline',
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    await adminDb
      .from('employee_profiles')
      .upsert({
        user_id: createdUser.user.id,
        full_name: name,
        job_title: accountType === 'director' ? 'Director' : 'Employee',
      }, { onConflict: 'user_id' });

    await adminDb
      .from('personnel_permissions')
      .upsert({
        user_id: createdUser.user.id,
        allow_video: accountType === 'director',
        allow_audit: accountType === 'director',
        system_lockout: false,
      }, { onConflict: 'user_id' });

    await adminDb.from('system_audit_logs').insert([{
      event_type: 'auth',
      message: `${accountType} account registered for ${email}`,
      triggered_by: createdUser.user.id,
      severity: accountType === 'director' ? 'medium' : 'low',
    }]);

    return NextResponse.json({ user_id: createdUser.user.id, role: accountType }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
