import { useState } from 'react'
import { getPosterUrl } from '../../lib/tmdb'
import { StarRating } from './StarRating'
import type { MovieWithPoster } from '../../types'

const MOOD_EMOJIS = [
  '😍', '🥰', '😂', '🤩', '🥹', '😊', '🫠',
  '😢', '😭', '😱', '😡', '🤬', '😤',
  '🤯', '🤔', '😴', '🥱', '🫣', '😬', '🙄', '😏',
  '💩', '🥕', '💎', '🔥', '❤️', '💀', '👻', '🍿', '🏆', '👎',
]

interface MarkWatchedModalProps {
  movie: MovieWithPoster
  mode: 'solo' | 'couple'
  partnerName?: string
  onConfirm: (data: MarkWatchedData) => void
  onClose: () => void
}

export interface MarkWatchedData {
  myRating: number | null
  myEmoji: string | null
  myNote: string
  partnerRating: number | null
  partnerEmoji: string | null
}

export function MarkWatchedModal({ movie, mode, partnerName, onConfirm, onClose }: MarkWatchedModalProps) {
  const [myRating, setMyRating] = useState<number | null>(null)
  const [myEmoji, setMyEmoji] = useState<string | null>(null)
  const [myNote, setMyNote] = useState('')
  const [partnerRating, setPartnerRating] = useState<number | null>(null)
  const [partnerEmoji, setPartnerEmoji] = useState<string | null>(null)
  const [showEmojis, setShowEmojis] = useState<'me' | 'partner' | null>(null)

  function handleConfirm() {
    onConfirm({ myRating, myEmoji, myNote, partnerRating, partnerEmoji })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/70" />
      <div
        className="relative w-full max-w-md bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl overflow-hidden animate-slide-up max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b border-[var(--color-border)]">
          <div className="w-12 h-18 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
            <img
              src={getPosterUrl(movie.poster_path, 'small')}
              alt={movie.title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[var(--color-text)] leading-tight">{movie.title}</p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              {movie.release_date && new Date(movie.release_date).getFullYear()}
              {movie.runtime && ` · ${Math.floor(movie.runtime / 60)}h${(movie.runtime % 60).toString().padStart(2, '0')}`}
            </p>
          </div>
          <button onClick={onClose} className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-xl p-1">✕</button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4 space-y-4">
          {/* My rating */}
          <div>
            <p className="text-sm font-medium text-[var(--color-text)] mb-2">
              {mode === 'couple' ? 'Ta note' : 'Ma note'}
            </p>
            <StarRating value={myRating} onChange={setMyRating} size="lg" />
          </div>

          {/* My emoji */}
          <div>
            <button
              onClick={() => setShowEmojis(showEmojis === 'me' ? null : 'me')}
              className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              <span className="text-lg">{myEmoji || '😶'}</span>
              <span>{myEmoji ? 'Changer mon emoji' : 'Ajouter un emoji'}</span>
            </button>
            {showEmojis === 'me' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {myEmoji && (
                  <button onClick={() => { setMyEmoji(null); setShowEmojis(null) }} className="text-lg opacity-60 hover:opacity-100">✕</button>
                )}
                {MOOD_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => { setMyEmoji(e); setShowEmojis(null) }}
                    className={`text-xl hover:scale-125 transition-transform ${myEmoji === e ? 'scale-125 ring-2 ring-[var(--color-accent)] rounded' : ''}`}
                  >
                    {e}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Partner rating (couple mode only) */}
          {mode === 'couple' && (
            <>
              <div className="border-t border-[var(--color-border)] pt-4">
                <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                  Note de {partnerName}
                </p>
                <StarRating value={partnerRating} onChange={setPartnerRating} size="lg" />
              </div>

              {/* Partner emoji */}
              <div>
                <button
                  onClick={() => setShowEmojis(showEmojis === 'partner' ? null : 'partner')}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                >
                  <span className="text-lg">{partnerEmoji || '😶'}</span>
                  <span>Emoji de {partnerName}</span>
                </button>
                {showEmojis === 'partner' && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {partnerEmoji && (
                      <button onClick={() => { setPartnerEmoji(null); setShowEmojis(null) }} className="text-lg opacity-60 hover:opacity-100">✕</button>
                    )}
                    {MOOD_EMOJIS.map(e => (
                      <button
                        key={e}
                        onClick={() => { setPartnerEmoji(e); setShowEmojis(null) }}
                        className={`text-xl hover:scale-125 transition-transform ${partnerEmoji === e ? 'scale-125 ring-2 ring-[var(--color-accent)] rounded' : ''}`}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Note/remark */}
          <div>
            <input
              type="text"
              value={myNote}
              onChange={e => setMyNote(e.target.value)}
              placeholder="Une remarque ? (optionnel)"
              className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-3 py-2 rounded-xl border border-[var(--color-border)] text-sm focus:outline-none focus:border-[var(--color-accent)]"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--color-border)] flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-muted)] bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] transition-colors"
          >
            On l'a vu !
          </button>
        </div>
      </div>
    </div>
  )
}
