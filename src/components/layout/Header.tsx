import { Link, useLocation } from 'react-router-dom'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Ciné',
  '/search': 'Rechercher',
  '/watchlist': 'À regarder',
  '/collection': 'Notre collection',
  '/pick': 'Soirée Ciné',
  '/social': 'Social',
}

export function Header() {
  const location = useLocation()
  const title = PAGE_TITLES[location.pathname] ?? 'Ciné'

  return (
    <header className="sticky top-0 z-10 bg-[var(--color-bg)]/90 backdrop-blur border-b border-[var(--color-border)] safe-area-top">
      <div className="flex items-center justify-between px-4 h-14 max-w-2xl mx-auto">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-[var(--color-accent)] text-2xl">🎬</span>
          <span className="font-bold text-lg tracking-tight text-[var(--color-text)]">
            {title}
          </span>
        </Link>
        <Link
          to="/profile"
          className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          aria-label="Profil"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        </Link>
      </div>
    </header>
  )
}
