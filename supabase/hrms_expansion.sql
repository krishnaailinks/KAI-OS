-- Phase 5: Complete HRMS Expansion
-- Tables for Profiles, Attendance, and Daily Reports

-- 1. Detailed Employee Profiles
CREATE TABLE IF NOT EXISTS public.employee_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    avatar_url TEXT,
    phone_number TEXT,
    address TEXT,
    job_title TEXT NOT NULL DEFAULT 'Operative',
    salary_amount DECIMAL(10,2) DEFAULT 0.00,
    salary_frequency TEXT DEFAULT 'Monthly', -- Monthly, Bi-weekly, Hourly
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Attendance (Check In/Out)
CREATE TABLE IF NOT EXISTS public.attendance_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in TIMESTAMP WITH TIME ZONE,
    check_out TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'present', -- present, absent, leave, half-day
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date) -- One attendance record per user per day
);

-- 3. Daily Work Reports
CREATE TABLE IF NOT EXISTS public.daily_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    report_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, date) -- One report per user per day
);

-- Security: Enable RLS
ALTER TABLE public.employee_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users to view directory
CREATE POLICY "Allow read access to profiles for authenticated users" 
ON public.employee_profiles FOR SELECT TO authenticated USING (true);

-- Allow users to update their own profiles
CREATE POLICY "Allow users to update own profile"
ON public.employee_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Attendance Read/Write
CREATE POLICY "Allow users to read own attendance"
ON public.attendance_logs FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow directors to read all attendance"
ON public.attendance_logs FOR SELECT TO authenticated USING (true); -- Simulated Director logic in app

CREATE POLICY "Allow users to insert own attendance"
ON public.attendance_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update own attendance"
ON public.attendance_logs FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Daily Reports Read/Write
CREATE POLICY "Allow users to read own reports"
ON public.daily_reports FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow directors to read all reports"
ON public.daily_reports FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow users to insert own reports"
ON public.daily_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow users to update own reports"
ON public.daily_reports FOR UPDATE TO authenticated USING (auth.uid() = user_id);
