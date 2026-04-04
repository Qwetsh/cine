import { getPosterUrl } from '../../lib/tmdb'
import type { LobbyFilm } from '../../hooks/useLobby'

interface Props {
  film1: LobbyFilm
  film2: LobbyFilm
  partnerName: string
  onChooseMode: (mode: 'random' | 'battle') => void
  onCancel: () => void
}

export function LobbyReveal({ film1, film2, partnerName, onChooseMode, onCancel }: Props) {
  return (
    <div className="px-4 space-y-4">
      <div className="text-center">
        <p className="text-sm text-[var(--color-text-muted)]">Les deux films sont choisis !</p>
      </div>

      {/* Films face to face */}
      <div className="grid grid-cols-2 gap-4">
        <FilmCard film={film1} label="Toi" />
        <FilmCard film={film2} label={partnerName} />
      </div>

      <div className="text-center pt-2">
        <p className="text-sm font-medium text-[var(--color-text)] mb-4">
          Comment on départage ?
        </p>
        <div className="space-y-3">
          <button
            onClick={() => onChooseMode('random')}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
          >
            🎲 Le hasard décide
          </button>
          <button
            onClick={() => onChooseMode('battle')}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3.5 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            ⚔️ Bataille de rapidité
          </button>
        </div>
      </div>

      <button
        onClick={onCancel}
        className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
      >
        Annuler
      </button>
    </div>
  )
}

function FilmCard({ film, label }: { film: LobbyFilm; label: string }) {
  const year = film.release_date ? new Date(film.release_date).getFullYear() : null
  return (
    <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-3 text-center">
      <p className="text-xs text-[var(--color-text-muted)] mb-2">{label}</p>
      <div className="w-20 h-28 mx-auto rounded-lg overflow-hidden shadow-md mb-2">
        <img src={getPosterUrl(film.poster_path, 'small')} alt={film.title} className="w-full h-full object-cover" />
      </div>
      <p className="text-xs font-medium text-[var(--color-text)] leading-tight">{film.title}</p>
      {year && <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{year}</p>}
    </div>
  )
}
