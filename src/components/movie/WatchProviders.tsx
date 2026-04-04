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
        <div className="h-5 w-32 bg-[var(--color-surface-2)] rounded animate-pulse mb-3" />
        <div className="flex gap-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-10 h-10 bg-[var(--color-surface-2)] rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const hasAny = providers && GROUPS.some(g => providers[g.key]?.length)

  return (
    <div className="mt-5">
      <h2 className="font-semibold text-[var(--color-text)] mb-3">Où regarder</h2>

      {!hasAny ? (
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 text-center">
          <p className="text-sm text-[var(--color-text-muted)]">
            Non disponible en streaming en France
          </p>
        </div>
      ) : (
        <div className="space-y-3">
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
        </div>
      )}

      <p className="text-[10px] text-[var(--color-text-muted)] mt-2 opacity-60">
        Données fournies par JustWatch
      </p>
    </div>
  )
}
