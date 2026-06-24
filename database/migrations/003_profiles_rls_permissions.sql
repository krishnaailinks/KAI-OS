-- Migration 003: Grant SELECT on profiles to authenticated role + RLS policies
-- Run this in the Supabase SQL editor to fix: proxy middleware cannot read profiles
-- (causes role defaulting to "employee" → wrong dashboard redirect)

-- 1. Grant base table access so RLS policies can work
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- 2. RLS policy: users can read their own profile
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 3. RLS policy: users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);
