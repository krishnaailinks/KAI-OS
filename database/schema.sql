-- KAI-OS production Supabase schema
-- Run this in the Supabase SQL editor before deploying the application.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_director(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = user_id
      AND role = 'director'
  );
$$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'employee' CHECK (role IN ('employee', 'director', 'client')),
  department TEXT,
  status TEXT DEFAULT 'Offline',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.personnel_permissions (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  allow_video BOOLEAN NOT NULL DEFAULT FALSE,
  allow_audit BOOLEAN NOT NULL DEFAULT FALSE,
  system_lockout BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed')),
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'STANDARD' CHECK (priority IN ('LOW', 'STANDARD', 'ELEVATED', 'CRITICAL')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pending_review', 'rejected', 'pending', 'completed')),
  tool_stack TEXT[] NOT NULL DEFAULT '{}',
  column_id TEXT NOT NULL DEFAULT 'TODO' CHECK (column_id IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'COMPLETED')),
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  budget NUMERIC(12, 2) DEFAULT 0,
  pending_updates JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.task_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id TEXT REFERENCES public.tasks(id) ON DELETE CASCADE,
  agent_id TEXT,
  action TEXT NOT NULL,
  status TEXT,
  logs_path TEXT,
  execution_ms INTEGER,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,
  contact_email TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT UNIQUE NOT NULL,
  task_id TEXT REFERENCES public.tasks(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'overdue')),
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  due_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days')
);

CREATE TABLE IF NOT EXISTS public.employee_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  phone_number TEXT,
  address TEXT,
  job_title TEXT NOT NULL DEFAULT 'Employee',
  salary_amount NUMERIC(12, 2) DEFAULT 0,
  salary_frequency TEXT NOT NULL DEFAULT 'Monthly',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'present',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  report_text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE TABLE IF NOT EXISTS public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  month_year TEXT NOT NULL,
  total_hours NUMERIC(10, 2) DEFAULT 0,
  base_salary NUMERIC(12, 2) DEFAULT 0,
  calculated_salary NUMERIC(12, 2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Paid')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  document_url TEXT,
  document_content TEXT,
  generated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id TEXT NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL CHECK (char_length(body) <= 4000),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  triggered_by TEXT NOT NULL DEFAULT 'SYSTEM',
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical'))
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON public.tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_column_id ON public.tasks(column_id);
CREATE INDEX IF NOT EXISTS idx_task_history_task_id ON public.task_history(task_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON public.attendance_logs(user_id, date);
CREATE INDEX IF NOT EXISTS idx_daily_reports_user_date ON public.daily_reports(user_id, date);
CREATE INDEX IF NOT EXISTS idx_team_messages_channel_created ON public.team_messages(channel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON public.system_audit_logs(timestamp DESC);

-- Performance indexes identified as missing in audit (2026-06-24)
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON public.tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_invoices_generated_at ON public.invoices(generated_at);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_payroll_status ON public.payroll(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'profiles',
    'personnel_permissions',
    'projects',
    'tasks',
    'task_history',
    'clients',
    'invoices',
    'employee_profiles',
    'attendance_logs',
    'daily_reports',
    'payroll',
    'project_documents',
    'team_messages',
    'system_audit_logs'
  ]
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
  END LOOP;
END $$;

DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_own ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own_or_director ON public.profiles;
CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id OR public.is_director());
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY profiles_update_own_or_director ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id OR public.is_director());

DROP POLICY IF EXISTS personnel_permissions_select ON public.personnel_permissions;
DROP POLICY IF EXISTS personnel_permissions_write_director ON public.personnel_permissions;
CREATE POLICY personnel_permissions_select ON public.personnel_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_director());
CREATE POLICY personnel_permissions_write_director ON public.personnel_permissions FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS projects_select ON public.projects;
DROP POLICY IF EXISTS projects_write_director ON public.projects;
CREATE POLICY projects_select ON public.projects FOR SELECT TO authenticated USING (true);
CREATE POLICY projects_write_director ON public.projects FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS tasks_select ON public.tasks;
DROP POLICY IF EXISTS tasks_insert_director ON public.tasks;
DROP POLICY IF EXISTS tasks_update_director ON public.tasks;
DROP POLICY IF EXISTS tasks_update_employee_review ON public.tasks;
DROP POLICY IF EXISTS tasks_delete_director ON public.tasks;
CREATE POLICY tasks_select ON public.tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY tasks_insert_director ON public.tasks FOR INSERT TO authenticated WITH CHECK (public.is_director());
CREATE POLICY tasks_update_director ON public.tasks FOR UPDATE TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());
CREATE POLICY tasks_update_employee_review ON public.tasks FOR UPDATE TO authenticated USING (assignee_id = auth.uid()) WITH CHECK (assignee_id = auth.uid() AND status = 'pending_review');
CREATE POLICY tasks_delete_director ON public.tasks FOR DELETE TO authenticated USING (public.is_director());

