import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/server/supabase';
import { jsonError, validateBody } from '@/lib/server/auth';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/security';
import { registerSchema } from '@/lib/validation';

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`register:${getClientIp(req)}`, 5, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const rawBody = await req.json();
    const validation = validateBody(registerSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, email, password, accountType, accessCode } = validation.data!;

    const adminDb = getServiceSupabase();

    if (accountType === 'director') {
      if (!accessCode) {
        return NextResponse.json({ error: 'Director invite token is required' }, { status: 400 });
      }

      const { data: invite, error: inviteQueryError } = await adminDb
        .from('director_invites')
        .select('*')
        .eq('token', accessCode)
        .eq('email', email.toLowerCase().trim())
        .single();

      if (inviteQueryError || !invite) {
        return NextResponse.json({ error: 'Invalid or missing director invite token' }, { status: 403 });
      }

      if (invite.used) {
        return NextResponse.json({ error: 'This invite token has already been used' }, { status: 403 });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return NextResponse.json({ error: 'This invite token has expired' }, { status: 403 });
      }
    }
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

    if (accountType === 'director' && accessCode) {
      await adminDb
        .from('director_invites')
        .update({ used: true })
        .eq('token', accessCode);
    }

    return NextResponse.json({ user_id: createdUser.user.id, role: accountType }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
