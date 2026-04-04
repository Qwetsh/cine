import { COUNTRIES } from '../../lib/tmdb'

interface Props {
  selected: string | null
  onSelect: (code: string | null) => void
}

export function CountryChips({ selected, onSelect }: Props) {
  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-4 px-4" style={{ WebkitOverflowScrolling: 'touch' }}>
      <button
        onClick={() => onSelect(null)}
        className={[
          'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
          !selected
            ? 'bg-[var(--color-accent)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
        ].join(' ')}
      >
        Tous pays
      </button>
      {COUNTRIES.map(c => (
        <button
          key={c.code}
          onClick={() => onSelect(selected === c.code ? null : c.code)}
          className={[
            'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
            selected === c.code
              ? 'bg-[var(--color-accent)] text-white'
              : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          {c.name}
        </button>
      ))}
    </div>
  )
}
