-- Collection perso pour les séries TV (vu en solo)
CREATE TABLE tv_personal_collection (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  tv_show_id uuid NOT NULL REFERENCES tv_shows(id) ON DELETE CASCADE,
  watched_at timestamptz NOT NULL DEFAULT now(),
  rating integer CHECK (rating BETWEEN 1 AND 10),
  note text,
  UNIQUE(user_id, tv_show_id)
);

CREATE INDEX idx_tv_personal_collection_user ON tv_personal_collection(user_id);

-- RLS
ALTER TABLE tv_personal_collection ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own TV personal collection"
  ON tv_personal_collection FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE tv_personal_collection;
