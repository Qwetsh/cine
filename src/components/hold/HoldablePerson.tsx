import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLongPress } from '../../hooks/useLongPress'
import { fetchPeekFilmography } from '../../lib/filmographyPeek'
import type { PeekEntry } from '../../lib/filmographyPeek'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie } from '../../lib/tmdb'
import { HoldRing } from './HoldRing'
import { HoldablePoster } from './HoldablePoster'
import './hold.css'

interface Props {
  personId: number
  personName: string
  profilePath?: string | null
  /** Classes du wrapper (en plus de relative) */
  className?: string
  /** Rayon du liseré, à faire correspondre aux coins du bouton */
  radius?: number
  children: ReactNode
}

/* Géométrie du manège */
const CARD_W = 96
const GAP = 12
const SPAN = CARD_W + GAP
const PAD = 24
/** Amplification du glissement du doigt sur le défilement */
const AMP = 1.6
/** En dessous de ce nombre de films, pas de boucle infinie (simple clamp) */
const LOOP_MIN = 6

/* Verrouillage : amener le doigt sur le cadenas, charge, relâcher */
const LOCK_CHARGE_MS = 600
const LOCK_ENTER_RADIUS = 55
const LOCK_LEAVE_RADIUS = 72

/** TmdbMovie « d'affichage » depuis une entrée du peek (menu rapide en mode lock) */
function peekEntryToMovie(entry: PeekEntry): TmdbMovie {
  return {
    id: entry.tmdbId,
    title: entry.title,
    original_title: entry.title,
    overview: '',
    poster_path: entry.posterPath,
    backdrop_path: null,
    release_date: entry.year ? `${entry.year}-01-01` : '',
    vote_average: 0,
    vote_count: 0,
    genre_ids: [],
    popularity: 0,
    adult: false,
    media_type: entry.mediaType,
  } as TmdbMovie
}

/**
 * Enrobe un bouton acteur/réalisateur pour lui donner le « hold-to-peek » :
 * appui long → liseré → manège horizontal de sa filmographie (les plus
 * populaires), en boucle infinie, qu'on parcourt en glissant le doigt dans
 * les deux sens sans relâcher. Relâcher ferme le peek — sauf si on dépose
 * le doigt sur le cadenas en bas : après sa charge, le menu se verrouille
 * (scroll natif, tap vers la fiche d'un film, appui long pour le menu
 * d'actions rapides) et le cadenas devient un bouton Retour.
 */
