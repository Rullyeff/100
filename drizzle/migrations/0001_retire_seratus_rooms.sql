DROP FUNCTION IF EXISTS public.commit_game_room(uuid, integer, jsonb);
COMMENT ON TABLE public.game_rooms IS 'DEPRECATED: 100 SUARA online rooms removed from the app';
COMMENT ON TABLE public.game_guest_sessions IS 'DEPRECATED: 100 SUARA guest sessions removed from the app';