import type { FullConfig } from '@playwright/test';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vkmhayiyrybovmyerhje.supabase.co';
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const TEST_EMAILS = [
  'test.director@kai-os.test',
  'test.employee@kai-os.test',
  'test.employee2@kai-os.test',
];

export default async function globalTeardown(_config: FullConfig) {
  const H = {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
  };

  for (const email of TEST_EMAILS) {
    // Fetch user ID
    const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, { headers: H });
    const data = await res.json();
    const user = (data.users ?? []).find((u: { email: string }) => u.email === email);
    if (!user) continue;

    // Delete auth user (cascades to profile via FK ON DELETE CASCADE)
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: H });
    console.log(`[teardown] Deleted test user ${email}`);
  }
}
