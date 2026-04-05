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
  return (
    <div className={`flex ${max > 5 ? 'gap-0.5' : 'gap-1'}`} role={readOnly ? undefined : 'group'} aria-label="Note">
      {Array.from({ length: max }).map((_, i) => {
        const starValue = i + 1
        const filled = value !== null && starValue <= value

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
