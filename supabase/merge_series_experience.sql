-- ============================================================
-- Fusion de l'expérience séries dans l'expérience films
-- Appliqué le 02/08/2026 via MCP (migrations merge_series_schema
-- et merge_series_rpc). Tables 100 % Ciné (tv_*) — base partagée
-- respectée : aucune suppression, uniquement de l'additif.
-- ============================================================

-- ------------------------------------------------------------
-- 1. tv_collection : parité avec collection (notes, emoji, date)
-- ------------------------------------------------------------
ALTER TABLE public.tv_collection
  ADD COLUMN IF NOT EXISTS watched_at timestamptz,
  ADD COLUMN IF NOT EXISTS rating_user1 numeric(2,1) CHECK (rating_user1 >= 0.5 AND rating_user1 <= 5),
  ADD COLUMN IF NOT EXISTS rating_user2 numeric(2,1) CHECK (rating_user2 >= 0.5 AND rating_user2 <= 5),
  ADD COLUMN IF NOT EXISTS note_user1 text,
  ADD COLUMN IF NOT EXISTS note_user2 text,
  ADD COLUMN IF NOT EXISTS emoji_user1 text,
  ADD COLUMN IF NOT EXISTS emoji_user2 text;
UPDATE public.tv_collection SET watched_at = created_at WHERE watched_at IS NULL;
ALTER TABLE public.tv_collection ALTER COLUMN watched_at SET DEFAULT now();

-- ------------------------------------------------------------
-- 2. tv_personal_collection : emoji (parité avec personal_collection)
-- ------------------------------------------------------------
ALTER TABLE public.tv_personal_collection ADD COLUMN IF NOT EXISTS emoji text;

-- ------------------------------------------------------------
-- 3. tv_watchlist : granularité série (season_number optionnel)
--    Une entrée = une série ; season_number reste informatif
--    (« à reprendre à la saison N »).
-- ------------------------------------------------------------
ALTER TABLE public.tv_watchlist DROP CONSTRAINT IF EXISTS tv_watchlist_tv_show_id_season_number_couple_id_key;
DROP INDEX IF EXISTS public.tv_watchlist_show_season_user_solo;
ALTER TABLE public.tv_watchlist ALTER COLUMN season_number DROP NOT NULL;

DELETE FROM public.tv_watchlist t USING public.tv_watchlist t2
  WHERE t.id <> t2.id
    AND t.tv_show_id = t2.tv_show_id
    AND ((t.couple_id IS NOT NULL AND t.couple_id = t2.couple_id)
      OR (t.couple_id IS NULL AND t2.couple_id IS NULL AND t.added_by = t2.added_by))
    AND (t.created_at > t2.created_at OR (t.created_at = t2.created_at AND t.id > t2.id));
UPDATE public.tv_watchlist SET season_number = NULL;

CREATE UNIQUE INDEX IF NOT EXISTS tv_watchlist_show_couple_key
  ON public.tv_watchlist (tv_show_id, couple_id) WHERE couple_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tv_watchlist_show_user_solo_key
  ON public.tv_watchlist (tv_show_id, added_by) WHERE couple_id IS NULL;

-- ------------------------------------------------------------
-- 4. RPC get_friends_want_to_watch : + séries, + watchlists solo
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_want_to_watch()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
  FROM (
    SELECT tmdb_id, media_type, count(DISTINCT friend_id) AS friend_count
    FROM (
      SELECT m.tmdb_id, 'movie' AS media_type, p.id AS friend_id
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.watchlist w ON w.couple_id = c.id
      JOIN public.movies m ON m.id = w.movie_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT m.tmdb_id, 'movie', p.id
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.watchlist w ON w.couple_id IS NULL AND w.added_by = p.id
      JOIN public.movies m ON m.id = w.movie_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT ts.tmdb_id, 'tv', p.id
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.tv_watchlist tw ON tw.couple_id = c.id
      JOIN public.tv_shows ts ON ts.id = tw.tv_show_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT ts.tmdb_id, 'tv', p.id
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.tv_watchlist tw ON tw.couple_id IS NULL AND tw.added_by = p.id
      JOIN public.tv_shows ts ON ts.id = tw.tv_show_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
    ) u
    GROUP BY tmdb_id, media_type
  ) t;
  RETURN result;
