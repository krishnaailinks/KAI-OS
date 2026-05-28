import { NextResponse } from 'next/server';
import { getServiceSupabase } from '@/lib/server/supabase';
import { jsonError } from '@/lib/server/auth';

type AccountType = 'employee' | 'director';

const isAccountType = (value: unknown): value is AccountType => value === 'employee' || value === 'director';

const isStrongPassword = (password: string) => (
  password.length >= 8
  && /[A-Z]/.test(password)
  && /[0-9]/.test(password)
  && /[^A-Za-z0-9]/.test(password)
);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const accountType = isAccountType(body.accountType) ? body.accountType : 'employee';
    const accessCode = typeof body.accessCode === 'string' ? body.accessCode : '';

    if (!name || !email || !password) {
      return NextResponse.json({ error: 'Name, email, and password are required' }, { status: 400 });
    }

    if (!isStrongPassword(password)) {
      return NextResponse.json({ error: 'Password must be at least 8 characters and include uppercase, number, and symbol' }, { status: 400 });
    }

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
      email,
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
