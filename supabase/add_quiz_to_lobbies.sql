-- Étend movie_night_lobbies pour supporter le mode quiz
-- À exécuter dans le SQL Editor de Supabase

-- 1. Élargir la contrainte mode pour inclure 'quiz'
ALTER TABLE movie_night_lobbies
  DROP CONSTRAINT IF EXISTS movie_night_lobbies_mode_check;
ALTER TABLE movie_night_lobbies
  ADD CONSTRAINT movie_night_lobbies_mode_check
  CHECK (mode IS NULL OR mode IN ('random', 'battle', 'quiz'));

-- 2. Élargir la contrainte status pour inclure 'quiz'
ALTER TABLE movie_night_lobbies
  DROP CONSTRAINT IF EXISTS movie_night_lobbies_status_check;
ALTER TABLE movie_night_lobbies
  ADD CONSTRAINT movie_night_lobbies_status_check
  CHECK (status IN ('picking', 'ready', 'battle', 'quiz', 'done'));

-- 3. Ajouter la colonne quiz_data (JSONB)
ALTER TABLE movie_night_lobbies
  ADD COLUMN IF NOT EXISTS quiz_data jsonb;
