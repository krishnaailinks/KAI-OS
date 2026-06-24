-- PHASE 12: BULLETPROOF FRESH PRODUCTION DATABASE SEEDING
-- Execute this script in your Supabase SQL Editor.
-- This script dynamically checks for table existence before purging or seeding data,
-- preventing relation errors and keeping your database 100% stable.

DO $$
DECLARE
  v_director_id UUID;
  v_employee_id UUID;
  v_client_id UUID;
  v_project_id UUID;
BEGIN
  -- 1. Fetch existing director and employee accounts from profiles
  SELECT id INTO v_director_id FROM public.profiles WHERE role = 'director' LIMIT 1;
  SELECT id INTO v_employee_id FROM public.profiles WHERE role = 'employee' LIMIT 1;

  -- Validation: Ensure a director account exists
  IF v_director_id IS NULL THEN
    RAISE EXCEPTION 'Fresh Seed Failed: At least one Director account must exist in public.profiles before running this script.';
  END IF;

  -- 2. Purge transactional tables safely only if they exist
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timesheet_logs') THEN
    EXECUTE 'DELETE FROM public.timesheet_logs';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_audit_logs') THEN
    EXECUTE 'DELETE FROM public.system_audit_logs';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_messages') THEN
    EXECUTE 'DELETE FROM public.team_messages';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_documents') THEN
    EXECUTE 'DELETE FROM public.project_documents';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payroll') THEN
    EXECUTE 'DELETE FROM public.payroll';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'daily_reports') THEN
    EXECUTE 'DELETE FROM public.daily_reports';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'attendance_logs') THEN
    EXECUTE 'DELETE FROM public.attendance_logs';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    EXECUTE 'DELETE FROM public.invoices';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    EXECUTE 'DELETE FROM public.clients';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'task_history') THEN
    EXECUTE 'DELETE FROM public.task_history';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    EXECUTE 'DELETE FROM public.tasks';
  END IF;

  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    EXECUTE 'DELETE FROM public.projects';
  END IF;

  -- 3. Seed fresh database entries dynamically only if the target tables exist
  
  -- Seed Client
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    INSERT INTO public.clients (company_name, contact_email, status)
    VALUES ('Acme Global Solutions', 'contact@acme.com', 'active')
    RETURNING id INTO v_client_id;
  END IF;

  -- Seed Project
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    INSERT INTO public.projects (name, description, status, start_date, end_date, created_by)
    VALUES ('Project Phoenix', 'Next-generation cloud firewall and security compliance suite.', 'Active', CURRENT_DATE, CURRENT_DATE + 90, v_director_id)
    RETURNING id INTO v_project_id;
  END IF;

  -- Seed Standard Task
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'tasks') THEN
    INSERT INTO public.tasks (
      id, title, description, priority, progress, status, tool_stack, column_id, project_id, assignee_id, budget, task_type, git_branch, git_commit, git_pr, logged_hours, history_payload
    ) VALUES (
      'TASK-1001',
      'Configure Production Firewall Sandbox',
      'Establish staging rules, load-balancer routing tables, and verify zero-trust port clearance.',
      'ELEVATED',
      30,
      'approved',
      ARRAY['nginx', 'aws', 'docker'],
      'IN_PROGRESS',
      v_project_id,
      COALESCE(v_employee_id, v_director_id),
      2500.00,
      'feature',
      'feature/TASK-1001-firewall-config',
      '7f4ab9e5c46e2786a34cd8f29e12',
      'https://github.com/company/krishna-os/pull/184',
      2.50,
      jsonb_build_object(
        'agent_id', 'System Agent',
        'status', 'success',
        'timestamp', NOW()::text,
        'triggered_by', 'DIRECTOR',
        'execution_ms', 1450,
        'logs_path', 'C:\sys\temp\task_1001.log',
        'quantum_signature', '[{"hours":2.5,"desc":"Configured load balancer ports and Nginx proxy rules.","date":"2026-05-28"}]'
      )
    );

    -- Seed Bug Support Ticket
    INSERT INTO public.tasks (
      id, title, description, priority, progress, status, tool_stack, column_id, project_id, assignee_id, budget, task_type, bug_severity, bug_environment, bug_steps, bug_expected, bug_actual, logged_hours, history_payload
    ) VALUES (
      'TICKET-2001',
      'API Endpoint returns 502 in Staging',
      'User profiles payload is truncated on staging API routes, causing frontend layout lockups.',
      'CRITICAL',
      0,
      'approved',
      ARRAY['nextjs', 'supabase'],
      'TODO',
      v_project_id,
      v_director_id,
      0.00,
      'bug',
      'critical',
      'staging',
      E'1. Navigate to /dashboard/client\n2. Trigger ticket directive submission\n3. Observe gateway timeout 502',
      'Service ticket details are posted directly into development backlog.',
      'Gateway timeout returned from Supabase database proxy API.',
      0.00,
      jsonb_build_object(
        'agent_id', 'CLIENT',
        'status', 'success',
        'timestamp', NOW()::text,
        'triggered_by', 'CLIENT'
      )
    );
  END IF;

  -- Seed Timesheet Log record
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'timesheet_logs') THEN
    INSERT INTO public.timesheet_logs (task_id, user_id, hours_logged, description)
    VALUES ('TASK-1001', COALESCE(v_employee_id, v_director_id), 2.50, 'Configured load balancer ports and Nginx proxy rules.');
  END IF;

  -- Seed Invoice
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    INSERT INTO public.invoices (invoice_number, task_id, client_id, amount, status)
    VALUES ('INV-2026-1001', 'TASK-1001', v_client_id, 2500.00, 'unpaid');
  END IF;

  -- Seed Team Message
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'team_messages') THEN
    INSERT INTO public.team_messages (channel_id, user_id, author_name, body)
    VALUES ('general', v_director_id, 'System Daemon', 'System initialized successfully. Welcome to the KAI-OS command center.');
  END IF;

  -- Seed Audit Log
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'system_audit_logs') THEN
    INSERT INTO public.system_audit_logs (event_type, message, triggered_by, severity)
    VALUES ('SYSTEM', 'Database transactional tables successfully purged and seeded for manual testing.', v_director_id::text, 'low');
  END IF;

END $$;
