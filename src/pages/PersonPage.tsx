import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MovieGrid } from '../components/movie/MovieGrid'
import type { TmdbMovie } from '../lib/tmdb'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p'
const apiKey = import.meta.env.VITE_TMDB_API_KEY

interface PersonDetail {
  id: number
  name: string
  profile_path: string | null
  known_for_department: string
  biography: string
}

interface CreditsResult {
  cast: TmdbMovie[]
  crew: (TmdbMovie & { job: string })[]
}

export function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = useState<PersonDetail | null>(null)
  const [movies, setMovies] = useState<TmdbMovie[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    const personUrl = `${TMDB_BASE}/person/${id}?api_key=${apiKey}&language=fr-FR`
    const creditsUrl = `${TMDB_BASE}/person/${id}/movie_credits?api_key=${apiKey}&language=fr-FR`

    Promise.all([
      fetch(personUrl).then(r => r.json()) as Promise<PersonDetail>,
      fetch(creditsUrl).then(r => r.json()) as Promise<CreditsResult>,
    ])
      .then(([personData, creditsData]) => {
        setPerson(personData)

        // For directors, show directed films; for actors, show cast films
        const isDirector = personData.known_for_department === 'Directing'
        let filmList: TmdbMovie[]

        if (isDirector) {
          filmList = creditsData.crew
            .filter(m => m.job === 'Director')
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        } else {
          filmList = creditsData.cast
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        }

        // Deduplicate by id
        const seen = new Set<number>()
        filmList = filmList.filter(m => {
          if (seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })

        setMovies(filmList)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-4 p-4">
          <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-[var(--color-surface-2)] rounded animate-pulse w-1/2" />
            <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/3" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 p-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] bg-[var(--color-surface-2)] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  if (!person) {
    return (
      <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
        <p>Personne introuvable</p>
        <button onClick={goBack} className="mt-4 text-[var(--color-accent)]">← Retour</button>
      </div>
    )
  }

  const isDirector = person.known_for_department === 'Directing'
  const role = isDirector ? 'Réalisateur' : 'Acteur'

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {/* Header */}
      <div className="flex items-center gap-4 p-4">
        <button
          onClick={goBack}
          className="bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-full w-9 h-9 flex items-center justify-center border border-[var(--color-border)] flex-shrink-0"
        >
          ←
        </button>

        {person.profile_path ? (
          <img
            src={`${TMDB_IMG}/w185${person.profile_path}`}
            alt={person.name}
            className="w-14 h-14 rounded-full object-cover border-2 border-[var(--color-border)]"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-2xl border-2 border-[var(--color-border)]">
            🎬
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg text-[var(--color-text)] leading-tight truncate">{person.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)]">
            {role} · {movies.length} film{movies.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filmography */}
      <MovieGrid
        movies={movies}
        onMovieClick={(movie) => navigate(`/movie/${movie.id}`)}
      />
    </div>
  )
}
