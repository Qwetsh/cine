import type { CSSProperties } from 'react'
import './hold.css'

interface Props {
  /** Durée de remplissage (ms) — celle de useLongPress */
  duration: number
  /** Rayon des coins, à faire correspondre au border-radius de la cible */
  radius?: number
}

/**
 * Liseré « red light » qui fait le tour de la cible pendant la charge
 * d'un appui long. À rendre dans un conteneur en position relative.
 */
export function HoldRing({ duration, radius = 8 }: Props) {
  // SVG2 : géométrie du rect pilotée en CSS pour pouvoir utiliser calc(100% - Npx)
  const rectStyle = {
    x: '1.5px',
    y: '1.5px',
    width: 'calc(100% - 3px)',
    height: 'calc(100% - 3px)',
    rx: `${radius}px`,
  } as CSSProperties

  return (
    <svg className="hold-ring" aria-hidden="true">
      <rect className="hold-ring__track" style={rectStyle} />
      <rect
        className="hold-ring__bar"
        style={{ ...rectStyle, animationDuration: `${duration}ms` }}
        pathLength={100}
        strokeDasharray={100}
        strokeDashoffset={100}
      />
    </svg>
  )
}
