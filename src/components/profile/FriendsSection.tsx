import { useRef, useState } from 'react'
import { useFriendsContext } from '../../contexts/FriendsContext'

interface Props {
  inviteCode: string | null
}

export function FriendsSection({ inviteCode }: Props) {
  const { friends, pendingRequests, loading, addFriend, acceptRequest, rejectRequest, removeFriend } = useFriendsContext()
  const [friendCode, setFriendCode] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const myCode = inviteCode ?? '...'

  async function handleCopyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silencieux
    }
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault()
    setAddError(null)
    setAddSuccess(false)
    setAdding(true)
    const { error } = await addFriend(friendCode.trim())
    setAdding(false)
    if (error) {
      setAddError(error)
    } else {
      setAddSuccess(true)
      setFriendCode('')
      setTimeout(() => setAddSuccess(false), 3000)
    }
  }

  return (
    <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 space-y-5">
      <h2 className="font-semibold text-[var(--color-text)]">Mes amis</h2>

      {/* Mon code invite */}
      <div>
        <p className="text-xs text-[var(--color-text-muted)] mb-2">
          Mon code ami
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-[var(--color-surface-2)] text-[var(--color-text-muted)] text-xs px-3 py-2.5 rounded-xl border border-[var(--color-border)] font-mono break-all">
            {myCode}
          </code>
          <button
            onClick={handleCopyCode}
            className="flex-shrink-0 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs px-3 py-2.5 rounded-xl transition-colors"
          >
            {copied ? '✓ Copié' : 'Copier'}
          </button>
        </div>
      </div>

      {/* Ajouter un ami */}
      <form onSubmit={handleAddFriend} className="space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Ajouter un ami avec son code
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={friendCode}
            onChange={e => setFriendCode(e.target.value)}
            placeholder="Code de ton ami"
            className="flex-1 bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm font-mono"
          />
          <button
            type="submit"
            disabled={!friendCode.trim() || adding}
            className="flex-shrink-0 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white rounded-xl px-4 py-3 font-medium text-sm transition-colors"
          >
            {adding ? '...' : 'Ajouter'}
          </button>
        </div>
        {addError && (
          <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{addError}</p>
        )}
        {addSuccess && (
          <p className="text-green-400 text-xs bg-green-400/10 px-3 py-2 rounded-lg">
            Demande d'ami envoyée !
          </p>
        )}
      </form>

      {/* Demandes en attente */}
      {pendingRequests.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)] font-medium">
            Demandes reçues ({pendingRequests.length})
          </p>
          {pendingRequests.map(req => (
            <div
              key={req.id}
              className="flex items-center gap-3 bg-[var(--color-surface-2)] rounded-xl px-3 py-2.5"
            >
              <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-sm flex-shrink-0">
                👤
              </div>
              <span className="text-sm text-[var(--color-text)] flex-1 truncate">
                {req.profile.display_name}
              </span>
              <button
                onClick={() => acceptRequest(req.id)}
                className="text-xs text-green-400 bg-green-400/10 px-2.5 py-1.5 rounded-lg hover:bg-green-400/20 transition-colors"
              >
                Accepter
              </button>
              <button
                onClick={() => rejectRequest(req.id)}
                className="text-xs text-red-400 bg-red-400/10 px-2.5 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
              >
                Refuser
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Liste d'amis */}
      {!loading && friends.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-[var(--color-text-muted)] font-medium">
            Amis ({friends.length})
          </p>
          {friends.map(friend => (
            <div
              key={friend.id}
              className="flex items-center gap-3 bg-[var(--color-surface-2)] rounded-xl px-3 py-2.5"
            >
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center text-sm flex-shrink-0">
                👤
              </div>
              <span className="text-sm text-[var(--color-text)] flex-1 truncate">
                {friend.profile.display_name}
              </span>
              <button
                onClick={() => removeFriend(friend.id)}
                className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors"
              >
                Retirer
              </button>
            </div>
          ))}
        </div>
      )}

      {!loading && friends.length === 0 && pendingRequests.length === 0 && (
        <p className="text-xs text-[var(--color-text-muted)] text-center py-2">
          Aucun ami pour le moment. Partage ton code !
        </p>
      )}
    </div>
  )
}
