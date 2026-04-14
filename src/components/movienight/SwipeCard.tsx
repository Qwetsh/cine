import { useCallback, useEffect, useRef, useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../../lib/tmdb'
import type { FeedbackType } from '../../hooks/useSmartSuggestion'
import { TrailerButton } from '../movie/TrailerButton'
import './SwipeCard.css'

/* ============================================
   Types
   ============================================ */

interface SwipeZone {
  id: string
  label: string
  angle: number
  feedbackType: FeedbackType
  genreId?: number
  cssClass: string
}

interface Props {
  movie: TmdbMovie
  genres: TmdbGenre[]
  onFeedback: (type: FeedbackType, movie: TmdbMovie, genreId?: number) => void
  onAccept: (movie: TmdbMovie) => void
  loading?: boolean
}

/* ============================================
   Constants
   ============================================ */

const ZONE_THRESHOLD = 90
const ZONE_ANGLE_TOLERANCE = 30
const EXIT_DISTANCE = 500
const TAP_THRESHOLD = 8
const TILT_FACTOR = 12
const DETAIL_TILT = 20

const HALO_COLORS: Record<string, string> = {
  'swipe-zone--accept': '16, 185, 129',
  'swipe-zone--skip': '6, 182, 212',
  'swipe-zone--too-recent': '245, 158, 11',
  'swipe-zone--too-old': '139, 92, 246',
  'swipe-zone--genre': '244, 63, 94',
}

/* ============================================
   Helpers
   ============================================ */

function getAngle(dx: number, dy: number): number {
  const rad = Math.atan2(dy, dx)
  return ((rad * 180) / Math.PI + 360) % 360
}

function getDistance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy)
}

function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

function buildZones(movieGenres: TmdbGenre[]): SwipeZone[] {
  const fixed: SwipeZone[] = [
    { id: 'accept', label: 'On regarde !', angle: 0, feedbackType: 'accept', cssClass: 'swipe-zone--accept' },
    { id: 'skip', label: 'Pas ce film', angle: 180, feedbackType: 'same_genre_diff_movie', cssClass: 'swipe-zone--skip' },
    { id: 'recent', label: 'Trop récent', angle: 270, feedbackType: 'too_recent', cssClass: 'swipe-zone--too-recent' },
    { id: 'old', label: 'Trop vieux', angle: 90, feedbackType: 'too_old', cssClass: 'swipe-zone--too-old' },
  ]

  const diagonalAngles = [315, 225, 45, 135]
  const genreZones: SwipeZone[] = movieGenres.slice(0, 4).map((g, i) => ({
    id: `genre-${g.id}`,
    label: `Pas de ${g.name}`,
    angle: diagonalAngles[i],
    feedbackType: 'exclude_genre' as FeedbackType,
    genreId: g.id,
    cssClass: 'swipe-zone--genre',
  }))

  return [...fixed, ...genreZones]
}

function getZoneStyle(angle: number): React.CSSProperties {
  const rad = (angle * Math.PI) / 180
  const rx = 130
  const ry = 145
  const x = Math.cos(rad) * rx
  const y = Math.sin(rad) * ry
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    transform: 'translate(-50%, -50%)',
  }
}

/** Extract 3 dominant color regions from a poster image via tiny canvas */
function extractPosterColors(src: string): Promise<string[]> {
  const fallback = ['40,40,40', '40,40,40', '40,40,40']
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const w = 10, h = 15
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { resolve(fallback); return }
        ctx.drawImage(img, 0, 0, w, h)

        const avgRegion = (startY: number, endY: number) => {
          const data = ctx.getImageData(0, startY, w, endY - startY).data
          let r = 0, g = 0, b = 0, count = 0
          for (let i = 0; i < data.length; i += 4) {
            r += data[i]; g += data[i + 1]; b += data[i + 2]; count++
          }
          return `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`
        }

        resolve([
          avgRegion(0, 5),   // top
          avgRegion(5, 10),  // middle
          avgRegion(10, 15), // bottom
        ])
      } catch {
        resolve(fallback)
      }
    }
    img.onerror = () => resolve(fallback)
    img.src = src
  })
}

/* ============================================
   Component
   ============================================ */

