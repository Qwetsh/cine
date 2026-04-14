import { useCallback, useEffect, useRef, useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie, TmdbGenre } from '../../lib/tmdb'
import type { FeedbackType } from '../../hooks/useSmartSuggestion'
import './SwipeCard.css'

/* ============================================
   Types
   ============================================ */

interface SwipeZone {
  id: string
  label: string
  angle: number            // center angle in degrees (0=right, 90=down, etc.)
  feedbackType: FeedbackType
  genreId?: number
  cssClass: string
}

interface Props {
  movie: TmdbMovie
  genres: TmdbGenre[]
  onFeedback: (type: FeedbackType, movie: TmdbMovie, genreId?: number) => void
  onAccept: (movie: TmdbMovie) => void
  onTap: (movie: TmdbMovie) => void
  loading?: boolean
}

/* ============================================
   Constants
   ============================================ */

const ZONE_THRESHOLD = 90        // px from center to activate a zone
const ZONE_ANGLE_TOLERANCE = 30  // degrees of angular tolerance per zone
const EXIT_DISTANCE = 500        // px for exit animation translation
const TAP_THRESHOLD = 8          // max px movement to count as tap
const TILT_FACTOR = 12           // max degrees of 3D tilt

/* ============================================
   Helpers
   ============================================ */

/** Angle from center in degrees: 0=right, 90=down, 180=left, 270=up */
function getAngle(dx: number, dy: number): number {
  const rad = Math.atan2(dy, dx)
  return ((rad * 180) / Math.PI + 360) % 360
}

function getDistance(dx: number, dy: number): number {
  return Math.sqrt(dx * dx + dy * dy)
}

