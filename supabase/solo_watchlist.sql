-- ============================================================
-- Migration : watchlist accessible en solo + fusion au lien couple
-- ============================================================

-- 1. Rendre couple_id nullable
ALTER TABLE public.watchlist ALTER COLUMN couple_id DROP NOT NULL;
ALTER TABLE public.tv_watchlist ALTER COLUMN couple_id DROP NOT NULL;

-- 2. Index unique partiel pour les entrées solo (éviter doublons)
CREATE UNIQUE INDEX watchlist_movie_user_solo
  ON public.watchlist(movie_id, added_by) WHERE couple_id IS NULL;

CREATE UNIQUE INDEX tv_watchlist_show_season_user_solo
  ON public.tv_watchlist(tv_show_id, season_number, added_by) WHERE couple_id IS NULL;

-- Index pour requêtes solo
CREATE INDEX watchlist_added_by_idx ON public.watchlist(added_by) WHERE couple_id IS NULL;
CREATE INDEX tv_watchlist_added_by_idx ON public.tv_watchlist(added_by) WHERE couple_id IS NULL;

-- ============================================================
-- 3. Remplacer les policies watchlist (movies)
-- ============================================================

DROP POLICY IF EXISTS "Lecture watchlist du couple" ON public.watchlist;
CREATE POLICY "Lecture watchlist" ON public.watchlist FOR SELECT USING (
  (couple_id IS NOT NULL AND couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ))
  OR
  (couple_id IS NULL AND added_by = auth.uid())
);

DROP POLICY IF EXISTS "Ajout à la watchlist" ON public.watchlist;
CREATE POLICY "Ajout watchlist" ON public.watchlist FOR INSERT WITH CHECK (
  auth.uid() = added_by
  AND (
    couple_id IS NULL
    OR couple_id IN (
      SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS "Suppression watchlist" ON public.watchlist;
CREATE POLICY "Suppression watchlist" ON public.watchlist FOR DELETE USING (
  (couple_id IS NOT NULL AND couple_id IN (
    SELECT id FROM public.couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ))
  OR
  (couple_id IS NULL AND added_by = auth.uid())
);

DROP POLICY IF EXISTS "Modification note watchlist" ON public.watchlist;
CREATE POLICY "Modification note watchlist" ON public.watchlist FOR UPDATE USING (auth.uid() = added_by);

-- ============================================================
-- 4. Remplacer la policy tv_watchlist (ALL → séparées)
-- ============================================================

DROP POLICY IF EXISTS "tv_watchlist couple members" ON public.tv_watchlist;

CREATE POLICY "tv_watchlist_select" ON public.tv_watchlist FOR SELECT USING (
  (couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c WHERE c.id = couple_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  ))
  OR (couple_id IS NULL AND added_by = auth.uid())
);

CREATE POLICY "tv_watchlist_insert" ON public.tv_watchlist FOR INSERT WITH CHECK (
  auth.uid() = added_by
  AND (
    couple_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.couples c WHERE c.id = couple_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  )
);

CREATE POLICY "tv_watchlist_delete" ON public.tv_watchlist FOR DELETE USING (
  (couple_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.couples c WHERE c.id = couple_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  ))
  OR (couple_id IS NULL AND added_by = auth.uid())
);

CREATE POLICY "tv_watchlist_update" ON public.tv_watchlist FOR UPDATE USING (auth.uid() = added_by);

-- ============================================================
-- 5. Fonction SECURITY DEFINER pour fusionner les watchlists solo
--    quand un couple se forme
-- ============================================================

CREATE OR REPLACE FUNCTION public.merge_watchlists_on_couple(
  p_couple_id uuid,
  p_user1_id uuid,
  p_user2_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Films : migrer les entrées solo vers le couple (sauf doublons)
  UPDATE public.watchlist
  SET couple_id = p_couple_id
  WHERE couple_id IS NULL
    AND added_by IN (p_user1_id, p_user2_id)
    AND movie_id NOT IN (
      SELECT movie_id FROM public.watchlist WHERE couple_id = p_couple_id
    );

  -- Supprimer les doublons solo restants
  DELETE FROM public.watchlist
  WHERE couple_id IS NULL
    AND added_by IN (p_user1_id, p_user2_id);

  -- Séries : migrer les entrées solo vers le couple (sauf doublons)
  UPDATE public.tv_watchlist
  SET couple_id = p_couple_id
  WHERE couple_id IS NULL
    AND added_by IN (p_user1_id, p_user2_id)
    AND (tv_show_id, season_number) NOT IN (
      SELECT tv_show_id, season_number FROM public.tv_watchlist WHERE couple_id = p_couple_id
    );

  -- Supprimer les doublons solo restants
  DELETE FROM public.tv_watchlist
  WHERE couple_id IS NULL
    AND added_by IN (p_user1_id, p_user2_id);
END;
$$;
