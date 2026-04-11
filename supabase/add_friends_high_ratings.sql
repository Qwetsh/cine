-- RPC: get friends' high-rated movies (rating >= 4 stars)
-- Returns tmdb_id + friend display_name for each highly-rated movie
CREATE OR REPLACE FUNCTION public.get_friends_high_ratings()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  result jsonb := '[]'::jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO result
  FROM (
    SELECT
      m.tmdb_id,
      p.display_name AS friend_name,
      pc.rating
    FROM public.friendships f
    JOIN public.profiles p ON p.id = CASE
      WHEN f.requester_id = current_user_id THEN f.addressee_id
      ELSE f.requester_id
    END
    JOIN public.personal_collection pc ON pc.user_id = p.id
    JOIN public.movies m ON m.id = pc.movie_id
    WHERE f.status = 'accepted'
      AND current_user_id IN (f.requester_id, f.addressee_id)
      AND pc.rating >= 4
  ) t;

  RETURN result;
END;
$$;
