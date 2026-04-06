import { useCallback, useEffect, useRef, useState } from 'react'

interface StarRatingProps {
  value: number | null
  onChange?: (rating: number) => void
  max?: number
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'text-base',
  md: 'text-xl',
  lg: 'text-2xl',
}

export function StarRating({
  value,
  onChange,
  max = 5,
  readOnly = false,
  size = 'md',
}: StarRatingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const [committedValue, setCommittedValue] = useState<number | null>(null)
  const draggingRef = useRef(false)
  const startYRef = useRef(0)
  const lockedRef = useRef<'horizontal' | 'vertical' | null>(null)
  const touchHandledRef = useRef(false)

  useEffect(() => {
    if (committedValue !== null && value === committedValue) {
      setCommittedValue(null)
    }
  }, [value, committedValue])

  const getValueFromX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    const raw = ratio * max
    return Math.max(0.5, Math.round(raw * 2) / 2)
  }, [max])

  function handleTouchStart(e: React.TouchEvent) {
    if (readOnly || !onChange) return
    e.stopPropagation()
    startYRef.current = e.touches[0].clientY
    lockedRef.current = null
    draggingRef.current = true
    touchHandledRef.current = false
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current) return
    e.stopPropagation()

    const dx = Math.abs(e.touches[0].clientX - (containerRef.current?.getBoundingClientRect().left ?? 0))
    const dy = Math.abs(e.touches[0].clientY - startYRef.current)

    if (!lockedRef.current) {
      if (dy > 8) {
        lockedRef.current = 'vertical'
        draggingRef.current = false
        setDragValue(null)
        return
      }
      if (dx > 4) {
        lockedRef.current = 'horizontal'
      } else {
        return
      }
    }

    if (lockedRef.current !== 'horizontal') return

    e.preventDefault()
    const val = getValueFromX(e.touches[0].clientX)
    if (val) setDragValue(val)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!draggingRef.current) return
    e.stopPropagation()
    draggingRef.current = false
    lockedRef.current = null

    if (dragValue != null) {
      touchHandledRef.current = true
      setCommittedValue(dragValue)
      onChange?.(dragValue)
    } else {
      // Simple tap — let click handle it with half-star detection
      const val = getValueFromX(e.changedTouches[0].clientX)
      if (val) {
        touchHandledRef.current = true
        setCommittedValue(val)
        onChange?.(val)
      }
    }
    setDragValue(null)
  }

  function handleClick(e: React.MouseEvent) {
    if (readOnly || !onChange) return
    // Skip if touch already handled this interaction
    if (touchHandledRef.current) {
      touchHandledRef.current = false
      return
    }
    const val = getValueFromX(e.clientX)
    if (val) {
      setCommittedValue(val)
      onChange(val)
    }
  }

  const displayValue = dragValue ?? committedValue ?? value

  return (
    <div
      ref={containerRef}
      className="flex gap-0.5 select-none touch-none"
      role={readOnly ? undefined : 'group'}
      aria-label="Note"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleClick}
    >
      {Array.from({ length: max }).map((_, i) => {
        const fullVal = i + 1
        const halfVal = i + 0.5
        const isFull = displayValue !== null && displayValue >= fullVal
        const isHalf = !isFull && displayValue !== null && displayValue >= halfVal

        return (
          <span
            key={i}
            className={[
              SIZE_CLASSES[size],
              'leading-none transition-transform relative',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95',
            ].join(' ')}
            aria-label={`${fullVal} étoile${fullVal > 1 ? 's' : ''}`}
          >
            <span className="text-[var(--color-border)]">★</span>
            <span
              className="absolute inset-0 overflow-hidden text-[var(--color-gold)]"
              style={{ width: isHalf ? '50%' : isFull ? '100%' : '0%' }}
            >
              ★
            </span>
          </span>
        )
      })}
    </div>
  )
}
