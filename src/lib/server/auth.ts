import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase, getServiceSupabase, getUserScopedSupabase } from './supabase';

export type UserRole = 'employee' | 'director' | 'client';

export interface AppProfile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  status: string | null;
}

export interface AuthContext {
  userId: string;
  email: string;
  role: UserRole;
  profile: AppProfile;
  /** User-scoped client — respects all RLS policies. Use for most queries. */
  db: SupabaseClient;
  /** Service-role client — bypasses RLS. Use only for trusted server operations
   *  (payroll execution, audit log writes, admin scripts). */
  adminDb: SupabaseClient;
}

export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

const isRole = (role: unknown): role is UserRole => role === 'employee' || role === 'director' || role === 'client';

const getBearerToken = (request: Request) => {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
};

export const authenticateRequest = async (request: Request): Promise<AuthContext> => {
  const token = getBearerToken(request);
  if (!token) {
    throw new HttpError(401, 'Missing bearer token');
  }

  const authDb = getServerSupabase();
  const { data: userData, error: userError } = await authDb.auth.getUser(token);

  if (userError || !userData.user) {
    throw new HttpError(401, 'Invalid or expired session');
  }

  const adminDb = getServiceSupabase();

  // Fetch profile and lockout flag in one query via PostgREST join.
  const { data: profile, error: profileError } = await adminDb
    .from('profiles')
    .select('id, email, full_name, role, status, personnel_permissions(system_lockout)')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new HttpError(403, 'Authenticated user profile was not found');
  }

  // Enforce system_lockout globally — no API call succeeds while a user is locked.
  const permsRow = Array.isArray(profile.personnel_permissions)
    ? profile.personnel_permissions[0]
    : profile.personnel_permissions;
  if (permsRow?.system_lockout === true) {
    throw new HttpError(423, 'Your account has been locked by an administrator. Contact your director.');
  }

  const role = isRole(profile.role) ? profile.role : 'employee';

  return {
    userId: userData.user.id,
    email: userData.user.email || profile.email || '',
    role,
    profile: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role,
      status: profile.status,
    },
    db: getUserScopedSupabase(token),
    adminDb,
  };
};

export const requireDirector = async (request: Request) => {
  const auth = await authenticateRequest(request);
  if (auth.role !== 'director') {
    throw new HttpError(403, 'Director clearance required');
  }
  return auth;
};

export const jsonError = (error: unknown) => {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (error instanceof Error) {
    console.error('[API Error]', error.message);
    const message = error.message.includes('SUPABASE') || error.message.includes('NEXT_PUBLIC_SUPABASE')
      ? 'Server configuration error'
      : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
};

import type { ZodSchema } from 'zod';

export const validateBody = <T>(schema: ZodSchema<T>, body: unknown): { data?: T; error?: NextResponse } => {
  const result = schema.safeParse(body);
  if (!result.success) {
    const firstError = result.error.issues[0];
    return {
      error: NextResponse.json(
        { error: firstError?.message || 'Validation failed' },
        { status: 400 },
      ),
    };
  }
  return { data: result.data };
};

/** Fetch the personnel_permissions row for a user.
 *  Returns safe defaults if no row exists yet. */
export const getUserPermissions = async (
  adminDb: SupabaseClient,
  userId: string,
): Promise<{ allow_video: boolean; allow_audit: boolean; system_lockout: boolean }> => {
  const { data } = await adminDb
    .from('personnel_permissions')
    .select('allow_video, allow_audit, system_lockout')
    .eq('user_id', userId)
    .maybeSingle();
  return data ?? { allow_video: false, allow_audit: false, system_lockout: false };
};

export const writeAuditLog = async (
  adminDb: SupabaseClient,
  eventType: string,
  message: string,
  triggeredBy = 'SYSTEM',
  severity: 'low' | 'medium' | 'high' | 'critical' = 'low',
) => {
  await adminDb.from('system_audit_logs').insert([{
    event_type: eventType,
    message,
    triggered_by: triggeredBy,
    severity,
  }]);
};
