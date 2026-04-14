import { useEffect, useRef } from 'react'

interface Props {
  active: boolean
  tier: number   // 0-3
  angle: number  // degrees — direction of hot zone
  rgb: string    // "r, g, b" for color
}

interface Bolt {
  points: { x: number; y: number }[]
  width: number
  alpha: number
  birth: number
  lifespan: number
}

/** Midpoint displacement — generates jagged lightning path */
function subdivide(
  pts: { x: number; y: number }[],
  ax: number, ay: number,
  bx: number, by: number,
  disp: number,
  depth: number,
) {
  if (depth === 0 || disp < 2) {
    pts.push({ x: bx, y: by })
    return
  }
  const mx = (ax + bx) / 2 + (Math.random() - 0.5) * disp
  const my = (ay + by) / 2 + (Math.random() - 0.5) * disp
  subdivide(pts, ax, ay, mx, my, disp * 0.55, depth - 1)
  subdivide(pts, mx, my, bx, by, disp * 0.55, depth - 1)
}

/** Ray-arena intersection — find edge point for a given angle */
function edgePoint(angleDeg: number, w: number, h: number) {
  const rad = (angleDeg * Math.PI) / 180
  const dx = Math.cos(rad)
  const dy = Math.sin(rad)
  const cx = w / 2
  const cy = h / 2
  let t = Infinity
  if (dx > 0) t = Math.min(t, (w - cx) / dx)
  else if (dx < 0) t = Math.min(t, -cx / dx)
  if (dy > 0) t = Math.min(t, (h - cy) / dy)
  else if (dy < 0) t = Math.min(t, -cy / dy)
  return { x: cx + dx * t, y: cy + dy * t }
}

export function LightningCanvas({ active, tier, angle, rgb }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boltsRef = useRef<Bolt[]>([])
  const frameRef = useRef(0)
  const lastSpawnRef = useRef(0)

  useEffect(() => {
    if (!active || tier === 0) {
      boltsRef.current = []
      return
    }

    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const arena = canvas.parentElement
    if (!arena) return

    let running = true

    function animate(now: number) {
      if (!running || !canvas || !ctx || !arena) return

      const rect = arena.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      // Spawn rate & density per tier
      const spawnMs = tier === 1 ? 260 : tier === 2 ? 130 : 60
      const maxBolts = tier === 1 ? 3 : tier === 2 ? 8 : 15

      if (
        now - lastSpawnRef.current > spawnMs &&
        boltsRef.current.length < maxBolts
      ) {
        lastSpawnRef.current = now

        // Card center relative to arena
        const cardEl = arena.querySelector('.swipe-card') as HTMLElement | null
        let sx = rect.width / 2
        let sy = rect.height / 2

        if (cardEl) {
          const cr = cardEl.getBoundingClientRect()
          sx = cr.left - rect.left + cr.width / 2
          sy = cr.top - rect.top + cr.height / 2

          // Offset start to card edge + random jitter along perimeter
          const rad = (angle * Math.PI) / 180
          const perpX = -Math.sin(rad)
          const perpY = Math.cos(rad)
          const jitter =
            (Math.random() - 0.5) * Math.min(cr.width, cr.height) * 0.7
          sx += Math.cos(rad) * cr.width * 0.45 + perpX * jitter
          sy += Math.sin(rad) * cr.height * 0.45 + perpY * jitter
        }

        // Target: arena edge with some spread
        const edge = edgePoint(angle, rect.width, rect.height)
        const rad2 = (angle * Math.PI) / 180
        const spread = (Math.random() - 0.5) * 50
        const tx = edge.x + -Math.sin(rad2) * spread
        const ty = edge.y + Math.cos(rad2) * spread

        const dist = Math.hypot(tx - sx, ty - sy)
        const disp = dist * (0.2 + Math.random() * 0.15)
        const pts: { x: number; y: number }[] = [{ x: sx, y: sy }]
        subdivide(pts, sx, sy, tx, ty, disp, 5)

        boltsRef.current.push({
          points: pts,
          width: 1 + Math.random() * (tier >= 3 ? 2.5 : 1.5),
          alpha: 0.3 + Math.random() * 0.5,
          birth: now,
          lifespan: 120 + Math.random() * 220,
        })
      }

      // Draw & cull dead bolts
      ctx.clearRect(0, 0, rect.width, rect.height)

      boltsRef.current = boltsRef.current.filter((bolt) => {
        const age = now - bolt.birth
        if (age > bolt.lifespan) return false
        const fade = 1 - age / bolt.lifespan

        ctx.beginPath()
        ctx.moveTo(bolt.points[0].x, bolt.points[0].y)
        for (let i = 1; i < bolt.points.length; i++) {
          ctx.lineTo(bolt.points[i].x, bolt.points[i].y)
        }

        // Colored glow layer
        ctx.strokeStyle = `rgba(${rgb}, ${(bolt.alpha * fade * 0.6).toFixed(2)})`
        ctx.lineWidth = bolt.width * 2.5
        ctx.shadowColor = `rgba(${rgb}, ${(bolt.alpha * fade).toFixed(2)})`
        ctx.shadowBlur = 15
        ctx.stroke()

        // White-hot core
        ctx.shadowBlur = 0
        ctx.strokeStyle = `rgba(255,255,255,${(bolt.alpha * fade * 0.85).toFixed(2)})`
        ctx.lineWidth = bolt.width * 0.5
        ctx.stroke()

        return true
      })

      frameRef.current = requestAnimationFrame(animate)
    }

    frameRef.current = requestAnimationFrame(animate)
    return () => {
      running = false
      cancelAnimationFrame(frameRef.current)
    }
  }, [active, tier, angle, rgb])

  if (!active || tier === 0) return null

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
