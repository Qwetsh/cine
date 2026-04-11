import { useState } from 'react'
import { QuizSetup } from './QuizSetup'
import type { useQuizLobby } from '../../hooks/useQuizLobby'

interface Props {
  lobby: ReturnType<typeof useQuizLobby>
  joinCode: string | null
  opponentName: string | null
  onBack: () => void
}

export function QuizLobby({ lobby, joinCode, opponentName, onBack }: Props) {
  const { session, isUser1 } = lobby

  // ── Creator view: waiting for opponent ──
  if (isUser1 && session?.status === 'setup') {
    const hasOpponent = !!session.player2_id

    return (
      <div className="px-4 space-y-4">
        {/* Join code display */}
        <div className="text-center py-4">
          <span className="text-4xl block mb-2">🎮</span>
          <p className="text-[var(--color-text)] font-medium mb-1">Quiz 1v1</p>
          <p className="text-xs text-[var(--color-text-muted)] mb-4">
            Partage ce code pour inviter un ami
          </p>
          <CodeDisplay code={joinCode ?? session.join_code} />
          {hasOpponent && opponentName && (
            <div className="mt-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3">
              <p className="text-sm text-green-400 font-medium">
                {opponentName} a rejoint !
              </p>
            </div>
          )}
          {!hasOpponent && (
            <p className="mt-4 text-sm text-[var(--color-text-muted)] animate-pulse">
              En attente d'un adversaire…
            </p>
          )}
        </div>

        {/* Config */}
        <QuizSetup
          onConfirm={async (config) => {
            await lobby.updateConfig({
              difficulty: config.difficulty,
              yearMin: config.yearMin,
              yearMax: config.yearMax,
              questionTypes: config.enabledTypes,
              questionCount: config.count,
            })
            await lobby.startPlaying()
          }}
          onCancel={async () => {
            await lobby.cancel()
            onBack()
          }}
          confirmLabel={hasOpponent ? 'Lancer le quiz !' : 'En attente d\'un adversaire…'}
        />
      </div>
    )
  }

  // ── Joiner view: waiting for host to start ──
  if (!isUser1 && session) {
    if (session.status === 'setup') {
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block animate-pulse">🎮</span>
          <p className="text-[var(--color-text)] font-medium">Quiz 1v1</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Tu as rejoint la partie !
          </p>
          <p className="text-sm text-[var(--color-text-muted)] animate-pulse">
            En attente du lancement par l'hôte…
          </p>
          <button
            onClick={async () => {
              await lobby.cancel()
              onBack()
            }}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Quitter
          </button>
        </div>
      )
    }
  }

  return null
}

// ── Join screen (before joining a lobby) ──

interface JoinProps {
  onJoin: (code: string) => Promise<boolean>
  onBack: () => void
  error: string | null
}

export function QuizJoinScreen({ onJoin, onBack, error }: JoinProps) {
  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  async function handleJoin() {
    if (code.length < 6 || joining) return
    setJoining(true)
    await onJoin(code)
    setJoining(false)
  }

  return (
    <div className="px-4 text-center py-12 space-y-5">
      <span className="text-5xl block">🔑</span>
      <p className="text-[var(--color-text)] font-medium">Rejoindre une partie</p>
      <p className="text-sm text-[var(--color-text-muted)]">
        Entre le code partagé par ton ami
      </p>

      <input
        type="text"
        value={code}
        onChange={e => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
        placeholder="CODE"
        maxLength={6}
        className="w-48 mx-auto block text-center text-2xl font-mono font-bold tracking-[0.3em] bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] uppercase"
        autoFocus
      />

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}

      <button
        onClick={handleJoin}
        disabled={code.length < 6 || joining}
        className={[
          'w-full rounded-xl py-3 font-medium text-sm transition-colors',
          code.length >= 6 && !joining
            ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed',
        ].join(' ')}
      >
        {joining ? 'Connexion…' : 'Rejoindre'}
      </button>

      <button
        onClick={onBack}
        className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
      >
        Retour
      </button>
    </div>
  )
}

// ── Code display component ──

function CodeDisplay({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-accent)] rounded-xl px-6 py-3 transition-all hover:bg-[var(--color-accent)]/10"
    >
      <span className="text-3xl font-mono font-black tracking-[0.4em] text-[var(--color-accent)]">
        {code}
      </span>
      <span className="text-xs text-[var(--color-text-muted)]">
        {copied ? '✓' : '📋'}
      </span>
    </button>
  )
}
