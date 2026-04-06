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

  // Clear committedValue once the prop catches up
  useEffect(() => {
    if (committedValue !== null && value === committedValue) {
      setCommittedValue(null)
    }
  }, [value, committedValue])

  const getStarFromX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    // Snap to nearest 0.5
    const raw = ratio * max
    return Math.max(0.5, Math.round(raw * 2) / 2)
  }, [max])

  function handleTouchStart(e: React.TouchEvent) {
    if (readOnly || !onChange) return
    e.stopPropagation()
    startYRef.current = e.touches[0].clientY
    lockedRef.current = null
    draggingRef.current = true
    // Don't set dragValue yet — wait for direction lock
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current) return
    e.stopPropagation()

    const dx = Math.abs(e.touches[0].clientX - (containerRef.current?.getBoundingClientRect().left ?? 0))
    const dy = Math.abs(e.touches[0].clientY - startYRef.current)

    // Lock direction after small movement
    if (!lockedRef.current) {
      if (dy > 8) {
        // Vertical scroll — abort star drag entirely
        lockedRef.current = 'vertical'
        draggingRef.current = false
        setDragValue(null)
        return
      }
      if (dx > 4) {
        lockedRef.current = 'horizontal'
      } else {
        return // Wait for enough movement to decide
      }
    }

    if (lockedRef.current !== 'horizontal') return

    e.preventDefault()
    const star = getStarFromX(e.touches[0].clientX)
    if (star) setDragValue(star)
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (!draggingRef.current) return
    e.stopPropagation()
    draggingRef.current = false
    lockedRef.current = null
    if (dragValue != null) {
      // Prevent the synthetic click that would overwrite the half-star
      e.preventDefault()
      setCommittedValue(dragValue)
      onChange?.(dragValue)
    }
    setDragValue(null)
  }

  // Show: drag in progress > committed waiting for prop > actual prop
  const displayValue = dragValue ?? committedValue ?? value

  return (
    <div
      ref={containerRef}
      className="flex gap-1 select-none touch-none"
      role={readOnly ? undefined : 'group'}
      aria-label="Note"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {Array.from({ length: max }).map((_, i) => {
        const fullVal = i + 1
        const halfVal = i + 0.5
        const isFull = displayValue !== null && displayValue >= fullVal
        const isHalf = !isFull && displayValue !== null && displayValue >= halfVal

        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => {
              const starValue = fullVal
              setCommittedValue(starValue)
              onChange?.(starValue)
            }}
            className={[
              SIZE_CLASSES[size],
              'leading-none transition-transform relative',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95',
              isFull ? 'text-[var(--color-gold)]' : 'text-[var(--color-border)]',
            ].join(' ')}
            aria-label={`${fullVal} étoile${fullVal > 1 ? 's' : ''}`}
          >
            ★
            {isHalf && (
              <span
                className="absolute inset-0 overflow-hidden text-[var(--color-gold)] pointer-events-none"
                style={{ width: '50%' }}
              >
                ★
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
