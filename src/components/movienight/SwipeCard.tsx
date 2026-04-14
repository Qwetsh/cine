import { useCallback, useEffect, useRef, useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../../lib/tmdb'
import type { FeedbackType } from '../../hooks/useSmartSuggestion'
import { TrailerButton } from '../movie/TrailerButton'
import { LightningCanvas } from './LightningCanvas'
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
  colorKey: string
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

const ZONE_COLORS: Record<string, string> = {
  accept: '16, 185, 129',
  skip: '6, 182, 212',
  recent: '245, 158, 11',
  old: '139, 92, 246',
  genre: '244, 63, 94',
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
    { id: 'accept', label: 'On regarde !', angle: 0, feedbackType: 'accept', colorKey: 'accept' },
    { id: 'skip', label: 'Pas ce film', angle: 180, feedbackType: 'same_genre_diff_movie', colorKey: 'skip' },
    { id: 'recent', label: 'Trop récent', angle: 270, feedbackType: 'too_recent', colorKey: 'recent' },
    { id: 'old', label: 'Trop vieux', angle: 90, feedbackType: 'too_old', colorKey: 'old' },
  ]

  const diagonalAngles = [315, 225, 45, 135]
  const genreZones: SwipeZone[] = movieGenres.slice(0, 4).map((g, i) => ({
    id: `genre-${g.id}`,
    label: `Pas de ${g.name}`,
    angle: diagonalAngles[i],
    feedbackType: 'exclude_genre' as FeedbackType,
    genreId: g.id,
    colorKey: 'genre',
  }))

  return [...fixed, ...genreZones]
}

/** Map zone angle → CSS classes for edge band positioning */
function getEdgeBandClass(angle: number): string {
  switch (angle) {
    case 0: return 'edge-band--v edge-band--right'
    case 180: return 'edge-band--v edge-band--left'
    case 270: return 'edge-band--h edge-band--top'
    case 90: return 'edge-band--h edge-band--bottom'
    case 315: return 'edge-band--corner edge-band--tr'
    case 225: return 'edge-band--corner edge-band--tl'
    case 45: return 'edge-band--corner edge-band--br'
    case 135: return 'edge-band--corner edge-band--bl'
    default: return 'edge-band--corner'
  }
}

