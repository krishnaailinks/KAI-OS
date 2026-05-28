
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createAdmin() {
  console.log("Injecting Founder Account directly into the database...");
  
  // Create the auth user bypassing rate limits
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: 'founder@krishna-ai.com',
    password: 'KAI-secure-2026!',
    email_confirm: true // Force confirmation so they can login immediately
  });

  if (authError) {
    console.error("Error creating auth user:", authError.message);
    // If it already exists, that's fine, we will just try to create the profile anyway
    if (!authError.message.includes("already registered")) {
      return;
    }
  } else {
    console.log("Auth user created successfully!");
  }

  // Get the user ID (either newly created or query existing if it failed with "already registered")
  let userId;
  if (authData?.user) {
    userId = authData.user.id;
  } else {
    const { data: listData } = await supabase.auth.admin.listUsers();
    const existing = listData.users.find(u => u.email === 'founder@krishna-ai.com');
    if (existing) {
      userId = existing.id;
      console.log("User already exists, updating their email confirmation status to TRUE...");
      await supabase.auth.admin.updateUserById(userId, { email_confirm: true });
    }
  }

  if (!userId) {
    console.error("Could not determine User ID!");
    return;
  }

  // Insert into public.profiles
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: userId,
      email: 'founder@krishna-ai.com',
      full_name: 'Founder Director',
      role: 'director',
      status: 'Online'
    });

  if (profileError) {
    console.error("Error creating public profile:", profileError.message);
  } else {
    console.log("Director Profile successfully injected! You can now log in.");
  }
}

createAdmin();
