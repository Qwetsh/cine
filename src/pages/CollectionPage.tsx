import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useCollection } from '../hooks/useCollection'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useTvCollection } from '../hooks/useTvCollection'
import { useTvCollectionRatings } from '../hooks/useTvCollectionRatings'
import { useTvPersonalCollection } from '../hooks/useTvPersonalCollection'
import { useLocalFilter } from '../hooks/useLocalFilter'
import { useSettings } from '../hooks/useSettings'
import { getPosterUrl } from '../lib/tmdb'
import { detailPath, tvShowToPosterMovie } from '../lib/media'
import { StarRating } from '../components/movie/StarRating'
import { CollectionFilterPanel } from '../components/filters/CollectionFilterPanel'
import { SwipeToDelete } from '../components/ui/SwipeToDelete'
import { HoldablePoster } from '../components/hold/HoldablePoster'
import { posterMovieFromDb } from '../lib/movies'
import { TvProviderLogos } from '../components/movie/TvProviderLogos'
import type { UnifiedCollectionEntry, UnifiedPersonalCollectionEntry } from '../types'

type Tab = 'couple' | 'perso'
type SortKey = 'date' | 'rating' | 'title'

const MOOD_EMOJIS = [
  // Émotions positives
  '😍', '🥰', '😂', '🤩', '🥹', '😊', '🫠',
  // Émotions négatives / intenses
  '😢', '😭', '😱', '😡', '🤬', '😤',
  // Réactions
  '🤯', '🤔', '😴', '🥱', '🫣', '😬', '🙄', '😏',
  // Signification spéciale
  '💩', '🥕', '💎', '🔥', '❤️', '💀', '👻', '🍿', '🏆', '👎',
]

