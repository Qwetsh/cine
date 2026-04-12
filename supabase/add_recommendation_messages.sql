-- ============================================================
-- Messages de discussion sur les recommandations
-- ============================================================

CREATE TABLE public.recommendation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id uuid NOT NULL REFERENCES public.recommendations(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reco_messages_reco ON public.recommendation_messages(recommendation_id, created_at);
CREATE INDEX idx_reco_messages_sender ON public.recommendation_messages(sender_id);

ALTER TABLE public.recommendation_messages ENABLE ROW LEVEL SECURITY;

-- SELECT: seuls les participants de la reco parent (from_user_id / to_user_id) peuvent lire
CREATE POLICY "reco_messages_select" ON public.recommendation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE r.id = recommendation_id
        AND auth.uid() IN (r.from_user_id, r.to_user_id)
    )
  );

-- INSERT: seuls les participants de la reco parent peuvent écrire, et sender_id = auth.uid()
CREATE POLICY "reco_messages_insert" ON public.recommendation_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.recommendations r
      WHERE r.id = recommendation_id
        AND auth.uid() IN (r.from_user_id, r.to_user_id)
    )
  );

-- DELETE: seul l'auteur du message peut supprimer
CREATE POLICY "reco_messages_delete" ON public.recommendation_messages FOR DELETE
  USING (auth.uid() = sender_id);

-- Activer le realtime sur cette table
ALTER PUBLICATION supabase_realtime ADD TABLE public.recommendation_messages;
