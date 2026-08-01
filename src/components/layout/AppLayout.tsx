import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { Header } from './Header'
import { ScrollRestoration } from './ScrollRestoration'
import { useAuth } from '../../contexts/AuthContext'
import { usePushNotifications } from '../../hooks/usePushNotifications'
import { getPendingInviteCode } from '../../lib/invite'

const DISMISSED_KEY = 'push-banner-dismissed'

export function AppLayout() {
  const { user } = useAuth()
  const push = usePushNotifications(user?.id ?? null)
  const [showBanner, setShowBanner] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  // Un lien d'invitation a été capturé (avant ou pendant le login) :
  // rediriger vers l'onglet Amis qui enverra la demande automatiquement
  useEffect(() => {
    if (!user) return
    if (getPendingInviteCode() && !location.pathname.startsWith('/social')) {
      navigate('/social?view=amis', { replace: true })
    }
  }, [user, location.pathname, navigate])

  useEffect(() => {
    // Show banner after a short delay if:
    // - push is supported
    // - user hasn't subscribed yet
    // - user hasn't dismissed the banner before
    // - permission is not already denied
    if (
      push.permission === 'unsupported' ||
      push.permission === 'denied' ||
      push.subscribed
    ) {
      // Si l'abonnement est détecté après coup (getSubscription est async),
      // retirer la bannière déjà affichée
      setShowBanner(false)
      return
    }

    const dismissed = localStorage.getItem(DISMISSED_KEY)
    if (dismissed) return

    const timer = setTimeout(() => setShowBanner(true), 3000)
    return () => clearTimeout(timer)
  }, [push.permission, push.subscribed])

  async function handleAccept() {
    // En cas d'échec (prompt fermé, erreur), on cache la bannière pour cette
    // session mais sans poser DISMISSED_KEY : elle reviendra au prochain lancement
    await push.subscribe()
    setShowBanner(false)
  }

  function handleDismiss() {
    localStorage.setItem(DISMISSED_KEY, '1')
    setShowBanner(false)
  }

  return (
    <div className="flex flex-col min-h-dvh bg-[var(--color-bg)]">
      <Header />
      <ScrollRestoration />

      {showBanner && (
        <div className="mx-4 mt-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-4 flex items-start gap-3 animate-in">
          <span className="text-2xl flex-shrink-0 mt-0.5">🔔</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-[var(--color-text)]">
              Activer les notifications ?
            </p>
            <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
              Sois alerté des recos, demandes d'ami et messages
            </p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAccept}
                className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors"
              >
                Activer
              </button>
              <button
                onClick={handleDismiss}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)] px-3 py-2 transition-colors"
              >
                Plus tard
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-sm flex-shrink-0"
          >
            ✕
          </button>
        </div>
      )}

      <main className="flex-1 pb-20 overflow-x-hidden">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  )
}
