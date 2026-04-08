import type { TmdbKeyword } from '../../lib/tmdb'
import { useBookSource } from '../../hooks/useBookSource'
import { AccordionSection } from './AccordionSection'

interface Props {
  tmdbId: number
  keywords?: { keywords: TmdbKeyword[] }
}

export function BookSource({ tmdbId, keywords }: Props) {
  const { bookSource, adaptationType, loading } = useBookSource(tmdbId, keywords)

  if (loading) {
    return (
      <div className="mt-4">
        <div className="h-16 bg-[var(--color-surface-2)] rounded-2xl animate-pulse" />
      </div>
    )
  }

  // Pas d'adaptation détectée
  if (!adaptationType) return null

  // Adaptation détectée mais pas de données Wikidata → badge simple
  if (!bookSource) {
    return (
      <AccordionSection icon="📖" title={`Adapté ${adaptationType}`}>
        <div className="px-4 py-3">
          <p className="text-sm text-[var(--color-text-muted)]">
            Aucune information disponible sur l'oeuvre source.
          </p>
        </div>
      </AccordionSection>
    )
  }

  // Données complètes
  const year = bookSource.publicationDate
    ? new Date(bookSource.publicationDate).getFullYear()
    : null

  const audibleQuery = encodeURIComponent(
    `${bookSource.title ?? ''}${bookSource.author ? ' ' + bookSource.author : ''}`
  )
  const audibleUrl = `https://www.audible.fr/search?keywords=${audibleQuery}`
  const kindleQuery = encodeURIComponent(
    `${bookSource.title ?? ''}${bookSource.author ? ' ' + bookSource.author : ''}`
  )
  const amazonUrl = `https://www.amazon.fr/s?k=${kindleQuery}&i=digital-text`

  return (
    <AccordionSection icon="📖" title={`Adapté ${adaptationType}`}>
      <div className="flex items-start gap-3 p-4">
        {bookSource.coverUrl ? (
          <img
            src={bookSource.coverUrl}
            alt={bookSource.title ?? ''}
            className="w-10 h-14 rounded-lg object-cover flex-shrink-0"
          />
        ) : (
          <div className="w-10 h-14 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-xl flex-shrink-0">
            📖
          </div>
        )}
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
          <div className="flex flex-wrap gap-1.5 mt-2">
            <a
              href={amazonUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              📱 Kindle
            </a>
            <a
              href={audibleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              🎧 Audiobook
            </a>
          </div>
        </div>
      </div>
    </AccordionSection>
  )
}
