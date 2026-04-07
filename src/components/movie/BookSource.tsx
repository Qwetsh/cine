import type { TmdbKeyword } from '../../lib/tmdb'
import { useBookSource } from '../../hooks/useBookSource'

interface Props {
  tmdbId: number
  keywords?: { keywords: TmdbKeyword[] }
}

export function BookSource({ tmdbId, keywords }: Props) {
  const { bookSource, adaptationType, loading } = useBookSource(tmdbId, keywords)

  if (loading) {
    return (
      <div className="mt-4">
        <div className="h-16 bg-[var(--color-surface-2)] rounded-xl animate-pulse" />
      </div>
    )
  }

  // Pas d'adaptation détectée
  if (!adaptationType) return null

  // Adaptation détectée mais pas de données Wikidata → badge simple
  if (!bookSource) {
    return (
      <div className="mt-4">
        <div className="inline-flex items-center gap-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] px-4 py-2.5">
          <span className="text-base">📖</span>
          <span className="text-sm text-[var(--color-text-muted)]">
            Adapté d'un {adaptationType}
          </span>
        </div>
      </div>
    )
  }

  // Données complètes
  const year = bookSource.publicationDate
    ? new Date(bookSource.publicationDate).getFullYear()
    : null

  return (
    <div className="mt-4">
      <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
        <p className="text-xs text-[var(--color-text-muted)] mb-2">Adapté d'un {adaptationType}</p>
        <div className="flex items-start gap-3">
          <div className="w-10 h-14 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-xl flex-shrink-0">
            📖
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text)] text-sm leading-tight">
              {bookSource.title}
            </p>
            {bookSource.author && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {bookSource.author}
              </p>
            )}
            {year && (
              <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                {year}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
