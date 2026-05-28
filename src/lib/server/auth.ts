import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServerSupabase, getServiceSupabase } from './supabase';

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
  const { data: profile, error: profileError } = await adminDb
    .from('profiles')
    .select('id, email, full_name, role, status')
    .eq('id', userData.user.id)
    .single();

  if (profileError || !profile) {
    throw new HttpError(403, 'Authenticated user profile was not found');
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

  const message = error instanceof Error ? error.message : 'Internal Server Error';
  const isConfigurationError = message.includes('SUPABASE') || message.includes('NEXT_PUBLIC_SUPABASE');

  return NextResponse.json(
    { error: isConfigurationError ? message : 'Internal Server Error' },
    { status: 500 },
  );
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
