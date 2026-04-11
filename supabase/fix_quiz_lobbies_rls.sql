-- Fix: allow any authenticated user to join an open lobby (set themselves as player2)
-- The current UPDATE policy blocks this because player2_id is NULL before the join.

-- Add a join-specific UPDATE policy
CREATE POLICY quiz_lobbies_join ON quiz_lobbies
  FOR UPDATE
  USING (
    -- Pre-update: lobby is open (no player2 yet)
    auth.uid() IS NOT NULL
    AND player2_id IS NULL
  )
  WITH CHECK (
    -- Post-update: they can only set themselves as player2
    player2_id = auth.uid()
  );

-- Fix: allow player2 to delete the lobby (when they quit)
DROP POLICY IF EXISTS quiz_lobbies_delete ON quiz_lobbies;
CREATE POLICY quiz_lobbies_delete ON quiz_lobbies
  FOR DELETE USING (
    auth.uid() = created_by
    OR auth.uid() = player2_id
  );