export function SwipeCard({ movie, genres, onFeedback, onAccept, loading }: Props) {
  const movieGenres = genres.filter(g => movie.genre_ids?.includes(g.id))
  const zones = buildZones(movieGenres)

  const cardRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })
  const [hotZone, setHotZone] = useState<string | null>(null)

  const [phase, setPhase] = useState<'entering' | 'idle' | 'exiting'>('entering')
  const [exitVec, setExitVec] = useState({ x: 0, y: 0, rot: 0 })

  const [cardPointer, setCardPointer] = useState({ mx: 50, my: 50, posx: 50, posy: 50 })

  const [detailMode, setDetailMode] = useState(false)

  // Poster dominant colors for ambient glow
  const [posterColors, setPosterColors] = useState<string[]>([])

  const maxDragDist = useRef(0)
  const movieKeyRef = useRef(movie.id)

  // Extract poster colors when movie changes
  useEffect(() => {
    if (!movie.poster_path) return
    extractPosterColors(getPosterUrl(movie.poster_path, 'small'))
      .then(setPosterColors)
  }, [movie.poster_path])

  // Reset when movie changes
  useEffect(() => {
    if (movie.id !== movieKeyRef.current) {
      movieKeyRef.current = movie.id
      setPhase('entering')
      setDragDelta({ x: 0, y: 0 })
      setHotZone(null)
      setCardPointer({ mx: 50, my: 50, posx: 50, posy: 50 })
      setDetailMode(false)
    }
  }, [movie.id])

  // Lock body scroll in detail mode
  useEffect(() => {
    if (detailMode) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [detailMode])

  const handleAnimationEnd = useCallback(() => {
    if (phase === 'entering') setPhase('idle')
  }, [phase])

  /* ---------- Swipe pointer handlers ---------- */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== 'idle' || detailMode) return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startPos.current = { x: e.clientX, y: e.clientY }
    maxDragDist.current = 0
    setDragging(true)
  }, [phase, detailMode])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    setDragDelta({ x: dx, y: dy })

    const dist = getDistance(dx, dy)
    if (dist > maxDragDist.current) maxDragDist.current = dist

    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const mx = Math.max(0, Math.min(100, (cx / rect.width) * 100))
      const my = Math.max(0, Math.min(100, (cy / rect.height) * 100))
      setCardPointer({
        mx, my,
        posx: 50 + (mx - 50) / 4,
        posy: 50 + (my - 50) / 4,
      })
    }

    if (dist > ZONE_THRESHOLD * 0.6) {
      const angle = getAngle(dx, dy)
      let closest: SwipeZone | null = null
      let closestDiff = Infinity
      for (const z of zones) {
        const diff = angleDiff(angle, z.angle)
        if (diff < ZONE_ANGLE_TOLERANCE && diff < closestDiff) {
          closest = z
          closestDiff = diff
        }
      }
      setHotZone(closest?.id ?? null)
    } else {
      setHotZone(null)
    }
  }, [dragging, zones])

  const handlePointerUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)

    const dx = dragDelta.x
    const dy = dragDelta.y
    const dist = getDistance(dx, dy)

    // Tap → open detail
    if (maxDragDist.current < TAP_THRESHOLD) {
      setDragDelta({ x: 0, y: 0 })
      setHotZone(null)
      setDetailMode(true)
      return
    }

    if (dist > ZONE_THRESHOLD && hotZone) {
      const zone = zones.find(z => z.id === hotZone)
      if (zone) {
        const angle = (zone.angle * Math.PI) / 180
        const ex = Math.cos(angle) * EXIT_DISTANCE
        const ey = Math.sin(angle) * EXIT_DISTANCE
        const rot = dx / 10
        setExitVec({ x: ex, y: ey, rot })
        setPhase('exiting')

        setTimeout(() => {
          if (zone.feedbackType === 'accept') {
            onAccept(movie)
          } else {
            onFeedback(zone.feedbackType, movie, zone.genreId)
          }
        }, 350)
      }
    }

    setDragDelta({ x: 0, y: 0 })
    setHotZone(null)
  }, [dragging, dragDelta, hotZone, zones, movie, onFeedback, onAccept])

  /* ---------- Detail pointer handlers (holo tracking) ---------- */

  const handleDetailPointerMove = useCallback((e: React.PointerEvent) => {
    if (!cardRef.current) return
    const rect = cardRef.current.getBoundingClientRect()
    const cx = e.clientX - rect.left
    const cy = e.clientY - rect.top
    const mx = Math.max(0, Math.min(100, (cx / rect.width) * 100))
    const my = Math.max(0, Math.min(100, (cy / rect.height) * 100))
    setCardPointer({
      mx, my,
      posx: 50 + (mx - 50) / 4,
      posy: 50 + (my - 50) / 4,
    })
  }, [])

  const handleDetailPointerLeave = useCallback(() => {
    setCardPointer({ mx: 50, my: 50, posx: 50, posy: 50 })
  }, [])

  /* ---------- Computed styles ---------- */

  const tiltX = detailMode
    ? -((cardPointer.my - 50) / 50) * DETAIL_TILT
    : dragging ? Math.max(-TILT_FACTOR, Math.min(TILT_FACTOR, -dragDelta.y / 15)) : 0
  const tiltY = detailMode
    ? ((cardPointer.mx - 50) / 50) * DETAIL_TILT
    : dragging ? Math.max(-TILT_FACTOR, Math.min(TILT_FACTOR, dragDelta.x / 15)) : 0
  const dragRotation = dragging ? dragDelta.x / 25 : 0

  const cardTransform = phase === 'exiting'
    ? undefined
    : detailMode
    ? undefined
    : `translate(${dragDelta.x}px, ${dragDelta.y}px) rotate(${dragRotation}deg)`

  const innerStyle: React.CSSProperties = {
    '--rx': `${tiltY}deg`,
    '--ry': `${tiltX}deg`,
    '--mx': `${cardPointer.mx}%`,
    '--my': `${cardPointer.my}%`,
    '--posx': `${cardPointer.posx}%`,
    '--posy': `${cardPointer.posy}%`,
  } as React.CSSProperties

  const exitStyle: React.CSSProperties = phase === 'exiting' ? {
    '--exit-x': `${exitVec.x}px`,
    '--exit-y': `${exitVec.y}px`,
    '--exit-rot': `${exitVec.rot}deg`,
  } as React.CSSProperties : {}

  const haloZone = hotZone ? zones.find(z => z.id === hotZone) : null
  const haloRgb = haloZone ? HALO_COLORS[haloZone.cssClass] ?? null : null

  const phaseClass = phase === 'entering' ? 'entering' : phase === 'exiting' ? 'exiting' : ''
  const activeClass = dragging ? 'dragging active' : ''
  const snappingClass = !dragging && phase === 'idle' && (dragDelta.x !== 0 || dragDelta.y !== 0) ? 'snapping' : ''

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null

  // Glow CSS vars from poster colors
  const glowStyle: React.CSSProperties = posterColors.length >= 3 ? {
    '--glow-c1': posterColors[0],
    '--glow-c2': posterColors[1],
    '--glow-c3': posterColors[2],
  } as React.CSSProperties : {}

  if (loading) {
    return (
      <div className="swipe-arena">
        <div className="w-[220px] aspect-[2/3] rounded-2xl bg-[var(--color-surface)] animate-pulse" />
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      {detailMode && (
        <div
          className="detail-backdrop"
          onClick={() => setDetailMode(false)}
        />
      )}

      <div className={`swipe-arena ${detailMode ? 'swipe-arena--detail' : ''}`}>
        {/* Zones — swipe mode only */}
        {!detailMode && zones.map(zone => (
          <div
            key={zone.id}
            className={[
              'swipe-zone',
              zone.cssClass,
              dragging ? 'visible' : '',
              hotZone === zone.id ? 'hot' : '',
            ].join(' ')}
            style={getZoneStyle(zone.angle)}
          >
            {zone.label}
          </div>
        ))}

        {/* Card wrapper for glow positioning */}
        <div className={`swipe-card-wrapper ${detailMode ? 'swipe-card-wrapper--detail' : ''}`}>
          {/* Ambient glow behind card — detail mode only */}
          {detailMode && posterColors.length >= 3 && (
            <div className="detail-glow" style={glowStyle} />
          )}

          {/* The card */}
          <div
            ref={cardRef}
            className={[
              'swipe-card',
              detailMode ? 'swipe-card--detail' : '',
              detailMode ? '' : phaseClass,
              detailMode ? '' : activeClass,
              detailMode ? '' : snappingClass,
            ].filter(Boolean).join(' ')}
            style={{
              transform: cardTransform,
              ...(detailMode ? {} : exitStyle),
              ...(haloRgb ? { '--halo-rgb': haloRgb } as React.CSSProperties : {}),
            }}
            onPointerDown={detailMode ? undefined : handlePointerDown}
            onPointerMove={detailMode ? handleDetailPointerMove : handlePointerMove}
            onPointerUp={detailMode ? undefined : handlePointerUp}
            onPointerCancel={detailMode ? undefined : handlePointerUp}
            onPointerLeave={detailMode ? handleDetailPointerLeave : undefined}
            onClick={detailMode ? () => setDetailMode(false) : undefined}
            onAnimationEnd={detailMode ? undefined : handleAnimationEnd}
          >
            <div className="swipe-card__inner" style={innerStyle}>
              <img
                src={getPosterUrl(movie.poster_path, 'large')}
                alt={movie.title}
                className="swipe-card__poster"
                draggable={false}
              />
              <div className="swipe-card__shine" />
              <div className="swipe-card__glare" />
            </div>

            {!detailMode && (
              <div className="swipe-card__tap-hint">
                Appuyer pour les détails
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        {detailMode && (
          <div className="detail-info" onClick={e => e.stopPropagation()}>
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
        )}
      </div>
    </>
  )
}
