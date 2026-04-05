interface Props {
  current: number
  max: number
  label: string
  reverse?: boolean
}

export function TournamentHP({ current, max, label, reverse }: Props) {
  const hearts = Array.from({ length: max }, (_, i) => i < current)

  return (
    <div className={`flex flex-col items-center gap-0.5 ${reverse ? 'order-last' : ''}`}>
      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">{label}</span>
      <div className="flex gap-0.5">
        {hearts.map((filled, i) => (
          <span
            key={i}
            className={`text-sm transition-all duration-300 ${
              filled ? '' : 'opacity-25 grayscale'
            }`}
          >
            {filled ? '❤️' : '🖤'}
          </span>
        ))}
      </div>
    </div>
  )
}