DROP POLICY IF EXISTS task_history_select ON public.task_history;
DROP POLICY IF EXISTS task_history_insert_authenticated ON public.task_history;
CREATE POLICY task_history_select ON public.task_history FOR SELECT TO authenticated USING (true);
CREATE POLICY task_history_insert_authenticated ON public.task_history FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS clients_select ON public.clients;
DROP POLICY IF EXISTS clients_write_director ON public.clients;
CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY clients_write_director ON public.clients FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS invoices_select_director ON public.invoices;
DROP POLICY IF EXISTS invoices_write_director ON public.invoices;
CREATE POLICY invoices_select_director ON public.invoices FOR SELECT TO authenticated USING (public.is_director());
CREATE POLICY invoices_write_director ON public.invoices FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS employee_profiles_select ON public.employee_profiles;
DROP POLICY IF EXISTS employee_profiles_write_own_or_director ON public.employee_profiles;
CREATE POLICY employee_profiles_select ON public.employee_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_director());
CREATE POLICY employee_profiles_write_own_or_director ON public.employee_profiles FOR ALL TO authenticated USING (auth.uid() = user_id OR public.is_director()) WITH CHECK (auth.uid() = user_id OR public.is_director());

DROP POLICY IF EXISTS attendance_select_own_or_director ON public.attendance_logs;
DROP POLICY IF EXISTS attendance_write_own ON public.attendance_logs;
CREATE POLICY attendance_select_own_or_director ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_director());
CREATE POLICY attendance_write_own ON public.attendance_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS daily_reports_select_own_or_director ON public.daily_reports;
DROP POLICY IF EXISTS daily_reports_write_own ON public.daily_reports;
CREATE POLICY daily_reports_select_own_or_director ON public.daily_reports FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_director());
CREATE POLICY daily_reports_write_own ON public.daily_reports FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS payroll_select_own_or_director ON public.payroll;
DROP POLICY IF EXISTS payroll_write_director ON public.payroll;
CREATE POLICY payroll_select_own_or_director ON public.payroll FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.is_director());
CREATE POLICY payroll_write_director ON public.payroll FOR ALL TO authenticated USING (public.is_director()) WITH CHECK (public.is_director());

DROP POLICY IF EXISTS project_documents_select ON public.project_documents;
DROP POLICY IF EXISTS project_documents_insert_authenticated ON public.project_documents;
CREATE POLICY project_documents_select ON public.project_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY project_documents_insert_authenticated ON public.project_documents FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS team_messages_select ON public.team_messages;
DROP POLICY IF EXISTS team_messages_insert ON public.team_messages;
CREATE POLICY team_messages_select ON public.team_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY team_messages_insert ON public.team_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS audit_logs_select_director ON public.system_audit_logs;
DROP POLICY IF EXISTS audit_logs_insert_authenticated ON public.system_audit_logs;
CREATE POLICY audit_logs_select_director ON public.system_audit_logs FOR SELECT TO authenticated USING (public.is_director());
CREATE POLICY audit_logs_insert_authenticated ON public.system_audit_logs FOR INSERT TO authenticated WITH CHECK (triggered_by = auth.uid()::TEXT OR public.is_director());

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

DROP TRIGGER IF EXISTS touch_profiles_updated_at ON public.profiles;
CREATE TRIGGER touch_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_projects_updated_at ON public.projects;
CREATE TRIGGER touch_projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_tasks_updated_at ON public.tasks;
CREATE TRIGGER touch_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_clients_updated_at ON public.clients;
CREATE TRIGGER touch_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_employee_profiles_updated_at ON public.employee_profiles;
CREATE TRIGGER touch_employee_profiles_updated_at BEFORE UPDATE ON public.employee_profiles FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_attendance_updated_at ON public.attendance_logs;
CREATE TRIGGER touch_attendance_updated_at BEFORE UPDATE ON public.attendance_logs FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_daily_reports_updated_at ON public.daily_reports;
CREATE TRIGGER touch_daily_reports_updated_at BEFORE UPDATE ON public.daily_reports FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
DROP TRIGGER IF EXISTS touch_payroll_updated_at ON public.payroll;
CREATE TRIGGER touch_payroll_updated_at BEFORE UPDATE ON public.payroll FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
