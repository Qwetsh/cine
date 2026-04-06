import { useState } from 'react'
import { useFriendsContext } from '../../contexts/FriendsContext'

interface Props {
  movieId: number | null
  tvShowId: number | null
  title: string
}

export function RecommendButton({ movieId, tvShowId, title }: Props) {
  const { friends, recos } = useFriendsContext()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  // Ne pas afficher si aucun ami
  if (friends.length === 0) return null

  // Amis déjà destinataires de cette reco
  const alreadySent = new Set(
    recos.sent
      .filter(r =>
        (movieId && r.movie_id === movieId) ||
        (tvShowId && r.tv_show_id === tvShowId)
      )
      .map(r => r.to_user_id)
  )

  function toggleFriend(friendUserId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(friendUserId)) {
        next.delete(friendUserId)
      } else {
        next.add(friendUserId)
      }
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0) return
    setSending(true)
    const { error } = await recos.sendRecommendation(
      [...selected],
      movieId,
      tvShowId,
      message.trim() || undefined,
    )
    setSending(false)
    if (!error) {
      setSent(true)
      setSelected(new Set())
      setMessage('')
      setTimeout(() => {
        setSent(false)
        setOpen(false)
      }, 1500)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
      >
        💌 Recommander à...
      </button>

      {/* Modal */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/50"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg bg-[var(--color-bg)] rounded-t-2xl p-5 space-y-4 max-h-[70vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="font-semibold text-[var(--color-text)] text-center">
              Recommander « {title} »
            </h3>

            {/* Liste d'amis */}
            <div className="space-y-2">
              {friends.map(friend => {
                const friendUserId = friend.profile.id
                const already = alreadySent.has(friendUserId)
                const isSelected = selected.has(friendUserId)

                return (
                  <button
                    key={friend.id}
                    onClick={() => !already && toggleFriend(friendUserId)}
                    disabled={already}
                    className={[
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors text-left',
                      already
                        ? 'bg-[var(--color-surface-2)] opacity-50 cursor-default'
                        : isSelected
                        ? 'bg-[var(--color-accent)]/20 border border-[var(--color-accent)]'
                        : 'bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)]',
                    ].join(' ')}
                  >
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-sm flex-shrink-0">
                      {isSelected ? '✓' : '👤'}
                    </div>
                    <span className="text-sm text-[var(--color-text)] flex-1 truncate">
                      {friend.profile.display_name}
                    </span>
                    {already && (
                      <span className="text-xs text-[var(--color-text-muted)]">Déjà envoyé</span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Message optionnel */}
            <input
              type="text"
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Un petit mot ? (optionnel)"
              className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            />

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 bg-[var(--color-surface)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSend}
                disabled={selected.size === 0 || sending}
                className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white rounded-xl py-3 font-medium text-sm transition-colors"
              >
                {sent ? '✓ Envoyé !' : sending ? '...' : `Envoyer (${selected.size})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
