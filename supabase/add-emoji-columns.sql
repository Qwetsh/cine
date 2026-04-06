-- Migration: ajouter des colonnes emoji aux collections
-- Permet de stocker une émotion (emoji) par utilisateur par film

ALTER TABLE collection
  ADD COLUMN IF NOT EXISTS emoji_user1 text,
  ADD COLUMN IF NOT EXISTS emoji_user2 text;

ALTER TABLE personal_collection
  ADD COLUMN IF NOT EXISTS emoji text;
