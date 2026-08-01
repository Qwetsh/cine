# Ciné

PWA React 19 + Vite + TypeScript + Tailwind 4 + Supabase. App de suivi de films/séries à deux (couple + amis) : watchlist, collection, notes, recommandations, soirée ciné (swipe), quiz, tournois, notifications push.

## ⚠️ Base Supabase PARTAGÉE entre plusieurs apps

Le projet Supabase `tppecozmygtjmbcdqgfc` est partagé avec d'autres apps (Pierrehammer `ph_*`, `quete_*`, `res_*`, `gw_*`, `quiz_jpo_*`…). Les tables `profiles`, `push_subscriptions` et l'auth sont communes à Ciné et Pierrehammer.

Règles impératives :
- **Jamais de `DROP ... CASCADE`** sans vérifier les dépendances inter-apps (le 27/04/2026, une migration Pierrehammer a détruit la table `friendships` de Ciné en la croyant orpheline — restaurée le 01/08/2026 via `supabase/restore_friendships.sql`).
- Une table qui semble « orpheline » appartient peut-être à une autre app : vérifier dans les autres repos avant de supprimer.
- Vérifier l'état réel de la base (`list_tables`, SQL) plutôt que de se fier aux fichiers du repo.
- Préfixer les nouvelles tables en cas d'ambiguïté possible.

## Migrations

Pas de dossier `supabase/migrations/` : les fichiers SQL sont à la racine de `supabase/` et appliqués à la main (SQL editor ou MCP). L'état de la base peut donc diverger du repo.

## Conventions

- UI et commits en français.
- Notation : optimistic updates uniquement, jamais de refetch après notation.
- Realtime : les tables écoutées doivent être dans la publication `supabase_realtime` (attention : avec `REPLICA IDENTITY DEFAULT`, les événements DELETE ne contiennent que la clé primaire).
