-- Migration 001: Add 'client' role to the profiles role CHECK constraint
-- Run this in the Supabase SQL editor if you already ran the original schema.sql
-- (which may have had the constraint without 'client').

-- First, drop the existing CHECK constraint
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Re-add it with 'client' included
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('employee', 'director', 'client'));
