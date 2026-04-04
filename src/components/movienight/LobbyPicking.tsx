import { useRef, useState } from 'react'
import { tmdb, getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie } from '../../lib/tmdb'
import type { LobbyFilm } from '../../hooks/useLobby'

interface Props {
  myFilm: LobbyFilm | null
  partnerFilm: LobbyFilm | null
  partnerName: string
  onSubmit: (film: LobbyFilm) => void
  onCancel: () => void
}

export function LobbyPicking({ myFilm, partnerFilm, partnerName, onSubmit, onCancel }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TmdbMovie[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function handleSearch(value: string) {
    setQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await tmdb.searchMovies(value.trim())
        setResults(data.results.slice(0, 8))
      } catch { /* ignore */ }
      setSearching(false)
    }, 400)
  }

  function selectMovie(movie: TmdbMovie) {
    const genres: string[] = [] // genre_ids are numbers, we store them as-is for display later
    onSubmit({
      tmdb_id: movie.id,
      title: movie.title,
      poster_path: movie.poster_path,
      release_date: movie.release_date,
      genres,
    })
    setQuery('')
    setResults([])
  }

  return (
    <div className="px-4 space-y-4">
      {/* Status */}
      <div className="grid grid-cols-2 gap-3">
        {/* My pick */}
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 text-center">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Ton choix</p>
          {myFilm ? (
            <div>
              <div className="w-16 h-24 mx-auto rounded-lg overflow-hidden shadow-md mb-2">
                <img src={getPosterUrl(myFilm.poster_path, 'small')} alt={myFilm.title} className="w-full h-full object-cover" />
              </div>
              <p className="text-xs font-medium text-[var(--color-text)] truncate">{myFilm.title}</p>
              <p className="text-[10px] text-green-400 mt-1">Prêt !</p>
            </div>
          ) : (
            <div className="w-16 h-24 mx-auto rounded-lg bg-[var(--color-surface-2)] border-2 border-dashed border-[var(--color-border)] flex items-center justify-center">
              <span className="text-2xl text-[var(--color-text-muted)]">?</span>
            </div>
          )}
        </div>

        {/* Partner pick */}
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 text-center">
          <p className="text-xs text-[var(--color-text-muted)] mb-2">{partnerName}</p>
          {partnerFilm ? (
            <div>
              <div className="w-16 h-24 mx-auto rounded-lg overflow-hidden bg-[var(--color-accent)]/20 flex items-center justify-center mb-2">
                <span className="text-2xl">🤫</span>
              </div>
              <p className="text-xs font-medium text-[var(--color-text)]">Film choisi</p>
              <p className="text-[10px] text-green-400 mt-1">Prêt !</p>
            </div>
          ) : (
            <div>
              <div className="w-16 h-24 mx-auto rounded-lg bg-[var(--color-surface-2)] border-2 border-dashed border-[var(--color-border)] flex items-center justify-center">
                <span className="text-2xl text-[var(--color-text-muted)]">?</span>
              </div>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-2">En attente…</p>
            </div>
          )}
        </div>
      </div>

      {/* Search (only if I haven't picked yet) */}
      {!myFilm && (
        <div>
          <p className="text-sm font-medium text-[var(--color-text)] mb-2">Choisis ton film :</p>
          <input
            type="search"
            value={query}
            onChange={e => handleSearch(e.target.value)}
            placeholder="Rechercher un film…"
            className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-2.5 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            autoFocus
          />
          {searching && (
            <p className="text-xs text-[var(--color-text-muted)] mt-2">Recherche…</p>
          )}
          {results.length > 0 && (
            <ul className="mt-2 space-y-1 max-h-64 overflow-y-auto">
              {results.map(movie => (
                <li key={movie.id}>
                  <button
                    onClick={() => selectMovie(movie)}
                    className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-left"
                  >
                    <div className="w-10 h-14 flex-shrink-0 rounded-md overflow-hidden bg-[var(--color-surface-2)]">
                      <img src={getPosterUrl(movie.poster_path, 'small')} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text)] truncate">{movie.title}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : ''}
                        {movie.vote_average > 0 && ` · ★ ${movie.vote_average.toFixed(1)}`}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Waiting message */}
      {myFilm && !partnerFilm && (
        <div className="text-center py-4">
          <div className="inline-block animate-pulse">
            <span className="text-3xl">⏳</span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)] mt-2">
            En attente du choix de {partnerName}…
          </p>
        </div>
      )}

      {/* Cancel */}
      <button
        onClick={onCancel}
        className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
      >
        Annuler la soirée
      </button>
    </div>
  )
}
