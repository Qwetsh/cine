-- Table pour les sessions de tournoi (plateau de jeu)
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS tournament_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'waiting'
    CHECK (status IN ('waiting', 'generating', 'playing', 'center_fight', 'done')),
  board jsonb NOT NULL DEFAULT '{}',
  game_state jsonb NOT NULL DEFAULT '{}',
  winner_user_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_couple
  ON tournament_sessions(couple_id, status);

-- RLS
ALTER TABLE tournament_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tournament_select" ON tournament_sessions FOR SELECT
  USING (couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));

CREATE POLICY "tournament_insert" ON tournament_sessions FOR INSERT
  WITH CHECK (couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));

CREATE POLICY "tournament_update" ON tournament_sessions FOR UPDATE
  USING (couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));

CREATE POLICY "tournament_delete" ON tournament_sessions FOR DELETE
  USING (couple_id IN (
    SELECT id FROM couples WHERE user1_id = auth.uid() OR user2_id = auth.uid()
  ));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tournament_sessions;
