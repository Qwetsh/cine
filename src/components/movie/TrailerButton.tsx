import { useEffect, useState } from 'react'
import { tmdb, type TmdbVideo } from '../../lib/tmdb'

interface Props {
  tmdbId: number
  mediaType: 'movie' | 'tv'
}

function pickTrailer(videos: TmdbVideo[]): TmdbVideo | null {
  const youtubeVideos = videos.filter(v => v.site === 'YouTube')
  // Prefer official trailer, then any trailer, then teaser
  return (
    youtubeVideos.find(v => v.type === 'Trailer' && v.official) ??
    youtubeVideos.find(v => v.type === 'Trailer') ??
    youtubeVideos.find(v => v.type === 'Teaser') ??
    youtubeVideos[0] ??
    null
  )
}

export function TrailerButton({ tmdbId, mediaType }: Props) {
  const [trailer, setTrailer] = useState<TmdbVideo | null>(null)
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const fetch = mediaType === 'movie' ? tmdb.getMovieVideos : tmdb.getTvVideos
    fetch(tmdbId).then(res => {
      setTrailer(pickTrailer(res.results))
    }).catch(() => {})
  }, [tmdbId, mediaType])

  if (!trailer) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        ▶ BA
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-2xl mx-4"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative aspect-video bg-black rounded-xl overflow-hidden">
              {!loaded && (
                <div className="absolute inset-0 flex items-center justify-center text-white/50">
                  Chargement...
                </div>
              )}
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.key}?autoplay=1&rel=0`}
                title={trailer.name}
                allow="autoplay; encrypted-media"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
                onLoad={() => setLoaded(true)}
              />
            </div>
            <button
              onClick={() => setOpen(false)}
              className="mt-3 w-full text-center text-white/70 text-sm py-2"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  )
}
