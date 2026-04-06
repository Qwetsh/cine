-- ============================================================
-- Système d'amis — table friendships + RLS + fonction RPC
-- ============================================================

-- Table friendships
CREATE TABLE public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);

-- RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

-- SELECT: voir ses propres friendships
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));

-- INSERT: seul le requester peut créer
CREATE POLICY "friendships_insert_requester" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- UPDATE: seul l'addressee peut accepter (status pending → accepted)
CREATE POLICY "friendships_update_addressee" ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending');

-- DELETE: l'un ou l'autre peut supprimer
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE
  USING (auth.uid() IN (requester_id, addressee_id));

-- ============================================================
-- Table recommendations
-- ============================================================

CREATE TABLE public.recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  to_user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  movie_id int REFERENCES public.movies(tmdb_id) ON DELETE CASCADE,
  tv_show_id int REFERENCES public.tv_shows(tmdb_id) ON DELETE CASCADE,
  message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  CHECK (movie_id IS NOT NULL OR tv_show_id IS NOT NULL)
);

CREATE INDEX idx_recommendations_to ON public.recommendations(to_user_id);
CREATE INDEX idx_recommendations_from ON public.recommendations(from_user_id);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- SELECT: voir ses propres recos (envoyées ou reçues)
CREATE POLICY "recommendations_select_own" ON public.recommendations FOR SELECT
  USING (auth.uid() IN (from_user_id, to_user_id));

-- INSERT: seul l'expéditeur peut créer + doit être ami accepted avec le destinataire
CREATE POLICY "recommendations_insert_sender" ON public.recommendations FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND EXISTS (
      SELECT 1 FROM public.friendships
      WHERE status = 'accepted'
        AND (
          (requester_id = auth.uid() AND addressee_id = to_user_id)
          OR (addressee_id = auth.uid() AND requester_id = to_user_id)
        )
    )
  );

-- UPDATE: seul le destinataire peut marquer seen_at
CREATE POLICY "recommendations_update_receiver" ON public.recommendations FOR UPDATE
  USING (auth.uid() = to_user_id);

-- DELETE: l'un ou l'autre peut supprimer
CREATE POLICY "recommendations_delete_own" ON public.recommendations FOR DELETE
  USING (auth.uid() IN (from_user_id, to_user_id));

-- ============================================================
-- Fonctions RPC
-- ============================================================

-- Fonction RPC pour résoudre un invite code en user_id
CREATE OR REPLACE FUNCTION public.resolve_invite_code_for_friend(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  SELECT id INTO target_id FROM public.profiles WHERE invite_code = code;
  RETURN target_id;
END;
$$;

-- Fonction SECURITY DEFINER pour récupérer les données amis sur un film/série
-- Bypass les RLS existantes pour lire collections/watchlists des amis
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
      -- Amis qui ont le film dans leur watchlist couple
      SELECT
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

      -- Amis qui ont noté/commenté le film (collection couple)
      SELECT
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

      -- Amis qui ont le film en collection perso
      SELECT
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
      -- Amis qui ont la série dans leur collection perso TV
      SELECT
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
