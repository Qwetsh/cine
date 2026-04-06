import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbTvShow } from '../../lib/tmdb'

interface TvCardProps {
  show: TmdbTvShow
  onClick?: () => void
}

export function TvCard({ show, onClick }: TvCardProps) {
  const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null
  const rating = show.vote_average ? show.vote_average.toFixed(1) : null

  return (
    <button
      onClick={onClick}
      className="group flex flex-col text-left rounded-lg overflow-hidden bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] transition-colors"
    >
      <div className="relative aspect-[2/3] bg-[var(--color-surface-2)] overflow-hidden">
        <img
          src={getPosterUrl(show.poster_path, 'medium')}
          alt={`Affiche de ${show.name}`}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        {rating && (
          <div className="absolute top-2 left-2 bg-black/70 backdrop-blur-sm text-[var(--color-gold)] text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
            ★ {rating}
          </div>
        )}
        {/* Badge série */}
        <div className="absolute top-2 right-2 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
          Série
        </div>
      </div>

      <div className="p-2">
        <p className="font-medium text-[var(--color-text)] text-sm leading-tight line-clamp-2">
          {show.name}
        </p>
        {year && (
          <p className="text-[var(--color-text-muted)] text-xs mt-1">{year}</p>
        )}
      </div>
    </button>
  )
}
