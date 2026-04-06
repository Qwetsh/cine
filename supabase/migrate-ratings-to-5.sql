-- Migration: passer les notes de l'échelle /10 à l'échelle /5
-- Divise toutes les notes existantes par 2
-- À exécuter UNE SEULE FOIS via le SQL Editor de Supabase

BEGIN;

-- Collection couple (films)
UPDATE collection
SET rating_user1 = rating_user1 / 2.0
WHERE rating_user1 IS NOT NULL;

UPDATE collection
SET rating_user2 = rating_user2 / 2.0
WHERE rating_user2 IS NOT NULL;

-- Collection perso (films)
UPDATE personal_collection
SET rating = rating / 2.0
WHERE rating IS NOT NULL;

-- Épisodes TV (couple)
UPDATE tv_episode_ratings
SET rating_user1 = rating_user1 / 2.0
WHERE rating_user1 IS NOT NULL;

UPDATE tv_episode_ratings
SET rating_user2 = rating_user2 / 2.0
WHERE rating_user2 IS NOT NULL;

-- Collection perso TV
UPDATE tv_personal_collection
SET rating = rating / 2.0
WHERE rating IS NOT NULL;

COMMIT;
