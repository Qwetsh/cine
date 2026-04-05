-- Migration: étendre les notes de 1-5 à 1-10 (10 étoiles)

-- Table collection : rating_user1
ALTER TABLE collection DROP CONSTRAINT IF EXISTS collection_rating_user1_check;
ALTER TABLE collection ADD CONSTRAINT collection_rating_user1_check CHECK (rating_user1 BETWEEN 1 AND 10);

-- Table collection : rating_user2
ALTER TABLE collection DROP CONSTRAINT IF EXISTS collection_rating_user2_check;
ALTER TABLE collection ADD CONSTRAINT collection_rating_user2_check CHECK (rating_user2 BETWEEN 1 AND 10);

-- Table personal_collection : rating (si elle existe)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'personal_collection' AND column_name = 'rating'
  ) THEN
    EXECUTE 'ALTER TABLE personal_collection DROP CONSTRAINT IF EXISTS personal_collection_rating_check';
    EXECUTE 'ALTER TABLE personal_collection ADD CONSTRAINT personal_collection_rating_check CHECK (rating BETWEEN 1 AND 10)';
  END IF;
END $$;
