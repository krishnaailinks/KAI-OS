-- Phase 6: Robust Audit Trail Schema
-- Table for holding immutable system audit logs

CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    event_type TEXT NOT NULL, -- auth, task, finance, hrms, security
    message TEXT NOT NULL,
    triggered_by TEXT NOT NULL DEFAULT 'SYSTEM', -- User ID or SYSTEM
    severity TEXT DEFAULT 'low' -- low, medium, high, critical
);

-- Enable RLS
ALTER TABLE public.system_audit_logs ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated directors
CREATE POLICY "Allow directors to read audit logs" 
ON public.system_audit_logs FOR SELECT TO authenticated USING (true); -- Simulated logic on api side

-- Allow service role to bypass RLS for inserts
-- (Service role bypasses RLS by default)
