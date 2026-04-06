import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { supabase } from '../lib/supabase'
import { SettingsSection } from '../components/profile/SettingsSection'
import { FriendsSection } from '../components/profile/FriendsSection'

export function ProfilePage() {
  const { user, signOut } = useAuth()
  const { coupleId, partner, loading: coupleLoading, linkPartner } = useCoupleContext()
  const [partnerCode, setPartnerCode] = useState('')
  const [linkError, setLinkError] = useState<string | null>(null)
  const [linkSuccess, setLinkSuccess] = useState(false)
  const [linking, setLinking] = useState(false)
  const [copied, setCopied] = useState(false)

  const [inviteCode, setInviteCode] = useState<string | null>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  // Générer ou récupérer un code d'invitation aléatoire (pas l'UUID auth)
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false

    async function loadOrCreateCode() {
      const { data } = await supabase
        .from('profiles')
        .select('invite_code')
        .eq('id', user!.id)
        .single()

      if (cancelled) return

      if (data?.invite_code) {
        setInviteCode(data.invite_code)
      } else {
        // Génère un code court aléatoire et le persiste
        const code = crypto.randomUUID().slice(0, 8).toUpperCase()
        await supabase
          .from('profiles')
          .update({ invite_code: code })
          .eq('id', user!.id)
        if (!cancelled) setInviteCode(code)
      }
    }

    loadOrCreateCode()
    return () => { cancelled = true }
  }, [user?.id])

  // Cleanup timer
  useEffect(() => {
    return () => { if (copiedTimer.current) clearTimeout(copiedTimer.current) }
  }, [])

  if (!user?.profile) return null

  const myCode = inviteCode ?? '...'

  async function handleCopyCode() {
    if (!inviteCode) return
    try {
      await navigator.clipboard.writeText(inviteCode)
      setCopied(true)
      if (copiedTimer.current) clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback silencieux si clipboard non disponible
    }
  }

  async function handleLink(e: React.FormEvent) {
    e.preventDefault()
    setLinkError(null)
    setLinking(true)
    const { error } = await linkPartner(partnerCode.trim())
    setLinking(false)
    if (error) {
      setLinkError(error)
    } else {
      setLinkSuccess(true)
      setPartnerCode('')
      // refresh() non nécessaire — linkPartner() appelle déjà fetchCouple()
    }
  }

  async function handleSignOut() {
    await signOut()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10 space-y-5">
      <h1 className="text-xl font-bold text-[var(--color-text)]">Mon profil</h1>

      {/* Infos utilisateur */}
      <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-2xl flex-shrink-0">
            🎬
          </div>
          <div className="min-w-0">
            <p className="font-bold text-[var(--color-text)] text-lg truncate">
              {user.profile.display_name}
            </p>
            <p className="text-[var(--color-text-muted)] text-sm truncate">{user.email}</p>
          </div>
        </div>
        <button
          onClick={handleSignOut}
          className="mt-4 w-full text-sm text-red-400 hover:text-red-300 border border-red-400/30 hover:border-red-300/50 rounded-xl py-2.5 transition-colors"
        >
          Se déconnecter
        </button>
      </div>

      {/* Partenaire */}
      {!coupleLoading && (
        coupleId && partner ? (
          // Partenaire déjà lié
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">Mon partenaire</h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-lg flex-shrink-0">
                💑
              </div>
              <div>
                <p className="font-medium text-[var(--color-text)]">{partner.display_name}</p>
                <p className="text-[var(--color-text-muted)] text-xs">{partner.email}</p>
              </div>
              <span className="ml-auto text-xs text-green-400 bg-green-400/10 px-2 py-1 rounded-full">
                Lié
              </span>
            </div>
          </div>
        ) : (
          // Pas encore de partenaire
          <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5 space-y-5">
            <h2 className="font-semibold text-[var(--color-text)]">Inviter mon partenaire</h2>

            {/* Mon code */}
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">
                1. Partage ce code avec ton partenaire
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

            {/* Saisir le code du partenaire */}
            <form onSubmit={handleLink} className="space-y-3">
              <p className="text-xs text-[var(--color-text-muted)]">
                2. Colle ici le code de ton partenaire
              </p>
              <input
                type="text"
                value={partnerCode}
                onChange={e => setPartnerCode(e.target.value)}
                placeholder="Code de mon partenaire"
                className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-3 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm font-mono"
              />
              {linkError && (
                <p className="text-red-400 text-xs bg-red-400/10 px-3 py-2 rounded-lg">{linkError}</p>
              )}
              {linkSuccess && (
                <p className="text-green-400 text-xs bg-green-400/10 px-3 py-2 rounded-lg">
                  Partenaire lié avec succès ! 🎉
                </p>
              )}
              <button
                type="submit"
                disabled={!partnerCode.trim() || linking}
                className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-40 text-white rounded-xl py-3 font-medium text-sm transition-colors"
              >
                {linking ? 'Liaison en cours…' : 'Lier nos comptes'}
              </button>
            </form>
          </div>
        )
      )}

      {coupleLoading && (
        <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] p-5">
          <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/2" />
        </div>
      )}

      {/* Mes amis */}
      <FriendsSection inviteCode={inviteCode} />

      {/* Paramètres */}
      <SettingsSection />
    </div>
  )
}