/** Map zone angle → CSS class for label positioning */
function getEdgeLabelClass(angle: number): string {
  switch (angle) {
    case 0: return 'edge-label--right'
    case 180: return 'edge-label--left'
    case 270: return 'edge-label--top'
    case 90: return 'edge-label--bottom'
    case 315: return 'edge-label--tr'
    case 225: return 'edge-label--tl'
    case 45: return 'edge-label--br'
    case 135: return 'edge-label--bl'
    default: return ''
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
  const [detailClosing, setDetailClosing] = useState(false)
  const closingRef = useRef(false)

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

  /* ---------- Detail open (FLIP + spin) ---------- */

  const handleDetailOpen = useCallback(() => {
    if (closingRef.current || !cardRef.current) {
      setDetailMode(true)
      return
    }

    const first = cardRef.current.getBoundingClientRect()
    setDetailMode(true)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cardRef.current) return

        const last = cardRef.current.getBoundingClientRect()
        const dx = first.left + first.width / 2 - (last.left + last.width / 2)
        const dy = first.top + first.height / 2 - (last.top + last.height / 2)
        const sw = first.width / last.width
        const sh = first.height / last.height

        const SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'

        cardRef.current.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${sw}, ${sh})` },
          { transform: 'translate(0, 0) scale(1)' },
        ], { duration: 900, easing: SPRING, fill: 'backwards' })

        const inner = cardRef.current.querySelector('.swipe-card__inner')
        if (inner) {
          inner.animate([
            { transform: 'perspective(800px) rotateY(0deg)' },
            { transform: 'perspective(800px) rotateY(360deg)' },
          ], { duration: 900, easing: SPRING })
        }
      })
    })
  }, [])

  const handlePointerUp = useCallback(() => {
    if (!dragging) return
    setDragging(false)

    const dx = dragDelta.x
    const dy = dragDelta.y
    const dist = getDistance(dx, dy)

    // Tap → open detail (blocked during closing animation)
    if (maxDragDist.current < TAP_THRESHOLD) {
      setDragDelta({ x: 0, y: 0 })
      setHotZone(null)
      if (!closingRef.current) handleDetailOpen()
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
  }, [dragging, dragDelta, hotZone, zones, movie, onFeedback, onAccept, handleDetailOpen])

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

  /* ---------- Detail close (FLIP + reverse spin) ---------- */

  const handleDetailClose = useCallback(() => {
    if (closingRef.current || !cardRef.current) return
    closingRef.current = true

    const first = cardRef.current.getBoundingClientRect()

    setDetailMode(false)
    setDetailClosing(true)

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cardRef.current) {
          closingRef.current = false
          setDetailClosing(false)
          return
        }

        const last = cardRef.current.getBoundingClientRect()
        const dx = first.left + first.width / 2 - (last.left + last.width / 2)
        const dy = first.top + first.height / 2 - (last.top + last.height / 2)
        const sw = first.width / last.width
        const sh = first.height / last.height

        const SPRING = 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'

        cardRef.current.animate([
          { transform: `translate(${dx}px, ${dy}px) scale(${sw}, ${sh})` },
          { transform: 'translate(0, 0) scale(1)' },
        ], { duration: 900, easing: SPRING, fill: 'backwards' })

        const inner = cardRef.current.querySelector('.swipe-card__inner')
        const spinAnim = inner
          ? inner.animate([
              { transform: 'perspective(800px) rotateY(-360deg)' },
              { transform: 'perspective(800px) rotateY(0deg)' },
            ], { duration: 900, easing: SPRING })
          : null

        const cleanup = () => {
          closingRef.current = false
          setDetailClosing(false)
        }

        if (spinAnim) {
          spinAnim.finished.then(cleanup).catch(cleanup)
        } else {
          setTimeout(cleanup, 900)
        }
      })
    })
  }, [])

  /* ---------- Computed values ---------- */

  const dragDist = getDistance(dragDelta.x, dragDelta.y)
  const progress = dragDist / ZONE_THRESHOLD

  // Tier: 0 (idle), 1 (amorce), 2 (tension), 3 (commit)
  const tier = !dragging || !hotZone ? 0
    : progress < 0.75 ? 1
    : progress < 0.95 ? 2
    : 3

  const hotZoneObj = hotZone ? zones.find(z => z.id === hotZone) : null
  const haloRgb = hotZoneObj ? ZONE_COLORS[hotZoneObj.colorKey] : null

  const tiltX = detailMode
    ? -((cardPointer.my - 50) / 50) * DETAIL_TILT
    : dragging ? Math.max(-TILT_FACTOR, Math.min(TILT_FACTOR, -dragDelta.y / 15)) : 0
  const tiltY = detailMode
    ? ((cardPointer.mx - 50) / 50) * DETAIL_TILT
    : dragging ? Math.max(-TILT_FACTOR, Math.min(TILT_FACTOR, dragDelta.x / 15)) : 0
  const dragRotation = dragging ? dragDelta.x / 25 : 0

  const cardTransform = phase === 'exiting'
    ? undefined
    : (detailMode || detailClosing)
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

  const phaseClass = phase === 'entering' ? 'entering' : phase === 'exiting' ? 'exiting' : ''
  const activeClass = dragging ? 'dragging active' : ''
  const snappingClass = !dragging && phase === 'idle' && (dragDelta.x !== 0 || dragDelta.y !== 0) ? 'snapping' : ''
  const tierClass = tier > 0 ? `tier-${tier}` : ''

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null

  const glowStyle: React.CSSProperties = posterColors.length >= 3 ? {
    '--glow-c1': posterColors[0],
    '--glow-c2': posterColors[1],
    '--glow-c3': posterColors[2],
  } as React.CSSProperties : {}

  if (loading) {
    return (
      <div className="swipe-arena">
        <div className="w-[180px] aspect-[2/3] rounded-2xl bg-[var(--color-surface)] animate-pulse" />
      </div>
    )
  }

  return (
    <>
      {/* Backdrop */}
      {(detailMode || detailClosing) && (
        <div
          className={`detail-backdrop ${detailClosing ? 'detail-closing' : ''}`}
          onClick={detailClosing ? undefined : handleDetailClose}
        />
      )}

      <div className={`swipe-arena ${detailMode ? 'swipe-arena--detail' : ''}`}>
        {/* Edge bands + labels — swipe mode only */}
        {!detailMode && !detailClosing && zones.map(zone => {
          const isHot = hotZone === zone.id
          const bandTier = !dragging ? ''
            : isHot && tier > 0 ? `tier-${tier}`
            : 'hint'
          const zoneStyle = { '--zone-rgb': ZONE_COLORS[zone.colorKey] } as React.CSSProperties
          return (
            <div key={zone.id}>
              <div
                className={`edge-band ${getEdgeBandClass(zone.angle)} ${bandTier}`}
                style={zoneStyle}
              />
              <div
                className={`edge-label ${getEdgeLabelClass(zone.angle)} ${bandTier}`}
                style={zoneStyle}
              >
                {zone.label}
              </div>
            </div>
          )
        })}

        {/* Lightning arcs — swipe mode only */}
        {!detailMode && !detailClosing && (
          <LightningCanvas
            active={dragging && tier > 0 && !!hotZoneObj}
            tier={tier}
            angle={hotZoneObj?.angle ?? 0}
            rgb={hotZoneObj ? ZONE_COLORS[hotZoneObj.colorKey] : '0,0,0'}
          />
        )}

        {/* Card wrapper for glow positioning */}
        <div className={`swipe-card-wrapper ${detailMode ? 'swipe-card-wrapper--detail' : ''}`}>
          {/* Ambient glow behind card */}
          {(detailMode || detailClosing) && posterColors.length >= 3 && (
            <div className={`detail-glow ${detailClosing ? 'detail-closing' : ''}`} style={glowStyle} />
          )}

          {/* The card */}
          <div
            ref={cardRef}
            className={[
              'swipe-card',
              detailMode ? 'swipe-card--detail' : '',
              (detailMode || detailClosing) ? '' : phaseClass,
              (detailMode || detailClosing) ? '' : activeClass,
              (detailMode || detailClosing) ? '' : snappingClass,
              (detailMode || detailClosing) ? '' : tierClass,
            ].filter(Boolean).join(' ')}
            style={{
              transform: cardTransform,
              ...(!detailMode && !detailClosing ? exitStyle : {}),
              ...(haloRgb ? { '--halo-rgb': haloRgb } as React.CSSProperties : {}),
            }}
            onPointerDown={detailMode ? undefined : handlePointerDown}
            onPointerMove={detailMode ? handleDetailPointerMove : handlePointerMove}
            onPointerUp={detailMode ? undefined : handlePointerUp}
            onPointerCancel={detailMode ? undefined : handlePointerUp}
            onPointerLeave={detailMode ? handleDetailPointerLeave : undefined}
            onClick={detailMode && !detailClosing ? handleDetailClose : undefined}
            onAnimationEnd={(detailMode || detailClosing) ? undefined : handleAnimationEnd}
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

              {/* Stamp overlay */}
              {dragging && hotZoneObj && tier > 0 && (
                <div
                  className={`swipe-stamp tier-${tier}`}
                  style={{ '--zone-rgb': ZONE_COLORS[hotZoneObj.colorKey] } as React.CSSProperties}
                >
                  {hotZoneObj.label}
                </div>
              )}
            </div>

            {!detailMode && !detailClosing && (
              <div className="swipe-card__tap-hint">
                Appuyer pour les détails
              </div>
            )}
          </div>
        </div>

        {/* Info panel */}
        {(detailMode || detailClosing) && (
          <div className={`detail-info ${detailClosing ? 'detail-closing' : ''}`} onClick={e => e.stopPropagation()}>
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
