import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

type Mode = 'signin' | 'signup'

export function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const { signIn, signUp } = useAuth()
  const navigate = useNavigate()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) { setError(error.message); return }
      } else {
        if (!displayName.trim()) { setError('Choisis un prénom ou pseudo'); return }
        const { error } = await signUp(email, password, displayName.trim())
        if (error) { setError(error.message); return }
      }
      navigate('/', { replace: true })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-[var(--color-bg)]">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="text-5xl mb-3">🎬</div>
        <h1 className="text-2xl font-bold text-[var(--color-text)]">Ciné</h1>
        <p className="text-[var(--color-text-muted)] text-sm mt-1">Votre ciné-club à deux</p>
      </div>

      {/* Carte */}
      <div className="w-full max-w-sm bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-6">
        {/* Onglets */}
        <div className="flex rounded-xl bg-[var(--color-surface-2)] p-1 mb-6">
          {(['signin', 'signup'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              className={[
                'flex-1 py-2 rounded-lg text-sm font-medium transition-colors',
                mode === m
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              {m === 'signin' ? 'Connexion' : 'Inscription'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {mode === 'signup' && (
            <input
              type="text"
              placeholder="Ton prénom ou pseudo"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              autoFocus
              className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
            />
          )}

          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoFocus={mode === 'signin'}
            className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
          />

          <input
            type="password"
            placeholder="Mot de passe"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
          />

          {error && (
            <p className="text-red-400 text-sm bg-red-400/10 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-50 text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            {loading ? 'Chargement…' : mode === 'signin' ? 'Se connecter' : 'Créer mon compte'}
          </button>
        </form>
      </div>
    </div>
  )
}
