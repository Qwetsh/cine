import { useEffect, useRef, useState } from 'react'
import { fetchSoundtrack, type DeezerAlbum, type DeezerTrack } from '../../lib/music'
import { AccordionSection } from './AccordionSection'

interface Props {
  movieTitle: string
  originalTitle?: string
}

export function MusicSource({ movieTitle, originalTitle }: Props) {
  const [album, setAlbum] = useState<DeezerAlbum | null>(null)
  const [loading, setLoading] = useState(true)
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

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  function togglePlay(track: DeezerTrack) {
    if (!track.previewUrl) return

    if (playingTrackId === track.id) {
      // Stop
      audioRef.current?.pause()
      audioRef.current = null
      setPlayingTrackId(null)
      return
    }

    // Stop previous
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
    <AccordionSection
      icon="🎵"
      title="Bande originale"
      badge={`${album.tracks.length} titre${album.tracks.length > 1 ? 's' : ''}`}
    >
      {/* Album header */}
      <div className="flex gap-3 p-3">
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
          <a
            href={album.link}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-[10px] text-[var(--color-accent)] mt-1 hover:underline"
          >
            Écouter sur Deezer →
          </a>
        </div>
      </div>

      {/* Track list */}
      <div className="border-t border-[var(--color-border)]">
        {visibleTracks.map(track => (
          <button
            key={track.id}
            onClick={() => togglePlay(track)}
            disabled={!track.previewUrl}
            className="w-full flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-surface-2)] transition-colors text-left disabled:opacity-40"
          >
            {/* Play/number indicator */}
            <span className="w-6 text-center text-xs flex-shrink-0">
              {playingTrackId === track.id ? (
                <span className="text-[var(--color-accent)]">⏸</span>
              ) : track.previewUrl ? (
                <span className="text-[var(--color-text-muted)]">▶</span>
              ) : (
                <span className="text-[var(--color-text-muted)]">{track.trackNumber}</span>
              )}
            </span>

            {/* Title + artist */}
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

            {/* Duration */}
            <span className="text-[10px] text-[var(--color-text-muted)] flex-shrink-0 tabular-nums">
              {formatDuration(track.duration)}
            </span>
          </button>
        ))}
      </div>

      {/* Show more / less */}
      {album.tracks.length > 5 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-2 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent-hover)] border-t border-[var(--color-border)] transition-colors"
        >
          {expanded ? 'Voir moins' : `Voir les ${album.tracks.length} titres`}
        </button>
      )}
    </AccordionSection>
  )
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