END;
$$;

-- ------------------------------------------------------------
-- 5. RPC get_friends_high_ratings : + media_type, + séries
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friends_high_ratings()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
  FROM (
    SELECT m.tmdb_id, 'movie' AS media_type, p.display_name AS friend_name, pc.rating
    FROM public.friendships f
    JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
    JOIN public.personal_collection pc ON pc.user_id = p.id
    JOIN public.movies m ON m.id = pc.movie_id
    WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      AND pc.rating >= 4
    UNION ALL
    SELECT ts.tmdb_id, 'tv', p.display_name, tpc.rating
    FROM public.friendships f
    JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
    JOIN public.tv_personal_collection tpc ON tpc.user_id = p.id
    JOIN public.tv_shows ts ON ts.id = tpc.tv_show_id
    WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      AND tpc.rating >= 4
  ) t;
  RETURN result;
END;
$$;

-- ------------------------------------------------------------
-- 6. RPC get_friend_movie_data : branche TV complète
--    (veut voir couple+solo, vu couple avec notes, vu solo)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friend_movie_data(p_tmdb_id integer, p_media_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
BEGIN
  IF p_media_type = 'movie' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
    FROM (
      SELECT p.id AS user_id, p.display_name, 'wants_to_watch' AS relation, NULL::numeric AS rating, NULL AS note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.watchlist w ON w.couple_id = c.id
      JOIN public.movies m ON m.id = w.movie_id AND m.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT p.id, p.display_name, 'watched_couple',
        CASE WHEN c.user1_id = p.id THEN col.rating_user1 ELSE col.rating_user2 END,
        CASE WHEN c.user1_id = p.id THEN col.note_user1 ELSE col.note_user2 END
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.collection col ON col.couple_id = c.id
      JOIN public.movies m ON m.id = col.movie_id AND m.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT p.id, p.display_name, 'watched_solo', pc.rating, pc.note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.personal_collection pc ON pc.user_id = p.id
      JOIN public.movies m ON m.id = pc.movie_id AND m.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
    ) t;

  ELSIF p_media_type = 'tv' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
    FROM (
      SELECT p.id AS user_id, p.display_name, 'wants_to_watch' AS relation, NULL::numeric AS rating, NULL AS note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.tv_watchlist tw ON tw.couple_id = c.id
      JOIN public.tv_shows ts ON ts.id = tw.tv_show_id AND ts.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT p.id, p.display_name, 'wants_to_watch', NULL::numeric, NULL
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.tv_watchlist tw ON tw.couple_id IS NULL AND tw.added_by = p.id
      JOIN public.tv_shows ts ON ts.id = tw.tv_show_id AND ts.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT p.id, p.display_name, 'watched_couple',
        CASE WHEN c.user1_id = p.id THEN tcol.rating_user1 ELSE tcol.rating_user2 END,
        CASE WHEN c.user1_id = p.id THEN tcol.note_user1 ELSE tcol.note_user2 END
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.tv_collection tcol ON tcol.couple_id = c.id
      JOIN public.tv_shows ts ON ts.id = tcol.tv_show_id AND ts.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
      UNION ALL
      SELECT p.id, p.display_name, 'watched_solo', tpc.rating, tpc.note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE WHEN f.requester_id = current_user_id THEN f.addressee_id ELSE f.requester_id END
      JOIN public.tv_personal_collection tpc ON tpc.user_id = p.id
      JOIN public.tv_shows ts ON ts.id = tpc.tv_show_id AND ts.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted' AND current_user_id IN (f.requester_id, f.addressee_id)
    ) t;
  END IF;

  RETURN result;
END;
$$;

-- ------------------------------------------------------------
-- 7. RPC get_friend_affinity : + séries vues en couple
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_friend_affinity(p_friend_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
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
    SELECT pc.user_id, 'movie' AS media_type, m.tmdb_id, m.title, m.poster_path, pc.rating, 1 AS prio
    FROM public.personal_collection pc
    JOIN public.movies m ON m.id = pc.movie_id
    WHERE pc.user_id IN (me, p_friend_id)
    UNION ALL
    SELECT u.user_id, 'movie', m.tmdb_id, m.title, m.poster_path,
      CASE WHEN c.user1_id = u.user_id THEN col.rating_user1 ELSE col.rating_user2 END, 2
    FROM public.collection col
    JOIN public.couples c ON c.id = col.couple_id
    JOIN public.movies m ON m.id = col.movie_id
    JOIN LATERAL unnest(ARRAY[c.user1_id, c.user2_id]) AS u(user_id) ON u.user_id IN (me, p_friend_id)
    UNION ALL
    SELECT tpc.user_id, 'tv', ts.tmdb_id, ts.name, ts.poster_path, tpc.rating, 1
    FROM public.tv_personal_collection tpc
    JOIN public.tv_shows ts ON ts.id = tpc.tv_show_id
    WHERE tpc.user_id IN (me, p_friend_id)
    UNION ALL
    SELECT u.user_id, 'tv', ts.tmdb_id, ts.name, ts.poster_path,
      CASE WHEN c.user1_id = u.user_id THEN tcol.rating_user1 ELSE tcol.rating_user2 END, 2
    FROM public.tv_collection tcol
    JOIN public.couples c ON c.id = tcol.couple_id
    JOIN public.tv_shows ts ON ts.id = tcol.tv_show_id
    JOIN LATERAL unnest(ARRAY[c.user1_id, c.user2_id]) AS u(user_id) ON u.user_id IN (me, p_friend_id)
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

-- ------------------------------------------------------------
-- 8. notify_reco_watched : + branche tv_collection + trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_reco_watched()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_tmdb_id int;
  v_title text;
  v_is_tv boolean := false;
  reco record;
  watcher_ids uuid[];
  supabase_url text := 'https://tppecozmygtjmbcdqgfc.supabase.co';
BEGIN
  IF TG_TABLE_NAME = 'personal_collection' THEN
    SELECT tmdb_id, title INTO v_tmdb_id, v_title FROM public.movies WHERE id = NEW.movie_id;
    watcher_ids := ARRAY[NEW.user_id];
  ELSIF TG_TABLE_NAME = 'collection' THEN
    SELECT tmdb_id, title INTO v_tmdb_id, v_title FROM public.movies WHERE id = NEW.movie_id;
    SELECT ARRAY[user1_id, user2_id] INTO watcher_ids FROM public.couples WHERE id = NEW.couple_id;
  ELSIF TG_TABLE_NAME = 'tv_personal_collection' THEN
    SELECT tmdb_id, name INTO v_tmdb_id, v_title FROM public.tv_shows WHERE id = NEW.tv_show_id;
    watcher_ids := ARRAY[NEW.user_id];
    v_is_tv := true;
  ELSIF TG_TABLE_NAME = 'tv_collection' THEN
    SELECT tmdb_id, name INTO v_tmdb_id, v_title FROM public.tv_shows WHERE id = NEW.tv_show_id;
    SELECT ARRAY[user1_id, user2_id] INTO watcher_ids FROM public.couples WHERE id = NEW.couple_id;
    v_is_tv := true;
  ELSE
    RETURN NEW;
  END IF;

  IF v_tmdb_id IS NULL OR watcher_ids IS NULL THEN
    RETURN NEW;
  END IF;

  FOR reco IN
    SELECT r.id, r.from_user_id, r.to_user_id
    FROM public.recommendations r
    WHERE ((NOT v_is_tv AND r.movie_id = v_tmdb_id) OR (v_is_tv AND r.tv_show_id = v_tmdb_id))
      AND r.to_user_id = ANY(watcher_ids)
      AND r.watched_at IS NULL
      AND r.from_user_id <> ALL(watcher_ids)
  LOOP
    UPDATE public.recommendations SET watched_at = now() WHERE id = reco.id;

    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = reco.from_user_id LIMIT 1) THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-push',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', reco.from_user_id,
          'title', 'Ta reco a été vue !',
          'body', (SELECT display_name FROM public.profiles WHERE id = reco.to_user_id)
                  || ' a regardé « ' || COALESCE(v_title, 'ta reco') || ' »',
          'url', '/recommendations?tab=sent'
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_reco_watched_tv_collection ON public.tv_collection;
CREATE TRIGGER trg_notify_reco_watched_tv_collection
  AFTER INSERT ON public.tv_collection
  FOR EACH ROW EXECUTE FUNCTION public.notify_reco_watched();
