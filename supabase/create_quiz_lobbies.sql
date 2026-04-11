-- Quiz Lobbies: code-based lobby system (replaces couple-only quiz_sessions)
-- Any authenticated user can create or join via a 6-char code.

CREATE TABLE IF NOT EXISTS quiz_lobbies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  join_code text NOT NULL UNIQUE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  player2_id uuid REFERENCES profiles(id) ON DELETE SET NULL,

  type text NOT NULL DEFAULT 'classic' CHECK (type IN ('classic', 'fight')),
  status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'picking', 'playing', 'done')),

  -- Quiz config
  difficulty text NOT NULL DEFAULT 'normal' CHECK (difficulty IN ('easy', 'normal', 'hard')),
  year_min int NOT NULL DEFAULT 1970,
  year_max int NOT NULL DEFAULT 2026,
  question_types text[] NOT NULL DEFAULT '{}',
  question_count int NOT NULL DEFAULT 10 CHECK (question_count IN (5, 10, 20)),

  -- Fight mode film picks
  film_user1 jsonb,
  film_user2 jsonb,

  -- Gameplay state
  quiz_data jsonb,
  score_user1 int NOT NULL DEFAULT 0,
  score_user2 int NOT NULL DEFAULT 0,

  -- Lifecycle
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_quiz_lobbies_join_code ON quiz_lobbies (join_code);
-- Index for user's active lobbies
CREATE INDEX IF NOT EXISTS idx_quiz_lobbies_created_by ON quiz_lobbies (created_by, status);

-- ── RLS ──
ALTER TABLE quiz_lobbies ENABLE ROW LEVEL SECURITY;

-- SELECT: participants can see their lobby
CREATE POLICY quiz_lobbies_select ON quiz_lobbies
  FOR SELECT USING (
    auth.uid() = created_by
    OR auth.uid() = player2_id
  );

-- SELECT: any authenticated user can lookup a lobby by join_code (to join)
CREATE POLICY quiz_lobbies_select_by_code ON quiz_lobbies
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND player2_id IS NULL
    AND status = 'setup'
  );

-- INSERT: any authenticated user can create
CREATE POLICY quiz_lobbies_insert ON quiz_lobbies
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
  );

-- UPDATE: only participants
CREATE POLICY quiz_lobbies_update ON quiz_lobbies
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = player2_id
  );

-- DELETE: only creator
CREATE POLICY quiz_lobbies_delete ON quiz_lobbies
  FOR DELETE USING (
    auth.uid() = created_by
  );

-- ── Realtime ──
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_lobbies;
