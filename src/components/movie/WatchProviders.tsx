import { useEffect, useState } from 'react'
import { tmdb } from '../../lib/tmdb'
import { useSettings, KINEPOLIS_CINEMAS } from '../../hooks/useSettings'
import type { WatchProviderCountry } from '../../lib/tmdb'

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w92'

interface Props {
  tmdbId: number
  releaseDate?: string
  isTv?: boolean
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

function getCinemaStatus(releaseDate?: string): 'in_theaters' | 'upcoming' | null {
  if (!releaseDate) return null
  const release = new Date(releaseDate)
  const now = new Date()
  const diffDays = Math.ceil((release.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays > 0 && diffDays <= 60) return 'upcoming'
  if (diffDays <= 0 && diffDays >= -60) return 'in_theaters'
  return null
}

function getCinemaUrl(slug: string): string {
  return `https://kinepolis.fr/cinemas/${slug}`
}

export function WatchProviders({ tmdbId, releaseDate, isTv }: Props) {
  const [providers, setProviders] = useState<WatchProviderCountry | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const { settings } = useSettings()

  useEffect(() => {
    setLoading(true)
    const fetchProviders = isTv ? tmdb.getTvWatchProviders(tmdbId) : tmdb.getWatchProviders(tmdbId)
    fetchProviders
      .then(data => setProviders(data.results?.FR ?? null))
      .catch(() => setProviders(null))
      .finally(() => setLoading(false))
  }, [tmdbId, isTv])

  if (loading) return null

  const cinemaStatus = getCinemaStatus(releaseDate)
  const selectedCinemas = KINEPOLIS_CINEMAS.filter(c => settings.cinemas.includes(c.slug))
  const showCinema = cinemaStatus && selectedCinemas.length > 0
  const hasProviders = providers && GROUPS.some(g => providers[g.key]?.length)
  const hasAny = hasProviders || showCinema

  const providerCount = hasProviders
    ? GROUPS.reduce((sum, g) => sum + (providers![g.key]?.length ?? 0), 0)
    : 0
  const count = providerCount + (showCinema ? selectedCinemas.length : 0)

  // Pick the main provider (first flatrate, then free, then rent, then buy)
  const mainProvider = providers?.flatrate?.[0] ?? providers?.free?.[0] ?? providers?.rent?.[0] ?? providers?.buy?.[0] ?? null
  const hasMore = count > 1

  if (!hasAny && !cinemaStatus) {
    return (
      <span className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] opacity-60">
        Non dispo en ligne
      </span>
    )
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors flex items-center gap-1"
      >
        {mainProvider ? (
          <>
            <img src={`${TMDB_IMAGE}${mainProvider.logo_path}`} alt={mainProvider.provider_name} className="w-4 h-4 rounded" />
            {hasMore && <span className="text-[10px]">...</span>}
          </>
        ) : showCinema ? (
          '🎟️ Cinéma'
        ) : (
          '📍 Où voir'
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md sm:mx-4 bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl border-t sm:border border-[var(--color-border)] max-h-[80dvh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm text-[var(--color-text)]">Où regarder</p>
                {hasAny ? (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white font-medium">
                    {count}
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">— indisponible</span>
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content — scrollable */}
            <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-3">
              {/* Cinema section */}
              {showCinema && (
                <div>
                  <p className="text-xs text-[var(--color-text-muted)] mb-1.5">
                    🎟️ {cinemaStatus === 'in_theaters' ? 'Au cinéma' : 'Prochainement au cinéma'}
                  </p>
                  <div className="space-y-2">
                    {selectedCinemas.map(cinema => (
                      <a
                        key={cinema.slug}
                        href={getCinemaUrl(cinema.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border)] px-3 py-2.5 hover:bg-[var(--color-border)] transition-colors group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#e30613] flex items-center justify-center flex-shrink-0">
                          <span className="text-white text-xs font-bold">K</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-[var(--color-text)] font-medium">
                            Kinepolis {cinema.name}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-muted)]">
                            {cinemaStatus === 'in_theaters'
                              ? 'En salle — voir les séances'
                              : `Sortie le ${formatDate(releaseDate!)}`}
                          </p>
                        </div>
                        <span className="text-xs text-[var(--color-accent)] group-hover:text-[var(--color-accent-hover)] font-medium flex-shrink-0">
                          Séances →
                        </span>
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Cinema hint */}
              {cinemaStatus && selectedCinemas.length === 0 && (
                <div className="bg-yellow-500/5 rounded-xl border border-yellow-500/20 px-3 py-2.5">
                  <p className="text-xs text-yellow-400">
                    🎟️ {cinemaStatus === 'in_theaters' ? 'Ce film est au cinéma !' : 'Ce film sort bientôt au cinéma'}
                  </p>
                  <p className="text-[10px] text-[var(--color-text-muted)] mt-0.5">
                    Ajoute tes cinés dans Paramètres pour voir les séances
                  </p>
                </div>
              )}

              {!hasProviders && !showCinema && !cinemaStatus ? (
                <div className="bg-[var(--color-surface-2)] rounded-xl border border-[var(--color-border)] p-4 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Non disponible en streaming en France
                  </p>
                </div>
              ) : (
                <>
                  {GROUPS.map(group => {
                    const list = providers?.[group.key]
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
                              className="flex items-center gap-2 bg-[var(--color-surface-2)] rounded-lg border border-[var(--color-border)] px-2.5 py-1.5"
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

                  {providers?.link && (
                    <a
                      href={providers.link}
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
      )}
    </>
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
