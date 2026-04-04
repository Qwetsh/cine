import { useState } from 'react'
import { getPosterUrl } from '../lib/tmdb'
import { StarRating } from '../components/movie/StarRating'

type SortKey = 'date' | 'rating' | 'title'

// TODO: Connecter useCollection(coupleId) une fois l'auth en place
const PLACEHOLDER_ENTRIES = [
  {
    id: '1',
    title: 'Oppenheimer',
    year: 2023,
    posterPath: null,
    watchedAt: '2024-01-15',
    rating_user1: 5,
    rating_user2: 4,
    note_user1: 'Chef-d\'œuvre absolu.',
    note_user2: 'Un peu long mais incroyable.',
  },
  {
    id: '2',
    title: 'Barbie',
    year: 2023,
    posterPath: null,
    watchedAt: '2023-08-20',
    rating_user1: 4,
    rating_user2: 5,
    note_user1: 'Surpris en bien !',
    note_user2: 'Greta Gerwig est géniale.',
  },
]

export function CollectionPage() {
  const [sort, setSort] = useState<SortKey>('date')

  const sorted = [...PLACEHOLDER_ENTRIES].sort((a, b) => {
    if (sort === 'date') return b.watchedAt.localeCompare(a.watchedAt)
    if (sort === 'title') return a.title.localeCompare(b.title)
    if (sort === 'rating') {
      const avgA = ((a.rating_user1 ?? 0) + (a.rating_user2 ?? 0)) / 2
      const avgB = ((b.rating_user1 ?? 0) + (b.rating_user2 ?? 0)) / 2
      return avgB - avgA
    }
    return 0
  })

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Notre collection</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {PLACEHOLDER_ENTRIES.length} film{PLACEHOLDER_ENTRIES.length > 1 ? 's' : ''} regardés ensemble
        </p>
      </div>

      {/* Tri */}
      <div className="flex gap-2 px-4 mb-4">
        {(['date', 'rating', 'title'] as SortKey[]).map(key => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              sort === key
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]',
            ].join(' ')}
          >
            {key === 'date' ? 'Date' : key === 'rating' ? 'Note' : 'Titre'}
          </button>
        ))}
      </div>

      {/* Liste */}
      <ul className="px-4 space-y-4">
        {sorted.map(entry => (
          <li
            key={entry.id}
            className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden"
          >
            <div className="flex gap-3 p-3">
              {/* Affiche */}
              <div className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
                <img
                  src={getPosterUrl(entry.posterPath, 'small')}
                  alt={`Affiche ${entry.title}`}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Infos */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)]">{entry.title}</p>
                <p className="text-[var(--color-text-muted)] text-xs">{entry.year}</p>
                <p className="text-[var(--color-text-muted)] text-xs mt-1">
                  Vu le {new Date(entry.watchedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                </p>

                {/* Notes */}
                <div className="mt-3 space-y-2">
                  <div>
                    <p className="text-[var(--color-text-muted)] text-xs mb-1">Toi</p>
                    <StarRating value={entry.rating_user1} readOnly size="sm" />
                    {entry.note_user1 && (
                      <p className="text-[var(--color-text-muted)] text-xs italic mt-1">
                        "{entry.note_user1}"
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[var(--color-text-muted)] text-xs mb-1">Partenaire</p>
                    <StarRating value={entry.rating_user2} readOnly size="sm" />
                    {entry.note_user2 && (
                      <p className="text-[var(--color-text-muted)] text-xs italic mt-1">
                        "{entry.note_user2}"
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
