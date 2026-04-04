-- Table pour les lobbies "Soirée Ciné" en temps réel
CREATE TABLE IF NOT EXISTS movie_night_lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES auth.users(id),
  status text NOT NULL DEFAULT 'picking' CHECK (status IN ('picking', 'ready', 'battle', 'done')),
  mode text CHECK (mode IN ('random', 'battle')),
  film_user1 jsonb,  -- {tmdb_id, title, poster_path, release_date, genres}
  film_user2 jsonb,
  score_user1 int DEFAULT 0,
  score_user2 int DEFAULT 0,
  winner_film jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index pour retrouver le lobby actif d'un couple
CREATE INDEX idx_lobbies_couple_status ON movie_night_lobbies(couple_id, status);

-- RLS
ALTER TABLE movie_night_lobbies ENABLE ROW LEVEL SECURITY;

-- Les membres du couple peuvent voir leurs lobbies
CREATE POLICY lobbies_select ON movie_night_lobbies FOR SELECT USING (
  couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  )
);

-- Les membres du couple peuvent créer un lobby
CREATE POLICY lobbies_insert ON movie_night_lobbies FOR INSERT WITH CHECK (
  couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  )
  AND created_by = auth.uid()
);

-- Les membres du couple peuvent mettre à jour leur lobby
CREATE POLICY lobbies_update ON movie_night_lobbies FOR UPDATE USING (
  couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  )
);

-- Les membres du couple peuvent supprimer leur lobby
CREATE POLICY lobbies_delete ON movie_night_lobbies FOR DELETE USING (
  couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  )
);

-- Activer Realtime sur cette table
ALTER PUBLICATION supabase_realtime ADD TABLE movie_night_lobbies;
