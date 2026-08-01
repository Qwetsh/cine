import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useFriendsContext } from '../contexts/FriendsContext'
import { Avatar } from '../components/ui/Avatar'
import { useInviteCode } from '../hooks/useInviteCode'
import { clearPendingInviteCode, getPendingInviteCode, shareInviteLink } from '../lib/invite'

export function FriendsListPage({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { friends, pendingRequests, loading, addFriend, acceptRequest, rejectRequest, removeFriend } = useFriendsContext()
  const [friendCode, setFriendCode] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [addSuccess, setAddSuccess] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmAction, setConfirmAction] = useState<{ type: 'accept' | 'reject' | 'remove'; id: string; name: string } | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle')
  const inviteCode = useInviteCode(user?.id)
  const inputRef = useRef<HTMLInputElement>(null)

  async function submitCode(code: string) {
    setAddError(null)
    setAddSuccess(false)
    setAdding(true)
    const { error } = await addFriend(code)
    setAdding(false)
    if (error) {
      setAddError(error)
    } else {
      setAddSuccess(true)
      setFriendCode('')
      setTimeout(() => setAddSuccess(false), 3000)
    }
  }

  async function handleAddFriend(e: React.FormEvent) {
    e.preventDefault()
    await submitCode(friendCode.trim())
  }

  // Lien d'invitation capturé (?invite=CODE) : envoyer la demande automatiquement
  const inviteConsumedRef = useRef(false)
  useEffect(() => {
    if (!user || loading || inviteConsumedRef.current) return
    const pending = getPendingInviteCode()
    if (!pending) return
    inviteConsumedRef.current = true
    clearPendingInviteCode()
    setShowAddForm(true)
    setFriendCode(pending)
    submitCode(pending)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loading])

  async function handleShareInvite() {
    if (!inviteCode) return
    const result = await shareInviteLink(inviteCode)
    if (result === 'copied') {
      setShareState('copied')
      setTimeout(() => setShareState('idle'), 2500)
    }
  }

  async function handleConfirm() {
    if (!confirmAction) return
    setActionError(null)
    let result: { error: string | null } = { error: null }
    if (confirmAction.type === 'accept') result = await acceptRequest(confirmAction.id)
    else if (confirmAction.type === 'reject') result = await rejectRequest(confirmAction.id)
    else if (confirmAction.type === 'remove') result = await removeFriend(confirmAction.id)
    setConfirmAction(null)
    if (result.error) {
      setActionError("L'action a échoué, réessaie. (" + result.error + ')')
      setTimeout(() => setActionError(null), 5000)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {!embedded && (
        <div className="px-4 pt-6 pb-4">
          <h1 className="text-xl font-bold text-[var(--color-text)]">Mes amis</h1>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {friends.length} ami{friends.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Add friend button */}
      <div className="px-4 pb-3">
        {!showAddForm ? (
          <div className="space-y-2">
            <button
              onClick={handleShareInvite}
              disabled={!inviteCode}
              className="w-full flex items-center justify-center gap-2 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white rounded-xl py-3 font-medium text-sm transition-colors"
            >
              {shareState === 'copied' ? '✓ Lien copié !' : '📤 Inviter un ami'}
            </button>
            <button
              onClick={() => { setShowAddForm(true); setTimeout(() => inputRef.current?.focus(), 100) }}
              className="w-full flex items-center justify-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
            >
              + J'ai un code ami
            </button>
          </div>
        ) : (
          <form onSubmit={handleAddFriend} className="space-y-2">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={friendCode}
                onChange={e => setFriendCode(e.target.value)}
                placeholder="Code de ton ami"
                className="flex-1 bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm font-mono"
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
                Demande d'ami envoyee !
              </p>
            )}
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
            >
              Annuler
            </button>
          </form>
        )}
      </div>

      {actionError && (
        <div className="px-4 pb-3">
          <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{actionError}</p>
        </div>
      )}

      {/* Pending requests */}
      {pendingRequests.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs text-[var(--color-text-muted)] font-medium mb-2">
            Demandes recues ({pendingRequests.length})
          </p>
          <div className="space-y-2">
            {pendingRequests.map(req => (
              <div
                key={req.id}
                className="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl p-3"
              >
                <Avatar name={req.profile.display_name} id={req.profile.id} size="sm" />
                <span className="text-sm text-[var(--color-text)] flex-1 truncate">
                  {req.profile.display_name}
                </span>
                <button
                  onClick={() => setConfirmAction({ type: 'accept', id: req.id, name: req.profile.display_name })}
                  className="text-xs text-green-400 bg-green-400/10 px-2.5 py-1.5 rounded-lg hover:bg-green-400/20 transition-colors"
                >
                  Accepter
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'reject', id: req.id, name: req.profile.display_name })}
                  className="text-xs text-red-400 bg-red-400/10 px-2.5 py-1.5 rounded-lg hover:bg-red-400/20 transition-colors"
                >
                  Refuser
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading ? (
        <div className="px-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[var(--color-surface)] rounded-xl animate-pulse border border-[var(--color-border)]" />
          ))}
        </div>
      ) : friends.length === 0 && pendingRequests.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-[var(--color-text-muted)] text-sm">
            Aucun ami pour le moment
          </p>
        </div>
      ) : (
        <ul className="px-4 space-y-2 pb-8">
          {friends.map(friend => (
            <li key={friend.id}>
              <div className="flex items-center gap-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3 transition-colors">
                <button
                  onClick={() => navigate(`/friend/${friend.profile.id}`)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <Avatar name={friend.profile.display_name} id={friend.profile.id} />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text)] text-sm truncate">
                      {friend.profile.display_name}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Voir sa collection
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => navigate(`/pick?challenge=${friend.profile.id}`)}
                  className="text-base hover:scale-110 transition-transform flex-shrink-0 px-1.5 py-1"
                  aria-label={`Défier ${friend.profile.display_name} au quiz`}
                  title="Défier au CinéQuiz"
                >
                  ⚔️
                </button>
                <button
                  onClick={() => setConfirmAction({ type: 'remove', id: friend.id, name: friend.profile.display_name })}
                  className="text-xs text-[var(--color-text-muted)] hover:text-red-400 transition-colors flex-shrink-0 px-2 py-1"
                >
                  Retirer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Confirmation modal */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirmAction(null)}>
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-5 max-w-sm w-full space-y-4" onClick={e => e.stopPropagation()}>
            <p className="text-sm text-[var(--color-text)]">
              {confirmAction.type === 'accept' && <>Accepter la demande d'ami de <strong>{confirmAction.name}</strong> ?</>}
              {confirmAction.type === 'reject' && <>Refuser la demande d'ami de <strong>{confirmAction.name}</strong> ?</>}
              {confirmAction.type === 'remove' && <>Retirer <strong>{confirmAction.name}</strong> de tes amis ?</>}
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleConfirm}
                className={`flex-1 text-sm text-white rounded-xl py-2.5 font-medium transition-colors ${
                  confirmAction.type === 'accept'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
              >
                {confirmAction.type === 'accept' ? 'Accepter' : confirmAction.type === 'reject' ? 'Refuser' : 'Retirer'}
              </button>
              <button
                onClick={() => setConfirmAction(null)}
                className="flex-1 text-sm text-[var(--color-text-muted)] border border-[var(--color-border)] rounded-xl py-2.5 hover:border-[var(--color-text-muted)] transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
