-- Table pour les sessions de quiz standalone (onglet Quiz)
-- À exécuter dans le SQL Editor de Supabase

CREATE TABLE IF NOT EXISTS quiz_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id uuid NOT NULL REFERENCES couples(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  type text NOT NULL CHECK (type IN ('classic', 'fight')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'picking', 'playing', 'done')),
  -- Classic mode
  theme text CHECK (theme IN ('actor', 'director', 'country', 'decade', 'general')),
  theme_value text,
  -- Fight mode films
  film_user1 jsonb,
  film_user2 jsonb,
  -- Quiz state
  quiz_data jsonb,
  -- Scores
  score_user1 int DEFAULT 0,
  score_user2 int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Index pour lookup rapide
CREATE INDEX IF NOT EXISTS idx_quiz_sessions_couple ON quiz_sessions(couple_id, status);

-- RLS
ALTER TABLE quiz_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Quiz sessions visible par le couple"
  ON quiz_sessions FOR SELECT
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "Quiz sessions modifiable par le couple"
  ON quiz_sessions FOR INSERT
  WITH CHECK (
    couple_id IN (
      SELECT id FROM couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "Quiz sessions update par le couple"
  ON quiz_sessions FOR UPDATE
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

CREATE POLICY "Quiz sessions delete par le couple"
  ON quiz_sessions FOR DELETE
  USING (
    couple_id IN (
      SELECT id FROM couples
      WHERE user1_id = auth.uid() OR user2_id = auth.uid()
    )
  );

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_sessions;
