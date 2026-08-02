import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useLongPress } from '../../hooks/useLongPress'
import { fetchPeekFilmography } from '../../lib/filmographyPeek'
import type { PeekEntry } from '../../lib/filmographyPeek'
import { getPosterUrl } from '../../lib/tmdb'
import { HoldRing } from './HoldRing'
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

/**
 * Enrobe un bouton acteur/réalisateur pour lui donner le « hold-to-peek » :
 * appui long → liseré → strip horizontal de sa filmographie, qu'on parcourt
 * en glissant le doigt sans relâcher ; relâcher ferme le peek.
 * Le tap normal (navigation vers la fiche personne) reste intact.
 */
export function HoldablePerson({ personId, personName, profilePath, className = '', radius = 10, children }: Props) {
  const [peek, setPeek] = useState<'open' | 'closing' | null>(null)
  const [entries, setEntries] = useState<PeekEntry[] | null>(null)
  const stripRef = useRef<HTMLDivElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const openRef = useRef(false)

  useEffect(() => () => clearTimeout(closeTimer.current), [])

  function closePeek() {
    if (!openRef.current) return
    openRef.current = false
    setPeek('closing')
    clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => {
      setPeek(null)
      setEntries(null)
    }, 200)
  }

  const { charging, ringDuration, handlers } = useLongPress({
    // Précharge la filmographie pendant la charge du liseré
    onPressStart: () => { void fetchPeekFilmography(personId).catch(() => {}) },
    onComplete: () => {
      clearTimeout(closeTimer.current)
      openRef.current = true
      setPeek('open')
      setEntries(null)
      fetchPeekFilmography(personId)
        .then(list => { if (openRef.current) setEntries(list) })
        .catch(() => { if (openRef.current) setEntries([]) })
    },
    onMove: (dx) => {
      // Drag-to-scroll : le doigt pilote le strip sans être relâché
      const strip = stripRef.current
      const viewport = viewportRef.current
      if (!strip || !viewport) return
      const maxScroll = Math.max(0, strip.scrollWidth - viewport.clientWidth)
      const offset = Math.min(0, Math.max(-maxScroll, dx * 1.6))
      strip.style.transform = `translateX(${offset}px)`
    },
    onRelease: closePeek,
    onAbort: closePeek,
  })

  return (
    <div
      {...handlers}
      className={`relative select-none [-webkit-touch-callout:none] ${className}`}
    >
      {children}
      {charging && <HoldRing duration={ringDuration} radius={radius} />}

      {peek && createPortal(
        <div className={`person-peek ${peek === 'closing' ? 'closing' : ''}`}>
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
                {entries === null ? 'Chargement…' : `${entries.length} films et séries marquants`}
              </p>
            </div>
          </div>

          <div className="person-peek__viewport" ref={viewportRef}>
            <div className="person-peek__strip" ref={stripRef}>
              {entries === null && Array.from({ length: 5 }, (_, i) => (
                <div key={i} className="person-peek__card" style={{ animationDelay: `${i * 50}ms` }}>
                  <div className="aspect-[2/3] rounded-lg bg-[var(--color-surface-2)] animate-pulse" />
                </div>
              ))}
              {entries !== null && entries.length === 0 && (
                <p className="text-sm text-[var(--color-text-muted)] py-8">Aucune filmographie trouvée</p>
              )}
              {entries !== null && entries.map((entry, i) => (
                <div
                  key={entry.key}
                  className="person-peek__card"
                  style={{ animationDelay: `${Math.min(i, 8) * 45}ms` } as CSSProperties}
                >
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
                </div>
              ))}
            </div>
          </div>

          <p className="person-peek__hint">Glisse pour parcourir · Relâche pour fermer</p>
        </div>,
        document.body,
      )}
    </div>
  )
}
