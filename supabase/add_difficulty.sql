-- Add difficulty column to quiz_sessions and tournament_sessions
-- Default 'normal' for backwards compatibility

ALTER TABLE quiz_sessions
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'normal'
  CHECK (difficulty IN ('easy', 'normal', 'hard'));

ALTER TABLE tournament_sessions
  ADD COLUMN IF NOT EXISTS difficulty text DEFAULT 'normal'
  CHECK (difficulty IN ('easy', 'normal', 'hard'));

ALTER TABLE tournament_sessions
  ADD COLUMN IF NOT EXISTS game_length text DEFAULT 'short'
  CHECK (game_length IN ('short', 'long'));
