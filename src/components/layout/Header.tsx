import { Link, useLocation } from 'react-router-dom'
import { useFriendsContext } from '../../contexts/FriendsContext'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Ciné',
  '/search': 'Rechercher',
  '/watchlist': 'À regarder',
  '/collection': 'Notre collection',
  '/pick': 'Soirée Ciné',
  '/friends': 'Mes amis',
}

export function Header() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Ciné'
  const { friends, pendingRequests } = useFriendsContext()

  return (
    <header className="sticky top-0 z-10 bg-[var(--color-bg)]/90 backdrop-blur border-b border-[var(--color-border)] safe-area-top">
      <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-[var(--color-accent)] text-2xl">🎬</span>
          <span className="font-bold text-lg tracking-tight text-[var(--color-text)]">
            {title}
          </span>
        </Link>
        <div className="flex items-center gap-2">
          {friends.length > 0 && (
            <Link
              to="/friends"
              className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              aria-label="Amis"
            >
              👥
            </Link>
          )}
          <Link
            to="/profile"
            className="relative w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            aria-label="Profil"
          >
            👤
            {pendingRequests.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {pendingRequests.length}
              </span>
            )}
          </Link>
        </div>
      </div>
    </header>
  )
}
