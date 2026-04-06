-- Migration : tables pour le support des séries TV

-- 1. tv_shows — cache local des séries TMDB (miroir de la table movies)
CREATE TABLE public.tv_shows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmdb_id integer UNIQUE NOT NULL,
  name text NOT NULL,
  original_name text NOT NULL,
  overview text NOT NULL DEFAULT '',
  poster_path text,
  backdrop_path text,
  first_air_date text,
  vote_average real,
  genres text[] DEFAULT '{}',
  number_of_seasons integer,
  status text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX tv_shows_tmdb_id_idx ON public.tv_shows (tmdb_id);

ALTER TABLE public.tv_shows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_shows readable by authenticated" ON public.tv_shows FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "tv_shows insertable by authenticated" ON public.tv_shows FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tv_shows updatable by authenticated" ON public.tv_shows FOR UPDATE USING (auth.uid() IS NOT NULL);

-- 2. tv_watchlist — une entrée par saison à voir (pas la série entière)
CREATE TABLE public.tv_watchlist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tv_show_id uuid NOT NULL REFERENCES public.tv_shows(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  added_by uuid NOT NULL REFERENCES auth.users(id),
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tv_show_id, season_number, couple_id)
);

CREATE INDEX tv_watchlist_couple_id_idx ON public.tv_watchlist (couple_id);

ALTER TABLE public.tv_watchlist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_watchlist couple members" ON public.tv_watchlist FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = couple_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

-- 3. tv_collection — une entrée par série dans la collection (pas par saison)
CREATE TABLE public.tv_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tv_show_id uuid NOT NULL REFERENCES public.tv_shows(id) ON DELETE CASCADE,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(tv_show_id, couple_id)
);

CREATE INDEX tv_collection_couple_id_idx ON public.tv_collection (couple_id);

ALTER TABLE public.tv_collection ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_collection couple members" ON public.tv_collection FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = couple_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);

-- 4. tv_season_status — vu ensemble / vu en solo par saison
CREATE TABLE public.tv_season_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tv_show_id uuid NOT NULL REFERENCES public.tv_shows(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  couple_id uuid REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id),
  watched_type text NOT NULL CHECK (watched_type IN ('couple', 'solo')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tv_show_id, season_number, couple_id, user_id)
);

ALTER TABLE public.tv_season_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_season_status couple members" ON public.tv_season_status FOR ALL USING (
  (couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = couple_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  ))
  OR (user_id = auth.uid())
);

-- 5. tv_episode_ratings — notes par épisode (couple, même pattern que collection)
CREATE TABLE public.tv_episode_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tv_show_id uuid NOT NULL REFERENCES public.tv_shows(id) ON DELETE CASCADE,
  season_number integer NOT NULL,
  episode_number integer NOT NULL,
  couple_id uuid NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  rating_user1 smallint CHECK (rating_user1 BETWEEN 1 AND 10),
  rating_user2 smallint CHECK (rating_user2 BETWEEN 1 AND 10),
  note_user1 text,
  note_user2 text,
  watched_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(tv_show_id, season_number, episode_number, couple_id)
);

CREATE INDEX tv_episode_ratings_show_idx ON public.tv_episode_ratings (tv_show_id, couple_id);

ALTER TABLE public.tv_episode_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tv_episode_ratings couple members" ON public.tv_episode_ratings FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.couples c
    WHERE c.id = couple_id
      AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  )
);
