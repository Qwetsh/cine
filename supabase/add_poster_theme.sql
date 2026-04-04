-- Ajouter 'poster' comme thème possible pour quiz_sessions
-- À exécuter dans le SQL Editor de Supabase

ALTER TABLE quiz_sessions DROP CONSTRAINT IF EXISTS quiz_sessions_theme_check;
ALTER TABLE quiz_sessions ADD CONSTRAINT quiz_sessions_theme_check
  CHECK (theme IN ('actor', 'director', 'country', 'decade', 'general', 'poster'));
