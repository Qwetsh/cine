import { useState } from 'react'
import * as Slider from '@radix-ui/react-slider'

const CURRENT_YEAR = new Date().getFullYear()
const MIN_YEAR = 1920

const PRESETS: { label: string; range: [number, number] }[] = [
  { label: '2020s', range: [2020, CURRENT_YEAR] },
  { label: '2010s', range: [2010, 2019] },
  { label: '2000s', range: [2000, 2009] },
  { label: '90s', range: [1990, 1999] },
  { label: '80s', range: [1980, 1989] },
  { label: 'Classiques', range: [MIN_YEAR, 1979] },
]

interface Props {
  value: [number, number] | null
  onChange: (range: [number, number] | null) => void
}

export function YearFilter({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const sliderValue: [number, number] = value ?? [MIN_YEAR, CURRENT_YEAR]

  const activePreset = value
    ? PRESETS.find(p => p.range[0] === value[0] && p.range[1] === value[1])
    : null

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 text-xs font-medium text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        aria-expanded={open}
      >
        Année
        {value && (
          <span className="bg-[var(--color-accent)] text-white text-[10px] rounded-full min-w-[18px] h-[18px] inline-flex items-center justify-center px-1">
            1
          </span>
        )}
        <span className={`transition-transform ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {/* Presets */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide" style={{ WebkitOverflowScrolling: 'touch' }}>
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => onChange(activePreset?.label === p.label ? null : p.range)}
                className={[
                  'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                  activePreset?.label === p.label
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Slider */}
          <div className="px-1">
            <Slider.Root
              className="relative flex items-center select-none touch-none h-5 w-full"
              min={MIN_YEAR}
              max={CURRENT_YEAR}
              step={1}
              value={sliderValue}
              onValueChange={v => onChange(v as [number, number])}
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

          {/* Clear */}
          {value && (
            <button
              onClick={() => onChange(null)}
              className="text-xs text-[var(--color-accent)] hover:underline"
            >
              Effacer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
