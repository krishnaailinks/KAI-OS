-- Migration 004: Enable Supabase Realtime for communication tables
-- Run AFTER 003_profiles_rls_permissions.sql
--
-- Without this migration, the TeamMessaging real-time subscription
-- (.on('postgres_changes', ...)) gets NO events, so messages from other
-- users only appear on page reload, never live.
--
-- REPLICA IDENTITY FULL ensures Supabase sends the complete row on every
-- change event (required for reliable filter matching on non-PK columns).

ALTER TABLE public.team_messages           REPLICA IDENTITY FULL;
ALTER TABLE public.channels                REPLICA IDENTITY FULL;
ALTER TABLE public.voice_rooms             REPLICA IDENTITY FULL;
ALTER TABLE public.voice_room_participants REPLICA IDENTITY FULL;

-- Add all four tables to the supabase_realtime publication.
-- In Supabase Cloud you can also do this via Dashboard > Database > Replication.
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.channels;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.voice_room_participants;
