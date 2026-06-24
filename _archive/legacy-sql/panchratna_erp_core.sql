-- PANCHRATNA ERP CORE SUPABASE SCHEMA
-- Execute this directly in your Supabase SQL Editor

-- 1. PROJECTS TABLE
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Planning' CHECK (status IN ('Planning', 'Active', 'On Hold', 'Completed')),
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. ALTER TASKS TABLE
-- Add project_id to tasks to link tasks to projects
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE;

-- 3. PAYROLL TABLE
CREATE TABLE IF NOT EXISTS public.payroll (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) NOT NULL,
  month_year TEXT NOT NULL, -- e.g., '2026-05'
  total_hours NUMERIC(10, 2) DEFAULT 0,
  base_salary NUMERIC(12, 2) DEFAULT 0,
  calculated_salary NUMERIC(12, 2) DEFAULT 0,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Paid')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- 4. PROJECT DOCUMENTS
CREATE TABLE IF NOT EXISTS public.project_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  document_url TEXT,
  document_content TEXT,
  generated_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ROW LEVEL SECURITY (RLS)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_documents ENABLE ROW LEVEL SECURITY;

-- POLICIES
-- Projects viewable by everyone
CREATE POLICY "Projects are viewable by everyone" ON public.projects FOR SELECT USING (true);
CREATE POLICY "Directors can insert projects" ON public.projects FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'director');
CREATE POLICY "Directors can update projects" ON public.projects FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'director');

-- Payroll: Employees can see their own, Directors can see all
CREATE POLICY "Employees can view own payroll" ON public.payroll FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Directors can view all payroll" ON public.payroll FOR SELECT USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'director');
CREATE POLICY "Directors can insert payroll" ON public.payroll FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'director');
CREATE POLICY "Directors can update payroll" ON public.payroll FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'director');

-- Documents: viewable by all, insert by all (since anyone might generate it, or restrict to directors)
CREATE POLICY "Documents viewable by everyone" ON public.project_documents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert documents" ON public.project_documents FOR INSERT WITH CHECK (true);