/** Shortest angular distance (0-180) */
function angleDiff(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

/** Build zones based on movie genres */
function buildZones(movieGenres: TmdbGenre[]): SwipeZone[] {
  const fixed: SwipeZone[] = [
    { id: 'accept', label: 'On regarde !', angle: 0, feedbackType: 'accept', cssClass: 'swipe-zone--accept' },
    { id: 'skip', label: 'Pas ce film', angle: 180, feedbackType: 'same_genre_diff_movie', cssClass: 'swipe-zone--skip' },
    { id: 'recent', label: 'Trop récent', angle: 270, feedbackType: 'too_recent', cssClass: 'swipe-zone--too-recent' },
    { id: 'old', label: 'Trop vieux', angle: 90, feedbackType: 'too_old', cssClass: 'swipe-zone--too-old' },
  ]

  // Place genres in diagonal slots: 315 (up-right), 225 (up-left), 45 (down-right), 135 (down-left)
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

/** Position a zone label around the arena */
function getZoneStyle(angle: number): React.CSSProperties {
  const rad = (angle * Math.PI) / 180
  // Elliptical placement
  const rx = 155  // horizontal radius from center
  const ry = 175  // vertical radius from center
  const x = Math.cos(rad) * rx
  const y = Math.sin(rad) * ry
  return {
    left: `calc(50% + ${x}px)`,
    top: `calc(50% + ${y}px)`,
    transform: 'translate(-50%, -50%)',
  }
}

/* ============================================
   Component
   ============================================ */

export function SwipeCard({ movie, genres, onFeedback, onAccept, onTap, loading }: Props) {
  const movieGenres = genres.filter(g => movie.genre_ids.includes(g.id))
  const zones = buildZones(movieGenres)

  // Drag state
  const cardRef = useRef<HTMLDivElement>(null)
  const startPos = useRef({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragDelta, setDragDelta] = useState({ x: 0, y: 0 })
  const [hotZone, setHotZone] = useState<string | null>(null)

  // Animation state
  const [phase, setPhase] = useState<'entering' | 'idle' | 'exiting'>('entering')
  const [exitVec, setExitVec] = useState({ x: 0, y: 0, rot: 0 })

  // Holo effect state (mouse/touch position on card)
  const [cardPointer, setCardPointer] = useState({ mx: 50, my: 50, posx: 50, posy: 50 })

  // Track if this is a tap vs drag
  const maxDragDist = useRef(0)

  // Unique key to re-trigger entering animation
  const movieKeyRef = useRef(movie.id)

  // Reset to entering when movie changes
  useEffect(() => {
    if (movie.id !== movieKeyRef.current) {
      movieKeyRef.current = movie.id
      setPhase('entering')
      setDragDelta({ x: 0, y: 0 })
      setHotZone(null)
      setCardPointer({ mx: 50, my: 50, posx: 50, posy: 50 })
    }
  }, [movie.id])

  // After entering animation completes
  const handleAnimationEnd = useCallback(() => {
    if (phase === 'entering') {
      setPhase('idle')
    }
    if (phase === 'exiting') {
      // Trigger feedback — handled in handlePointerUp
    }
  }, [phase])

  /* ---------- Pointer handlers ---------- */

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (phase !== 'idle') return
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    startPos.current = { x: e.clientX, y: e.clientY }
    maxDragDist.current = 0
    setDragging(true)
  }, [phase])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    setDragDelta({ x: dx, y: dy })

    const dist = getDistance(dx, dy)
    if (dist > maxDragDist.current) maxDragDist.current = dist

    // Update holo effect based on drag position on card
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

    // Check hot zone
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

    // Tap detection
    if (maxDragDist.current < TAP_THRESHOLD) {
      setDragDelta({ x: 0, y: 0 })
      setHotZone(null)
      onTap(movie)
      return
    }

    // Check if we're in a zone
    if (dist > ZONE_THRESHOLD && hotZone) {
      const zone = zones.find(z => z.id === hotZone)
      if (zone) {
        // Calculate exit direction
        const angle = (zone.angle * Math.PI) / 180
        const ex = Math.cos(angle) * EXIT_DISTANCE
        const ey = Math.sin(angle) * EXIT_DISTANCE
        const rot = (dx / 10) // slight rotation based on horizontal drag
        setExitVec({ x: ex, y: ey, rot })
        setPhase('exiting')

        // Fire feedback after exit animation
        setTimeout(() => {
          if (zone.feedbackType === 'accept') {
            onAccept(movie)
          } else {
            onFeedback(zone.feedbackType, movie, zone.genreId)
          }
        }, 350)
      }
    }

    // Snap back
    setDragDelta({ x: 0, y: 0 })
    setHotZone(null)
  }, [dragging, dragDelta, hotZone, zones, movie, onFeedback, onAccept, onTap])

  /* ---------- Computed styles ---------- */

  // Card transform (drag + 3D tilt)
  const tiltX = dragging ? Math.max(-TILT_FACTOR, Math.min(TILT_FACTOR, -dragDelta.y / 15)) : 0
  const tiltY = dragging ? Math.max(-TILT_FACTOR, Math.min(TILT_FACTOR, dragDelta.x / 15)) : 0
  const dragRotation = dragging ? dragDelta.x / 25 : 0

  const cardTransform = phase === 'exiting'
    ? undefined  // handled by animation
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

  // Phase classes
  const phaseClass = phase === 'entering' ? 'entering'
    : phase === 'exiting' ? 'exiting'
    : ''
  const activeClass = dragging ? 'dragging active' : ''
  const snappingClass = !dragging && phase === 'idle' && (dragDelta.x !== 0 || dragDelta.y !== 0) ? 'snapping' : ''

  if (loading) {
    return (
      <div className="swipe-arena">
        <div className="w-[220px] aspect-[2/3] rounded-2xl bg-[var(--color-surface)] animate-pulse" />
      </div>
    )
  }

  return (
    <div className="swipe-arena">
      {/* Zone labels */}
      {zones.map(zone => (
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

      {/* The card */}
      <div
        ref={cardRef}
        className={['swipe-card', phaseClass, activeClass, snappingClass].filter(Boolean).join(' ')}
        style={{
          transform: cardTransform,
          ...exitStyle,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onAnimationEnd={handleAnimationEnd}
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

        <div className="swipe-card__tap-hint">
          Appuyer pour les détails
        </div>
      </div>
    </div>
  )
}
