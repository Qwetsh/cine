import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdb, getPosterUrl, type TmdbMovie, type TmdbPerson } from '../../lib/tmdb'

interface Props {
  personId: number
  personMovieIds: Set<number>
}

interface CreditsResult {
  cast: TmdbMovie[]
}

export function CrossFilmography({ personId, personMovieIds }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [suggestions, setSuggestions] = useState<TmdbPerson[]>([])
  const [selectedPerson, setSelectedPerson] = useState<TmdbPerson | null>(null)
  const [sharedMovies, setSharedMovies] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const navigate = useNavigate()

  // Focus input when opening
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  // Search actors with debounce
  const searchActors = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await tmdb.searchPerson(q)
        setSuggestions(
          res.results
            .filter(p => p.id !== personId && p.known_for_department === 'Acting')
            .slice(0, 6)
        )
      } catch {
        setSuggestions([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [personId])

  async function selectPerson(person: TmdbPerson) {
    setSelectedPerson(person)
    setSuggestions([])
    setQuery('')
    setLoading(true)

    try {
      const apiKey = import.meta.env.VITE_TMDB_API_KEY
      const res = await fetch(
        `https://api.themoviedb.org/3/person/${person.id}/movie_credits?api_key=${apiKey}&language=fr-FR`
      )
      const data: CreditsResult = await res.json()

      const otherMovieIds = new Set(data.cast.map(m => m.id))
      const shared = data.cast
        .filter(m => personMovieIds.has(m.id))
        .sort((a, b) => (b.vote_average ?? 0) - (a.vote_average ?? 0))

      // Deduplicate
      const seen = new Set<number>()
      const deduped = shared.filter(m => {
        if (seen.has(m.id)) return false
        seen.add(m.id)
        return true
      })

      setSharedMovies(deduped)
    } catch {
      setSharedMovies([])
    } finally {
      setLoading(false)
    }
  }

  function reset() {
    setSelectedPerson(null)
    setSharedMovies([])
    setQuery('')
    setSuggestions([])
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
      >
        🎭 Jouant avec...
      </button>
    )
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Filmographie croisée</h3>
        <button
          onClick={() => { setOpen(false); reset() }}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
        >
          ✕
        </button>
      </div>

      {/* Search or selected */}
      {selectedPerson ? (
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 flex-1 bg-[var(--color-surface-2)] rounded-lg px-3 py-2">
            {selectedPerson.profile_path ? (
              <img
                src={getPosterUrl(selectedPerson.profile_path, 'small').replace('/w185', '/w92')}
                alt={selectedPerson.name}
                className="w-6 h-6 rounded-full object-cover"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-[10px]">🎭</div>
            )}
            <span className="text-sm text-[var(--color-text)]">{selectedPerson.name}</span>
          </div>
          <button
            onClick={reset}
            className="text-xs text-[var(--color-accent)] whitespace-nowrap"
          >
            Changer
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); searchActors(e.target.value) }}
            placeholder="Rechercher un acteur..."
            className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          />
          {suggestions.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-lg overflow-hidden z-10 shadow-lg">
              {suggestions.map(p => (
                <button
                  key={p.id}
                  onClick={() => selectPerson(p)}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[var(--color-surface-2)] transition-colors text-left"
                >
                  {p.profile_path ? (
                    <img
                      src={getPosterUrl(p.profile_path, 'small').replace('/w185', '/w92')}
                      alt={p.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs">🎭</div>
                  )}
                  <span className="text-sm text-[var(--color-text)]">{p.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {loading && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2">Recherche des films en commun...</p>
      )}

      {selectedPerson && !loading && sharedMovies.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2">Aucun film en commun trouvé</p>
      )}

      {sharedMovies.length > 0 && (
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">
            {sharedMovies.length} film{sharedMovies.length > 1 ? 's' : ''} en commun
          </p>
          <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-hide">
            {sharedMovies.map(movie => {
              const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
              return (
                <button
                  key={movie.id}
                  onClick={() => navigate(`/movie/${movie.id}`)}
                  className="flex-shrink-0 w-20 text-left group"
                >
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors">
                    <img
                      src={getPosterUrl(movie.poster_path, 'small')}
                      alt={movie.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {movie.vote_average > 0 && (
                      <div className="absolute top-1 left-1 bg-black/70 text-[var(--color-gold)] text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                        ★ {movie.vote_average.toFixed(1)}
                      </div>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-1 line-clamp-2 leading-tight">{movie.title}</p>
                  {year && <p className="text-[9px] text-[var(--color-text-muted)]">{year}</p>}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
