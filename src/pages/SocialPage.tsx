import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FriendRecommendationsPage } from './FriendRecommendationsPage'
import { FriendsListPage } from './FriendsListPage'
import { useFriendsContext } from '../contexts/FriendsContext'

type SocialTab = 'recos' | 'amis'

export function SocialPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { recos, totalUnreadMessages, pendingRequests } = useFriendsContext()

  const tabParam = searchParams.get('view')
  const activeTab: SocialTab = tabParam === 'amis' ? 'amis' : 'recos'

  function switchTab(tab: SocialTab) {
    if (tab === 'amis') {
      setSearchParams({ view: 'amis' })
    } else {
      setSearchParams({})
    }
  }

  const recoBadge = recos.unseenCount + totalUnreadMessages
  const amiBadge = pendingRequests.length

  return (
    <div className="max-w-2xl mx-auto">
      {/* Tabs */}
      <div className="sticky top-14 z-[5] bg-[var(--color-bg)]/95 backdrop-blur px-4 pt-4 pb-2">
        <div className="flex gap-1 bg-[var(--color-surface)] rounded-lg p-1 border border-[var(--color-border)]">
          <button
            onClick={() => switchTab('recos')}
            className={`relative flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'recos'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Recos
            {recoBadge > 0 && activeTab !== 'recos' && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {recoBadge}
              </span>
            )}
          </button>
          <button
            onClick={() => switchTab('amis')}
            className={`relative flex-1 py-2.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === 'amis'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
            }`}
          >
            Amis
            {amiBadge > 0 && activeTab !== 'amis' && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                {amiBadge}
              </span>
            )}
          </button>
        </div>
      </div>

      {activeTab === 'recos' ? (
        <FriendRecommendationsPage embedded />
      ) : (
        <FriendsListPage embedded />
      )}
    </div>
  )
}
