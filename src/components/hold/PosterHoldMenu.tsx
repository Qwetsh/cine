import type { CSSProperties } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie } from '../../lib/tmdb'
import { holdSafeBottom } from './holdZones'
import type { PlacedZone, HoldZoneKey } from './holdZones'
import './hold.css'

interface Props {
  movie: TmdbMovie
  rect: { top: number; left: number; width: number; height: number }
  closing: boolean
  /** Bulles placées en cercle autour du point d'appui */
  zones: PlacedZone[]
  activeKey: HoldZoneKey | null
  /** 0 = aucune bulle survolée, 1-3 = tiers de proximité */
  tier: 0 | 1 | 2 | 3
  /** Vecteur de glissement courant (px depuis le point d'appui), null au repos */
  drag: { dx: number; dy: number } | null
}

/* Légère rotation pendant le suivi 1:1 (cf. SwipeCard) */
const DRAG_ROTATE_DIVISOR = 25

/* Icônes au trait, cohérentes avec la charte (monochrome, accent à la sélection) */
function ZoneIcon({ zone }: { zone: HoldZoneKey }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }
  switch (zone) {
    case 'reco':
      // Avion en papier — envoyer à un ami
      return (
        <svg {...common}>
          <path d="M22 2 11 13" />
          <path d="M22 2 15 22l-4-9-9-4z" />
        </svg>
      )
    case 'col-solo':
      // Coche simple — vu (par moi)
      return (
        <svg {...common}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      )
    case 'col-couple':
      // Double coche — vu (à deux)
      return (
        <svg {...common}>
          <path d="M18 7 7.5 17.5 3 13" />
          <path d="m21 11-8 8" />
        </svg>
      )
    case 'wl-solo':
      // Marque-page — à voir (pour moi)
      return (
        <svg {...common}>
          <path d="M6 4h12v17l-6-4.2L6 21z" />
        </svg>
      )
    case 'wl-couple':
      // Cœur — à voir (en couple)
      return (
        <svg {...common}>
          <path d="M12 21S4 14.2 4 8.8C4 6 6.2 3.8 9 3.8c1.3 0 2.4.6 3 1.4.6-.8 1.7-1.4 3-1.4 2.8 0 5 2.2 5 5C20 14.2 12 21 12 21z" />
        </svg>
      )
  }
}

/**
 * Overlay plein écran du menu radial d'appui long sur une affiche.
 * Purement présentationnel : le glisser est piloté par HoldMenuProvider.
 * L'affiche suit le doigt 1:1 ; on la « dépose » sur une bulle pour agir.
 */
export function PosterHoldMenu({ movie, rect, closing, zones, activeKey, tier, drag }: Props) {
  const dragTransform = drag
    ? `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / DRAG_ROTATE_DIVISOR}deg)`
    : 'translate(0px, 0px) rotate(0deg)'

  return (
    <div className={`hold-menu ${closing ? 'closing' : ''}`}>
      {/* Affiche mise en avant, à sa position d'origine — elle suit le doigt 1:1 */}
      <div
        className={`hold-menu__poster-drag ${drag ? '' : 'snapping'}`}
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, transform: dragTransform }}
      >
        <div className="hold-menu__poster">
          <img src={getPosterUrl(movie.poster_path, 'medium')} alt={`Affiche de ${movie.title}`} />
        </div>
      </div>

      {/* Bulles d'action en cercle autour du point d'appui */}
      {zones.map((zone, i) => {
        const isActive = zone.key === activeKey
        const tierClass = isActive ? (tier >= 3 ? 't3' : tier === 2 ? 't2' : 't1') : ''
        const dimmed = activeKey !== null && !isActive
        return (
          <div
            key={zone.key}
            className="hold-zone-slot"
            style={{ left: zone.x, top: zone.y, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className={`hold-zone ${tierClass} ${dimmed ? 'dimmed' : ''}`}
              style={{ animationDelay: `${i * 40}ms` } as CSSProperties}
            >
              <div className="hold-zone__icon">
                <ZoneIcon zone={zone.key} />
              </div>
              <span className="hold-zone__label">{zone.label}</span>
            </div>
          </div>
        )
      })}

      <p className="hold-menu__hint" style={{ bottom: holdSafeBottom(24) }}>
        Dépose l'affiche sur une action, ou relâche pour annuler
      </p>
    </div>
  )
}
