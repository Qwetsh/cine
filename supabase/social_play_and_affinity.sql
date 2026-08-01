-- ============================================================
-- Social phase 2 : défi quiz entre amis, affinité, anti-spam — 02/08/2026
-- (appliqué en base via la migration social_play_and_affinity)
--
-- 1) game_invites : invitation de défi CinéQuiz entre amis/partenaire,
--    avec push automatique vers le destinataire (deep link ?join=CODE)
-- 2) get_friend_affinity : œuvres en commun + notes comparées + % affinité
-- 3) Anti-spam demandes d'ami : statut 'rejected' persistant
-- ============================================================

-- 1) Invitations de défi ------------------------------------------------

CREATE TABLE IF NOT EXISTS public.game_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  join_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_game_invites_to ON public.game_invites(to_user_id, created_at);

ALTER TABLE public.game_invites ENABLE ROW LEVEL SECURITY;

-- INSERT : seulement vers un ami accepté ou le partenaire
DROP POLICY IF EXISTS "game_invites_insert" ON public.game_invites;
CREATE POLICY "game_invites_insert" ON public.game_invites FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = to_user_id)
            OR (addressee_id = auth.uid() AND requester_id = to_user_id)
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.couples
        WHERE (user1_id = auth.uid() AND user2_id = to_user_id)
           OR (user2_id = auth.uid() AND user1_id = to_user_id)
      )
    )
  );

DROP POLICY IF EXISTS "game_invites_select_own" ON public.game_invites;
CREATE POLICY "game_invites_select_own" ON public.game_invites FOR SELECT
  USING (auth.uid() IN (from_user_id, to_user_id));

DROP POLICY IF EXISTS "game_invites_delete_own" ON public.game_invites;
CREATE POLICY "game_invites_delete_own" ON public.game_invites FOR DELETE
  USING (auth.uid() IN (from_user_id, to_user_id));

-- Push « X te défie au CinéQuiz ! » vers le destinataire
CREATE OR REPLACE FUNCTION public.notify_game_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sender_name text;
  supabase_url text := 'https://tppecozmygtjmbcdqgfc.supabase.co';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = NEW.to_user_id LIMIT 1) THEN
    RETURN NEW;
  END IF;

  SELECT display_name INTO sender_name FROM public.profiles WHERE id = NEW.from_user_id;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'user_id', NEW.to_user_id,
      'title', '⚔️ Défi CinéQuiz !',
      'body', COALESCE(sender_name, 'Un ami') || ' te défie au quiz',
      'url', '/pick?join=' || NEW.join_code
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_game_invite_notify ON public.game_invites;
CREATE TRIGGER on_game_invite_notify
  AFTER INSERT ON public.game_invites
  FOR EACH ROW EXECUTE FUNCTION public.notify_game_invite();

-- 2) Affinité -----------------------------------------------------------
-- Œuvres notées par les deux (perso en priorité, sinon note couple pour
-- les films), % d'affinité = moyenne de 100 - |écart de notes| × 20
-- (notes sur 5). Accessible uniquement entre amis acceptés ou partenaires.

CREATE OR REPLACE FUNCTION public.get_friend_affinity(p_friend_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  result jsonb;
BEGIN
  IF me IS NULL THEN
    RETURN NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND ((requester_id = me AND addressee_id = p_friend_id)
        OR (addressee_id = me AND requester_id = p_friend_id))
  ) AND NOT EXISTS (
    SELECT 1 FROM public.couples
    WHERE (user1_id = me AND user2_id = p_friend_id)
       OR (user2_id = me AND user1_id = p_friend_id)
  ) THEN
    RETURN NULL;
  END IF;

  WITH user_works AS (
    -- Films perso
    SELECT pc.user_id, 'movie' AS media_type, m.tmdb_id, m.title, m.poster_path, pc.rating, 1 AS prio
    FROM public.personal_collection pc
    JOIN public.movies m ON m.id = pc.movie_id
    WHERE pc.user_id IN (me, p_friend_id)
    UNION ALL
    -- Films couple (la note du membre concerné)
    SELECT u.user_id, 'movie', m.tmdb_id, m.title, m.poster_path,
      CASE WHEN c.user1_id = u.user_id THEN col.rating_user1 ELSE col.rating_user2 END, 2
    FROM public.collection col
    JOIN public.couples c ON c.id = col.couple_id
    JOIN public.movies m ON m.id = col.movie_id
    JOIN LATERAL unnest(ARRAY[c.user1_id, c.user2_id]) AS u(user_id) ON u.user_id IN (me, p_friend_id)
    UNION ALL
    -- Séries perso
    SELECT tpc.user_id, 'tv', ts.tmdb_id, ts.name, ts.poster_path, tpc.rating, 1
    FROM public.tv_personal_collection tpc
    JOIN public.tv_shows ts ON ts.id = tpc.tv_show_id
    WHERE tpc.user_id IN (me, p_friend_id)
  ),
  agg AS (
    SELECT DISTINCT ON (user_id, media_type, tmdb_id)
      user_id, media_type, tmdb_id, title, poster_path, rating
    FROM user_works
    ORDER BY user_id, media_type, tmdb_id, prio, rating DESC NULLS LAST
  ),
  common AS (
    SELECT mine.media_type, mine.tmdb_id, mine.title, mine.poster_path,
           mine.rating AS my_rating, theirs.rating AS friend_rating
    FROM agg mine
    JOIN agg theirs ON theirs.media_type = mine.media_type
                   AND theirs.tmdb_id = mine.tmdb_id
                   AND theirs.user_id = p_friend_id
    WHERE mine.user_id = me
  )
  SELECT jsonb_build_object(
    'common_count', (SELECT count(*) FROM common),
    'my_total', (SELECT count(*) FROM agg WHERE user_id = me),
    'friend_total', (SELECT count(*) FROM agg WHERE user_id = p_friend_id),
    'affinity_pct', (
      SELECT round(avg(100 - least(abs(my_rating - friend_rating) * 20, 100)))
      FROM common
      WHERE my_rating IS NOT NULL AND friend_rating IS NOT NULL
    ),
    'rated_common_count', (
      SELECT count(*) FROM common
      WHERE my_rating IS NOT NULL AND friend_rating IS NOT NULL
    ),
    'common', (
      SELECT COALESCE(jsonb_agg(row_to_json(c) ORDER BY
        (COALESCE(c.my_rating, 0) + COALESCE(c.friend_rating, 0)) DESC), '[]'::jsonb)
      FROM common c
    )
  ) INTO result;

  RETURN result;
END;
$$;

-- 3) Anti-spam : refus persistant ---------------------------------------
-- Refuser une demande passe la ligne en 'rejected' (au lieu de DELETE) :
-- le demandeur ne peut plus re-spammer (contrainte UNIQUE), et il ne peut
-- pas contourner en supprimant la ligne (DELETE interdit au requester sur
-- une ligne rejected). L'ex-addressee peut, lui, repartir de zéro.

ALTER TABLE public.friendships DROP CONSTRAINT IF EXISTS friendships_status_check;
ALTER TABLE public.friendships ADD CONSTRAINT friendships_status_check
  CHECK (status IN ('pending', 'accepted', 'rejected'));

DROP POLICY IF EXISTS "friendships_update_addressee" ON public.friendships;
CREATE POLICY "friendships_update_addressee" ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status IN ('accepted', 'rejected'));

DROP POLICY IF EXISTS "friendships_delete_own" ON public.friendships;
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE
  USING (
    auth.uid() IN (requester_id, addressee_id)
    AND NOT (status = 'rejected' AND auth.uid() = requester_id)
  );
