import { NavLink } from 'react-router-dom'

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', icon: '🏠' },
  { to: '/search', label: 'Rechercher', icon: '🔍' },
  { to: '/watchlist', label: 'À voir', icon: '📋' },
  { to: '/collection', label: 'Collection', icon: '⭐' },
  { to: '/pick', label: 'Soirée', icon: '🎲' },
]

export function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur border-t border-[var(--color-border)] safe-area-inset-bottom">
      <div className="flex items-stretch max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ to, label, icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              [
                'flex-1 flex flex-col items-center justify-center gap-1 py-2 px-1 text-xs transition-colors',
                isActive
                  ? 'text-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')
            }
          >
            <span className="text-xl leading-none">{icon}</span>
            <span>{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
