import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFriendsContext } from '../contexts/FriendsContext'
import { tmdb, getPosterUrl } from '../lib/tmdb'
import { supabase } from '../lib/supabase'
import type { Profile } from '../types'

interface RecoDisplay {
  id: string
  title: string
  posterPath: string | null
  mediaType: 'movie' | 'tv'
  tmdbId: number
  fromName: string
  message: string | null
  createdAt: string
  seenAt: string | null
}

export function FriendRecommendationsPage() {
  const navigate = useNavigate()
  const { recos } = useFriendsContext()
  const [items, setItems] = useState<RecoDisplay[]>([])
  const [loading, setLoading] = useState(true)

  // Mark all as seen on mount
  useEffect(() => {
    recos.markAllSeen()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve reco details (titles, posters, sender names)
  useEffect(() => {
    if (recos.loading) return

    async function resolve() {
      setLoading(true)

      // Collect unique sender IDs
      const senderIds = [...new Set(recos.received.map(r => r.from_user_id))]
      const profileMap = new Map<string, Profile>()

      if (senderIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .in('id', senderIds)
        for (const p of (data ?? []) as unknown as Profile[]) {
          profileMap.set(p.id, p)
        }
      }

      // Resolve movie/tv titles
      const results: RecoDisplay[] = []

      for (const r of recos.received) {
        const fromProfile = profileMap.get(r.from_user_id)
        const fromName = fromProfile?.display_name ?? 'Un ami'

        if (r.movie_id) {
          try {
            const movie = await tmdb.getMovie(r.movie_id)
            results.push({
              id: r.id,
              title: movie.title,
              posterPath: movie.poster_path,
              mediaType: 'movie',
              tmdbId: r.movie_id,
              fromName,
              message: r.message,
              createdAt: r.created_at,
              seenAt: r.seen_at,
            })
          } catch {
            // Film introuvable sur TMDB
          }
        } else if (r.tv_show_id) {
          try {
            const show = await tmdb.getTvShow(r.tv_show_id)
            results.push({
              id: r.id,
              title: show.name,
              posterPath: show.poster_path,
              mediaType: 'tv',
              tmdbId: r.tv_show_id,
              fromName,
              message: r.message,
              createdAt: r.created_at,
              seenAt: r.seen_at,
            })
          } catch {
            // Série introuvable sur TMDB
          }
        }
      }

      setItems(results)
      setLoading(false)
    }

    resolve()
  }, [recos.received, recos.loading])

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10">
      <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Recos de mes amis</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-[var(--color-surface)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💌</div>
          <p className="text-[var(--color-text-muted)] text-sm">
            Aucune recommandation pour le moment
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <button
              key={item.id}
              onClick={() => navigate(item.mediaType === 'movie' ? `/movie/${item.tmdbId}` : `/tv/${item.tmdbId}`)}
              className="w-full flex items-center gap-3 bg-[var(--color-surface)] rounded-xl p-3 border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors text-left"
            >
              {/* Poster */}
              {item.posterPath ? (
                <img
                  src={getPosterUrl(item.posterPath, 'sm')}
                  alt={item.title}
                  className="w-12 h-18 rounded-lg object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-12 h-18 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-lg flex-shrink-0">
                  🎬
                </div>
              )}

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[var(--color-text)] text-sm truncate">{item.title}</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  par {item.fromName} · {formatDate(item.createdAt)}
                </p>
                {item.message && (
                  <p className="text-xs text-[var(--color-accent)] mt-1 truncate">
                    « {item.message} »
                  </p>
                )}
              </div>

              {/* Media type badge */}
              <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                {item.mediaType === 'movie' ? '🎬' : '📺'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
