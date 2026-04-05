import { useCallback, useSyncExternalStore } from 'react'

// Major French streaming platforms — TMDB provider IDs
export const STREAMING_PROVIDERS = [
  { id: 8, name: 'Netflix' },
  { id: 337, name: 'Disney+' },
  { id: 119, name: 'Amazon Prime Video' },
  { id: 381, name: 'Canal+' },
  { id: 350, name: 'Apple TV+' },
  { id: 56, name: 'OCS' },
  { id: 236, name: 'Crunchyroll' },
  { id: 1899, name: 'Max' },
  { id: 283, name: 'Paramount+' },
] as const

export type BattleColor = 'blue' | 'green' | 'purple' | 'pink' | 'orange'

// Kinepolis cinemas in France — slug used in kinepolis.fr URLs
export const KINEPOLIS_CINEMAS = [
  { slug: 'kinepolis-amneville', name: 'Amnéville' },
  { slug: 'kinepolis-belfort', name: 'Belfort' },
  { slug: 'kinepolis-bourgoin-jallieu', name: 'Bourgoin-Jallieu' },
  { slug: 'kinepolis-bretigny-sur-orge', name: 'Brétigny-sur-Orge' },
  { slug: 'kinepolis-beziers', name: 'Béziers' },
  { slug: 'kinepolis-fenouillet', name: 'Fenouillet' },
  { slug: 'kinepolis-lomme', name: 'Lomme' },
  { slug: 'kinepolis-longwy', name: 'Longwy' },
  { slug: 'kinepolis-metz', name: 'Metz' },
  { slug: 'kinepolis-mulhouse', name: 'Mulhouse' },
  { slug: 'kinepolis-nancy', name: 'Nancy' },
  { slug: 'kinepolis-nimes', name: 'Nîmes' },
  { slug: 'kinepolis-rouen', name: 'Rouen' },
  { slug: 'kinepolis-servon', name: 'Servon' },
  { slug: 'kinepolis-st-julien-les-metz', name: 'St-Julien-lès-Metz' },
  { slug: 'kinepolis-thionville', name: 'Thionville' },
  { slug: 'kinepolis-waves', name: 'Waves' },
] as const

export const BATTLE_COLORS: { id: BattleColor; label: string; gradient: string; glow: string }[] = [
  { id: 'blue', label: 'Bleu', gradient: 'linear-gradient(90deg, #1a6eff, #4dabff, #80cfff)', glow: '#4dabff88' },
  { id: 'green', label: 'Vert', gradient: 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)', glow: '#34d39988' },
  { id: 'purple', label: 'Violet', gradient: 'linear-gradient(90deg, #7c3aed, #a78bfa, #c4b5fd)', glow: '#a78bfa88' },
  { id: 'pink', label: 'Rose', gradient: 'linear-gradient(90deg, #ec4899, #f472b6, #fbcfe8)', glow: '#f472b688' },
  { id: 'orange', label: 'Orange', gradient: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)', glow: '#fb923c88' },
]

export interface Settings {
  // Streaming filters
  filterByStreaming: boolean
  enabledProviders: number[]
  hideRentals: boolean
  // Cinemas
  cinemas: string[] // Kinepolis slugs
  // Battle
  battleColor: BattleColor
}

const STORAGE_KEY = 'cine_settings'

const defaultSettings: Settings = {
  filterByStreaming: false,
  enabledProviders: [],
  hideRentals: false,
  cinemas: [],
  battleColor: 'blue',
}

// Cached snapshot — useSyncExternalStore requires referential stability
let cachedRaw: string | null = null
let cachedSettings: Settings = defaultSettings

function getSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === cachedRaw) return cachedSettings
    cachedRaw = raw
    cachedSettings = raw ? { ...defaultSettings, ...JSON.parse(raw) } : defaultSettings
    return cachedSettings
  } catch {
    return defaultSettings
  }
}

function saveSettings(settings: Settings) {
  const json = JSON.stringify(settings)
  cachedRaw = json
  cachedSettings = settings
  localStorage.setItem(STORAGE_KEY, json)
  window.dispatchEvent(new Event('cine-settings-change'))
}

// External store for useSyncExternalStore
const subscribe = (cb: () => void) => {
  window.addEventListener('cine-settings-change', cb)
  window.addEventListener('storage', cb)
  return () => {
    window.removeEventListener('cine-settings-change', cb)
    window.removeEventListener('storage', cb)
  }
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSettings, () => defaultSettings)

  const update = useCallback((patch: Partial<Settings>) => {
    const current = getSettings()
    saveSettings({ ...current, ...patch })
  }, [])

  const toggleProvider = useCallback((providerId: number) => {
    const current = getSettings()
    const enabled = current.enabledProviders.includes(providerId)
      ? current.enabledProviders.filter(id => id !== providerId)
      : [...current.enabledProviders, providerId]
    saveSettings({ ...current, enabledProviders: enabled })
  }, [])

  const toggleCinema = useCallback((slug: string) => {
    const current = getSettings()
    const cinemas = current.cinemas.includes(slug)
      ? current.cinemas.filter(s => s !== slug)
      : [...current.cinemas, slug]
    saveSettings({ ...current, cinemas })
  }, [])

  return { settings, update, toggleProvider, toggleCinema }
}

// Helper: get TMDB discover params for streaming filter
export function getStreamingDiscoverParams(settings: Settings): Record<string, string> {
  if (!settings.filterByStreaming || settings.enabledProviders.length === 0) return {}

  const params: Record<string, string> = {
    watch_region: 'FR',
    with_watch_providers: settings.enabledProviders.join('|'),
  }

  if (settings.hideRentals) {
    params.with_watch_monetization_types = 'flatrate|free'
  } else {
    params.with_watch_monetization_types = 'flatrate|free|rent|buy'
  }

  return params
}
