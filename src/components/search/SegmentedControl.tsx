import type { SearchMode } from '../../lib/tmdb'

const MODES: { value: SearchMode; label: string }[] = [
  { value: 'title', label: 'Titre' },
  { value: 'actor', label: 'Acteur' },
  { value: 'director', label: 'Réalisateur' },
]

interface Props {
  value: SearchMode
  onChange: (mode: SearchMode) => void
}

export function SegmentedControl({ value, onChange }: Props) {
  return (
    <div className="flex rounded-xl bg-[var(--color-surface-2)] p-1" role="radiogroup">
      {MODES.map(m => (
        <button
          key={m.value}
          role="radio"
          aria-checked={value === m.value}
          onClick={() => onChange(m.value)}
          className={[
            'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
            value === m.value
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
