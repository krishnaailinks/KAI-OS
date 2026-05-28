-- Phase 4: Financial Management System (FMS) & Client Relationship Management System (CRMS) Schema

-- 1. Create Clients Table (CRMS)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name TEXT NOT NULL,
    contact_email TEXT,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert a default client for testing automation
INSERT INTO public.clients (company_name, contact_email) 
VALUES ('Acme Corp', 'billing@acmecorp.com')
ON CONFLICT DO NOTHING;

-- 2. Create Invoices Table (FMS)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    invoice_number TEXT UNIQUE NOT NULL,
    task_id TEXT NOT NULL,
    client_id UUID REFERENCES public.clients(id),
    amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'unpaid', -- unpaid, paid, overdue
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    due_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days')
);

-- 3. Alter Tasks Table (PMS)
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS budget DECIMAL(10, 2);

-- Enable Row Level Security (RLS)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Allow read access to authenticated users
CREATE POLICY "Allow read access to clients for authenticated users" 
ON public.clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow read access to invoices for authenticated users" 
ON public.invoices FOR SELECT TO authenticated USING (true);

-- Allow service role to bypass RLS for inserts/updates (used by backend automation)
-- (Service role bypasses RLS by default in Supabase)
