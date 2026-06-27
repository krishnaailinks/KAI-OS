-- ═══════════════════════════════════════════════════════════════════════════
-- KAI-OS  ·  ONE-TIME MIGRATION SCRIPT
-- ═══════════════════════════════════════════════════════════════════════════
-- Paste this ENTIRE file into Supabase Dashboard → SQL Editor and click Run.
-- It is fully IDEMPOTENT — safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Prerequisites ────────────────────────────────────────────────────────

-- Ensure the is_director() helper exists (used by RLS policies below)
CREATE OR REPLACE FUNCTION public.is_director(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id AND role = 'director');
$$;

-- touch_updated_at trigger function (idempotent)
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ─── 1. Fix profiles role constraint to include 'client' ────────────────────

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('employee', 'director', 'client'));

-- ─── 2. Grant schema access so authenticated users can read profiles ─────────

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.profiles TO authenticated;

-- ─── 3. Channels table ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.channels (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  slug        TEXT    UNIQUE NOT NULL
                      CHECK (slug ~ '^[a-z0-9][a-z0-9_-]*$' AND char_length(slug) <= 50),
  type        TEXT    NOT NULL DEFAULT 'text'
                      CHECK (type IN ('text', 'announcement')),
  description TEXT    CHECK (description IS NULL OR char_length(description) <= 500),
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by  UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS touch_channels_updated_at ON public.channels;
CREATE TRIGGER touch_channels_updated_at
  BEFORE UPDATE ON public.channels
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX IF NOT EXISTS idx_channels_slug     ON public.channels(slug);
CREATE INDEX IF NOT EXISTS idx_channels_type     ON public.channels(type);
CREATE INDEX IF NOT EXISTS idx_channels_archived ON public.channels(is_archived) WHERE is_archived = FALSE;

ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS channels_select         ON public.channels;
DROP POLICY IF EXISTS channels_write_director ON public.channels;
CREATE POLICY channels_select ON public.channels
  FOR SELECT TO authenticated USING (is_archived = FALSE);
CREATE POLICY channels_write_director ON public.channels
  FOR ALL TO authenticated
  USING (public.is_director()) WITH CHECK (public.is_director());

GRANT ALL ON public.channels TO service_role;

-- Seed default channels (idempotent)
INSERT INTO public.channels (name, slug, type, description) VALUES
  ('General',     'general',     'text',         'Company-wide chat'),
  ('Engineering', 'engineering', 'text',         'Technical discussions and dev updates'),
  ('Alerts',      'alerts',      'announcement', 'System and project alerts — directors only')
ON CONFLICT (slug) DO NOTHING;

-- ─── 4. Voice / meeting rooms table ─────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.voice_rooms (
  id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT    NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  room_code        TEXT    UNIQUE NOT NULL
                           CHECK (room_code ~ '^[a-z0-9-]+$' AND char_length(room_code) <= 120),
  created_by       UUID    REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  max_participants INTEGER NOT NULL DEFAULT 20
                           CHECK (max_participants BETWEEN 2 AND 100),
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  ended_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_voice_rooms_active ON public.voice_rooms(is_active) WHERE is_active = TRUE;

ALTER TABLE public.voice_rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS voice_rooms_select               ON public.voice_rooms;
DROP POLICY IF EXISTS voice_rooms_insert_authenticated ON public.voice_rooms;
DROP POLICY IF EXISTS voice_rooms_update_creator_director ON public.voice_rooms;
CREATE POLICY voice_rooms_select ON public.voice_rooms
  FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY voice_rooms_insert_authenticated ON public.voice_rooms
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY voice_rooms_update_creator_director ON public.voice_rooms
  FOR UPDATE TO authenticated
  USING (auth.uid() = created_by OR public.is_director());

GRANT ALL ON public.voice_rooms TO service_role;

-- ─── 5. Voice room participants (presence tracking) ──────────────────────────

CREATE TABLE IF NOT EXISTS public.voice_room_participants (
  room_id      UUID NOT NULL REFERENCES public.voice_rooms(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.profiles(id)    ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  joined_at    TIMESTAMPTZ DEFAULT NOW(),
  left_at      TIMESTAMPTZ,
  PRIMARY KEY  (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_vrp_room   ON public.voice_room_participants(room_id);
CREATE INDEX IF NOT EXISTS idx_vrp_user   ON public.voice_room_participants(user_id);
CREATE INDEX IF NOT EXISTS idx_vrp_active ON public.voice_room_participants(room_id) WHERE left_at IS NULL;

ALTER TABLE public.voice_room_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vrp_select ON public.voice_room_participants;
DROP POLICY IF EXISTS vrp_insert ON public.voice_room_participants;
DROP POLICY IF EXISTS vrp_update ON public.voice_room_participants;
CREATE POLICY vrp_select ON public.voice_room_participants FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY vrp_insert ON public.voice_room_participants FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY vrp_update ON public.voice_room_participants FOR UPDATE TO authenticated USING (auth.uid() = user_id);

GRANT ALL ON public.voice_room_participants TO service_role;

-- ─── 6. Enable Supabase Realtime on communication tables ─────────────────────
-- Without this, the browser subscription (.on('postgres_changes',...)) gets
-- zero events — messages only appear on page reload, never live.

ALTER TABLE public.team_messages           REPLICA IDENTITY FULL;
ALTER TABLE public.channels                REPLICA IDENTITY FULL;
ALTER TABLE public.voice_rooms             REPLICA IDENTITY FULL;
ALTER TABLE public.voice_room_participants REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_participants;

-- ─── Done ────────────────────────────────────────────────────────────────────
SELECT 'Migration complete ✓' AS result;
