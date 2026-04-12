import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useFriendsContext } from '../contexts/FriendsContext'
import { useCollection } from '../hooks/useCollection'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { tmdb, getPosterUrl, getBackdropUrl } from '../lib/tmdb'
import { ensureMovie } from '../lib/movies'
import { supabase } from '../lib/supabase'
import { RecoThread } from '../components/chat/RecoThread'
import type { Profile } from '../types'
import type { TmdbMovie } from '../lib/tmdb'

type RecoTab = 'received' | 'sent'

interface RecoDisplay {
  id: string
  title: string
  posterPath: string | null
  backdropPath: string | null
  mediaType: 'movie' | 'tv'
  tmdbId: number
  direction: RecoTab
  otherName: string
  message: string | null
  createdAt: string
  seenAt: string | null
  tmdbMovie: TmdbMovie | null
}

export function FriendRecommendationsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()
  const { recos, unreadMessages, markMessagesRead } = useFriendsContext()
  const couple = useCollection(coupleId)
  const personal = usePersonalCollection(user?.id ?? null)
  const [receivedItems, setReceivedItems] = useState<RecoDisplay[]>([])
  const [sentItems, setSentItems] = useState<RecoDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Tab & thread state driven by URL
  const activeTab: RecoTab = searchParams.get('tab') === 'sent' ? 'sent' : 'received'
  const openThreadId = searchParams.get('thread')

  function switchTab(tab: RecoTab) {
    const params: Record<string, string> = {}
    if (tab === 'sent') params.tab = 'sent'
    setSearchParams(params)
  }

  function openThread(recoId: string) {
    markMessagesRead(recoId)
    const params: Record<string, string> = { thread: recoId }
    if (activeTab === 'sent') params.tab = 'sent'
    setSearchParams(params)
  }

  function closeThread() {
    const params: Record<string, string> = {}
    if (activeTab === 'sent') params.tab = 'sent'
    setSearchParams(params)
  }

  // Mark messages read when thread is opened via URL (e.g. back navigation)
  useEffect(() => {
    if (openThreadId) markMessagesRead(openThreadId)
  }, [openThreadId, markMessagesRead])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Mark all received as seen on mount
  useEffect(() => {
    recos.markAllSeen()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve received reco details
  useEffect(() => {
    if (recos.loading) return

    async function resolve() {
      setLoading(true)

      // Collect all user IDs we need profiles for (senders of received + receivers of sent)
      const userIds = new Set<string>()
      for (const r of recos.received) userIds.add(r.from_user_id)
      for (const r of recos.sent) userIds.add(r.to_user_id)

      const profileMap = new Map<string, Profile>()
      const idArray = [...userIds]
      if (idArray.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .in('id', idArray)
        for (const p of (data ?? []) as unknown as Profile[]) {
          profileMap.set(p.id, p)
        }
      }

      // Helper to resolve a reco into a RecoDisplay
      async function resolveReco(
        r: { id: string; movie_id: number | null; tv_show_id: number | null; message: string | null; created_at: string; seen_at: string | null },
        direction: RecoTab,
        otherUserId: string,
      ): Promise<RecoDisplay | null> {
        const otherProfile = profileMap.get(otherUserId)
        const otherName = otherProfile?.display_name ?? 'Un ami'

        if (r.movie_id) {
          try {
            const movie = await tmdb.getMovie(r.movie_id)
            return {
              id: r.id, title: movie.title, posterPath: movie.poster_path, backdropPath: movie.backdrop_path,
              mediaType: 'movie', tmdbId: r.movie_id, direction, otherName,
              message: r.message, createdAt: r.created_at, seenAt: r.seen_at, tmdbMovie: movie,
            }
          } catch { return null }
        } else if (r.tv_show_id) {
          try {
            const show = await tmdb.getTvShow(r.tv_show_id)
            return {
              id: r.id, title: show.name, posterPath: show.poster_path, backdropPath: show.backdrop_path,
              mediaType: 'tv', tmdbId: r.tv_show_id, direction, otherName,
              message: r.message, createdAt: r.created_at, seenAt: r.seen_at, tmdbMovie: null,
            }
          } catch { return null }
        }
        return null
      }

      // Resolve both lists in parallel
      const [receivedResults, sentResults] = await Promise.all([
        Promise.all(recos.received.map(r => resolveReco(r, 'received', r.from_user_id))),
        Promise.all(recos.sent.map(r => resolveReco(r, 'sent', r.to_user_id))),
      ])

      setReceivedItems(receivedResults.filter((r): r is RecoDisplay => r !== null))
      setSentItems(sentResults.filter((r): r is RecoDisplay => r !== null))
      setLoading(false)
    }

    resolve()
  }, [recos.received, recos.sent, recos.loading])

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }

  function isAlreadyInCouple(tmdbId: number): boolean {
    return couple.entries.some(e => e.movie.tmdb_id === tmdbId)
  }

  function isAlreadyInPersonal(tmdbId: number): boolean {
    return personal.entries.some(e => e.movie.tmdb_id === tmdbId)
  }

  function isAlreadyWatched(item: RecoDisplay): boolean {
    if (item.mediaType !== 'movie') return false
    return isAlreadyInCouple(item.tmdbId) || isAlreadyInPersonal(item.tmdbId)
  }

  async function handleMarkWatchedCouple(item: RecoDisplay) {
    if (!item.tmdbMovie || !coupleId || actionLoading) return
    setActionLoading(item.id)
    try {
      const movieDbId = await ensureMovie(item.tmdbMovie)
      const { error } = await couple.addToCollection(movieDbId)
      if (!error) showToast('Ajouté à la collection couple !')
    } catch (e) {
      console.error(e)
    }
    setActionLoading(null)
  }

  async function handleMarkWatchedSolo(item: RecoDisplay) {
    if (!item.tmdbMovie || actionLoading) return
    setActionLoading(item.id)
    try {
      const movieDbId = await ensureMovie(item.tmdbMovie)
      const { error } = await personal.addToPersonalCollection(movieDbId)
      if (!error) showToast('Ajouté à ta collection perso !')
    } catch (e) {
      console.error(e)
    }
    setActionLoading(null)
  }

  async function handleDelete(recoId: string) {
    setReceivedItems(prev => prev.filter(i => i.id !== recoId))
    setSentItems(prev => prev.filter(i => i.id !== recoId))
    await recos.deleteRecommendation(recoId)
  }

  const items = activeTab === 'received' ? receivedItems : sentItems
  const allItems = [...receivedItems, ...sentItems]
  const threadItem = openThreadId ? allItems.find(i => i.id === openThreadId) : null

  // Count unread in sent tab
  const sentUnreadTotal = sentItems.reduce((sum, item) => sum + (unreadMessages.get(item.id) ?? 0), 0)

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Recommandations</h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-[var(--color-surface)] rounded-lg p-1 border border-[var(--color-border)]">
        <button
          onClick={() => switchTab('received')}
          className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'received'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Reçues ({receivedItems.length})
        </button>
        <button
          onClick={() => switchTab('sent')}
          className={`relative flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
            activeTab === 'sent'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          Envoyées ({sentItems.length})
          {sentUnreadTotal > 0 && activeTab !== 'sent' && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">
              {sentUnreadTotal}
            </span>
          )}
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-[var(--color-surface)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">{activeTab === 'received' ? '💌' : '📤'}</div>
          <p className="text-[var(--color-text-muted)] text-sm">
            {activeTab === 'received'
              ? 'Aucune recommandation reçue'
              : 'Aucune recommandation envoyée'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const watched = isAlreadyWatched(item)
            const inCouple = isAlreadyInCouple(item.tmdbId)
            const inPersonal = isAlreadyInPersonal(item.tmdbId)
            const isMovie = item.mediaType === 'movie'
            const isLoading = actionLoading === item.id
            const unread = unreadMessages.get(item.id) ?? 0
            const isReceived = item.direction === 'received'

            return (
              <div
                key={item.id}
                className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden"
              >
                {/* Clickable top area */}
                <button
                  onClick={() => navigate(item.mediaType === 'movie' ? `/movie/${item.tmdbId}` : `/tv/${item.tmdbId}`)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  {item.posterPath ? (
                    <img
                      src={getPosterUrl(item.posterPath, 'small')}
                      alt={item.title}
                      className="w-12 h-18 rounded-lg object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-12 h-18 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-lg flex-shrink-0">
                      🎬
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[var(--color-text)] text-sm truncate">{item.title}</p>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {isReceived ? `par ${item.otherName}` : `à ${item.otherName}`} · {formatDate(item.createdAt)}
                    </p>
                    {item.message && (
                      <p className="text-xs text-[var(--color-accent)] mt-1 truncate">
                        « {item.message} »
                      </p>
                    )}
                    {isReceived && watched && (
                      <p className="text-xs text-green-400 mt-1 font-medium">
                        Déjà vu
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-[var(--color-text-muted)] flex-shrink-0">
                    {item.mediaType === 'movie' ? '🎬' : '📺'}
                  </span>
                </button>

                {/* Action buttons */}
                <div className="flex items-center gap-2 px-3 pb-3 pt-0">
                  {/* Vu en couple — only for received movies */}
                  {isReceived && isMovie && coupleId && (
                    inCouple ? (
                      <span className="flex-1 text-center text-xs text-[var(--color-text-muted)] py-1.5">
                        Vu en couple
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkWatchedCouple(item)}
                        disabled={isLoading}
                        className="flex-1 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] rounded-lg py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        👫 Vu en couple
                      </button>
                    )
                  )}

                  {/* Vu solo — only for received movies */}
                  {isReceived && isMovie && (
                    inPersonal ? (
                      <span className="flex-1 text-center text-xs text-[var(--color-text-muted)] py-1.5">
                        Vu solo
                      </span>
                    ) : (
                      <button
                        onClick={() => handleMarkWatchedSolo(item)}
                        disabled={isLoading}
                        className="flex-1 bg-[var(--color-surface-2)] hover:bg-[var(--color-border)] text-[var(--color-text)] rounded-lg py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        🎬 Vu solo
                      </button>
                    )
                  )}

                  {/* Discuter */}
                  <button
                    onClick={() => openThread(item.id)}
                    className="relative w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors flex-shrink-0"
                    aria-label="Discuter"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                        {unread}
                      </span>
                    )}
                  </button>

                  {/* Supprimer */}
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--color-text-muted)] hover:text-red-400 hover:bg-red-500/10 transition-colors flex-shrink-0"
                    aria-label="Supprimer"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Thread panel overlay */}
      {threadItem && (
        <div className="fixed inset-0 z-40 bg-[var(--color-bg)] flex flex-col h-[100dvh]">
          {/* Big movie header */}
          <div className="relative overflow-hidden">
            {threadItem.backdropPath ? (
              <div className="h-32 relative">
                <img
                  src={getBackdropUrl(threadItem.backdropPath, 'medium')}
                  alt=""
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-[var(--color-bg)]/60 to-transparent" />
              </div>
            ) : (
              <div className="h-20 bg-[var(--color-surface)]" />
            )}

            <div className="absolute bottom-0 left-0 right-0 flex items-end gap-3 px-4 pb-3">
              {threadItem.posterPath && (
                <button
                  onClick={() => navigate(threadItem.mediaType === 'movie' ? `/movie/${threadItem.tmdbId}` : `/tv/${threadItem.tmdbId}`)}
                  className="flex-shrink-0"
                >
                  <img
                    src={getPosterUrl(threadItem.posterPath, 'small')}
                    alt={threadItem.title}
                    className="w-14 h-21 rounded-lg object-cover border border-white/20 shadow-lg"
                  />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(threadItem.mediaType === 'movie' ? `/movie/${threadItem.tmdbId}` : `/tv/${threadItem.tmdbId}`)}
                  className="text-left"
                >
                  <p className="font-bold text-[var(--color-text)] text-base leading-tight truncate hover:text-[var(--color-accent)] transition-colors">
                    {threadItem.title}
                  </p>
                </button>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  {threadItem.mediaType === 'movie' ? 'Film' : 'Série'} · {threadItem.direction === 'received' ? `reco de ${threadItem.otherName}` : `envoyé à ${threadItem.otherName}`}
                </p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-hidden">
            <RecoThread
              recommendationId={openThreadId!}
              initialMessage={threadItem.message}
              initialSenderName={threadItem.direction === 'received' ? threadItem.otherName : 'Toi'}
              initialDate={threadItem.createdAt}
              otherName={threadItem.otherName}
              onClose={closeThread}
            />
          </div>
        </div>
      )}
    </div>
  )
}
