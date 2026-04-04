import { useRef, useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import type { LocalFilters } from '../../hooks/useLocalFilter'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1920

const YEAR_PRESETS: { label: string; range: [number, number] }[] = [
  { label: '2020s', range: [2020, CURRENT_YEAR] },
  { label: '2010s', range: [2010, 2019] },
  { label: '2000s', range: [2000, 2009] },
  { label: '90s', range: [1990, 1999] },
  { label: '80s', range: [1980, 1989] },
  { label: 'Classiques', range: [MIN_YEAR, 1979] },
]

interface Props {
  filters: LocalFilters
  availableGenres: string[]
  activeCount: number
  onQueryChange: (query: string) => void
  onToggleGenre: (genre: string) => void
  onYearRangeChange: (range: [number, number] | null) => void
  onClearAll: () => void
}

export function CollectionFilterPanel({
  filters,
  availableGenres,
  activeCount,
  onQueryChange,
  onToggleGenre,
  onYearRangeChange,
  onClearAll,
}: Props) {
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const sliderValue: [number, number] = filters.yearRange ?? [MIN_YEAR, CURRENT_YEAR]

  const activePreset = filters.yearRange
    ? YEAR_PRESETS.find(p => p.range[0] === filters.yearRange![0] && p.range[1] === filters.yearRange![1])
    : null

  return (
    <div className="mx-4 mb-3">
      {/* Accordion trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-sm font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors py-1"
        aria-expanded={open}
      >
        <span>Filtrer</span>
        {activeCount > 0 && (
          <span className="bg-[var(--color-accent)] text-white text-[10px] rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1">
            {activeCount}
          </span>
        )}
        <span className={`text-xs transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* Accordion content */}
      {open && (
        <div className="mt-2 space-y-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
          {/* Search input */}
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-sm">
              🔍
            </span>
            <input
              ref={inputRef}
              type="search"
              value={filters.query}
              onChange={e => onQueryChange(e.target.value)}
              placeholder="Rechercher par titre…"
              className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] pl-9 pr-8 py-2 rounded-lg border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            />
            {filters.query && (
              <button
                onClick={() => { onQueryChange(''); inputRef.current?.focus() }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm"
              >
                ✕
              </button>
            )}
          </div>

          {/* Genre chips */}
          {availableGenres.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Genres</p>
              <div className="flex flex-wrap gap-1.5">
                {availableGenres.map(genre => {
                  const active = filters.genres.includes(genre)
                  return (
                    <button
                      key={genre}
                      onClick={() => onToggleGenre(genre)}
                      className={[
                        'px-2.5 py-1 rounded-full text-xs font-medium transition-colors',
                        active
                          ? 'bg-[var(--color-accent)] text-white'
                          : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                      ].join(' ')}
                    >
                      {genre}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Year filter */}
          <div>
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Année</p>
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-2" style={{ WebkitOverflowScrolling: 'touch' }}>
              {YEAR_PRESETS.map(p => (
                <button
                  key={p.label}
                  onClick={() => onYearRangeChange(activePreset?.label === p.label ? null : p.range)}
                  className={[
                    'flex-shrink-0 px-2.5 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                    activePreset?.label === p.label
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="px-1">
              <Slider.Root
                className="relative flex items-center select-none touch-none h-5 w-full"
                min={MIN_YEAR}
                max={CURRENT_YEAR}
                step={1}
                value={sliderValue}
                onValueChange={v => onYearRangeChange(v as [number, number])}
              >
                <Slider.Track className="relative h-1 grow rounded-full bg-[var(--color-surface-2)]">
                  <Slider.Range className="absolute h-full rounded-full bg-[var(--color-accent)]" />
                </Slider.Track>
                <Slider.Thumb className="block w-5 h-5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
                <Slider.Thumb className="block w-5 h-5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
              </Slider.Root>
              <div className="flex justify-between mt-1">
                <span className="text-[10px] text-[var(--color-text-muted)]">{sliderValue[0]}</span>
                <span className="text-[10px] text-[var(--color-text-muted)]">{sliderValue[1]}</span>
              </div>
            </div>
          </div>

          {/* Clear all */}
          {activeCount > 0 && (
            <button
              onClick={onClearAll}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Effacer les filtres
            </button>
          )}
        </div>
      )}
    </div>
  )
}
