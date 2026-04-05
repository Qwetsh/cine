import { useEffect, useState } from 'react'
import { useSettings, STREAMING_PROVIDERS, BATTLE_COLORS, KINEPOLIS_CINEMAS } from '../../hooks/useSettings'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG = 'https://image.tmdb.org/t/p/w92'
const apiKey = import.meta.env.VITE_TMDB_API_KEY

interface ProviderLogo {
  provider_id: number
  logo_path: string
}

export function SettingsSection() {
  const { settings, update, toggleProvider, toggleCinema } = useSettings()
  const [logos, setLogos] = useState<Record<number, string>>({})

  // Fetch provider logos from TMDB
  useEffect(() => {
    if (!settings.filterByStreaming) return
    fetch(`${TMDB_BASE}/watch/providers/movie?api_key=${apiKey}&language=fr-FR&watch_region=FR`)
      .then(r => r.json())
      .then(data => {
        const map: Record<number, string> = {}
        for (const p of (data.results ?? []) as ProviderLogo[]) {
          map[p.provider_id] = p.logo_path
        }
        setLogos(map)
      })
      .catch(() => {})
  }, [settings.filterByStreaming])

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-[var(--color-text)]">Paramètres</h2>

      {/* Streaming filter */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0 pr-3">
            <p className="font-medium text-sm text-[var(--color-text)]">Filtrer par streaming</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Ne me proposer que des films dispos sur :
            </p>
          </div>
          <Toggle
            checked={settings.filterByStreaming}
            onChange={(v) => update({ filterByStreaming: v })}
          />
        </div>

        {settings.filterByStreaming && (
          <>
            <div className="space-y-2">
              {STREAMING_PROVIDERS.map(p => (
                <button
                  key={p.id}
                  onClick={() => toggleProvider(p.id)}
                  className={`flex items-center gap-3 w-full rounded-xl px-3 py-2.5 transition-colors border ${
                    settings.enabledProviders.includes(p.id)
                      ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                      : 'bg-[var(--color-surface-2)] border-transparent hover:border-[var(--color-border)]'
                  }`}
                >
                  {logos[p.id] ? (
                    <img
                      src={`${TMDB_IMG}${logos[p.id]}`}
                      alt={p.name}
                      className="w-8 h-8 rounded-lg"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                      {p.name.charAt(0)}
                    </div>
                  )}
                  <span className={`text-sm font-medium ${
                    settings.enabledProviders.includes(p.id)
                      ? 'text-[var(--color-text)]'
                      : 'text-[var(--color-text-muted)]'
                  }`}>
                    {p.name}
                  </span>
                  {settings.enabledProviders.includes(p.id) && (
                    <span className="ml-auto text-[var(--color-accent)] text-sm">✓</span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border)]">
              <div className="flex-1 min-w-0 pr-3">
                <p className="font-medium text-sm text-[var(--color-text)]">Masquer les locations</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Ne voir que ce qui est inclus dans l'abonnement
                </p>
              </div>
              <Toggle
                checked={settings.hideRentals}
                onChange={(v) => update({ hideRentals: v })}
              />
            </div>
          </>
        )}
      </div>

      {/* Mes cinés */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
        <div>
          <p className="font-medium text-sm text-[var(--color-text)]">🎟️ Mes cinés</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Sélectionne tes Kinepolis pour voir les films à l'affiche
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {KINEPOLIS_CINEMAS.map(c => {
            const selected = settings.cinemas.includes(c.slug)
            return (
              <button
                key={c.slug}
                onClick={() => toggleCinema(c.slug)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  selected
                    ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40 text-[var(--color-text)]'
                    : 'bg-[var(--color-surface-2)] border-transparent text-[var(--color-text-muted)] hover:border-[var(--color-border)]'
                }`}
              >
                {selected && <span className="mr-1">✓</span>}
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Home mode */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
        <div>
          <p className="font-medium text-sm text-[var(--color-text)]">Accueil</p>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Choisis ce qui s'affiche sur ta page d'accueil
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => update({ homeMode: 'trending' })}
            className={`flex-1 rounded-xl border p-3 text-center transition-colors ${
              settings.homeMode !== 'forYou'
                ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                : 'bg-[var(--color-surface-2)] border-transparent hover:border-[var(--color-border)]'
            }`}
          >
            <span className="text-lg block mb-1">🔥</span>
            <span className={`text-xs font-medium ${
              settings.homeMode !== 'forYou' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            }`}>
              Tendances
            </span>
          </button>
          <button
            onClick={() => update({ homeMode: 'forYou' })}
            className={`flex-1 rounded-xl border p-3 text-center transition-colors ${
              settings.homeMode === 'forYou'
                ? 'bg-[var(--color-accent)]/10 border-[var(--color-accent)]/40'
                : 'bg-[var(--color-surface-2)] border-transparent hover:border-[var(--color-border)]'
            }`}
          >
            <span className="text-lg block mb-1">✨</span>
            <span className={`text-xs font-medium ${
              settings.homeMode === 'forYou' ? 'text-[var(--color-text)]' : 'text-[var(--color-text-muted)]'
            }`}>
              Pour vous
            </span>
          </button>
        </div>
      </div>

      {/* Battle color */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-4 space-y-3">
        <p className="font-medium text-sm text-[var(--color-text)]">Couleur de combat</p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Ta couleur dans la barre d'énergie du duel
        </p>
        <div className="flex gap-2">
          {BATTLE_COLORS.map(c => (
            <button
              key={c.id}
              onClick={() => update({ battleColor: c.id })}
              className={`flex-1 h-10 rounded-xl border-2 transition-all ${
                settings.battleColor === c.id
                  ? 'border-white scale-105 shadow-lg'
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              style={{ background: c.gradient }}
              title={c.label}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
        checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-surface-2)]'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  )
}
