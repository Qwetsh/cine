import { useEffect, useState } from 'react'
import { tmdb } from '../../lib/tmdb'

const TMDB_IMAGE = 'https://image.tmdb.org/t/p/w92'

interface Provider {
  provider_id: number
  provider_name: string
  logo_path: string
}

interface Props {
  tmdbId: number
  overlay?: boolean
}

export function TvProviderLogos({ tmdbId, overlay }: Props) {
  const [providers, setProviders] = useState<Provider[]>([])

  useEffect(() => {
    tmdb.getTvWatchProviders(tmdbId)
      .then(data => {
        const fr = data.results?.FR
        setProviders((fr?.flatrate ?? []).slice(0, 3))
      })
      .catch(() => setProviders([]))
  }, [tmdbId])

  if (providers.length === 0) return null

  if (overlay) {
    return (
      <div className="flex items-center gap-1 bg-black/60 backdrop-blur-sm rounded-full px-1.5 py-1">
        {providers.map(p => (
          <img
            key={p.provider_id}
            src={`${TMDB_IMAGE}${p.logo_path}`}
            alt={p.provider_name}
            title={p.provider_name}
            className="w-4 h-4 rounded-sm"
          />
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 mt-2">
      {providers.map(p => (
        <img
          key={p.provider_id}
          src={`${TMDB_IMAGE}${p.logo_path}`}
          alt={p.provider_name}
          title={p.provider_name}
          className="w-5 h-5 rounded"
        />
      ))}
    </div>
  )
}
