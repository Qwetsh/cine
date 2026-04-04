import { useEffect, useState } from 'react'
import { tmdb } from '../../lib/tmdb'
import type { WatchProviderCountry } from '../../lib/tmdb'

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w92'

interface Props {
  tmdbId: number
}

interface ProviderGroup {
  label: string
  key: keyof Pick<WatchProviderCountry, 'flatrate' | 'free' | 'rent' | 'buy'>
  emoji: string
}

const GROUPS: ProviderGroup[] = [
  { label: 'Abonnement', key: 'flatrate', emoji: '📺' },
  { label: 'Gratuit', key: 'free', emoji: '🆓' },
  { label: 'Location', key: 'rent', emoji: '🎬' },
  { label: 'Achat', key: 'buy', emoji: '💰' },
]

export function WatchProviders({ tmdbId }: Props) {
  const [providers, setProviders] = useState<WatchProviderCountry | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    tmdb.getWatchProviders(tmdbId)
      .then(data => setProviders(data.results?.FR ?? null))
      .catch(() => setProviders(null))
      .finally(() => setLoading(false))
  }, [tmdbId])

  if (loading) {
    return (
      <div className="mt-5">
        <div className="h-11 bg-[var(--color-surface)] rounded-xl animate-pulse border border-[var(--color-border)]" />
      </div>
    )
  }

  const hasAny = providers && GROUPS.some(g => providers[g.key]?.length)

  // Count total providers for badge
  const count = hasAny
    ? GROUPS.reduce((sum, g) => sum + (providers![g.key]?.length ?? 0), 0)
    : 0

  return (
    <div className="mt-5">
      {/* Accordion trigger */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] px-4 py-3 transition-colors hover:bg-[var(--color-surface-2)]"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm text-[var(--color-text)]">Où regarder</span>
          {hasAny ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white font-medium">
              {count}
            </span>
          ) : (
            <span className="text-xs text-[var(--color-text-muted)]">— indisponible</span>
          )}
        </div>
        <span className={`text-[var(--color-text-muted)] text-sm transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          ▾
        </span>
      </button>

      {/* Accordion content */}
      <div
        className="overflow-hidden transition-all duration-200 ease-out"
        style={{ maxHeight: open ? '500px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="pt-3 space-y-3">
          {!hasAny ? (
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 text-center">
              <p className="text-sm text-[var(--color-text-muted)]">
                Non disponible en streaming en France
              </p>
            </div>
          ) : (
            <>
              {GROUPS.map(group => {
                const list = providers![group.key]
                if (!list?.length) return null
                return (
                  <div key={group.key}>
                    <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
                      {group.emoji} {group.label}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {list.map(p => (
                        <div
                          key={p.provider_id}
                          className="flex items-center gap-2 bg-[var(--color-surface)] rounded-lg border border-[var(--color-border)] px-2.5 py-1.5"
                        >
                          <img
                            src={`${TMDB_IMAGE}${p.logo_path}`}
                            alt={p.provider_name}
                            className="w-6 h-6 rounded"
                          />
                          <span className="text-xs text-[var(--color-text)]">{p.provider_name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}

              {providers!.link && (
                <a
                  href={providers!.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] underline mt-1"
                >
                  Voir sur JustWatch →
                </a>
              )}
            </>
          )}

          <p className="text-[10px] text-[var(--color-text-muted)] opacity-60">
            Données fournies par JustWatch
          </p>
        </div>
      </div>
    </div>
  )
}
