import { useCallback, useEffect, useRef, useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../../lib/tmdb'
import { TrailerButton } from '../movie/TrailerButton'
import './SwipeCard.css'

interface Props {
  movie: TmdbMovie
  genres: TmdbGenre[]
  open: boolean
  onClose: () => void
}

const TILT_MAX = 18

export function MovieDetailSheet({ movie, genres, open, onClose }: Props) {
  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const movieGenres = genres.filter(g => movie.genre_ids?.includes(g.id))
  const cardRef = useRef<HTMLDivElement>(null)
  const [interacting, setInteracting] = useState(false)
  const [cardVars, setCardVars] = useState({
    rx: 0, ry: 0, mx: 50, my: 50, posx: 50, posy: 50,
  })

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [open])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const px = (cx / rect.width) * 100
    const py = (cy / rect.height) * 100
    const mx = Math.max(0, Math.min(100, px))
    const my = Math.max(0, Math.min(100, py))

    // Rotation: center=0, edges=±TILT_MAX
    const rx = ((mx - 50) / 50) * TILT_MAX
    const ry = -((my - 50) / 50) * TILT_MAX

    setCardVars({
      rx, ry, mx, my,
      posx: 50 + (mx - 50) / 4,
      posy: 50 + (my - 50) / 4,
    })
  }, [])

  const handlePointerEnter = useCallback(() => setInteracting(true), [])
  const handlePointerLeave = useCallback(() => {
    setInteracting(false)
    setCardVars({ rx: 0, ry: 0, mx: 50, my: 50, posx: 50, posy: 50 })
  }, [])

  if (!open) return null

  const innerStyle: React.CSSProperties = {
    '--rx': `${cardVars.rx}deg`,
    '--ry': `${cardVars.ry}deg`,
    '--mx': `${cardVars.mx}%`,
    '--my': `${cardVars.my}%`,
    '--posx': `${cardVars.posx}%`,
    '--posy': `${cardVars.posy}%`,
  } as React.CSSProperties

  return (
    <div className="detail-overlay" onClick={onClose}>
      <div className="detail-overlay__backdrop" />

      <button
        className="detail-overlay__close"
        onClick={onClose}
        aria-label="Fermer"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>

      <div className="detail-overlay__content" onClick={e => e.stopPropagation()}>
        {/* Card with interactive holo */}
        <div
          ref={cardRef}
          className={`detail-card ${interacting ? 'interacting' : ''}`}
          onPointerMove={handlePointerMove}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <div className="detail-card__inner" style={innerStyle}>
            <img
              src={getPosterUrl(movie.poster_path, 'large')}
              alt={movie.title}
              className="detail-card__poster"
              draggable={false}
            />
            <div className="swipe-card__shine" />
            <div className="swipe-card__glare" />
          </div>
        </div>

        {/* Info panel */}
        <div className="detail-info">
          <h2 className="font-bold text-xl text-white leading-tight">
            {movie.title}
          </h2>

          <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-300">
            {year && <span>{year}</span>}
            {movie.vote_average > 0 && (
              <span className="text-[var(--color-gold)]">
                ★ {movie.vote_average.toFixed(1)}
              </span>
            )}
            <TrailerButton tmdbId={movie.id} mediaType="movie" />
          </div>

          {movieGenres.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3">
              {movieGenres.map(g => (
                <span
                  key={g.id}
                  className="text-[11px] px-2.5 py-1 rounded-full bg-white/10 text-gray-300 border border-white/10"
                >
                  {g.name}
                </span>
              ))}
            </div>
          )}

          {movie.overview && (
            <p className="text-gray-400 text-sm leading-relaxed mt-4">
              {movie.overview}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
