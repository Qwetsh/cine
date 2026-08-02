import type { CSSProperties } from 'react'

export type HoldZoneKey = 'reco' | 'col-solo' | 'col-couple' | 'wl-couple' | 'wl-solo'

export interface HoldZone {
  key: HoldZoneKey
  /** Angle de glissement en degrés (atan2, y vers le bas) */
  angle: number
  emoji: string
  label: string
  /** Couleur de zone "r,g,b" (palette SwipeCard) */
  color: string
  slotStyle: CSSProperties
}

/** Distance de glissement (px) à partir de laquelle relâcher valide l'action */
export const HOLD_ZONE_THRESHOLD = 90
/** Tolérance angulaire (deg) pour cibler une zone */
export const HOLD_ZONE_ANGLE_TOLERANCE = 32

const safeTop = (px: number) => `calc(env(safe-area-inset-top, 0px) + ${px}px)`
export const holdSafeBottom = (px: number) => `calc(env(safe-area-inset-bottom, 0px) + ${px}px)`

/** Les 5 zones : coins + haut, disposition demandée par Thomas */
export const HOLD_ZONES: HoldZone[] = [
  { key: 'reco', angle: -90, emoji: '💌', label: 'Recommander à un ami', color: '244,63,94', slotStyle: { top: safeTop(14), left: '50%', transform: 'translateX(-50%)' } },
  { key: 'col-solo', angle: -45, emoji: '🎬', label: 'Collection solo', color: '16,185,129', slotStyle: { top: safeTop(76), right: '12px' } },
  { key: 'col-couple', angle: 45, emoji: '👫', label: 'Collection couple', color: '245,158,11', slotStyle: { bottom: holdSafeBottom(18), right: '12px' } },
  { key: 'wl-couple', angle: -135, emoji: '💑', label: 'À voir couple', color: '139,92,246', slotStyle: { top: safeTop(76), left: '12px' } },
  { key: 'wl-solo', angle: 135, emoji: '👁️', label: 'À voir solo', color: '6,182,212', slotStyle: { bottom: holdSafeBottom(18), left: '12px' } },
]

/** Zone visée par le vecteur de glissement, ou null hors tolérance */
export function zoneForDrag(dx: number, dy: number, zones: HoldZone[]): { zone: HoldZone; progress: number } | null {
  const dist = Math.hypot(dx, dy)
  if (dist < 30) return null
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  let best: { zone: HoldZone; diff: number } | null = null
  for (const z of zones) {
    let diff = Math.abs(angle - z.angle)
    if (diff > 180) diff = 360 - diff
    if (diff <= HOLD_ZONE_ANGLE_TOLERANCE && (!best || diff < best.diff)) {
      best = { zone: z, diff }
    }
  }
  if (!best) return null
  return { zone: best.zone, progress: dist / HOLD_ZONE_THRESHOLD }
}
