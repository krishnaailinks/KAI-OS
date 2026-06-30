/**
 * provisionDemoAccounts.js
 * ------------------------------------------------------------------
 * Creates (idempotently) a persistent set of demo accounts — one per
 * role — for manual / black-box testing. Uses a dedicated email domain
 * (@demo.kai-os.local) so the E2E global-teardown (which only deletes
 * *@kai-os.test director/employee users) never removes them.
 *
 * Usage:
 *   node scripts/provisionDemoAccounts.js
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the
 * environment (loaded from .env.local below).
 */
const fs = require('fs');
const path = require('path');

// Minimal .env.local loader (avoids adding a dotenv dependency to the script).
const envPath = path.resolve(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const DEMO_USERS = [
  { email: 'demo.director@demo.kai-os.local', password: 'DemoDirector#2026', full_name: 'Demo Director', role: 'director' },
  { email: 'demo.employee@demo.kai-os.local', password: 'DemoEmployee#2026', full_name: 'Demo Employee', role: 'employee' },
  { email: 'demo.client@demo.kai-os.local',   password: 'DemoClient#2026',   full_name: 'Demo Client',   role: 'client' },
];

const H = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function upsert(user) {
  // 1. Create auth user (idempotent).
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: H,
    body: JSON.stringify({ email: user.email, password: user.password, email_confirm: true }),
  });
  const createData = await createRes.json();
  let userId = createData.id;

  if (!userId) {
    // Already exists — look up id and (re)set the password so it always matches.
    const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(user.email)}`, { headers: H });
    const listData = await listRes.json();
    const found = (listData.users ?? []).find((u) => u.email === user.email);
    if (found) {
      userId = found.id;
      await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
        method: 'PUT',
        headers: H,
        body: JSON.stringify({ password: user.password, email_confirm: true }),
      });
    }
  }

  if (!userId) {
    console.warn(`⚠️  Could not create/find ${user.email}`);
    return;
  }

  // 2. Upsert profile.
  await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({ id: userId, email: user.email, full_name: user.full_name, role: user.role }),
  });

  // 3. Upsert permissions.
  const isDirector = user.role === 'director';
  const isClient = user.role === 'client';
  await fetch(`${SUPABASE_URL}/rest/v1/personnel_permissions`, {
    method: 'POST',
    headers: { ...H, Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify({
      user_id: userId,
      allow_video: !isClient,
      allow_audit: isDirector,
      system_lockout: false,
    }),
  });

  console.log(`✅  ${user.email}  (${user.role})  →  ${user.password}`);
}

(async () => {
  console.log('Provisioning persistent demo accounts...\n');
  for (const u of DEMO_USERS) await upsert(u);
  console.log('\nDone. These accounts persist across E2E runs.');
})();
