-- ============================================================
-- Fix 1 : Policy UPDATE friendships — ajouter WITH CHECK
-- Le USING exige status='pending' pour cibler la row,
-- mais sans WITH CHECK séparé, le nouveau status='accepted' est rejeté.
-- ============================================================

DROP POLICY IF EXISTS "friendships_update_addressee" ON public.friendships;

CREATE POLICY "friendships_update_addressee" ON public.friendships FOR UPDATE
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');

-- ============================================================
-- Fix 2 : Permettre la lecture des profils des amis acceptés
-- Sans cela, le SELECT profiles pour afficher le nom des amis
-- retourne vide (RLS bloque tout sauf soi-même + partenaire).
-- ============================================================

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
