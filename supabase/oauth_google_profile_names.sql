-- ============================================================
-- OAuth Google — 02/08/2026
-- (appliqué en base via la migration oauth_google_profile_names)
--
-- Le trigger handle_new_user ne lisait que raw_user_meta_data->>'display_name'
-- (posé par notre inscription e-mail). Un compte créé via Google fournit
-- given_name / full_name / name : sans ce fallback, le profil aurait pris
-- le préfixe de l'e-mail comme nom.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    new.id,
    new.email,
    COALESCE(
      new.raw_user_meta_data->>'display_name',
      new.raw_user_meta_data->>'given_name',
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(new.email, '@', 1)
    )
  );
  RETURN new;
END;
$$;
