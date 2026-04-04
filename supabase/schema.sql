-- ============================================================
-- Ciné — Schéma Supabase
-- Appliquer via : Supabase Dashboard > SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE : profiles
-- Un profil par utilisateur auth.users
-- ============================================================
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,
  avatar_url   text,
  partner_id   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS : chaque utilisateur voit et modifie uniquement son propre profil
-- (et peut lire le profil de son partenaire)
alter table public.profiles enable row level security;

create policy "Lecture profil propre et partenaire" on public.profiles
  for select using (
    auth.uid() = id
    or auth.uid() = partner_id
    or id in (
      select partner_id from public.profiles where id = auth.uid()
    )
  );

create policy "Modification profil propre" on public.profiles
  for update using (auth.uid() = id);

create policy "Insertion profil à l'inscription" on public.profiles
  for insert with check (auth.uid() = id);

-- Trigger : met à jour updated_at automatiquement
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- TABLE : couples
-- Lien entre deux utilisateurs (symétrique)
-- ============================================================
create table public.couples (
  id         uuid primary key default uuid_generate_v4(),
  user1_id   uuid not null references public.profiles(id) on delete cascade,
  user2_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user1_id, user2_id),
  check (user1_id <> user2_id)
);

alter table public.couples enable row level security;

create policy "Lecture couple propre" on public.couples
  for select using (
    auth.uid() = user1_id or auth.uid() = user2_id
  );

create policy "Création couple" on public.couples
  for insert with check (
    auth.uid() = user1_id or auth.uid() = user2_id
  );

-- ============================================================
-- TABLE : movies
-- Cache local des données TMDB (évite les appels API répétés)
-- ============================================================
create table public.movies (
  id             uuid primary key default uuid_generate_v4(),
  tmdb_id        integer not null unique,
  title          text not null,
  original_title text not null,
  overview       text not null default '',
  poster_path    text,
  backdrop_path  text,
  release_date   date,
  vote_average   numeric(3, 1),
  genres         text[] not null default '{}',
  runtime        integer,
  created_at     timestamptz not null default now()
);

-- Films lisibles par tous les utilisateurs connectés
alter table public.movies enable row level security;

create policy "Lecture films pour tous" on public.movies
  for select using (auth.role() = 'authenticated');

create policy "Insertion films" on public.movies
  for insert with check (auth.role() = 'authenticated');

create policy "Mise à jour films" on public.movies
  for update using (auth.role() = 'authenticated');

-- Index pour les recherches fréquentes
create index movies_tmdb_id_idx on public.movies(tmdb_id);
create index movies_release_date_idx on public.movies(release_date desc);

-- ============================================================
-- TABLE : watchlist
-- Films que le couple veut regarder
-- ============================================================
create table public.watchlist (
  id         uuid primary key default uuid_generate_v4(),
  movie_id   uuid not null references public.movies(id) on delete cascade,
  added_by   uuid not null references public.profiles(id) on delete cascade,
  couple_id  uuid not null references public.couples(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now(),
  unique(movie_id, couple_id)
);

alter table public.watchlist enable row level security;

create policy "Lecture watchlist du couple" on public.watchlist
  for select using (
    couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Ajout à la watchlist" on public.watchlist
  for insert with check (
    auth.uid() = added_by
    and couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Suppression watchlist" on public.watchlist
  for delete using (
    couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Modification note watchlist" on public.watchlist
  for update using (auth.uid() = added_by);

-- Index
create index watchlist_couple_id_idx on public.watchlist(couple_id);
create index watchlist_created_at_idx on public.watchlist(created_at desc);

-- ============================================================
-- TABLE : collection
-- Films déjà regardés, avec notes individuelles
-- ============================================================
create table public.collection (
  id             uuid primary key default uuid_generate_v4(),
  movie_id       uuid not null references public.movies(id) on delete cascade,
  couple_id      uuid not null references public.couples(id) on delete cascade,
  watched_at     timestamptz not null default now(),
  -- Notes individuelles (1-5 étoiles)
  rating_user1   smallint check (rating_user1 between 1 and 5),
  rating_user2   smallint check (rating_user2 between 1 and 5),
  -- Avis textuels
  note_user1     text,
  note_user2     text,
  created_at     timestamptz not null default now(),
  unique(movie_id, couple_id)
);

alter table public.collection enable row level security;

create policy "Lecture collection du couple" on public.collection
  for select using (
    couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Ajout à la collection" on public.collection
  for insert with check (
    couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Modification collection" on public.collection
  for update using (
    couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

create policy "Suppression collection" on public.collection
  for delete using (
    couple_id in (
      select id from public.couples
      where user1_id = auth.uid() or user2_id = auth.uid()
    )
  );

-- Index
create index collection_couple_id_idx on public.collection(couple_id);
create index collection_watched_at_idx on public.collection(watched_at desc);

-- ============================================================
-- FONCTION : upsert_movie
-- Insère ou met à jour un film depuis les données TMDB
-- ============================================================
create or replace function public.upsert_movie(
  p_tmdb_id        integer,
  p_title          text,
  p_original_title text,
  p_overview       text,
  p_poster_path    text,
  p_backdrop_path  text,
  p_release_date   date,
  p_vote_average   numeric,
  p_genres         text[],
  p_runtime        integer
) returns uuid language plpgsql security definer as $$
declare
  v_movie_id uuid;
begin
  insert into public.movies
    (tmdb_id, title, original_title, overview, poster_path, backdrop_path, release_date, vote_average, genres, runtime)
  values
    (p_tmdb_id, p_title, p_original_title, p_overview, p_poster_path, p_backdrop_path, p_release_date, p_vote_average, p_genres, p_runtime)
  on conflict (tmdb_id) do update set
    title          = excluded.title,
    overview       = excluded.overview,
    poster_path    = excluded.poster_path,
    backdrop_path  = excluded.backdrop_path,
    vote_average   = excluded.vote_average,
    genres         = excluded.genres,
    runtime        = excluded.runtime
  returning id into v_movie_id;

  return v_movie_id;
end;
$$;
