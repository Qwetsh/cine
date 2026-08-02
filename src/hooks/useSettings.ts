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

// Kinepolis cinemas in France — slug historique (clé stockée dans les settings),
// complex = code utilisé par kinepolis.fr et son API de programmation
export const KINEPOLIS_CINEMAS = [
  { slug: 'kinepolis-amneville', name: 'Amnéville', complex: 'FRAMN' },
  { slug: 'kinepolis-belfort', name: 'Belfort', complex: 'FRBLF' },
  { slug: 'kinepolis-bourgoin-jallieu', name: 'Bourgoin-Jallieu', complex: 'KBOUR' },
  { slug: 'kinepolis-bretigny-sur-orge', name: 'Brétigny-sur-Orge', complex: 'BRETI' },
  { slug: 'kinepolis-beziers', name: 'Béziers', complex: 'FRBEZ' },
  { slug: 'kinepolis-fenouillet', name: 'Fenouillet', complex: 'KFEN' },
  { slug: 'kinepolis-lomme', name: 'Lomme', complex: 'KLOM' },
  { slug: 'kinepolis-longwy', name: 'Longwy', complex: 'ULONG' },
  { slug: 'kinepolis-metz', name: 'Metz — AMPHI Quartier Muse', complex: 'MTZAM' },
  { slug: 'kinepolis-mulhouse', name: 'Mulhouse', complex: 'KMUL' },
  { slug: 'kinepolis-nancy', name: 'Nancy', complex: 'KNCY' },
  { slug: 'kinepolis-nimes', name: 'Nîmes', complex: 'KNIM' },
  { slug: 'kinepolis-rouen', name: 'Rouen', complex: 'KROU' },
  { slug: 'kinepolis-servon', name: 'Servon', complex: 'KSERV' },
  { slug: 'kinepolis-st-julien-les-metz', name: 'St-Julien-lès-Metz', complex: 'KMETZ' },
  { slug: 'kinepolis-thionville', name: 'Thionville', complex: 'KTHIO' },
  { slug: 'kinepolis-waves', name: 'Waves', complex: 'WAVES' },
] as const

export const BATTLE_COLORS: { id: BattleColor; label: string; gradient: string; glow: string }[] = [
  { id: 'blue', label: 'Bleu', gradient: 'linear-gradient(90deg, #1a6eff, #4dabff, #80cfff)', glow: '#4dabff88' },
  { id: 'green', label: 'Vert', gradient: 'linear-gradient(90deg, #10b981, #34d399, #6ee7b7)', glow: '#34d39988' },
  { id: 'purple', label: 'Violet', gradient: 'linear-gradient(90deg, #7c3aed, #a78bfa, #c4b5fd)', glow: '#a78bfa88' },
  { id: 'pink', label: 'Rose', gradient: 'linear-gradient(90deg, #ec4899, #f472b6, #fbcfe8)', glow: '#f472b688' },
  { id: 'orange', label: 'Orange', gradient: 'linear-gradient(90deg, #f97316, #fb923c, #fdba74)', glow: '#fb923c88' },
]

export type HomeMode = 'trending' | 'forYou'

export interface Settings {
  // Streaming filters
  filterByStreaming: boolean
  enabledProviders: number[]
  hideRentals: boolean
  // Cinemas
  cinemas: string[] // Kinepolis slugs
  // Battle
  battleColor: BattleColor
  // Home display
  homeMode: HomeMode
  // TV series
  showSeries: boolean
  suggestSeries: boolean
  // Enrichments on movie detail page
  showBooks: boolean
  showGames: boolean
  showMusic: boolean
  showFriendRatings: boolean
  showFriendRecos: boolean
}

const STORAGE_KEY = 'cine_settings'

const defaultSettings: Settings = {
  filterByStreaming: false,
  enabledProviders: [],
  hideRentals: false,
  cinemas: [],
  battleColor: 'blue',
  homeMode: 'trending',
  showSeries: false,
  suggestSeries: false,
  showBooks: true,
  showGames: true,
  showMusic: true,
  showFriendRatings: true,
  showFriendRecos: true,
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
