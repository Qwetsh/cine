-- ============================================================
-- RESTAURATION du système d'amis — 01/08/2026
--
-- CAUSE IDENTIFIÉE : la migration Pierrehammer
-- Pierrammer/supabase/migrations/20260427_fix_profiles_display_name_cleanup.sql
-- a fait « DROP TABLE IF EXISTS friendships CASCADE » en croyant la table
-- orpheline (le code PH était passé sur ph_friendships), alors que c'était
-- la table LIVE de Ciné — les deux apps partagent le même projet Supabase.
-- Le CASCADE a aussi emporté la policy « Lecture profils amis » sur
-- profiles et le trigger de notification push sur friendships.
-- Les fonctions RPC de Ciné (get_friends_want_to_watch,
-- get_friends_high_ratings, get_friend_*…) ont survécu mais plantent en
-- 42P01, que PostgREST renvoie en 404.
--
-- friendships n'est pas non plus dans la publication realtime écoutée
-- par useFriends.ts.
--
-- Ce script est idempotent : rejouable sans risque.
-- Il ne recrée PAS les fonctions (déjà présentes) ni la table
-- recommendations (déjà présente).
-- ============================================================

-- 1) Table friendships + index
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id);

-- 2) RLS
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_own" ON public.friendships;
CREATE POLICY "friendships_select_own" ON public.friendships FOR SELECT
  USING (auth.uid() IN (requester_id, addressee_id));

DROP POLICY IF EXISTS "friendships_insert_requester" ON public.friendships;
CREATE POLICY "friendships_insert_requester" ON public.friendships FOR INSERT
  WITH CHECK (auth.uid() = requester_id);

-- Version corrigée (fix_friends_rls.sql) : WITH CHECK séparé, sinon le
-- passage pending → accepted est rejeté.
DROP POLICY IF EXISTS "friendships_update_addressee" ON public.friendships;
CREATE POLICY "friendships_update_addressee" ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');

DROP POLICY IF EXISTS "friendships_delete_own" ON public.friendships;
CREATE POLICY "friendships_delete_own" ON public.friendships FOR DELETE
  USING (auth.uid() IN (requester_id, addressee_id));

-- 3) Lecture des profils des amis acceptés (sinon les noms/avatars des
-- amis restent vides — RLS profiles ne couvre que soi-même + partenaire)
DROP POLICY IF EXISTS "Lecture profils amis" ON public.profiles;
CREATE POLICY "Lecture profils amis" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT CASE
        WHEN requester_id = auth.uid() THEN addressee_id
        ELSE requester_id
      END
      FROM public.friendships
      WHERE status = 'accepted'
        AND auth.uid() IN (requester_id, addressee_id)
    )
  );

-- 4) Trigger de notification push (détruit avec la table par le CASCADE).
-- notify_push() gère déjà les branches TG_TABLE_NAME = 'friendships'
-- (demande d'ami sur INSERT, acceptation sur UPDATE status='accepted').
-- Nom aligné sur la convention existante (on_recommendation_notify,
-- on_couple_notify…).
DROP TRIGGER IF EXISTS on_friendship_notify ON public.friendships;
CREATE TRIGGER on_friendship_notify
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.notify_push();

-- 5) Realtime : useFriends.ts écoute postgres_changes sur friendships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
END $$;
