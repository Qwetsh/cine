-- Migration: permettre les demi-étoiles (0.5, 1.0, 1.5, ..., 5.0)
-- Change le type des colonnes rating de smallint/integer vers numeric(2,1)
-- et met à jour les contraintes CHECK pour 0.5-5

BEGIN;

-- ============================================================
-- Table: collection (films couple)
-- ============================================================
ALTER TABLE collection
  ALTER COLUMN rating_user1 TYPE numeric(2,1) USING rating_user1::numeric(2,1),
  ALTER COLUMN rating_user2 TYPE numeric(2,1) USING rating_user2::numeric(2,1);

ALTER TABLE collection DROP CONSTRAINT IF EXISTS collection_rating_user1_check;
ALTER TABLE collection DROP CONSTRAINT IF EXISTS collection_rating_user2_check;
ALTER TABLE collection ADD CONSTRAINT collection_rating_user1_check CHECK (rating_user1 BETWEEN 0.5 AND 5);
ALTER TABLE collection ADD CONSTRAINT collection_rating_user2_check CHECK (rating_user2 BETWEEN 0.5 AND 5);

-- ============================================================
-- Table: personal_collection (films perso)
-- ============================================================
ALTER TABLE personal_collection
  ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);

ALTER TABLE personal_collection DROP CONSTRAINT IF EXISTS personal_collection_rating_check;
ALTER TABLE personal_collection ADD CONSTRAINT personal_collection_rating_check CHECK (rating BETWEEN 0.5 AND 5);

-- ============================================================
-- Table: tv_episode_ratings (épisodes TV couple)
-- ============================================================
ALTER TABLE tv_episode_ratings
  ALTER COLUMN rating_user1 TYPE numeric(2,1) USING rating_user1::numeric(2,1),
  ALTER COLUMN rating_user2 TYPE numeric(2,1) USING rating_user2::numeric(2,1);

ALTER TABLE tv_episode_ratings DROP CONSTRAINT IF EXISTS tv_episode_ratings_rating_user1_check;
ALTER TABLE tv_episode_ratings DROP CONSTRAINT IF EXISTS tv_episode_ratings_rating_user2_check;
ALTER TABLE tv_episode_ratings ADD CONSTRAINT tv_episode_ratings_rating_user1_check CHECK (rating_user1 BETWEEN 0.5 AND 5);
ALTER TABLE tv_episode_ratings ADD CONSTRAINT tv_episode_ratings_rating_user2_check CHECK (rating_user2 BETWEEN 0.5 AND 5);

-- ============================================================
-- Table: tv_personal_collection (séries perso)
-- ============================================================
ALTER TABLE tv_personal_collection
  ALTER COLUMN rating TYPE numeric(2,1) USING rating::numeric(2,1);

ALTER TABLE tv_personal_collection DROP CONSTRAINT IF EXISTS tv_personal_collection_rating_check;
ALTER TABLE tv_personal_collection ADD CONSTRAINT tv_personal_collection_rating_check CHECK (rating BETWEEN 0.5 AND 5);

COMMIT;
