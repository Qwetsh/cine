# 🎬 Ciné

Une PWA de gestion de films pour couples — liste de films à regarder ensemble, collection avec notes personnelles, et recherche via TMDB.

## Stack

- **React 19** + **TypeScript** (Vite 8)
- **Tailwind CSS v4**
- **Supabase** — auth + base de données (PostgreSQL + RLS)
- **TMDB API** — données films, affiches, détails
- **vite-plugin-pwa** — manifest, service worker, cache offline

## Installation

### 1. Cloner et installer

```bash
git clone <repo>
cd Ciné
npm install --legacy-peer-deps
```

### 2. Variables d'environnement

```bash
cp .env.example .env
```

Renseignez vos clés dans `.env` :

| Variable | Où la trouver |
|---|---|
| `VITE_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `VITE_TMDB_API_KEY` | themoviedb.org → Settings → API |

### 3. Base de données Supabase

Dans le **SQL Editor** de votre projet Supabase, exécutez :

```
supabase/schema.sql
```

Ce script crée les tables `profiles`, `couples`, `movies`, `watchlist`, `collection` avec RLS activé.

### 4. Lancer en développement

```bash
npm run dev
```

## Structure du projet

```
src/
├── components/
│   ├── layout/       # AppLayout, Header, BottomNav
│   ├── movie/        # MovieCard, MovieGrid, StarRating
│   └── ui/           # Composants réutilisables génériques
├── hooks/
│   ├── useAuth.ts       # Session Supabase + profil
│   ├── useWatchlist.ts  # CRUD watchlist partagée
│   ├── useCollection.ts # CRUD collection + notes
│   └── useTmdbSearch.ts # Recherche films avec debounce
├── lib/
│   ├── supabase.ts   # Client Supabase typé
│   └── tmdb.ts       # Client TMDB (search, détails, images)
├── pages/
│   ├── HomePage.tsx        # Accueil + tendances TMDB
│   ├── SearchPage.tsx      # Recherche avec debounce
│   ├── WatchlistPage.tsx   # Liste à regarder ensemble
│   ├── CollectionPage.tsx  # Films vus + notes/étoiles
│   ├── MovieDetailPage.tsx # Fiche film avec backdrop/affiche
│   └── ProfilePage.tsx     # Auth + paramètres couple
└── types/
    ├── database.ts   # Types générés depuis le schéma Supabase
    └── index.ts      # Types UI et utilitaires
```

## Schéma base de données

```
profiles ──┐
           ├── couples (user1_id, user2_id)
           │       │
           │       ├── watchlist (movie_id, couple_id, added_by)
           │       └── collection (movie_id, couple_id, rating/note par user)
           │
movies ────┘ (cache TMDB : tmdb_id unique)
```

## Images TMDB

Les affiches sont servies depuis `image.tmdb.org` et mises en cache par le service worker (CacheFirst, 30 jours). Tailles disponibles dans `src/lib/tmdb.ts` : `small (w185)`, `medium (w342)`, `large (w500)`.

## Build & déploiement

```bash
npm run build    # Compile + génère le SW
npm run preview  # Aperçu du build
```

Le dossier `dist/` est prêt pour Vercel, Netlify, ou Cloudflare Pages.

## Prochaines étapes

- [ ] Connecter l'auth Supabase dans `ProfilePage`
- [ ] Implémenter l'invitation partenaire (lien par email)
- [ ] Relier les boutons "+ À regarder" / "On l'a vu !" sur `MovieDetailPage`
- [ ] Activer le Realtime Supabase pour la synchronisation instantanée
- [ ] Générer les icônes PWA (192×192, 512×512) dans `public/icons/`
