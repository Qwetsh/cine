import type { CSSProperties } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbMovie } from '../../lib/tmdb'
import { holdSafeBottom } from './holdZones'
import type { HoldZone, HoldZoneKey } from './holdZones'
import './hold.css'

interface Props {
  movie: TmdbMovie
  rect: { top: number; left: number; width: number; height: number }
  closing: boolean
  zones: HoldZone[]
  activeKey: HoldZoneKey | null
  /** 0 = aucune zone visée, 1-3 = tiers de proximité */
  tier: 0 | 1 | 2 | 3
  /** Vecteur de glissement courant (px depuis le point d'appui), null au repos */
  drag: { dx: number; dy: number } | null
}

/* L'affiche suit le doigt avec un amorti + légère rotation (cf. SwipeCard) */
const DRAG_FOLLOW = 0.45
const DRAG_ROTATE_DIVISOR = 25

/**
 * Overlay plein écran du menu radial d'appui long sur une affiche.
 * Purement présentationnel : le glisser est piloté par HoldMenuProvider.
 */
export function PosterHoldMenu({ movie, rect, closing, zones, activeKey, tier, drag }: Props) {
  const dragTransform = drag
    ? `translate(${drag.dx * DRAG_FOLLOW}px, ${drag.dy * DRAG_FOLLOW}px) rotate(${drag.dx / DRAG_ROTATE_DIVISOR}deg)`
    : 'translate(0px, 0px) rotate(0deg)'

  return (
    <div className={`hold-menu ${closing ? 'closing' : ''}`}>
      {/* Affiche mise en avant, à sa position d'origine — elle suit le doigt */}
      <div
        className={`hold-menu__poster-drag ${drag ? '' : 'snapping'}`}
        style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height, transform: dragTransform }}
      >
        <div className="hold-menu__poster">
          <img src={getPosterUrl(movie.poster_path, 'medium')} alt={`Affiche de ${movie.title}`} />
        </div>
      </div>

      {/* Bulles d'action : coins + haut */}
      {zones.map((zone, i) => {
        const isActive = zone.key === activeKey
        const tierClass = isActive ? (tier >= 3 ? 't3' : tier === 2 ? 't2' : tier === 1 ? 't1' : '') : ''
        const dimmed = activeKey !== null && !isActive
        return (
          <div key={zone.key} className="hold-zone-slot" style={zone.slotStyle}>
            <div
              className={`hold-zone ${tierClass} ${dimmed ? 'dimmed' : ''}`}
              style={{ '--zone-c': zone.color, animationDelay: `${i * 40}ms` } as CSSProperties}
            >
              <span className="hold-zone__emoji">{zone.emoji}</span>
              <span className="hold-zone__label">{zone.label}</span>
            </div>
          </div>
        )
      })}

      <p className="hold-menu__hint" style={{ bottom: holdSafeBottom(104) }}>
        Glisse vers une action, puis relâche
      </p>
    </div>
  )
}
