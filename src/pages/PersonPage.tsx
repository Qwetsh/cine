import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { MovieGrid } from '../components/movie/MovieGrid'
import { tmdb, getPosterUrl } from '../lib/tmdb'
import { CrossFilmography } from '../components/movie/CrossFilmography'
import type { TmdbMovie, TmdbPersonDetail, TmdbExternalIds } from '../lib/tmdb'

const TMDB_IMG = 'https://image.tmdb.org/t/p'

interface CreditsResult {
  cast: (TmdbMovie & { character?: string })[]
  crew: (TmdbMovie & { job: string })[]
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function getAge(birthday: string, deathday: string | null): number {
  const birth = new Date(birthday)
  const end = deathday ? new Date(deathday) : new Date()
  let age = end.getFullYear() - birth.getFullYear()
  const m = end.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && end.getDate() < birth.getDate())) age--
  return age
}

function getCareerSpan(movies: TmdbMovie[]): { first: number; last: number } | null {
  const years = movies
    .map(m => m.release_date ? new Date(m.release_date).getFullYear() : 0)
    .filter(y => y > 1900)
  if (years.length === 0) return null
  return { first: Math.min(...years), last: Math.max(...years) }
}

export function PersonPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [person, setPerson] = useState<TmdbPersonDetail | null>(null)
  const [biography, setBiography] = useState('')
  const [movies, setMovies] = useState<TmdbMovie[]>([])
  const [topMovies, setTopMovies] = useState<TmdbMovie[]>([])
  const [externalIds, setExternalIds] = useState<TmdbExternalIds | null>(null)
  const [loading, setLoading] = useState(true)
  const [bioExpanded, setBioExpanded] = useState(false)

  useEffect(() => {
    if (!id) return
    const numId = Number(id)
    setLoading(true)
    setBioExpanded(false)

    Promise.all([
      tmdb.getPerson(numId),
      tmdb.getPersonEn(numId),
      tmdb.getPersonExternalIds(numId).catch(() => null),
      fetch(`https://api.themoviedb.org/3/person/${numId}/movie_credits?api_key=${import.meta.env.VITE_TMDB_API_KEY}&language=fr-FR`)
        .then(r => r.json()) as Promise<CreditsResult>,
    ])
      .then(([personFr, personEn, extIds, creditsData]) => {
        setPerson(personFr)
        setExternalIds(extIds)

        // Use French bio, fallback to English if too short
        const bioFr = personFr.biography || ''
        const bioEn = personEn.biography || ''
        if (bioFr.length >= 100) {
          setBiography(bioFr)
        } else if (bioEn.length > bioFr.length) {
          setBiography(bioEn)
        } else {
          setBiography(bioFr)
        }

        const isDirector = personFr.known_for_department === 'Directing'
        let filmList: TmdbMovie[]

        if (isDirector) {
          filmList = creditsData.crew
            .filter(m => m.job === 'Director')
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        } else {
          filmList = creditsData.cast
            .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
        }

        // Deduplicate
        const seen = new Set<number>()
        filmList = filmList.filter(m => {
          if (seen.has(m.id)) return false
          seen.add(m.id)
          return true
        })

        setMovies(filmList)
        setTopMovies(filmList.slice(0, 5))
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="p-4 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-24 h-24 rounded-2xl bg-[var(--color-surface-2)] animate-pulse" />
            <div className="flex-1 space-y-2">
              <div className="h-6 bg-[var(--color-surface-2)] rounded animate-pulse w-2/3" />
              <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/2" />
              <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/3" />
            </div>
          </div>
          <div className="h-20 bg-[var(--color-surface-2)] rounded-xl animate-pulse" />
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
  const role = isDirector ? 'Realisateur' : 'Acteur'
  const career = getCareerSpan(movies)
  const avgRating = movies.length > 0
    ? (movies.reduce((sum, m) => sum + (m.vote_average || 0), 0) / movies.length).toFixed(1)
    : null

  const movieIds = useMemo(() => new Set(movies.map(m => m.id)), [movies])

  const BIO_PREVIEW = 300
  const isLongBio = biography.length > BIO_PREVIEW

  const links: { label: string; url: string; icon: string }[] = []
  if (externalIds?.imdb_id) links.push({ label: 'IMDb', url: `https://www.imdb.com/name/${externalIds.imdb_id}`, icon: '🎬' })
  if (externalIds?.instagram_id) links.push({ label: 'Instagram', url: `https://instagram.com/${externalIds.instagram_id}`, icon: '📸' })
  if (externalIds?.twitter_id) links.push({ label: 'X', url: `https://x.com/${externalIds.twitter_id}`, icon: '𝕏' })
  if (externalIds?.tiktok_id) links.push({ label: 'TikTok', url: `https://tiktok.com/@${externalIds.tiktok_id}`, icon: '🎵' })
  if (externalIds?.youtube_id) links.push({ label: 'YouTube', url: `https://youtube.com/channel/${externalIds.youtube_id}`, icon: '▶️' })
  if (person.homepage) links.push({ label: 'Site web', url: person.homepage, icon: '����' })

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {/* Back button */}
      <div className="p-4 pb-0">
        <button
          onClick={goBack}
          className="bg-[var(--color-surface)] text-[var(--color-text-muted)] rounded-full w-9 h-9 flex items-center justify-center border border-[var(--color-border)]"
        >
          ←
        </button>
      </div>

      {/* Profile header */}
      <div className="flex items-start gap-4 px-4 pt-3 pb-2">
        {person.profile_path ? (
          <img
            src={`${TMDB_IMG}/w342${person.profile_path}`}
            alt={person.name}
            className="w-24 h-32 rounded-2xl object-cover border-2 border-[var(--color-border)] flex-shrink-0"
          />
        ) : (
          <div className="w-24 h-32 rounded-2xl bg-[var(--color-surface-2)] flex items-center justify-center text-4xl border-2 border-[var(--color-border)] flex-shrink-0">
            {isDirector ? '��' : '🎭'}
          </div>
        )}

        <div className="flex-1 min-w-0 pt-1">
          <h1 className="font-bold text-xl text-[var(--color-text)] leading-tight">{person.name}</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">{role}</p>

          {/* Quick stats */}
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-[var(--color-text-muted)]">
            {person.birthday && (
              <span>
                {person.deathday
                  ? `${getAge(person.birthday, person.deathday)} ans`
                  : `${getAge(person.birthday, null)} ans`}
              </span>
            )}
            {person.place_of_birth && (
              <span className="truncate max-w-[180px]">{person.place_of_birth}</span>
            )}
          </div>

          {person.birthday && (
            <p className="text-[11px] text-[var(--color-text-muted)] mt-1">
              {formatDate(person.birthday)}
              {person.deathday && ` — ${formatDate(person.deathday)}`}
            </p>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex gap-2 px-4 mt-2 mb-3">
        <div className="flex-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-2.5 text-center">
          <p className="text-lg font-bold text-[var(--color-text)]">{movies.length}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">Films</p>
        </div>
        {career && (
          <div className="flex-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-2.5 text-center">
            <p className="text-lg font-bold text-[var(--color-text)]">{career.last - career.first}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Ans de carriere</p>
          </div>
        )}
        {avgRating && (
          <div className="flex-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-2.5 text-center">
            <p className="text-lg font-bold text-[var(--color-gold)]">{avgRating}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Note moy.</p>
          </div>
        )}
        {career && (
          <div className="flex-1 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-2.5 text-center">
            <p className="text-lg font-bold text-[var(--color-text)]">{career.first}</p>
            <p className="text-[10px] text-[var(--color-text-muted)]">Debut</p>
          </div>
        )}
      </div>

      {/* Biography */}
      {biography && (
        <div className="px-4 mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-1.5">Biographie</h2>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed whitespace-pre-line">
              {bioExpanded || !isLongBio
                ? biography
                : biography.slice(0, BIO_PREVIEW) + '…'}
            </p>
            {isLongBio && (
              <button
                onClick={() => setBioExpanded(v => !v)}
                className="text-xs text-[var(--color-accent)] mt-2 font-medium"
              >
                {bioExpanded ? 'Voir moins' : 'Lire la suite'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* External links */}
      {links.length > 0 && (
        <div className="px-4 mb-3">
          <div className="flex flex-wrap gap-2">
            {links.map(link => (
              <a
                key={link.label}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 bg-[var(--color-surface)] rounded-full border border-[var(--color-border)] px-3 py-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:border-[var(--color-accent)] transition-colors"
              >
                <span>{link.icon}</span>
                <span>{link.label}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Cross filmography */}
      {!isDirector && movies.length > 0 && (
        <div className="px-4 mb-3">
          <CrossFilmography personId={Number(id)} personMovieIds={movieIds} />
        </div>
      )}

      {/* Top films */}
      {topMovies.length > 0 && (
        <div className="px-4 mb-2">
          <h2 className="text-sm font-semibold text-[var(--color-text)] mb-2">Films notables</h2>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {topMovies.map(movie => (
              <button
                key={movie.id}
                onClick={() => navigate(`/movie/${movie.id}`)}
                className="flex-shrink-0 w-20 text-center group"
              >
                <img
                  src={getPosterUrl(movie.poster_path, 'small')}
                  alt={movie.title}
                  className="w-20 h-[120px] rounded-lg object-cover border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors"
                />
                <p className="text-[10px] text-[var(--color-text-muted)] mt-1 line-clamp-2 leading-tight">{movie.title}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Full filmography */}
      <div className="px-4 pt-1 pb-1">
        <p className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider font-medium">
          Filmographie ({movies.length})
        </p>
      </div>

      <MovieGrid
        movies={movies}
        onMovieClick={(movie) => navigate(`/movie/${movie.id}`)}
      />
    </div>
  )
}
