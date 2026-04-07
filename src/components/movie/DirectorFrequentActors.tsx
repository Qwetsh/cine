import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie } from '../../lib/tmdb'

interface Props {
  movies: TmdbMovie[]
}

interface CastMember {
  id: number
  name: string
  profile_path: string | null
}

interface ActorStats {
  actor: CastMember
  movies: TmdbMovie[]
}

interface MovieCredits {
  cast: CastMember[]
}

export function DirectorFrequentActors({ movies }: Props) {
  const [open, setOpen] = useState(false)
  const [actors, setActors] = useState<ActorStats[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedActorId, setExpandedActorId] = useState<number | null>(null)
  const navigate = useNavigate()

  async function loadFrequentActors() {
    setOpen(true)
    if (actors.length > 0) return
    setLoading(true)

    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      // Fetch credits pour les 20 films les plus populaires max
      const topMovies = movies.slice(0, 20)
      const results = await Promise.all(
        topMovies.map(async (movie) => {
          try {
            const res = await fetch(
              `https://api.themoviedb.org/3/movie/${movie.id}/credits?api_key=${apiKey}&language=fr-FR`
            )
            const data: MovieCredits = await res.json()
            return { movie, cast: data.cast?.slice(0, 15) ?? [] }
          } catch {
            return { movie, cast: [] as CastMember[] }
          }
        })
      )

      // Compter les apparitions de chaque acteur
      const actorMap = new Map<number, { actor: CastMember; movies: TmdbMovie[] }>()
      for (const { movie, cast } of results) {
        for (const member of cast) {
          if (!actorMap.has(member.id)) {
            actorMap.set(member.id, { actor: member, movies: [] })
          }
          actorMap.get(member.id)!.movies.push(movie)
        }
      }

      // Top 5 des acteurs avec au moins 2 films
      const sorted = [...actorMap.values()]
        .filter(a => a.movies.length >= 2)
        .sort((a, b) => b.movies.length - a.movies.length)
        .slice(0, 5)

      setActors(sorted)
    } catch {
      setActors([])
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button
        onClick={loadFrequentActors}
        className="w-full flex items-center justify-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 text-sm font-medium border border-[var(--color-border)] hover:border-[var(--color-accent)] transition-colors"
      >
        <span>🎭</span> Ses acteurs fétiches
      </button>
    )
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Acteurs les plus fréquents</h3>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ✕
        </button>
      </div>

      {loading && (
        <div className="space-y-2 py-1">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] animate-pulse flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3.5 bg-[var(--color-surface-2)] rounded animate-pulse w-1/3" />
                <div className="h-3 bg-[var(--color-surface-2)] rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && actors.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2">Pas assez de données</p>
      )}

      {!loading && actors.length > 0 && (
        <div className="space-y-1">
          {actors.map(({ actor, movies: actorMovies }) => (
            <div key={actor.id}>
              <button
                onClick={() => setExpandedActorId(expandedActorId === actor.id ? null : actor.id)}
                className="w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-left"
              >
                {actor.profile_path ? (
                  <img
                    src={getPosterUrl(actor.profile_path, 'small').replace('/w185', '/w92')}
                    alt={actor.name}
                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-sm flex-shrink-0">🎭</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--color-text)] truncate">{actor.name}</p>
                  <p className="text-[11px] text-[var(--color-text-muted)]">
                    {actorMovies.length} film{actorMovies.length > 1 ? 's' : ''} ensemble
                  </p>
                </div>
                <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                  {expandedActorId === actor.id ? '▲' : '▼'}
                </span>
              </button>

              {expandedActorId === actor.id && (
                <div className="flex gap-2 overflow-x-auto pb-1 pl-14 pr-2 scrollbar-hide mt-1">
                  {actorMovies
                    .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))
                    .map(movie => {
                      const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
                      return (
                        <button
                          key={movie.id}
                          onClick={() => navigate(`/movie/${movie.id}`)}
                          className="flex-shrink-0 w-16 text-left group"
                        >
                          <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors">
                            <img
                              src={getPosterUrl(movie.poster_path, 'small')}
                              alt={movie.title}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <p className="text-[9px] text-[var(--color-text-muted)] mt-1 line-clamp-2 leading-tight">{movie.title}</p>
                          {year && <p className="text-[8px] text-[var(--color-text-muted)]">{year}</p>}
                        </button>
                      )
                    })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
