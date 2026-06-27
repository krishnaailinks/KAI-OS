import type { FullConfig } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vkmhayiyrybovmyerhje.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const TEST_USERS = [
  {
    email:     'test.director@kai-os.test',
    password:  'TestKaiDirector2026!',
    full_name: 'Test Director',
    role:      'director' as const,
  },
  {
    email:     'test.employee@kai-os.test',
    password:  'TestKaiEmployee2026!',
    full_name: 'Test Employee',
    role:      'employee' as const,
  },
  {
    email:     'test.employee2@kai-os.test',
    password:  'TestKaiEmployee2026!',
    full_name: 'Test Employee Two',
    role:      'employee' as const,
  },
  {
    email:     'test.client@kai-os.test',
    password:  'TestKaiClient2026!',
    full_name: 'Test Client',
    role:      'client' as const,
  },
];

async function upsertTestUser(user: typeof TEST_USERS[0]) {
  const H = {
    apikey:        SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  // 1. Create via Auth Admin API (idempotent — handles 422 user-already-exists).
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: user.email, password: user.password, email_confirm: true }),
  });
  const createData = await createRes.json();
  let userId: string = createData.id;

  if (!userId) {
    // User already exists — fetch their ID.
    const listRes = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`,
      { headers: H },
    );
    const listData = await listRes.json();
    const found = (listData.users ?? []).find((u: { email: string }) => u.email === user.email);
    if (found) userId = found.id;
  }

  if (!userId) {
    console.warn(`[setup] ⚠️  Could not create or find user ${user.email}`);
    return;
  }

  // 2. Upsert profile row.
  const profRes = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method:  'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({ id: userId, email: user.email, full_name: user.full_name, role: user.role }),
  });
  if (!profRes.ok) {
    const err = await profRes.text();
    console.warn(`[setup] ⚠️  Profile upsert failed for ${user.email}: ${err}`);
  }

  // 3. Upsert personnel_permissions.
  const isDirector = user.role === 'director';
  const isClient   = user.role === 'client';
  const permRes = await fetch(`${SUPABASE_URL}/rest/v1/personnel_permissions`, {
    method:  'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates' },
    body:    JSON.stringify({
      user_id:        userId,
      allow_video:    !isClient,   // director + employees get video; clients don't
      allow_audit:    isDirector,
      system_lockout: false,
    }),
  });
  if (!permRes.ok) {
    const err = await permRes.text();
    console.warn(`[setup] ⚠️  Permissions upsert failed for ${user.email}: ${err}`);
  }

  console.log(`[setup] ✅  Upserted ${user.email} (${user.role}, id=${userId})`);
}

async function seedDefaultChannels() {
  const H = {
    apikey:        SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    Prefer:        'resolution=ignore-duplicates',
  };
  // Ensure default channels exist (idempotent).
  await fetch(`${SUPABASE_URL}/rest/v1/channels`, {
    method:  'POST',
    headers: H,
    body:    JSON.stringify([
      { name: 'General',     slug: 'general',     type: 'text',         description: 'Company-wide chat' },
      { name: 'Engineering', slug: 'engineering', type: 'text',         description: 'Technical discussions' },
      { name: 'Alerts',      slug: 'alerts',      type: 'announcement', description: 'Directors only' },
    ]),
  });
}

async function getAccessTokens(): Promise<Record<string, string>> {
  const H = { 'Content-Type': 'application/json', apikey: ANON_KEY };
  const tokens: Record<string, string> = {};

  for (const user of TEST_USERS) {
    const res  = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: H,
      body:    JSON.stringify({ email: user.email, password: user.password }),
    });
    const data = await res.json();
    if (data.access_token) {
      tokens[user.role === 'director' ? 'director'
           : user.email.includes('employee2') ? 'employee2'
           : user.role === 'client' ? 'client'
           : 'employee'] = data.access_token;
    } else {
      console.warn(`[setup] ⚠️  Could not get token for ${user.email}: ${JSON.stringify(data)}`);
    }
  }
  return tokens;
}

export default async function globalSetup(_config: FullConfig) {
  if (!SERVICE_KEY) {
    throw new Error('[setup] SUPABASE_SERVICE_ROLE_KEY is not set — cannot create test users');
  }
  if (!ANON_KEY) {
    throw new Error('[setup] NEXT_PUBLIC_SUPABASE_ANON_KEY is not set');
  }

  console.log('[setup] Creating / verifying test users in Supabase...');
  await Promise.all(TEST_USERS.map(upsertTestUser));

  console.log('[setup] Seeding default channels...');
  await seedDefaultChannels();

  // Save tokens to disk so spec files can read them in beforeAll without
  // each file logging in separately — much faster overall.
  console.log('[setup] Fetching auth tokens for test users...');
  const tokens = await getAccessTokens();

  const tokenPath = path.resolve(__dirname, '.tokens.json');
  fs.writeFileSync(tokenPath, JSON.stringify(tokens, null, 2));
  console.log(`[setup] Tokens saved to ${tokenPath}`);

  console.log('[setup] ✅  Global setup complete.');
}
