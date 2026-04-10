import { useNavigate } from 'react-router-dom'
import { useFriendsContext } from '../contexts/FriendsContext'

export function FriendsListPage() {
  const navigate = useNavigate()
  const { friends, loading } = useFriendsContext()

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-4">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Mes amis</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          {friends.length} ami{friends.length !== 1 ? 's' : ''}
        </p>
      </div>

      {loading ? (
        <div className="px-4 space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 bg-[var(--color-surface)] rounded-xl animate-pulse border border-[var(--color-border)]" />
          ))}
        </div>
      ) : friends.length === 0 ? (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">👥</span>
          <p className="text-[var(--color-text)] font-medium">Aucun ami pour l'instant</p>
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            Ajoutez des amis depuis votre profil
          </p>
          <button
            onClick={() => navigate('/profile')}
            className="mt-4 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-6 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Aller au profil
          </button>
        </div>
      ) : (
        <ul className="px-4 space-y-2 pb-8">
          {friends.map(friend => (
            <li key={friend.id}>
              <button
                onClick={() => navigate(`/friend/${friend.profile.id}`)}
                className="w-full flex items-center gap-3 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-xl p-3 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center text-lg flex-shrink-0">
                  👤
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium text-[var(--color-text)] text-sm truncate">
                    {friend.profile.display_name}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Voir sa collection
                  </p>
                </div>
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-[var(--color-text-muted)] flex-shrink-0"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
