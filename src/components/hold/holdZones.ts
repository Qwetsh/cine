export type HoldZoneKey = 'reco' | 'col-solo' | 'col-couple' | 'wl-couple' | 'wl-solo'

export interface HoldZone {
  key: HoldZoneKey
  /** Angle de placement en degrés autour du point d'appui (atan2, y vers le bas) */
  angle: number
  label: string
}

export interface PlacedZone extends HoldZone {
  /** Centre de la bulle (coordonnées viewport) */
  x: number
  y: number
}

/** Rayon du cercle de bulles autour du point d'appui */
export const HOLD_MENU_RADIUS = 118
/** Distance doigt→bulle en dessous de laquelle relâcher valide l'action */
export const HOLD_SELECT_RADIUS = 55

export const holdSafeBottom = (px: number) => `calc(env(safe-area-inset-bottom, 0px) + ${px}px)`

/** Les 5 zones : haut + coins, disposition demandée par Thomas */
export const HOLD_ZONES: HoldZone[] = [
  { key: 'reco', angle: -90, label: 'Recommander' },
  { key: 'col-solo', angle: -40, label: 'Collection solo' },
  { key: 'col-couple', angle: 40, label: 'Collection couple' },
  { key: 'wl-couple', angle: -140, label: 'À voir couple' },
  { key: 'wl-solo', angle: 140, label: 'À voir solo' },
]

/**
 * Place les bulles en cercle autour du point d'appui. Si l'appui est trop
 * près d'un bord, le centre du cercle est ramené vers l'intérieur pour que
 * toutes les bulles restent visibles et atteignables.
 */
export function placeZones(
  zones: HoldZone[],
  origin: { x: number; y: number },
  viewport: { width: number; height: number },
): PlacedZone[] {
  // Marges : demi-bulle horizontale, et de quoi ne pas passer sous les
  // barres système en haut/bas
  const mx = 74
  const mTop = 96
  const mBottom = 110
  const cx = Math.min(Math.max(origin.x, HOLD_MENU_RADIUS + mx), viewport.width - HOLD_MENU_RADIUS - mx)
  const cy = Math.min(Math.max(origin.y, HOLD_MENU_RADIUS + mTop), viewport.height - HOLD_MENU_RADIUS - mBottom)

  return zones.map(zone => {
    const rad = (zone.angle * Math.PI) / 180
    return {
      ...zone,
      x: cx + Math.cos(rad) * HOLD_MENU_RADIUS,
      y: cy + Math.sin(rad) * HOLD_MENU_RADIUS,
    }
  })
}

/** Bulle la plus proche du doigt, ou null si aucune à portée de sélection */
export function zoneAtPoint(
  placed: PlacedZone[],
  x: number,
  y: number,
): { zone: PlacedZone; dist: number } | null {
  let best: { zone: PlacedZone; dist: number } | null = null
  for (const zone of placed) {
    const dist = Math.hypot(x - zone.x, y - zone.y)
    if (dist <= HOLD_SELECT_RADIUS && (!best || dist < best.dist)) {
      best = { zone, dist }
    }
  }
  return best
}

/** Tier de proximité (1-3) pour le retour visuel pendant le survol */
export function tierForDist(dist: number): 1 | 2 | 3 {
  if (dist <= 28) return 3
  if (dist <= 42) return 2
  return 1
}
