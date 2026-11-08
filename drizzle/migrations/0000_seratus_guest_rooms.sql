CREATE TABLE public.game_guest_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 token_hash text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
GRANT ALL ON public.game_guest_sessions TO service_role;
ALTER TABLE public.game_guest_sessions ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.game_rooms (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 code text NOT NULL UNIQUE,
 host_session_id uuid NOT NULL REFERENCES public.game_guest_sessions(id) ON DELETE CASCADE,
 mode text NOT NULL DEFAULT 'online' CHECK (mode IN ('online','local')),
 payload jsonb NOT NULL,
 revision integer NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 expires_at timestamptz NOT NULL
);
GRANT ALL ON public.game_rooms TO service_role;
ALTER TABLE public.game_rooms ENABLE ROW LEVEL SECURITY;
CREATE INDEX game_rooms_host_expiry_idx ON public.game_rooms(host_session_id, expires_at);
CREATE INDEX game_guest_sessions_expiry_idx ON public.game_guest_sessions(expires_at);
CREATE FUNCTION public.commit_game_room(p_id uuid,p_revision integer,p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE changed integer;
BEGIN
 UPDATE public.game_rooms SET payload=p_payload,revision=revision+1,updated_at=now()
 WHERE id=p_id AND revision=p_revision AND expires_at>now();
 GET DIAGNOSTICS changed = ROW_COUNT;
 RETURN changed = 1;
END;
$$;
REVOKE ALL ON FUNCTION public.commit_game_room(uuid,integer,jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.commit_game_room(uuid,integer,jsonb) TO service_role;
COMMENT ON TABLE public.game_guest_sessions IS 'Private guest identity hashes. Access only through server-validated room requests.';
COMMENT ON TABLE public.game_rooms IS 'Private multiplayer room state. Guests are authorized by hashed HttpOnly cookies in the server handler.';