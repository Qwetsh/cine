import { useEffect, useState } from 'react'
import { tmdb } from '../../lib/tmdb'
import { useSettings, KINEPOLIS_CINEMAS } from '../../hooks/useSettings'
import type { WatchProviderCountry } from '../../lib/tmdb'

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w92'

interface Props {
  tmdbId: number
  releaseDate?: string // ISO date string from movie data
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

export function WatchProviders({ tmdbId, releaseDate }: Props) {
  const [providers, setProviders] = useState<WatchProviderCountry | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const { settings } = useSettings()

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

  const cinemaStatus = getCinemaStatus(releaseDate)
  const selectedCinemas = KINEPOLIS_CINEMAS.filter(c => settings.cinemas.includes(c.slug))
  const showCinema = cinemaStatus && selectedCinemas.length > 0
  const hasProviders = providers && GROUPS.some(g => providers[g.key]?.length)
  const hasAny = hasProviders || showCinema

  // Count total providers for badge
  const providerCount = hasProviders
    ? GROUPS.reduce((sum, g) => sum + (providers![g.key]?.length ?? 0), 0)
    : 0
  const count = providerCount + (showCinema ? selectedCinemas.length : 0)

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
        style={{ maxHeight: open ? '800px' : '0px', opacity: open ? 1 : 0 }}
      >
        <div className="pt-3 space-y-3">
          {/* Cinema section — only if user has selected cinemas */}
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
                    className="flex items-center gap-3 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] px-3 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors group"
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

          {/* Cinema hint if no cinemas selected but movie is in theaters */}
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
            <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 text-center">
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
  )
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}
