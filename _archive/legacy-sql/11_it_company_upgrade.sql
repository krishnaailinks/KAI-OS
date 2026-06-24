-- PHASE 11: IT COMPANY ENTERPRISE WORKFLOWS UPGRADE
-- Execute this script in your Supabase SQL Editor

-- 1. Extend the role check constraint to support the 'client' role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('employee', 'director', 'client'));

-- 2. Add IT-specific tracking columns to the tasks table
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS task_type TEXT DEFAULT 'task' CHECK (task_type IN ('feature', 'bug', 'task'));

-- Git / Source Control integration columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS git_branch TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS git_commit TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS git_pr TEXT;

-- Bug tracking specific columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS bug_severity TEXT CHECK (bug_severity IN ('low', 'medium', 'high', 'critical'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS bug_environment TEXT CHECK (bug_environment IN ('development', 'staging', 'production'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS bug_steps TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS bug_expected TEXT;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS bug_actual TEXT;

-- Timesheet / Work logging columns
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS logged_hours NUMERIC(10, 2) DEFAULT 0;

-- 3. Create a timesheet_logs table to keep history of logged hours
CREATE TABLE IF NOT EXISTS public.timesheet_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  hours_logged NUMERIC(6, 2) NOT NULL CHECK (hours_logged > 0),
  description TEXT,
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on timesheet_logs
ALTER TABLE public.timesheet_logs ENABLE ROW LEVEL SECURITY;

-- Timesheet logs policies:
-- Users can see their own logs, Directors can see all, Clients can see logs related to their tasks
DROP POLICY IF EXISTS timesheet_logs_select ON public.timesheet_logs;
CREATE POLICY timesheet_logs_select ON public.timesheet_logs FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id 
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'director'
  );

DROP POLICY IF EXISTS timesheet_logs_insert ON public.timesheet_logs;
CREATE POLICY timesheet_logs_insert ON public.timesheet_logs FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('employee', 'director')
  );

-- 4. Enable Read-only SELECT access on projects and tasks for Clients
-- Re-verify projects and tasks SELECT policies to ensure clients can read projects/tasks assigned/associated
-- In our schema, we have "Projects viewable by everyone" or "projects_select ON public.projects FOR SELECT TO authenticated USING (true)"
-- Let's make sure it is generic and safe for authenticated users.
