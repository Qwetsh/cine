import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useRecoMessages } from '../../hooks/useRecoMessages'
import { MentionInput } from './MentionInput'
import { MentionText } from './MentionText'

interface RecoThreadProps {
  recommendationId: string
  /** The initial message left when the reco was sent */
  initialMessage: string | null
  initialSenderName: string
  initialDate: string
  /** Display name of the other participant */
  otherName: string
  onClose: () => void
}

export function RecoThread({
  recommendationId,
  initialMessage,
  initialSenderName,
  initialDate,
  otherName,
  onClose,
}: RecoThreadProps) {
  const { user } = useAuth()
  const { messages, loading, sending, sendMessage } = useRecoMessages(
    recommendationId,
    user?.id ?? null,
  )
  const [draft, setDraft] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function handleSubmit() {
    if (!draft.trim()) return
    sendMessage(draft.trim())
    setDraft('')
  }

  function formatTime(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' ' +
      d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }

  function getSenderName(senderId: string): string {
    if (senderId === user?.id) return 'Toi'
    return otherName
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)]">
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--color-surface-2)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <span className="text-xs text-[var(--color-text-muted)]">
          Discussion avec {otherName}
        </span>
      </div>

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* Initial reco message */}
        {initialMessage && (
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
              {initialSenderName} · {formatTime(initialDate)}
            </span>
            <div className="bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 rounded-lg px-3 py-2 text-sm text-[var(--color-text)]">
              <MentionText text={initialMessage} />
            </div>
          </div>
        )}

        {loading && messages.length === 0 && (
          <div className="text-center py-4">
            <div className="w-5 h-5 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}

        {/* Thread messages */}
        {messages.map((msg) => {
          const isMe = msg.sender_id === user?.id
          return (
            <div key={msg.id} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                {getSenderName(msg.sender_id)} · {formatTime(msg.created_at)}
              </span>
              <div
                className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                  isMe
                    ? 'bg-[var(--color-accent)]/20 text-[var(--color-text)] ml-auto'
                    : 'bg-[var(--color-surface-2)] text-[var(--color-text)]'
                }`}
              >
                <MentionText text={msg.content} />
              </div>
            </div>
          )
        })}

        {!initialMessage && messages.length === 0 && !loading && (
          <div className="text-center py-8 text-[var(--color-text-muted)] text-xs">
            Pas encore de messages. Lance la conversation !
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="px-4 py-3 border-t border-[var(--color-border)]">
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <MentionInput
              value={draft}
              onChange={setDraft}
              onSubmit={handleSubmit}
              disabled={sending}
            />
          </div>
          <button
            onClick={handleSubmit}
            disabled={sending || !draft.trim()}
            className="w-9 h-9 flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-40 transition-opacity flex-shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
