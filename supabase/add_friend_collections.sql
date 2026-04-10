-- ============================================================
-- Collections amis — RPCs pour voir les collections des amis
-- ============================================================

-- 1) Mettre à jour get_friend_movie_data pour retourner user_id
CREATE OR REPLACE FUNCTION public.get_friend_movie_data(p_tmdb_id int, p_media_type text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
BEGIN
  IF p_media_type = 'movie' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
    FROM (
      SELECT
        p.id AS user_id,
        p.display_name,
        'wants_to_watch' AS relation,
        NULL::numeric AS rating,
        NULL AS note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE
        WHEN f.requester_id = current_user_id THEN f.addressee_id
        ELSE f.requester_id
      END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.watchlist w ON w.couple_id = c.id
      JOIN public.movies m ON m.id = w.movie_id AND m.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted'
        AND current_user_id IN (f.requester_id, f.addressee_id)

      UNION ALL

      SELECT
        p.id AS user_id,
        p.display_name,
        'watched_couple' AS relation,
        CASE
          WHEN c.user1_id = p.id THEN col.rating_user1
          ELSE col.rating_user2
        END AS rating,
        CASE
          WHEN c.user1_id = p.id THEN col.note_user1
          ELSE col.note_user2
        END AS note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE
        WHEN f.requester_id = current_user_id THEN f.addressee_id
        ELSE f.requester_id
      END
      JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
      JOIN public.collection col ON col.couple_id = c.id
      JOIN public.movies m ON m.id = col.movie_id AND m.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted'
        AND current_user_id IN (f.requester_id, f.addressee_id)

      UNION ALL

      SELECT
        p.id AS user_id,
        p.display_name,
        'watched_solo' AS relation,
        pc.rating,
        pc.note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE
        WHEN f.requester_id = current_user_id THEN f.addressee_id
        ELSE f.requester_id
      END
      JOIN public.personal_collection pc ON pc.user_id = p.id
      JOIN public.movies m ON m.id = pc.movie_id AND m.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted'
        AND current_user_id IN (f.requester_id, f.addressee_id)
    ) t;

  ELSIF p_media_type = 'tv' THEN
    SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
    FROM (
      SELECT
        p.id AS user_id,
        p.display_name,
        'watched_solo' AS relation,
        tpc.rating,
        tpc.note
      FROM public.friendships f
      JOIN public.profiles p ON p.id = CASE
        WHEN f.requester_id = current_user_id THEN f.addressee_id
        ELSE f.requester_id
      END
      JOIN public.tv_personal_collection tpc ON tpc.user_id = p.id
      JOIN public.tv_shows ts ON ts.id = tpc.tv_show_id AND ts.tmdb_id = p_tmdb_id
      WHERE f.status = 'accepted'
        AND current_user_id IN (f.requester_id, f.addressee_id)
    ) t;
  END IF;

  RETURN result;
END;
$$;

-- 2) RPC pour récupérer la collection perso d'un ami (films)
CREATE OR REPLACE FUNCTION public.get_friend_personal_collection(p_friend_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_friend boolean;
  result jsonb := '[]'::jsonb;
BEGIN
  -- Vérifier que c'est bien un ami accepté
  SELECT EXISTS(
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = current_user_id AND addressee_id = p_friend_id)
        OR (addressee_id = current_user_id AND requester_id = p_friend_id)
      )
  ) INTO is_friend;

  IF NOT is_friend THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.watched_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT
      pc.id,
      pc.watched_at,
      pc.rating,
      pc.note,
      pc.emoji,
      jsonb_build_object(
        'id', m.id,
        'tmdb_id', m.tmdb_id,
        'title', m.title,
        'original_title', m.original_title,
        'overview', m.overview,
        'poster_path', m.poster_path,
        'backdrop_path', m.backdrop_path,
        'release_date', m.release_date,
        'vote_average', m.vote_average,
        'genres', m.genres,
        'runtime', m.runtime
      ) AS movie
    FROM public.personal_collection pc
    JOIN public.movies m ON m.id = pc.movie_id
    WHERE pc.user_id = p_friend_id
  ) t;

  RETURN result;
END;
$$;

-- 3) RPC pour récupérer la collection perso TV d'un ami
CREATE OR REPLACE FUNCTION public.get_friend_tv_personal_collection(p_friend_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  is_friend boolean;
  result jsonb := '[]'::jsonb;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.friendships
    WHERE status = 'accepted'
      AND (
        (requester_id = current_user_id AND addressee_id = p_friend_id)
        OR (addressee_id = current_user_id AND requester_id = p_friend_id)
      )
  ) INTO is_friend;

  IF NOT is_friend THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.watched_at DESC), '[]'::jsonb) INTO result
  FROM (
    SELECT
      tpc.id,
      tpc.watched_at,
      tpc.rating,
      tpc.note,
      jsonb_build_object(
        'id', ts.id,
        'tmdb_id', ts.tmdb_id,
        'name', ts.name,
        'original_name', ts.original_name,
        'overview', ts.overview,
        'poster_path', ts.poster_path,
        'backdrop_path', ts.backdrop_path,
        'first_air_date', ts.first_air_date,
        'vote_average', ts.vote_average,
        'genres', ts.genres,
        'number_of_seasons', ts.number_of_seasons,
        'status', ts.status
      ) AS tv_show
    FROM public.tv_personal_collection tpc
    JOIN public.tv_shows ts ON ts.id = tpc.tv_show_id
    WHERE tpc.user_id = p_friend_id
  ) t;

  RETURN result;
END;
$$;

-- 4) RPC pour récupérer les tmdb_ids que les amis veulent voir (watchlist couple + personal watchlist-like)
CREATE OR REPLACE FUNCTION public.get_friends_want_to_watch()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
  FROM (
    SELECT
      m.tmdb_id,
      'movie' AS media_type,
      count(DISTINCT p.id) AS friend_count
    FROM public.friendships f
    JOIN public.profiles p ON p.id = CASE
      WHEN f.requester_id = current_user_id THEN f.addressee_id
      ELSE f.requester_id
    END
    JOIN public.couples c ON (c.user1_id = p.id OR c.user2_id = p.id)
    JOIN public.watchlist w ON w.couple_id = c.id
    JOIN public.movies m ON m.id = w.movie_id
    WHERE f.status = 'accepted'
      AND current_user_id IN (f.requester_id, f.addressee_id)
    GROUP BY m.tmdb_id
  ) t;

  RETURN result;
END;
$$;
