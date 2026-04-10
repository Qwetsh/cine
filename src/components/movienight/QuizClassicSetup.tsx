import { useRef, useState } from 'react'
import { tmdb, getPosterUrl, COUNTRIES } from '../../lib/tmdb'
import type { TmdbPerson } from '../../lib/tmdb'
import { DECADES } from '../../lib/discover'
import type { QuizDifficulty } from '../../lib/discover'

export type QuizTheme = 'actor' | 'director' | 'country' | 'decade' | 'general' | 'poster'

export const DIFFICULTY_OPTIONS: { id: QuizDifficulty; label: string; emoji: string; desc: string }[] = [
  { id: 'easy', label: 'Facile', emoji: '🟢', desc: 'Films populaires' },
  { id: 'normal', label: 'Normal', emoji: '🟡', desc: 'Mix varié' },
  { id: 'hard', label: 'Difficile', emoji: '🔴', desc: 'Films obscurs' },
]

export const DIFFICULTY_LABELS: Record<QuizDifficulty, string> = {
  easy: '🟢 Facile',
  normal: '🟡 Normal',
  hard: '🔴 Difficile',
}

export const THEME_LABELS: Record<QuizTheme, string> = {
  actor: '🎭 Acteur',
  director: '🎬 Réalisateur',
  country: '🌍 Pays',
  decade: '📅 Décennie',
  poster: '🖼️ Affiche floue',
  general: '🎲 Général',
}

interface Props {
  onSelectTheme: (theme: QuizTheme, value?: string, difficulty?: QuizDifficulty) => void | Promise<void>
  onCancel: () => void | Promise<void>
  confirmLabel?: string
}

export function ClassicSetup({ onSelectTheme, onCancel, confirmLabel = 'Proposer ce thème' }: Props) {
  const [theme, setTheme] = useState<QuizTheme | null>(null)
  const [themeValue, setThemeValue] = useState('')
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('normal')
  const [personQuery, setPersonQuery] = useState('')
  const [personResults, setPersonResults] = useState<TmdbPerson[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function handlePersonSearch(value: string) {
    setPersonQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setPersonResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await tmdb.searchPerson(value.trim())
        const dept = theme === 'actor' ? 'Acting' : 'Directing'
        setPersonResults(data.results.filter(p => p.known_for_department === dept).slice(0, 6))
      } catch { /* ignore */ }
      setSearching(false)
    }, 400)
  }

  function selectPerson(person: TmdbPerson) {
    setThemeValue(person.name)
    setPersonQuery('')
    setPersonResults([])
  }

  async function handleConfirmTheme() {
    if (!theme || submitting) return
    setSubmitting(true)
    await onSelectTheme(theme, themeValue || undefined, difficulty)
    setSubmitting(false)
  }

  const needsPersonSearch = theme === 'actor' || theme === 'director'
  const needsSelection = needsPersonSearch || theme === 'country' || theme === 'decade'
  const canConfirm = theme && (!needsSelection || themeValue)

  return (
    <div className="px-4 space-y-4">
      <div className="text-center">
        <span className="text-5xl block mb-2">🎯</span>
        <p className="text-[var(--color-text)] font-medium">Quiz Classique</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Choisissez un thème</p>
      </div>

      {/* Theme buttons */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(THEME_LABELS) as [QuizTheme, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTheme(key); setThemeValue('') }}
            className={[
              'rounded-xl border p-3 text-sm font-medium transition-all',
              theme === key
                ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Difficulty selector */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">Difficulté</p>
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

      {/* Person search (actor/director) */}
      {needsPersonSearch && (
        <div>
          {themeValue ? (
            <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-accent)] p-3">
              <span className="text-sm font-medium text-[var(--color-text)] flex-1">{themeValue}</span>
              <button
                onClick={() => setThemeValue('')}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={personQuery}
                onChange={e => handlePersonSearch(e.target.value)}
                placeholder={theme === 'actor' ? 'Rechercher un acteur…' : 'Rechercher un réalisateur…'}
                className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-2.5 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
                autoFocus
              />
              {searching && <p className="text-xs text-[var(--color-text-muted)] mt-2">Recherche…</p>}
              {personResults.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {personResults.map(p => (
                    <li key={p.id}>
                      <button
                        onClick={() => selectPerson(p)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-left"
                      >
                        <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
                          {p.profile_path ? (
                            <img src={getPosterUrl(p.profile_path, 'small')} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">?</div>
                          )}
                        </div>
                        <span className="text-sm text-[var(--color-text)]">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Country picker */}
      {theme === 'country' && (
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.slice(0, 12).map(c => (
            <button
              key={c.code}
              onClick={() => setThemeValue(c.code)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                themeValue === c.code
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Decade picker */}
      {theme === 'decade' && (
        <div className="flex gap-2">
          {DECADES.map(d => (
            <button
              key={d.label}
              onClick={() => setThemeValue(d.label)}
              className={[
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border',
                themeValue === d.label
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Confirm theme button */}
      <button
        onClick={handleConfirmTheme}
        disabled={!canConfirm || submitting}
        className={[
          'w-full rounded-xl py-3 font-medium text-sm transition-colors',
          canConfirm && !submitting
            ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed',
        ].join(' ')}
      >
        {submitting ? 'Envoi…' : confirmLabel}
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
