-- ============================================================
-- Fix : trigger auto-création de profil à l'inscription
-- À exécuter dans : Supabase Dashboard > SQL Editor
-- ============================================================

-- Fonction appelée automatiquement à chaque nouvel utilisateur auth
-- SECURITY DEFINER : s'exécute avec les droits du propriétaire (postgres),
-- bypasse les RLS → plus de 401 à l'inscription.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(new.email, '@', 1)   -- fallback : partie locale de l'email
    )
  );
  return new;
end;
$$;

-- Trigger sur auth.users (table gérée par Supabase)
drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
