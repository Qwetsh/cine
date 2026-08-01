-- ============================================================
-- Améliorations du lien social — 01/08/2026
-- (appliqué en base via la migration social_link_improvements)
--
-- 1) Verrou anti-énumération sur les RPC de résolution de code invite
-- 2) Lecture du profil de l'autre partie d'une demande d'ami pending
-- 3) Recommandations autorisées vers le partenaire (pas seulement les amis)
-- 4) read_at sur les messages de reco (non-lus persistés)
-- 5) recommendations dans la publication realtime
-- 6) Boucle de reco fermée : push à l'expéditeur quand le destinataire
--    ajoute le film recommandé à sa collection (+ recommendations.watched_at)
-- ============================================================

-- 1) Les codes invite (8 hex, générés côté client) étaient résolubles par
-- le rôle anon → énumération possible sans compte. On exige une session.
CREATE OR REPLACE FUNCTION public.resolve_invite_code(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO target_id FROM public.profiles WHERE invite_code = code;
  RETURN target_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_invite_code_for_friend(code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  target_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO target_id FROM public.profiles WHERE invite_code = code;
  RETURN target_id;
END;
$$;

-- 2) Sans cette policy, une demande d'ami pending affiche « Utilisateur »
-- des deux côtés (demandes reçues ET envoyées) : la RLS profiles ne couvre
-- que soi-même, le partenaire et les amis acceptés.
DROP POLICY IF EXISTS "Lecture profils demandes pending" ON public.profiles;
CREATE POLICY "Lecture profils demandes pending" ON public.profiles
  FOR SELECT USING (
    id IN (
      SELECT CASE
        WHEN requester_id = auth.uid() THEN addressee_id
        ELSE requester_id
      END
      FROM public.friendships
      WHERE status = 'pending'
        AND auth.uid() IN (requester_id, addressee_id)
    )
  );

-- 3) Reco au partenaire : on élargit la policy INSERT au lieu de créer une
-- amitié fantôme (qui polluerait badges amis, carrousel recos, etc.)
DROP POLICY IF EXISTS "recommendations_insert_sender" ON public.recommendations;
CREATE POLICY "recommendations_insert_sender" ON public.recommendations FOR INSERT
  WITH CHECK (
    auth.uid() = from_user_id
    AND (
      EXISTS (
        SELECT 1 FROM public.friendships
        WHERE status = 'accepted'
          AND (
            (requester_id = auth.uid() AND addressee_id = to_user_id)
            OR (addressee_id = auth.uid() AND requester_id = to_user_id)
          )
      )
      OR EXISTS (
        SELECT 1 FROM public.couples
        WHERE (user1_id = auth.uid() AND user2_id = to_user_id)
           OR (user2_id = auth.uid() AND user1_id = to_user_id)
      )
    )
  );

-- 4) Non-lus persistés : read_at + policy UPDATE restreinte au lecteur
-- (pas l'auteur), et grant limité à la colonne read_at pour empêcher
-- toute modification du contenu d'un message d'autrui.
ALTER TABLE public.recommendation_messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

DROP POLICY IF EXISTS "reco_messages_mark_read" ON public.recommendation_messages;
CREATE POLICY "reco_messages_mark_read" ON public.recommendation_messages FOR UPDATE
  USING (
    sender_id <> auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE r.id = recommendation_id
        AND auth.uid() IN (r.from_user_id, r.to_user_id)
    )
  );

REVOKE UPDATE ON public.recommendation_messages FROM authenticated;
GRANT UPDATE (read_at) ON public.recommendation_messages TO authenticated;

-- 5) Les abonnements realtime côté client ne reçoivent rien si la table
-- n'est pas publiée (leçon apprise avec friendships)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'recommendations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.recommendations;
  END IF;
END $$;

-- 6) Boucle de reco fermée. watched_at sert à la fois de dédup de
-- notification et de signal « vu » exploitable côté UI.
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS watched_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_reco_watched()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_tmdb_id int;
  v_title text;
  v_is_tv boolean := false;
  reco record;
  watcher_ids uuid[];
  supabase_url text := 'https://tppecozmygtjmbcdqgfc.supabase.co';
BEGIN
  -- Identifier l'œuvre et le(s) spectateur(s) selon la table source
  IF TG_TABLE_NAME = 'personal_collection' THEN
    SELECT tmdb_id, title INTO v_tmdb_id, v_title FROM public.movies WHERE id = NEW.movie_id;
    watcher_ids := ARRAY[NEW.user_id];
  ELSIF TG_TABLE_NAME = 'collection' THEN
    SELECT tmdb_id, title INTO v_tmdb_id, v_title FROM public.movies WHERE id = NEW.movie_id;
    SELECT ARRAY[user1_id, user2_id] INTO watcher_ids FROM public.couples WHERE id = NEW.couple_id;
  ELSIF TG_TABLE_NAME = 'tv_personal_collection' THEN
    SELECT tmdb_id, name INTO v_tmdb_id, v_title FROM public.tv_shows WHERE id = NEW.tv_show_id;
    watcher_ids := ARRAY[NEW.user_id];
    v_is_tv := true;
  ELSE
    RETURN NEW;
  END IF;

  IF v_tmdb_id IS NULL OR watcher_ids IS NULL THEN
    RETURN NEW;
  END IF;

  -- Toutes les recos non encore « vues » pointant vers cette œuvre pour ce(s) user(s)
  FOR reco IN
    SELECT r.id, r.from_user_id, r.to_user_id
    FROM public.recommendations r
    WHERE ((NOT v_is_tv AND r.movie_id = v_tmdb_id) OR (v_is_tv AND r.tv_show_id = v_tmdb_id))
      AND r.to_user_id = ANY(watcher_ids)
      AND r.watched_at IS NULL
      AND r.from_user_id <> ALL(watcher_ids)
  LOOP
    UPDATE public.recommendations SET watched_at = now() WHERE id = reco.id;

    IF EXISTS (SELECT 1 FROM public.push_subscriptions WHERE user_id = reco.from_user_id LIMIT 1) THEN
      PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-push',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'user_id', reco.from_user_id,
          'title', 'Ta reco a été vue !',
          'body', (SELECT display_name FROM public.profiles WHERE id = reco.to_user_id)
                  || ' a regardé « ' || COALESCE(v_title, 'ta reco') || ' »',
          'url', '/recommendations?tab=sent'
        )
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Ne jamais faire échouer l'ajout en collection pour une notification
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_personal_collection_reco_watched ON public.personal_collection;
CREATE TRIGGER on_personal_collection_reco_watched
  AFTER INSERT ON public.personal_collection
  FOR EACH ROW EXECUTE FUNCTION public.notify_reco_watched();

DROP TRIGGER IF EXISTS on_collection_reco_watched ON public.collection;
CREATE TRIGGER on_collection_reco_watched
  AFTER INSERT ON public.collection
  FOR EACH ROW EXECUTE FUNCTION public.notify_reco_watched();

DROP TRIGGER IF EXISTS on_tv_personal_collection_reco_watched ON public.tv_personal_collection;
CREATE TRIGGER on_tv_personal_collection_reco_watched
  AFTER INSERT ON public.tv_personal_collection
  FOR EACH ROW EXECUTE FUNCTION public.notify_reco_watched();
