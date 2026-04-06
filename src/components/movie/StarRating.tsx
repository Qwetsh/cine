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
      setCommittedValue(dragValue)
      onChange?.(dragValue)
    }
    setDragValue(null)
  }

  function handleStarClick(starIndex: number, e: React.MouseEvent) {
    if (readOnly || !onChange) return
    // Detect left/right half of the star
    const target = e.currentTarget as HTMLElement
    const rect = target.getBoundingClientRect()
    const x = e.clientX - rect.left
    const isLeftHalf = x < rect.width / 2
    const val = isLeftHalf ? starIndex + 0.5 : starIndex + 1
    setCommittedValue(val)
    onChange(val)
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
            onClick={(e) => handleStarClick(i, e)}
            className={[
              SIZE_CLASSES[size],
              'leading-none transition-transform relative',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95',
            ].join(' ')}
            aria-label={`${fullVal} étoile${fullVal > 1 ? 's' : ''}`}
          >
            {/* Empty star (background) */}
            <span className="text-[var(--color-border)]">★</span>
            {/* Half star overlay */}
            {isHalf && (
              <span
                className="absolute inset-0 overflow-hidden text-[var(--color-gold)]"
                style={{ width: '50%' }}
              >
                ★
              </span>
            )}
            {/* Full star overlay */}
            {isFull && (
              <span className="absolute inset-0 text-[var(--color-gold)]">★</span>
            )}
          </button>
        )
      })}
    </div>
  )
}
