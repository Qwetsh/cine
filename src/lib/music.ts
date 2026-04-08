export interface DeezerAlbum {
  id: number
  title: string
  artist: string
  coverUrl: string | null
  tracks: DeezerTrack[]
  link: string
}

export interface DeezerTrack {
  id: number
  title: string
  artist: string
  duration: number // seconds
  previewUrl: string | null
  trackNumber: number
}

// Cache
const albumCache = new Map<string, DeezerAlbum | null>()

// Dédup inflight
const inflight = new Map<string, Promise<DeezerAlbum | null>>()

function cacheKey(movieTitle: string) {
  return `music_${movieTitle.toLowerCase().trim()}`
}

function loadCache(key: string): DeezerAlbum | null | undefined {
  if (albumCache.has(key)) return albumCache.get(key)!
  try {
    const stored = sessionStorage.getItem(key)
    if (stored) {
      const parsed = JSON.parse(stored) as DeezerAlbum | null
      albumCache.set(key, parsed)
      return parsed
    }
  } catch { /* ignore */ }
  return undefined
}

function saveCache(key: string, value: DeezerAlbum | null) {
  albumCache.set(key, value)
  try {
    sessionStorage.setItem(key, JSON.stringify(value))
  } catch { /* ignore */ }
}

export function fetchSoundtrack(movieTitle: string, originalTitle?: string): Promise<DeezerAlbum | null> {
  const key = cacheKey(movieTitle)
  const cached = loadCache(key)
  if (cached !== undefined) return Promise.resolve(cached)

  if (inflight.has(key)) return inflight.get(key)!

  const promise = _fetchSoundtrack(movieTitle, key, originalTitle)
  inflight.set(key, promise)
  promise.finally(() => inflight.delete(key))
  return promise
}

interface DeezerSearchResult {
  data?: {
    id: number
    title: string
    artist: { name: string }
    cover_big: string | null
    link: string
  }[]
}

interface DeezerTracksResult {
  data?: {
    id: number
    title: string
    artist: { name: string }
    duration: number
    preview: string
    track_position: number
  }[]
}

// Deezer API doesn't support CORS — proxy through Supabase Edge Function
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

function deezerFetch(endpoint: string, params: Record<string, string> = {}): Promise<Response> {
  const qs = new URLSearchParams(params).toString()
  const path = qs ? `${endpoint}?${qs}` : endpoint
  return fetch(`${SUPABASE_URL}/functions/v1/deezer-proxy?path=${encodeURIComponent(path)}`)
}

async function _fetchSoundtrack(movieTitle: string, key: string, originalTitle?: string): Promise<DeezerAlbum | null> {
  try {
    // Build search queries — try original (English) title first if different from local title
    const titles = originalTitle && originalTitle.toLowerCase() !== movieTitle.toLowerCase()
      ? [originalTitle, movieTitle]
      : [movieTitle]

    const queries: string[] = []
    for (const t of titles) {
      queries.push(`${t} original motion picture soundtrack`)
      queries.push(`${t} soundtrack`)
      queries.push(`${t} bande originale`)
    }

    type DeezerAlbumResult = NonNullable<DeezerSearchResult['data']>[number]
    let bestAlbum: DeezerAlbumResult | null = null

    for (const q of queries) {
      const res = await deezerFetch('/search/album', { q, limit: '5' })
      if (!res.ok) continue

      const data: DeezerSearchResult = await res.json()
      if (!data.data || data.data.length === 0) continue

      // Find the best match: prefer albums with "soundtrack" or "bande originale" in the title
      const match = data.data.find(a => {
        const t = a.title.toLowerCase()
        return t.includes('soundtrack') || t.includes('bande originale') || t.includes('ost') || t.includes('motion picture')
      }) ?? data.data[0]

      if (match) {
        bestAlbum = match
        break
      }
    }

    if (!bestAlbum) {
      saveCache(key, null)
      return null
    }

    // Fetch tracks
    const tracksRes = await deezerFetch(`/album/${bestAlbum.id}/tracks`, { limit: '50' })
    let tracks: DeezerTrack[] = []

    if (tracksRes.ok) {
      const tracksData: DeezerTracksResult = await tracksRes.json()
      tracks = (tracksData.data ?? []).map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist.name,
        duration: t.duration,
        previewUrl: t.preview || null,
        trackNumber: t.track_position,
      }))
    }

    const album: DeezerAlbum = {
      id: bestAlbum.id,
      title: bestAlbum.title,
      artist: bestAlbum.artist.name,
      coverUrl: bestAlbum.cover_big,
      tracks,
      link: bestAlbum.link,
    }

    saveCache(key, album)
    return album
  } catch {
    saveCache(key, null)
    return null
  }
}
