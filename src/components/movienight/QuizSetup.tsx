import { useState } from 'react'
import * as Slider from '@radix-ui/react-slider'
import { QUESTION_TYPE_META, ALL_QUESTION_TYPES } from '../../lib/quiz'
import type { QuestionType, Difficulty } from '../../lib/quiz'
import type { QuizDifficulty } from '../../lib/discover'

export interface QuizConfig {
  difficulty: QuizDifficulty
  yearMin: number
  yearMax: number
  enabledTypes: QuestionType[]
  count: number
}

const DIFFICULTY_OPTIONS: { id: QuizDifficulty; label: string; emoji: string; desc: string }[] = [
  { id: 'easy', label: 'Facile', emoji: '🟢', desc: 'Films populaires' },
  { id: 'normal', label: 'Normal', emoji: '🟡', desc: 'Mix varié' },
  { id: 'hard', label: 'Difficile', emoji: '🔴', desc: 'Films obscurs' },
]

const DURATION_OPTIONS = [
  { count: 5, label: 'Court', desc: '5 questions' },
  { count: 10, label: 'Moyen', desc: '10 questions' },
  { count: 20, label: 'Long', desc: '20 questions' },
]

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

const DIFFICULTY_GROUPS: { label: string; difficulty: Difficulty }[] = [
  { label: 'Facile', difficulty: 'easy' },
  { label: 'Moyen', difficulty: 'medium' },
  { label: 'Difficile', difficulty: 'hard' },
]

interface Props {
  onConfirm: (config: QuizConfig) => void | Promise<void>
  onCancel: () => void | Promise<void>
  confirmLabel?: string
}

export function QuizSetup({ onConfirm, onCancel, confirmLabel = 'Lancer le quiz' }: Props) {
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('normal')
  const [yearMin, setYearMin] = useState(1970)
  const [yearMax, setYearMax] = useState(CURRENT_YEAR)
  const [enabledTypes, setEnabledTypes] = useState<Set<QuestionType>>(new Set(ALL_QUESTION_TYPES))
  const [count, setCount] = useState(10)
  const [submitting, setSubmitting] = useState(false)

  function toggleType(type: QuestionType) {
    setEnabledTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        if (next.size <= 3) return prev // minimum 3 types
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }

  function toggleAll() {
    if (enabledTypes.size === ALL_QUESTION_TYPES.length) {
      // Deselect to minimum (keep first 3)
      setEnabledTypes(new Set(ALL_QUESTION_TYPES.slice(0, 3)))
    } else {
      setEnabledTypes(new Set(ALL_QUESTION_TYPES))
    }
  }

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    await onConfirm({
      difficulty,
      yearMin,
      yearMax,
      enabledTypes: [...enabledTypes],
      count,
    })
    setSubmitting(false)
  }

  const canConfirm = enabledTypes.size >= 3

  return (
    <div className="px-4 space-y-5 pb-4">
      {/* Difficulty */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2 font-medium">Difficulté des films</p>
        <div className="flex gap-2">
          {DIFFICULTY_OPTIONS.map(d => (
            <button
              key={d.id}
              onClick={() => setDifficulty(d.id)}
              className={[
                'flex-1 rounded-xl border p-2 text-center transition-all',
                difficulty === d.id
                  ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              <span className="text-lg block">{d.emoji}</span>
              <span className={`text-xs font-medium block ${difficulty === d.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
                {d.label}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] block">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Year range */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2 font-medium">Période</p>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3">
          <p className="text-center text-sm font-bold text-[var(--color-text)] mb-3">
            {yearMin} — {yearMax}
          </p>

          {/* Presets */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-3" style={{ WebkitOverflowScrolling: 'touch' }}>
            {YEAR_PRESETS.map(p => {
              const active = yearMin === p.range[0] && yearMax === p.range[1]
              return (
                <button
                  key={p.label}
                  onClick={() => { setYearMin(p.range[0]); setYearMax(p.range[1]) }}
                  className={[
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
                    active
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
                  ].join(' ')}
                >
                  {p.label}
                </button>
              )
            })}
          </div>

          {/* Dual-thumb slider */}
          <div className="px-1">
            <Slider.Root
              className="relative flex items-center select-none touch-none h-5 w-full"
              min={MIN_YEAR}
              max={CURRENT_YEAR}
              step={1}
              value={[yearMin, yearMax]}
              onValueChange={v => { setYearMin(v[0]); setYearMax(v[1]) }}
              minStepsBetweenThumbs={5}
            >
              <Slider.Track className="relative h-1 grow rounded-full bg-[var(--color-surface-2)]">
                <Slider.Range className="absolute h-full rounded-full bg-[var(--color-accent)]" />
              </Slider.Track>
              <Slider.Thumb className="block w-5 h-5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
              <Slider.Thumb className="block w-5 h-5 rounded-full bg-white shadow-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)]" />
            </Slider.Root>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-[var(--color-text-muted)]">{yearMin}</span>
              <span className="text-[10px] text-[var(--color-text-muted)]">{yearMax}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Question types */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs text-[var(--color-text-muted)] font-medium">Types de questions</p>
          <button
            onClick={toggleAll}
            className="text-[10px] text-[var(--color-accent)] hover:underline"
          >
            {enabledTypes.size === ALL_QUESTION_TYPES.length ? 'Tout décocher' : 'Tout cocher'}
          </button>
        </div>

        <div className="space-y-3">
          {DIFFICULTY_GROUPS.map(group => {
            const types = QUESTION_TYPE_META.filter(q => q.difficulty === group.difficulty)
            return (
              <div key={group.difficulty}>
                <p className="text-[10px] text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">
                  {group.label}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {types.map(qt => {
                    const active = enabledTypes.has(qt.id)
                    return (
                      <button
                        key={qt.id}
                        onClick={() => toggleType(qt.id)}
                        className={[
                          'px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all border',
                          active
                            ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]'
                            : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]',
                        ].join(' ')}
                      >
                        {qt.emoji} {qt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {enabledTypes.size < 3 && (
          <p className="text-[10px] text-red-400 mt-1">Minimum 3 types requis</p>
        )}
      </div>

      {/* Duration */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2 font-medium">Durée</p>
        <div className="flex gap-2">
          {DURATION_OPTIONS.map(d => (
            <button
              key={d.count}
              onClick={() => setCount(d.count)}
              className={[
                'flex-1 rounded-xl border p-2.5 text-center transition-all',
                count === d.count
                  ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              <span className={`text-sm font-medium block ${count === d.count ? 'text-[var(--color-accent)]' : 'text-[var(--color-text)]'}`}>
                {d.label}
              </span>
              <span className="text-[10px] text-[var(--color-text-muted)] block">{d.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Confirm */}
      <button
        onClick={handleConfirm}
        disabled={!canConfirm || submitting}
        className={[
          'w-full rounded-xl py-3 font-medium text-sm transition-colors',
          canConfirm && !submitting
            ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed',
        ].join(' ')}
      >
        {submitting ? 'Chargement…' : confirmLabel}
      </button>

      <button
        onClick={() => onCancel()}
        className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
      >
        Annuler
      </button>
    </div>
  )
}
