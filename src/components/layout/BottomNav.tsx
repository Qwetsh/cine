import { NavLink } from 'react-router-dom'
import { useFriendsContext } from '../../contexts/FriendsContext'

// SVG icons — cinema style, thin stroke
function IconHome({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
      <path d="M9 21V12h6v9" />
    </svg>
  )
}

function IconSearch({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  )
}

function IconWatchlist({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 7v10l4-3 4 3V7" />
    </svg>
  )
}

function IconCollection({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <path d="M2 8h2M20 8h2M2 16h2M20 16h2" />
    </svg>
  )
}

function IconSocial({ active }: { active: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

const NAV_ITEMS = [
  { to: '/', label: 'Accueil', Icon: IconHome },
  { to: '/search', label: 'Rechercher', Icon: IconSearch },
  { to: '/watchlist', label: 'À voir', Icon: IconWatchlist },
  { to: '/collection', label: 'Collection', Icon: IconCollection },
  { to: '/social', label: 'Social', Icon: IconSocial },
]

export function BottomNav() {
  const { recos, totalUnreadMessages } = useFriendsContext()
  const unseenCount = recos.unseenCount + totalUnreadMessages

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-10 bg-[var(--color-surface)]/95 backdrop-blur border-t border-[var(--color-border)] safe-area-bottom">
      <div className="flex items-stretch max-w-2xl mx-auto">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
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
            {({ isActive }) => (
              <div className="relative flex flex-col items-center">
                <Icon active={isActive} />
                <span>{label}</span>
                {to === '/social' && unseenCount > 0 && (
                  <span className="absolute -top-1 -right-2 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
                    {unseenCount}
                  </span>
                )}
              </div>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
