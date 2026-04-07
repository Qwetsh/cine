import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { tmdb, getPosterUrl, type TmdbMovie, type TmdbCollectionDetail } from '../../lib/tmdb'

interface Props {
  collectionId: number
  currentMovieId: number
}

export function MovieCollection({ collectionId, currentMovieId }: Props) {
  const [collection, setCollection] = useState<TmdbCollectionDetail | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    tmdb.getCollection(collectionId)
      .then(setCollection)
      .catch(() => {})
  }, [collectionId])

  if (!collection || collection.parts.length < 2) return null

  const sorted = [...collection.parts].sort((a, b) => {
    if (!a.release_date) return 1
    if (!b.release_date) return -1
    return a.release_date.localeCompare(b.release_date)
  })

  return (
    <div className="mt-6">
      <h2 className="font-semibold text-[var(--color-text)] mb-3">{collection.name}</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
        {sorted.map(movie => (
          <SagaCard
            key={movie.id}
            movie={movie}
            isCurrent={movie.id === currentMovieId}
            onClick={() => {
              if (movie.id !== currentMovieId) navigate(`/movie/${movie.id}`)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function SagaCard({ movie, isCurrent, onClick }: { movie: TmdbMovie; isCurrent: boolean; onClick: () => void }) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null

  return (
    <button
      onClick={onClick}
      className={[
        'flex-shrink-0 w-24 text-left transition-all',
        isCurrent ? 'opacity-100' : 'opacity-70 hover:opacity-100',
      ].join(' ')}
    >
      <div className={[
        'relative aspect-[2/3] rounded-lg overflow-hidden',
        isCurrent ? 'ring-2 ring-[var(--color-accent)]' : '',
      ].join(' ')}>
        <img
          src={getPosterUrl(movie.poster_path, 'small')}
          alt={movie.title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
        {isCurrent && (
          <div className="absolute bottom-0 inset-x-0 bg-[var(--color-accent)] text-white text-[10px] font-medium text-center py-0.5">
            En cours
          </div>
        )}
      </div>
      <p className="text-xs text-[var(--color-text)] mt-1.5 leading-tight line-clamp-2">{movie.title}</p>
      {year && <p className="text-[10px] text-[var(--color-text-muted)]">{year}</p>}
    </button>
  )
}