export function HoldablePerson({ personId, personName, profilePath, className = '', radius = 10, children }: Props) {
  const navigate = useNavigate()
  const [peek, setPeek] = useState<'open' | 'closing' | null>(null)
  const [entries, setEntries] = useState<PeekEntry[] | null>(null)
  const [locked, setLocked] = useState(false)
  const [lockCharge, setLockCharge] = useState(false)
  const [lockReady, setLockReady] = useState(false)

  const stripRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const lockRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const lockTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const openRef = useRef(false)
  const lockedRef = useRef(false)
  const lockReadyRef = useRef(false)
  const lockChargeRef = useRef(false)
  const entriesRef = useRef<PeekEntry[] | null>(null)
  const loopRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })
  const offset0Ref = useRef(0)
  const offsetRef = useRef(0)

  useEffect(() => {
    entriesRef.current = entries
  }, [entries])

  useEffect(() => () => {
    clearTimeout(closeTimer.current)
    clearTimeout(lockTimer.current)
  }, [])

  const cancelLockCharge = useCallback(() => {
    clearTimeout(lockTimer.current)
    if (lockChargeRef.current || lockReadyRef.current) {
      lockChargeRef.current = false
      lockReadyRef.current = false
      setLockCharge(false)
      setLockReady(false)
    }
  }, [])

  const closePeek = useCallback(() => {
    if (!openRef.current) return
    openRef.current = false
    lockedRef.current = false
    cancelLockCharge()
    setPeek('closing')
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setPeek(null)
      setEntries(null)
      setLocked(false)
    }, 200)
  }, [cancelLockCharge])

  // Position initiale du manège : premier film (le plus populaire) centré,
  // sur la copie du milieu quand la boucle infinie est active
  useEffect(() => {
    if (peek !== 'open' || locked || !entries || entries.length === 0) return
    const strip = stripRef.current
    const viewport = viewportRef.current
    if (!strip || !viewport) return
    const loop = entries.length >= LOOP_MIN
    loopRef.current = loop
    const vw = viewport.clientWidth
    const offset0 = loop ? vw / 2 - CARD_W / 2 - PAD - entries.length * SPAN : 0
    offset0Ref.current = offset0
    offsetRef.current = offset0
    strip.style.transform = `translateX(${offset0}px)`
  }, [peek, entries, locked])

  // Passage en mode verrouillé : le transform devient un scroll natif
  useEffect(() => {
    if (!locked) return
    const strip = stripRef.current
    const viewport = viewportRef.current
    if (!strip || !viewport) return
    strip.style.transform = 'none'
    viewport.scrollLeft = Math.max(0, -offsetRef.current)
  }, [locked])

  const { charging, ringDuration, handlers } = useLongPress({
    delay: 300,
    // Précharge la filmographie pendant la charge du liseré
    onPressStart: () => { void fetchPeekFilmography(personId).catch(() => {}) },
    onComplete: (start) => {
      clearTimeout(closeTimer.current)
      openRef.current = true
      lockedRef.current = false
      startRef.current = start
      setLocked(false)
      setPeek('open')
      setEntries(null)
      fetchPeekFilmography(personId)
        .then(list => { if (openRef.current) setEntries(list) })
        .catch(() => { if (openRef.current) setEntries([]) })
    },
    onMove: (dx, dy) => {
      if (lockedRef.current) return

      // Manège piloté par le doigt, dans les deux sens, sans relâcher
      const strip = stripRef.current
      const viewport = viewportRef.current
      const list = entriesRef.current
      if (strip && viewport && list && list.length > 0) {
        const totalSpan = list.length * SPAN
        let offset
        if (loopRef.current) {
          // Boucle infinie : modulo recentré sur la copie du milieu (3 copies
          // rendues) pour que la fenêtre visible reste toujours couverte
          const shift = (((dx * AMP) % totalSpan) + totalSpan * 1.5) % totalSpan - totalSpan / 2
          offset = offset0Ref.current + shift
        } else {
          const max = Math.max(0, strip.scrollWidth - viewport.clientWidth)
          offset = Math.min(0, Math.max(-max, offset0Ref.current + dx * AMP))
        }
        offsetRef.current = offset
        strip.style.transform = `translateX(${offset}px)`
      }

      // Approche du cadenas : charge avec hystérésis
      const lockEl = lockRef.current
      if (!lockEl) return
      const rect = lockEl.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      const fx = startRef.current.x + dx
      const fy = startRef.current.y + dy
      const dist = Math.hypot(fx - cx, fy - cy)
      if (!lockChargeRef.current && dist <= LOCK_ENTER_RADIUS) {
        lockChargeRef.current = true
        setLockCharge(true)
        clearTimeout(lockTimer.current)
        lockTimer.current = setTimeout(() => {
          if (!openRef.current || !lockChargeRef.current) return
          lockReadyRef.current = true
          setLockReady(true)
          try { navigator.vibrate?.(20) } catch { /* non supporté */ }
        }, LOCK_CHARGE_MS + 20)
      } else if (lockChargeRef.current && dist > LOCK_LEAVE_RADIUS) {
        cancelLockCharge()
      }
    },
    onRelease: () => {
      if (lockedRef.current) return
      if (lockReadyRef.current) {
        // Verrouillage : le menu reste, le doigt est libre
        lockedRef.current = true
        cancelLockCharge()
        setLocked(true)
      } else {
        closePeek()
      }
    },
    onAbort: () => {
      if (!lockedRef.current) closePeek()
    },
  })

  function openEntry(entry: PeekEntry) {
    closePeek()
    navigate(entry.mediaType === 'movie' ? `/movie/${entry.tmdbId}` : `/tv/${entry.tmdbId}`)
  }

  const n = entries?.length ?? 0
  // 3 copies pour la boucle infinie : la fenêtre visible reste toujours couverte
  const displayed = entries === null ? null : (n >= LOOP_MIN ? [...entries, ...entries, ...entries] : entries)

  function renderCard(entry: PeekEntry, i: number) {
    const content = (
      <>
        <div className="aspect-[2/3] rounded-lg overflow-hidden bg-[var(--color-surface-2)] relative">
          <img
            src={getPosterUrl(entry.posterPath, 'small')}
            alt={`Affiche de ${entry.title}`}
            className="w-full h-full object-cover"
            draggable={false}
          />
          {entry.mediaType === 'tv' && (
            <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full">
              Série
            </div>
          )}
        </div>
        <p className="text-[11px] font-medium text-[var(--color-text)] leading-tight line-clamp-2 mt-1.5">
          {entry.title}
          {entry.year && <span className="text-[var(--color-text-muted)] font-normal"> · {entry.year}</span>}
        </p>
        {entry.sub && (
          <p className="text-[10px] text-[var(--color-text-muted)] italic leading-tight line-clamp-1 mt-0.5">
            {entry.sub}
          </p>
        )}
      </>
    )

    const delay = { animationDelay: `${Math.min(i % Math.max(n, 1), 8) * 45}ms` }

    // Verrouillé : tap → fiche, appui long → menu d'actions rapides
    if (locked) {
      return (
        <HoldablePoster key={`${entry.key}-${i}`} movie={peekEntryToMovie(entry)} partial className="person-peek__card" radius={8}>
          <button onClick={() => openEntry(entry)} className="w-full text-left" style={delay}>
            {content}
          </button>
        </HoldablePoster>
      )
    }
    return (
      <div key={`${entry.key}-${i}`} className="person-peek__card" style={delay}>
        {content}
      </div>
    )
  }

  return (
    <div
      {...handlers}
      className={`relative select-none [-webkit-touch-callout:none] ${className}`}
    >
      {children}
      {charging && <HoldRing duration={ringDuration} radius={radius} />}

      {peek && createPortal(
        <div
          className={`person-peek ${peek === 'closing' ? 'closing' : ''}`}
          style={locked ? { touchAction: 'auto' } : undefined}
          onPointerDown={e => e.stopPropagation()}
          onPointerMove={e => e.stopPropagation()}
          onPointerUp={e => e.stopPropagation()}
        >
          <div className="person-peek__header">
            {profilePath ? (
              <img
                src={getPosterUrl(profilePath, 'small').replace('/w185', '/w92')}
                alt={personName}
                className="w-9 h-9 rounded-full object-cover"
              />
            ) : (
              <div className="w-9 h-9 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-sm">🎭</div>
            )}
            <div>
              <p className="font-semibold text-[var(--color-text)] leading-tight">{personName}</p>
              <p className="text-xs text-[var(--color-text-muted)]">
                {entries === null ? 'Chargement…' : `${entries.length} titres les plus populaires`}
              </p>
            </div>
          </div>

          <div
            className="person-peek__viewport scrollbar-hide"
            style={locked ? { overflowX: 'auto' } : undefined}
            ref={viewportRef}
          >
            <div className="person-peek__strip" ref={stripRef}>
              {displayed === null && Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="person-peek__card" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="aspect-[2/3] rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
                </div>
              ))}
              {displayed !== null && displayed.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] py-8">Aucune filmographie trouvée</p>
              )}
              {displayed !== null && displayed.map(renderCard)}
            </div>
          </div>

          <p className="person-peek__hint">
            {locked
              ? 'Touche un film pour sa fiche · Appui long pour les actions'
              : 'Glisse pour parcourir · Dépose sur le cadenas pour garder le menu'}
          </p>

          {/* Cadenas de verrouillage / bouton Retour */}
          <div className="person-peek__lock" ref={lockRef}>
            {locked ? (
              <button onClick={closePeek} className="person-peek__backbtn">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </svg>
                Retour
              </button>
            ) : (
              <div className={`person-peek__lockbtn ${lockCharge ? 'charging' : ''} ${lockReady ? 'ready' : ''}`}>
                {lockCharge && <HoldRing duration={LOCK_CHARGE_MS} radius={24} />}
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="4" y="11" width="16" height="10" rx="2" />
                  <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                </svg>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
