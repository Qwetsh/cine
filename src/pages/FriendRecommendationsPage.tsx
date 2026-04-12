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

interface RecoDisplay {
  id: string
  title: string
  posterPath: string | null
  backdropPath: string | null
  mediaType: 'movie' | 'tv'
  tmdbId: number
  fromUserId: string
  fromName: string
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
  const [items, setItems] = useState<RecoDisplay[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  // Thread state driven by URL search params
  const openThreadId = searchParams.get('thread')

  function openThread(recoId: string) {
    markMessagesRead(recoId)
    setSearchParams({ thread: recoId })
  }

  function closeThread() {
    setSearchParams({})
  }

  // Mark messages read when thread is opened via URL (e.g. back navigation)
  useEffect(() => {
    if (openThreadId) markMessagesRead(openThreadId)
  }, [openThreadId, markMessagesRead])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Mark all as seen on mount
  useEffect(() => {
    recos.markAllSeen()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resolve reco details
  useEffect(() => {
    if (recos.loading) return

    async function resolve() {
      setLoading(true)

      const senderIds = [...new Set(recos.received.map(r => r.from_user_id))]
      const profileMap = new Map<string, Profile>()

      if (senderIds.length > 0) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .in('id', senderIds)
        for (const p of (data ?? []) as unknown as Profile[]) {
          profileMap.set(p.id, p)
        }
      }

      const results: RecoDisplay[] = []

      for (const r of recos.received) {
        const fromProfile = profileMap.get(r.from_user_id)
        const fromName = fromProfile?.display_name ?? 'Un ami'

        if (r.movie_id) {
          try {
            const movie = await tmdb.getMovie(r.movie_id)
            results.push({
              id: r.id,
              title: movie.title,
              posterPath: movie.poster_path,
              backdropPath: movie.backdrop_path,
              mediaType: 'movie',
              tmdbId: r.movie_id,
              fromUserId: r.from_user_id,
              fromName,
              message: r.message,
              createdAt: r.created_at,
              seenAt: r.seen_at,
              tmdbMovie: movie,
            })
          } catch { /* Film introuvable */ }
        } else if (r.tv_show_id) {
          try {
            const show = await tmdb.getTvShow(r.tv_show_id)
            results.push({
              id: r.id,
              title: show.name,
              posterPath: show.poster_path,
              backdropPath: show.backdrop_path,
              mediaType: 'tv',
              tmdbId: r.tv_show_id,
              fromUserId: r.from_user_id,
              fromName,
              message: r.message,
              createdAt: r.created_at,
              seenAt: r.seen_at,
              tmdbMovie: null,
            })
          } catch { /* Série introuvable */ }
        }
      }

      setItems(results)
      setLoading(false)
    }

    resolve()
  }, [recos.received, recos.loading])

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
    setItems(prev => prev.filter(i => i.id !== recoId))
    await recos.deleteRecommendation(recoId)
  }

  // Thread overlay
  const threadItem = openThreadId ? items.find(i => i.id === openThreadId) : null

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-10">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <h1 className="text-xl font-bold text-[var(--color-text)] mb-4">Recos de mes amis</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-28 bg-[var(--color-surface)] rounded-xl animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">💌</div>
          <p className="text-[var(--color-text-muted)] text-sm">
            Aucune recommandation pour le moment
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
                      par {item.fromName} · {formatDate(item.createdAt)}
                    </p>
                    {item.message && (
                      <p className="text-xs text-[var(--color-accent)] mt-1 truncate">
                        « {item.message} »
                      </p>
                    )}
                    {watched && (
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
                  {/* Vu en couple */}
                  {isMovie && coupleId && (
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

                  {/* Vu solo */}
                  {isMovie && (
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
        <div className="fixed inset-0 z-40 bg-[var(--color-bg)] flex flex-col">
          {/* Big movie header */}
          <div className="relative overflow-hidden">
            {/* Backdrop */}
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

            {/* Poster + info overlay */}
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
                  {threadItem.mediaType === 'movie' ? 'Film' : 'Série'} · reco de {threadItem.fromName}
                </p>
              </div>
            </div>
          </div>

          {/* Thread */}
          <div className="flex-1 overflow-hidden">
            <RecoThread
              recommendationId={openThreadId!}
              initialMessage={threadItem.message}
              initialSenderName={threadItem.fromName}
              initialDate={threadItem.createdAt}
              otherName={threadItem.fromName}
              onClose={closeThread}
            />
          </div>
        </div>
      )}
    </div>
  )
}
