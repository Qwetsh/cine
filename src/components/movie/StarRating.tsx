import { useCallback, useRef, useState } from 'react'

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
  max = 10,
  readOnly = false,
  size = 'md',
}: StarRatingProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [dragValue, setDragValue] = useState<number | null>(null)
  const draggingRef = useRef(false)

  const getStarFromX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    const x = clientX - rect.left
    const ratio = Math.max(0, Math.min(1, x / rect.width))
    return Math.ceil(ratio * max) || 1
  }, [max])

  function handleTouchStart(e: React.TouchEvent) {
    if (readOnly || !onChange) return
    draggingRef.current = true
    const star = getStarFromX(e.touches[0].clientX)
    if (star) setDragValue(star)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!draggingRef.current) return
    e.preventDefault()
    const star = getStarFromX(e.touches[0].clientX)
    if (star) setDragValue(star)
  }

  function handleTouchEnd() {
    if (!draggingRef.current) return
    draggingRef.current = false
    if (dragValue != null) {
      onChange?.(dragValue)
    }
    setDragValue(null)
  }

  const displayValue = dragValue ?? value

  return (
    <div
      ref={containerRef}
      className={`flex ${max > 5 ? 'gap-0.5' : 'gap-1'} select-none touch-none`}
      role={readOnly ? undefined : 'group'}
      aria-label="Note"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1
        const filled = displayValue !== null && starValue <= displayValue

        return (
          <button
            key={i}
            type="button"
            disabled={readOnly}
            onClick={() => onChange?.(starValue)}
            className={[
              SIZE_CLASSES[size],
              'leading-none transition-transform',
              readOnly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95',
              filled ? 'text-[var(--color-gold)]' : 'text-[var(--color-border)]',
            ].join(' ')}
            aria-label={`${starValue} étoile${starValue > 1 ? 's' : ''}`}
          >
            ★
          </button>
        )
      })}
    </div>
  )
}
