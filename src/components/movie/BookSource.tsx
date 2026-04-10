import { useState } from 'react'
import type { TmdbKeyword } from '../../lib/tmdb'
import { useBookSource } from '../../hooks/useBookSource'

interface Props {
  tmdbId: number
  keywords?: { keywords: TmdbKeyword[] }
}

export function BookSource({ tmdbId, keywords }: Props) {
  const { bookSource, adaptationType, loading } = useBookSource(tmdbId, keywords)
  const [open, setOpen] = useState(false)

  if (loading) return null
  if (!adaptationType) return null

  const year = bookSource?.publicationDate
    ? new Date(bookSource.publicationDate).getFullYear()
    : null

  const audibleQuery = bookSource
    ? encodeURIComponent(`${bookSource.title ?? ''}${bookSource.author ? ' ' + bookSource.author : ''}`)
    : ''
  const audibleUrl = `https://www.audible.fr/search?keywords=${audibleQuery}`
  const kindleQuery = audibleQuery
  const amazonUrl = `https://www.amazon.fr/s?k=${kindleQuery}&i=digital-text`

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        📖 Roman
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md sm:mx-4 bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl border-t sm:border border-[var(--color-border)] animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <p className="font-semibold text-sm text-[var(--color-text)]">
                Adapté {adaptationType}
              </p>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            {!bookSource ? (
              <div className="px-4 pb-4">
                <p className="text-sm text-[var(--color-text-muted)]">
                  Aucune information disponible sur l'oeuvre source.
                </p>
              </div>
            ) : (
              <div className="flex items-start gap-3 px-4 pb-4">
                {bookSource.coverUrl ? (
                  <img
                    src={bookSource.coverUrl}
                    alt={bookSource.title ?? ''}
                    className="w-12 h-[4.5rem] rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="w-12 h-[4.5rem] rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-xl flex-shrink-0">
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
            )}
          </div>
        </div>
      )}
    </>
  )
}
