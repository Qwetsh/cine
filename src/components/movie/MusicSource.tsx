import { useEffect, useRef, useState } from 'react'
import { fetchSoundtrack, type DeezerAlbum, type DeezerTrack } from '../../lib/music'

interface Props {
  movieTitle: string
  originalTitle?: string
}

export function MusicSource({ movieTitle, originalTitle }: Props) {
  const [album, setAlbum] = useState<DeezerAlbum | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [playingTrackId, setPlayingTrackId] = useState<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchSoundtrack(movieTitle, originalTitle)
      .then(result => {
        if (!cancelled) setAlbum(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [movieTitle, originalTitle])

  // Cleanup audio on unmount or modal close
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  function handleClose() {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current = null
    }
    setPlayingTrackId(null)
    setOpen(false)
  }

  function togglePlay(track: DeezerTrack) {
    if (!track.previewUrl) return

    if (playingTrackId === track.id) {
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingTrackId(null)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
    }

    const audio = new Audio(track.previewUrl)
    audio.play().catch(() => {})
    audio.onended = () => {
      setPlayingTrackId(null)
      audioRef.current = null
    }
    audioRef.current = audio
    setPlayingTrackId(track.id)
  }

  if (loading) return null
  if (!album || album.tracks.length === 0) return null

  const visibleTracks = expanded ? album.tracks : album.tracks.slice(0, 5)

  return (
    <>
      {/* Small button — same style as TrailerButton */}
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        ♪ BO
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md sm:mx-4 bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl border-t sm:border border-[var(--color-border)] max-h-[80dvh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Album header */}
            <div className="flex gap-3 p-4">
              {album.coverUrl ? (
                <img
                  src={album.coverUrl}
                  alt={album.title}
                  className="w-16 h-16 rounded-lg object-cover flex-shrink-0"
                  loading="lazy"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-2xl flex-shrink-0">
                  🎵
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text)] leading-tight line-clamp-2">
                  {album.title}
                </p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{album.artist}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    {album.tracks.length} titre{album.tracks.length > 1 ? 's' : ''}
                  </span>
                  <a
                    href={album.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-[var(--color-accent)] hover:underline"
                  >
                    Écouter sur Deezer →
                  </a>
                </div>
              </div>
              {/* Close button */}
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors flex-shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Track list — scrollable */}
            <div className="overflow-y-auto flex-1 border-t border-[var(--color-border)]">
              {visibleTracks.map(track => (
                <button
                  key={track.id}
                  onClick={() => togglePlay(track)}
                  disabled={!track.previewUrl}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors text-left disabled:opacity-40"
                >
                  <span className="w-6 text-center text-xs flex-shrink-0">
                    {playingTrackId === track.id ? (
                      <span className="text-[var(--color-accent)]">⏸</span>
                    ) : track.previewUrl ? (
                      <span className="text-[var(--color-text-muted)]">▶</span>
                    ) : (
                      <span className="text-[var(--color-text-muted)]">{track.trackNumber}</span>
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight truncate ${
                      playingTrackId === track.id ? 'text-[var(--color-accent)] font-medium' : 'text-[var(--color-text)]'
                    }`}>
                      {track.title}
                    </p>
                    {track.artist !== album.artist && (
                      <p className="text-[10px] text-[var(--color-text-muted)] truncate">{track.artist}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
                    {formatDuration(track.duration)}
                  </span>
                </button>
              ))}

              {/* Show more / less */}
              {album.tracks.length > 5 && (
                <button
                  onClick={() => setExpanded(!expanded)}
                  className="w-full py-2.5 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] border-t border-[var(--color-border)] transition-colors"
                >
                  {expanded ? 'Voir moins' : `Voir les ${album.tracks.length} titres`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
