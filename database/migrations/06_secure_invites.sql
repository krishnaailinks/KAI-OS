-- Migration 06: Secure Director Invites
-- Replaces shared DIRECTOR_REGISTRATION_CODE with single-use tokens

CREATE TABLE IF NOT EXISTS public.director_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_director_invites_token ON public.director_invites(token);

ALTER TABLE public.director_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY director_invites_select ON public.director_invites 
  FOR SELECT TO authenticated USING (public.is_director());

CREATE POLICY director_invites_insert ON public.director_invites 
  FOR INSERT TO authenticated WITH CHECK (public.is_director() AND auth.uid() = created_by);

CREATE TRIGGER touch_director_invites_updated_at BEFORE UPDATE ON public.director_invites FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

GRANT ALL ON TABLE public.director_invites TO service_role;
