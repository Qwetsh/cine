import { useNavigate } from 'react-router-dom'
import { getPosterUrl } from '../lib/tmdb'

// TODO: Connecter useWatchlist(coupleId) une fois l'auth en place
const PLACEHOLDER_MOVIES = [
  { id: '1', title: 'Dune: Part Two', year: 2024, posterPath: null, addedBy: 'Toi', note: null },
  { id: '2', title: 'Poor Things', year: 2023, posterPath: null, addedBy: 'Partenaire', note: 'Yorgos Lanthimos !' },
]

export function WatchlistPage() {
  const navigate = useNavigate()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">À regarder ensemble</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {PLACEHOLDER_MOVIES.length} film{PLACEHOLDER_MOVIES.length > 1 ? 's' : ''} dans la liste
        </p>
      </div>

      {/* Bouton ajouter */}
      <div className="px-4 mb-4">
        <button
          onClick={() => navigate('/search')}
          className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          <span>+</span>
          Ajouter un film
        </button>
      </div>

      {/* Liste */}
      <ul className="px-4 space-y-3">
        {PLACEHOLDER_MOVIES.map(movie => (
          <li
            key={movie.id}
            className="bg-[var(--color-surface)] rounded-xl overflow-hidden border border-[var(--color-border)]"
          >
            <div className="flex gap-3 p-3">
              {/* Affiche miniature */}
              <div className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
                <img
                  src={getPosterUrl(movie.posterPath, 'small')}
                  alt={`Affiche ${movie.title}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)] leading-tight">
                  {movie.title}
                </p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">{movie.year}</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-2">
                  Ajouté par <span className="text-[var(--color-text)]">{movie.addedBy}</span>
                </p>
                {movie.note && (
                  <p className="text-[var(--color-text-muted)] text-xs mt-1 italic">
                    "{movie.note}"
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 justify-start">
                <button
                  className="text-[var(--color-text-muted)] hover:text-green-400 text-lg transition-colors"
                  title="Marquer comme vu"
                >
                  ✓
                </button>
                <button
                  className="text-[var(--color-text-muted)] hover:text-red-400 text-lg transition-colors"
                  title="Retirer de la liste"
                >
                  ✕
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {PLACEHOLDER_MOVIES.length === 0 && (
        <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
          <span className="text-5xl mb-4">📋</span>
          <p className="font-medium">Votre liste est vide</p>
          <p className="text-sm mt-1">Ajoutez des films que vous voulez voir ensemble</p>
          <button
            onClick={() => navigate('/search')}
            className="mt-4 bg-[var(--color-accent)] text-white px-6 py-2 rounded-xl text-sm"
          >
            Parcourir les films
          </button>
        </div>
      )}
    </div>
  )
}
