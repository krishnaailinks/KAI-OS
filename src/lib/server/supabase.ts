import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const requireEnv = (value: string | undefined, name: string) => {
  if (!value) {
    throw new Error(`${name} is not configured`);
  }
  return value;
};

export const getServerSupabase = () => createClient(
  requireEnv(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);

/** Returns a user-scoped client that respects RLS policies.
 *  Uses the anon key + user JWT so Supabase evaluates auth.uid() correctly. */
export const getUserScopedSupabase = (token: string) => createClient(
  requireEnv(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv(supabaseAnonKey, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  },
);

/** Returns a service-role client that bypasses RLS.
 *  Use ONLY for trusted server-side operations (payroll, scripts, audit writes). */
export const getServiceSupabase = () => createClient(
  requireEnv(supabaseUrl, 'NEXT_PUBLIC_SUPABASE_URL'),
  requireEnv(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY'),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
