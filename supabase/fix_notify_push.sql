-- ============================================================
-- Fix notify_push() — appliqué le 02/08/2026 (migration
-- fix_notify_push_new_status via MCP).
--
-- Bug : la condition « ELSIF TG_TABLE_NAME = 'friendships' AND
-- TG_OP = 'UPDATE' AND NEW.status = 'accepted' » était préparée
-- pour TOUTES les tables déclencheuses ; sur recommendations,
-- recommendation_messages et couples (pas de colonne status),
-- la résolution de NEW.status échouait (42703) et faisait
-- échouer l'INSERT métier en 400. Conséquence : plus aucune
-- recommandation ni message envoyables depuis fin avril 2026
-- (l'ajout de la notification « Ami accepté »).
--
-- Correction : branchement imbriqué par table (NEW.status n'est
-- résolu que dans la branche friendships) + EXCEPTION WHEN OTHERS
-- pour qu'un échec de notification ne bloque plus jamais l'action.
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  target_user_id uuid;
  sender_name text;
  notif_title text;
  notif_body text;
  notif_url text;
  supabase_url text := 'https://tppecozmygtjmbcdqgfc.supabase.co';
BEGIN
  -- Brancher d'abord par table : NEW.status n'existe que sur friendships
  IF TG_TABLE_NAME = 'friendships' THEN
    IF TG_OP = 'INSERT' THEN
      target_user_id := NEW.addressee_id;
      SELECT display_name INTO sender_name FROM profiles WHERE id = NEW.requester_id;
      notif_title := 'Demande d''ami';
      notif_body := sender_name || ' veut devenir ton ami';
      notif_url := '/profile';
    ELSIF TG_OP = 'UPDATE' AND NEW.status = 'accepted' THEN
      target_user_id := NEW.requester_id;
      SELECT display_name INTO sender_name FROM profiles WHERE id = NEW.addressee_id;
      notif_title := 'Ami accepté !';
      notif_body := sender_name || ' a accepté ta demande d''ami';
      notif_url := '/friends';
    ELSE
      RETURN NEW;
    END IF;

  ELSIF TG_TABLE_NAME = 'recommendations' AND TG_OP = 'INSERT' THEN
    target_user_id := NEW.to_user_id;
    SELECT display_name INTO sender_name FROM profiles WHERE id = NEW.from_user_id;
    notif_title := 'Nouvelle recommandation';
    notif_body := sender_name || ' t''a recommandé quelque chose';
    notif_url := '/recommendations';

  ELSIF TG_TABLE_NAME = 'recommendation_messages' AND TG_OP = 'INSERT' THEN
    DECLARE
      reco record;
    BEGIN
      SELECT * INTO reco FROM recommendations WHERE id = NEW.recommendation_id;
      IF reco.from_user_id = NEW.sender_id THEN
        target_user_id := reco.to_user_id;
      ELSE
        target_user_id := reco.from_user_id;
      END IF;
    END;
    SELECT display_name INTO sender_name FROM profiles WHERE id = NEW.sender_id;
    notif_title := 'Nouveau message';
    notif_body := sender_name || ' t''a envoyé un message';
    notif_url := '/recommendations';

  ELSIF TG_TABLE_NAME = 'couples' AND TG_OP = 'INSERT' THEN
    target_user_id := NEW.user2_id;
    SELECT display_name INTO sender_name FROM profiles WHERE id = NEW.user1_id;
    notif_title := 'Partenaire lié !';
    notif_body := sender_name || ' vous a ajouté comme partenaire';
    notif_url := '/profile';

  ELSE
    RETURN NEW;
  END IF;

  IF target_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM push_subscriptions WHERE user_id = target_user_id LIMIT 1) THEN
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/send-push',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'user_id', target_user_id,
      'title', notif_title,
      'body', notif_body,
      'url', notif_url
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Une notification ne doit jamais faire échouer l'action métier
  RETURN NEW;
END;
$function$;
