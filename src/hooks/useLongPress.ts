import { useCallback, useEffect, useRef, useState } from 'react'
import type * as React from 'react'

export interface UseLongPressOptions {
  /** Délai avant le démarrage du liseré (ms) */
  delay?: number
  /** Durée de remplissage du liseré (ms) */
  duration?: number
  /** Distance (px) au-delà de laquelle l'appui est annulé pendant la charge */
  moveThreshold?: number
  disabled?: boolean
  /** Appelé dès le pointerdown (utile pour précharger des données) */
  onPressStart?: () => void
  /** Le liseré a fait le tour : le geste est activé */
  onComplete: () => void
  /** Déplacement du doigt après activation, en px depuis le point d'appui */
  onMove?: (dx: number, dy: number) => void
  /** Relâchement après activation */
  onRelease?: (dx: number, dy: number) => void
  /** Geste interrompu par le navigateur après activation */
  onAbort?: () => void
}

type Phase = 'idle' | 'waiting' | 'charging' | 'active'

/**
 * Appui long avec liseré de charge : delay → charge (liseré visible) → activation.
 * Basé sur les Pointer Events + setPointerCapture (cf. SwipeCard), avec garde
 * anti-click fantôme après activation (cf. StarRating).
 *
 * Pendant la charge le scroll natif n'est pas bloqué : un déplacement > moveThreshold
 * ou un pointercancel (le navigateur prend la main pour scroller) annule l'appui.
 * Après activation, un listener touchmove non-passif bloque le scroll pour permettre
 * le glisser sans relâcher.
 */
export function useLongPress(options: UseLongPressOptions) {
  const { delay = 250, duration = 650, moveThreshold = 10, disabled = false } = options

  const [charging, setCharging] = useState(false)
  const phaseRef = useRef<Phase>('idle')
  const startRef = useRef({ x: 0, y: 0 })
  const pointerIdRef = useRef<number | null>(null)
  const delayTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const durationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const doneAtRef = useRef(0)
  const cbRef = useRef(options)
  useEffect(() => {
    cbRef.current = options
  })

  const preventTouchMove = useCallback((ev: TouchEvent) => {
    ev.preventDefault()
  }, [])

  const reset = useCallback(() => {
    clearTimeout(delayTimer.current)
    clearTimeout(durationTimer.current)
    document.removeEventListener('touchmove', preventTouchMove)
    phaseRef.current = 'idle'
    pointerIdRef.current = null
    setCharging(false)
  }, [preventTouchMove])

  // Nettoyage au démontage
  useEffect(() => reset, [reset])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    if (disabled || !e.isPrimary) return
    if (e.pointerType === 'mouse' && e.button !== 0) return
    phaseRef.current = 'waiting'
    pointerIdRef.current = e.pointerId
    startRef.current = { x: e.clientX, y: e.clientY }
    try {
      e.currentTarget.setPointerCapture(e.pointerId)
    } catch { /* pointeur déjà parti */ }
    cbRef.current.onPressStart?.()
    clearTimeout(delayTimer.current)
    delayTimer.current = setTimeout(() => {
      phaseRef.current = 'charging'
      setCharging(true)
      durationTimer.current = setTimeout(() => {
        phaseRef.current = 'active'
        setCharging(false)
        doneAtRef.current = Date.now()
        try { navigator.vibrate?.(35) } catch { /* non supporté */ }
        document.addEventListener('touchmove', preventTouchMove, { passive: false })
        cbRef.current.onComplete()
      }, duration)
    }, delay)
  }, [disabled, delay, duration, preventTouchMove])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    const phase = phaseRef.current
    if (phase === 'waiting' || phase === 'charging') {
      if (Math.hypot(dx, dy) > moveThreshold) reset()
    } else if (phase === 'active') {
      cbRef.current.onMove?.(dx, dy)
    }
  }, [moveThreshold, reset])

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    if (phaseRef.current === 'active') {
      doneAtRef.current = Date.now()
      cbRef.current.onRelease?.(e.clientX - startRef.current.x, e.clientY - startRef.current.y)
    }
    reset()
  }, [reset])

  const onPointerCancel = useCallback((e: React.PointerEvent) => {
    if (pointerIdRef.current !== e.pointerId) return
    if (phaseRef.current === 'active') cbRef.current.onAbort?.()
    reset()
  }, [reset])

  const onContextMenu = useCallback((e: React.MouseEvent) => {
    // Bloque le menu contextuel natif déclenché par l'appui long (Android),
    // mais laisse le clic droit desktop fonctionner au repos.
    if (phaseRef.current !== 'idle' || Date.now() - doneAtRef.current < 700) e.preventDefault()
  }, [])

  const onClickCapture = useCallback((e: React.MouseEvent) => {
    // Click fantôme émis après un appui long abouti : on l'étouffe.
    if (phaseRef.current === 'active' || Date.now() - doneAtRef.current < 600) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, [])

  const onDragStart = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  return {
    /** Le liseré est en train de se remplir */
    charging,
    /** Durée de remplissage à passer au HoldRing */
    ringDuration: duration,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onContextMenu, onClickCapture, onDragStart },
  }
}