export function CollectionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const { settings } = useSettings()
  const showSeries = !settings.hideSeries
  const couple = useCollection(coupleId)
  const personal = usePersonalCollection(user?.id ?? null)
  const tvCol = useTvCollection(showSeries ? coupleId : null)
  const tvRatings = useTvCollectionRatings(showSeries ? coupleId : null)
  const tvPerso = useTvPersonalCollection(showSeries ? user?.id ?? null : null)
  // coupleId est encore null pendant le chargement du CoupleProvider : tant
  // que l'utilisateur n'a pas choisi d'onglet, on suit la valeur résolue
  const [userTab, setTab] = useState<Tab | null>(null)
  const tab: Tab = userTab ?? (coupleId ? 'couple' : 'perso')
  const [sort, setSort] = useState<SortKey>('date')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  // Listes unifiées films + séries. Pour les séries sans note directe,
  // la moyenne des notes d'épisodes sert de note affichée (et de départ).
  const coupleUnified: UnifiedCollectionEntry[] = useMemo(() => {
    const films: UnifiedCollectionEntry[] = couple.entries.map(e => ({ ...e, media_type: 'movie' as const }))
    const series: UnifiedCollectionEntry[] = tvCol.entries.map(e => {
      const avg = tvRatings.getShowAvg(e.tv_show.id)
      return {
        id: e.id,
        watched_at: e.watched_at ?? e.created_at,
        rating_user1: e.rating_user1 ?? avg.user1 ?? null,
        rating_user2: e.rating_user2 ?? avg.user2 ?? null,
        note_user1: e.note_user1,
        note_user2: e.note_user2,
        emoji_user1: e.emoji_user1,
        emoji_user2: e.emoji_user2,
        movie: tvShowToPosterMovie(e.tv_show),
        media_type: 'tv' as const,
        number_of_seasons: e.tv_show.number_of_seasons,
      }
    })
    return [...films, ...series]
  }, [couple.entries, tvCol.entries, tvRatings])

  const personalUnified: UnifiedPersonalCollectionEntry[] = useMemo(() => {
    const films: UnifiedPersonalCollectionEntry[] = personal.entries.map(e => ({ ...e, media_type: 'movie' as const }))
    const series: UnifiedPersonalCollectionEntry[] = tvPerso.entries.map(e => {
      const avg = tvRatings.getShowAvg(e.tv_show.id)
      const myAvg = isUser1 ? avg.user1 : avg.user2
      return {
        id: e.id,
        watched_at: e.watched_at,
        rating: e.rating ?? myAvg ?? null,
        note: e.note,
        emoji: e.emoji,
        movie: tvShowToPosterMovie(e.tv_show),
        media_type: 'tv' as const,
        number_of_seasons: e.tv_show.number_of_seasons,
      }
    })
    return [...films, ...series]
  }, [personal.entries, tvPerso.entries, tvRatings, isUser1])

  // Local filters per tab
  const coupleFilter = useLocalFilter(coupleUnified)
  const personalFilter = useLocalFilter(personalUnified)
  const currentFilter = tab === 'couple' ? coupleFilter : personalFilter

  // --- Couple helpers ---
  function getMyRating(entry: UnifiedCollectionEntry) {
    return isUser1 ? entry.rating_user1 : entry.rating_user2
  }
  function getPartnerRating(entry: UnifiedCollectionEntry) {
    return isUser1 ? entry.rating_user2 : entry.rating_user1
  }
  function getMyNote(entry: UnifiedCollectionEntry) {
    return isUser1 ? entry.note_user1 : entry.note_user2
  }
  function getPartnerNote(entry: UnifiedCollectionEntry) {
    return isUser1 ? entry.note_user2 : entry.note_user1
  }
  function getMyEmoji(entry: UnifiedCollectionEntry) {
    return isUser1 ? entry.emoji_user1 : entry.emoji_user2
  }
  function getPartnerEmoji(entry: UnifiedCollectionEntry) {
    return isUser1 ? entry.emoji_user2 : entry.emoji_user1
  }

  async function handleCoupleRating(entry: UnifiedCollectionEntry, rating: number) {
    if (entry.media_type === 'tv') await tvCol.updateRating(entry.id, isUser1, rating)
    else await couple.updateRating(entry.id, isUser1, rating)
  }

  function startEditCoupleNote(entry: UnifiedCollectionEntry) {
    setEditingNote(entry.id)
    setNoteText(getMyNote(entry) ?? '')
  }

  async function saveCoupleNote(entryId: string) {
    const entry = coupleUnified.find(e => e.id === entryId)
    if (!entry) return
    if (entry.media_type === 'tv') {
      await tvCol.updateRating(entryId, isUser1, getMyRating(entry) ?? 0, noteText)
    } else {
      await couple.updateRating(entryId, isUser1, getMyRating(entry) ?? 0, noteText)
    }
    setEditingNote(null)
  }

  function handleCoupleEmoji(entry: UnifiedCollectionEntry, emoji: string | null) {
    if (entry.media_type === 'tv') tvCol.updateEmoji(entry.id, isUser1, emoji)
    else couple.updateEmoji(entry.id, isUser1, emoji)
  }

  function handleCoupleRemove(entry: UnifiedCollectionEntry) {
    if (entry.media_type === 'tv') tvCol.removeFromTvCollection(entry.id)
    else couple.removeFromCollection(entry.id)
  }

  // --- Personal helpers ---
  async function handlePersonalRating(entry: UnifiedPersonalCollectionEntry, rating: number) {
    if (entry.media_type === 'tv') await tvPerso.updateRating(entry.id, rating, entry.note ?? undefined)
    else await personal.updateRating(entry.id, rating, entry.note ?? undefined)
  }

  function startEditPersonalNote(entry: UnifiedPersonalCollectionEntry) {
    setEditingNote(entry.id)
    setNoteText(entry.note ?? '')
  }

  async function savePersonalNote(entryId: string) {
    const entry = personalUnified.find(e => e.id === entryId)
    if (!entry) return
    if (entry.media_type === 'tv') {
      await tvPerso.updateRating(entryId, entry.rating ?? 0, noteText)
    } else {
      await personal.updateRating(entryId, entry.rating ?? 0, noteText)
    }
    setEditingNote(null)
  }

  function handlePersonalEmoji(entry: UnifiedPersonalCollectionEntry, emoji: string | null) {
    if (entry.media_type === 'tv') tvPerso.updateEmoji(entry.id, emoji)
    else personal.updateEmoji(entry.id, emoji)
  }

  function handlePersonalRemove(entry: UnifiedPersonalCollectionEntry) {
    if (entry.media_type === 'tv') tvPerso.removeFromTvPersonalCollection(entry.id)
    else personal.removeFromPersonalCollection(entry.id)
  }

  // --- Sort filtered entries ---
  const coupleEntries = [...coupleFilter.filtered].sort((a, b) => {
    if (sort === 'date') return b.watched_at.localeCompare(a.watched_at)
    if (sort === 'title') return a.movie.title.localeCompare(b.movie.title)
    if (sort === 'rating') {
      const avgOf = (e: UnifiedCollectionEntry) => {
        const my = getMyRating(e)
        const p = getPartnerRating(e)
        const sum = (my ?? 0) + (p ?? 0)
        const count = (my != null ? 1 : 0) + (p != null ? 1 : 0)
        return count > 0 ? sum / count : 0
      }
      return avgOf(b) - avgOf(a)
    }
    return 0
  })

  const personalEntries = [...personalFilter.filtered].sort((a, b) => {
    if (sort === 'date') return b.watched_at.localeCompare(a.watched_at)
    if (sort === 'title') return a.movie.title.localeCompare(b.movie.title)
    if (sort === 'rating') return (b.rating ?? 0) - (a.rating ?? 0)
    return 0
  })

  const loading = tab === 'couple' ? couple.loading : personal.loading
  const totalCount = tab === 'couple' ? coupleUnified.length : personalUnified.length
  const shownCount = tab === 'couple' ? coupleEntries.length : personalEntries.length

  function entrySubtitle(watchedAt: string, isTv: boolean, seasons?: number | null) {
    const date = `Vu le ${new Date(watchedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}`
    if (isTv && seasons) return `${date} · ${seasons} saison${seasons > 1 ? 's' : ''}`
    return date
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Collection</h1>
      </div>

      {/* Tabs Couple / Perso — only show when user has a partner */}
      {coupleId && (
        <div className="flex mx-4 mb-2 rounded-xl bg-[var(--color-surface-2)] p-1">
          <button
            onClick={() => { setTab('couple'); setEditingNote(null) }}
            className={[
              'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
              tab === 'couple'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            Couple {coupleUnified.length > 0 ? `(${coupleUnified.length})` : ''}
          </button>
          <button
            onClick={() => { setTab('perso'); setEditingNote(null) }}
            className={[
              'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
              tab === 'perso'
                ? 'bg-[var(--color-accent)] text-white'
                : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
            ].join(' ')}
          >
            Solo {personalUnified.length > 0 ? `(${personalUnified.length})` : ''}
          </button>
        </div>
      )}

      {/* Subtitle */}
      <div className="px-4 pb-2">
        {!loading && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {totalCount} titre{totalCount !== 1 ? 's' : ''}{' '}
            {coupleId ? (tab === 'couple' ? 'vus ensemble' : 'vus en solo') : 'vus'}
            {currentFilter.activeCount > 0 && ` · ${shownCount} affiché${shownCount !== 1 ? 's' : ''}`}
          </p>
        )}
      </div>

      {/* Filter accordion */}
      {!loading && totalCount > 0 && (
        <CollectionFilterPanel
          filters={currentFilter.filters}
          availableGenres={currentFilter.availableGenres}
          activeCount={currentFilter.activeCount}
          onQueryChange={currentFilter.setQuery}
          onToggleGenre={currentFilter.toggleGenre}
          onYearRangeChange={currentFilter.setYearRange}
          onClearAll={currentFilter.clearAll}
        />
      )}

      {/* Sort */}
      <div className="flex gap-2 px-4 mb-4">
        {(['date', 'rating', 'title'] as SortKey[]).map(key => (
          <button
            key={key}
            onClick={() => setSort(key)}
            className={[
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              sort === key
                ? 'bg-[var(--color-accent)] text-white'
                : 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] border border-[var(--color-border)]',
            ].join(' ')}
          >
            {key === 'date' ? 'Date' : key === 'rating' ? 'Note' : 'Titre'}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <ul className="px-4 space-y-4">
          {[1, 2, 3].map(i => (
            <li key={i} className="bg-[var(--color-surface)] rounded-xl h-40 animate-pulse border border-[var(--color-border)]" />
          ))}
        </ul>
      ) : totalCount === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
          <span className="text-5xl mb-4">{tab === 'couple' ? '👫' : '🎬'}</span>
          <p className="font-medium">
            {tab === 'couple' ? 'Rien de vu ensemble pour le moment' : coupleId ? 'Aucun titre dans ta collection perso' : 'Aucun titre dans ta collection'}
          </p>
          <p className="text-sm mt-1">
            {tab === 'couple'
              ? coupleId ? 'Marquez des films ou séries comme vus pour les ajouter' : 'Liez vos comptes depuis votre profil'
              : coupleId ? 'Ajoute des titres vus en solo depuis leur fiche' : 'Ajoute des titres vus depuis leur fiche'}
          </p>
          {tab === 'couple' && !coupleId && (
            <button
              onClick={() => navigate('/profile')}
              className="mt-4 bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl text-sm font-medium"
            >
              Aller au profil
            </button>
          )}
        </div>
      ) : shownCount === 0 ? (
        <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
          <p className="text-sm">Aucun résultat ne correspond aux filtres</p>
          <button onClick={currentFilter.clearAll} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
            Effacer les filtres
          </button>
        </div>
      ) : tab === 'couple' ? (
        /* --- COUPLE LIST --- */
        <ul className="px-4 space-y-4 pb-4">
          {coupleEntries.map(entry => {
            const isTv = entry.media_type === 'tv'
            const path = detailPath({ id: entry.movie.tmdb_id, media_type: entry.media_type })
            return (
              <li key={`${entry.media_type}-${entry.id}`}>
                <SwipeToDelete onDelete={() => handleCoupleRemove(entry)}>
                  <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <div className="flex gap-3 p-3">
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <HoldablePoster movie={{ ...posterMovieFromDb(entry.movie), media_type: entry.media_type }} movieDbId={entry.movie.id}>
                        <button
                          onClick={() => navigate(path)}
                          className="relative w-16 h-24 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                        >
                          <img src={getPosterUrl(entry.movie.poster_path, 'small')} alt={entry.movie.title} className="w-full h-full object-cover" loading="lazy" />
                          {isTv && (
                            <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[8px] font-bold px-1 py-0.5 rounded">Série</div>
                          )}
                        </button>
                        </HoldablePoster>
                        <button
                          onClick={() => document.getElementById(`emoji-couple-${entry.id}`)?.classList.toggle('hidden')}
                          className="flex gap-1.5 items-center hover:scale-105 transition-transform"
                        >
                          <div className="flex flex-col items-center">
                            <span className="text-base leading-none">{getMyEmoji(entry) || '😶'}</span>
                            <span className="text-[8px] text-[var(--color-text-muted)]">Toi</span>
                          </div>
                          <div className="flex flex-col items-center">
                            <span className="text-base leading-none">{getPartnerEmoji(entry) || '😶'}</span>
                            <span className="text-[8px] text-[var(--color-text-muted)]">{partner?.display_name?.slice(0, 4) ?? ''}</span>
                          </div>
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => navigate(path)} className="text-left">
                          <p className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">{entry.movie.title}</p>
                        </button>
                        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                          {entrySubtitle(entry.watched_at, isTv, entry.number_of_seasons)}
                        </p>
                        {isTv && <TvProviderLogos tmdbId={entry.movie.tmdb_id} />}
                        <div className="mt-2 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <p className="text-[var(--color-text-muted)] text-xs w-10 flex-shrink-0">Toi</p>
                            <StarRating value={getMyRating(entry)} onChange={r => handleCoupleRating(entry, r)} size="md" />
                          </div>
                          {editingNote === entry.id ? (
                            <div className="flex gap-2">
                              <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ton avis…" autoFocus
                                className="flex-1 bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs focus:outline-none focus:border-[var(--color-accent)]" />
                              <button onClick={() => saveCoupleNote(entry.id)} className="text-xs text-[var(--color-accent)] font-medium px-2">OK</button>
                              <button onClick={() => setEditingNote(null)} className="text-xs text-[var(--color-text-muted)] px-1">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startEditCoupleNote(entry)} className="text-left">
                              {getMyNote(entry) ? (
                                <p className="text-[var(--color-text-muted)] text-xs italic hover:text-[var(--color-text)] transition-colors">"{getMyNote(entry)}" ✏️</p>
                              ) : (
                                <p className="text-[var(--color-text-muted)] text-xs hover:text-[var(--color-accent)] transition-colors">+ Ajouter un avis</p>
                              )}
                            </button>
                          )}
                          {partner && (
                            <>
                              <div className="flex items-center gap-2">
                                <p className="text-[var(--color-text-muted)] text-xs w-10 flex-shrink-0 truncate">{partner.display_name}</p>
                                <StarRating value={getPartnerRating(entry)} readOnly size="md" />
                              </div>
                              {getPartnerNote(entry) && (
                                <p className="text-[var(--color-text-muted)] text-xs italic">"{getPartnerNote(entry)}"</p>
                              )}
                            </>
                          )}
                          {isTv && (
                            <button onClick={() => navigate(path)} className="text-left">
                              <p className="text-[var(--color-text-muted)] text-[10px] hover:text-[var(--color-accent)] transition-colors">
                                Noter les épisodes →
                              </p>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div id={`emoji-couple-${entry.id}`} className="hidden border-t border-[var(--color-border)]">
                      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
                        {getMyEmoji(entry) && (
                          <button onClick={() => {
                            handleCoupleEmoji(entry, null)
                            document.getElementById(`emoji-couple-${entry.id}`)?.classList.add('hidden')
                          }} className="text-lg flex-shrink-0 opacity-60 hover:opacity-100">✕</button>
                        )}
                        {MOOD_EMOJIS.map(e => (
                          <button key={e} onClick={() => {
                            handleCoupleEmoji(entry, e)
                            document.getElementById(`emoji-couple-${entry.id}`)?.classList.add('hidden')
                          }} className="text-xl flex-shrink-0 hover:scale-125 transition-transform">{e}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SwipeToDelete>
              </li>
            )
          })}
        </ul>
      ) : (
        /* --- PERSONAL LIST --- */
        <ul className="px-4 space-y-4 pb-4">
          {personalEntries.map(entry => {
            const isTv = entry.media_type === 'tv'
            const path = detailPath({ id: entry.movie.tmdb_id, media_type: entry.media_type })
            return (
              <li key={`${entry.media_type}-${entry.id}`}>
                <SwipeToDelete onDelete={() => handlePersonalRemove(entry)}>
                  <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                    <div className="flex gap-3 p-3">
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <HoldablePoster movie={{ ...posterMovieFromDb(entry.movie), media_type: entry.media_type }} movieDbId={entry.movie.id}>
                        <button
                          onClick={() => navigate(path)}
                          className="relative w-16 h-24 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                        >
                          <img src={getPosterUrl(entry.movie.poster_path, 'small')} alt={entry.movie.title} className="w-full h-full object-cover" loading="lazy" />
                          {isTv && (
                            <div className="absolute top-1 right-1 bg-purple-600/90 text-white text-[8px] font-bold px-1 py-0.5 rounded">Série</div>
                          )}
                        </button>
                        </HoldablePoster>
                        <button
                          onClick={() => document.getElementById(`emoji-perso-${entry.id}`)?.classList.toggle('hidden')}
                          className="flex gap-0.5 hover:scale-110 transition-transform"
                        >
                          <span className="text-base leading-none">{entry.emoji || '😶'}</span>
                        </button>
                      </div>
                      <div className="flex-1 min-w-0">
                        <button onClick={() => navigate(path)} className="text-left">
                          <p className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">{entry.movie.title}</p>
                        </button>
                        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                          {entrySubtitle(entry.watched_at, isTv, entry.number_of_seasons)}
                        </p>
                        <div className="mt-2">
                          <div className="flex items-center gap-2">
                            <p className="text-[var(--color-text-muted)] text-xs flex-shrink-0">Ma note</p>
                            <StarRating value={entry.rating} onChange={r => handlePersonalRating(entry, r)} size="md" />
                          </div>
                          {editingNote === entry.id ? (
                            <div className="flex gap-2 mt-1">
                              <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Mon avis…" autoFocus
                                className="flex-1 bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs focus:outline-none focus:border-[var(--color-accent)]" />
                              <button onClick={() => savePersonalNote(entry.id)} className="text-xs text-[var(--color-accent)] font-medium px-2">OK</button>
                              <button onClick={() => setEditingNote(null)} className="text-xs text-[var(--color-text-muted)] px-1">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startEditPersonalNote(entry)} className="text-left mt-1">
                              {entry.note ? (
                                <p className="text-[var(--color-text-muted)] text-xs italic hover:text-[var(--color-text)] transition-colors">"{entry.note}" ✏️</p>
                              ) : (
                                <p className="text-[var(--color-text-muted)] text-xs hover:text-[var(--color-accent)] transition-colors">+ Ajouter un avis</p>
                              )}
                            </button>
                          )}
                          {isTv && (
                            <button onClick={() => navigate(path)} className="text-left mt-1">
                              <p className="text-[var(--color-text-muted)] text-[10px] hover:text-[var(--color-accent)] transition-colors">
                                Noter les épisodes →
                              </p>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    <div id={`emoji-perso-${entry.id}`} className="hidden border-t border-[var(--color-border)]">
                      <div className="flex gap-1.5 overflow-x-auto px-3 py-2 scrollbar-hide">
                        {entry.emoji && (
                          <button onClick={() => {
                            handlePersonalEmoji(entry, null)
                            document.getElementById(`emoji-perso-${entry.id}`)?.classList.add('hidden')
                          }} className="text-lg flex-shrink-0 opacity-60 hover:opacity-100">✕</button>
                        )}
                        {MOOD_EMOJIS.map(e => (
                          <button key={e} onClick={() => {
                            handlePersonalEmoji(entry, e)
                            document.getElementById(`emoji-perso-${entry.id}`)?.classList.add('hidden')
                          }} className="text-xl flex-shrink-0 hover:scale-125 transition-transform">{e}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </SwipeToDelete>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
