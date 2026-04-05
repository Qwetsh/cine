import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useCollection } from '../hooks/useCollection'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useLocalFilter } from '../hooks/useLocalFilter'
import { getPosterUrl } from '../lib/tmdb'
import { StarRating } from '../components/movie/StarRating'
import { CollectionFilterPanel } from '../components/filters/CollectionFilterPanel'
import { SwipeToDelete } from '../components/ui/SwipeToDelete'
import type { CollectionMovieEntry, PersonalCollectionEntry } from '../types'

type Tab = 'couple' | 'perso'
type SortKey = 'date' | 'rating' | 'title'

export function CollectionPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const couple = useCollection(coupleId)
  const personal = usePersonalCollection(user?.id ?? null)
  const [tab, setTab] = useState<Tab>(coupleId ? 'couple' : 'perso')
  const [sort, setSort] = useState<SortKey>('date')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

  // Local filters per tab
  const coupleFilter = useLocalFilter(couple.entries)
  const personalFilter = useLocalFilter(personal.entries)
  const currentFilter = tab === 'couple' ? coupleFilter : personalFilter

  // --- Couple helpers ---
  function getMyRating(entry: CollectionMovieEntry) {
    return isUser1 ? entry.rating_user1 : entry.rating_user2
  }
  function getPartnerRating(entry: CollectionMovieEntry) {
    return isUser1 ? entry.rating_user2 : entry.rating_user1
  }
  function getMyNote(entry: CollectionMovieEntry) {
    return isUser1 ? entry.note_user1 : entry.note_user2
  }
  function getPartnerNote(entry: CollectionMovieEntry) {
    return isUser1 ? entry.note_user2 : entry.note_user1
  }

  async function handleCoupleRating(entry: CollectionMovieEntry, rating: number) {
    await couple.updateRating(entry.id, isUser1, rating)
  }

  function startEditCoupleNote(entry: CollectionMovieEntry) {
    setEditingNote(entry.id)
    setNoteText(getMyNote(entry) ?? '')
  }

  async function saveCoupleNote(entryId: string) {
    const entry = couple.entries.find(e => e.id === entryId)
    if (!entry) return
    await couple.updateRating(entryId, isUser1, getMyRating(entry) ?? 0, noteText)
    setEditingNote(null)
  }

  // --- Personal helpers ---
  async function handlePersonalRating(entry: PersonalCollectionEntry, rating: number) {
    await personal.updateRating(entry.id, rating, entry.note ?? undefined)
  }

  function startEditPersonalNote(entry: PersonalCollectionEntry) {
    setEditingNote(entry.id)
    setNoteText(entry.note ?? '')
  }

  async function savePersonalNote(entryId: string) {
    const entry = personal.entries.find(e => e.id === entryId)
    if (!entry) return
    await personal.updateRating(entryId, entry.rating ?? 0, noteText)
    setEditingNote(null)
  }

  // --- Sort filtered entries ---
  const coupleEntries = [...coupleFilter.filtered].sort((a, b) => {
    if (sort === 'date') return b.watched_at.localeCompare(a.watched_at)
    if (sort === 'title') return a.movie.title.localeCompare(b.movie.title)
    if (sort === 'rating') {
      const avgOf = (e: CollectionMovieEntry) => {
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

  const entries = tab === 'couple' ? coupleEntries : personalEntries
  const loading = tab === 'couple' ? couple.loading : personal.loading
  const totalCount = tab === 'couple' ? couple.entries.length : personal.entries.length

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Collection</h1>
      </div>

      {/* Tabs Couple / Perso */}
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
          Couple {couple.entries.length > 0 ? `(${couple.entries.length})` : ''}
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
          Perso {personal.entries.length > 0 ? `(${personal.entries.length})` : ''}
        </button>
      </div>

      {/* Subtitle */}
      <div className="px-4 pb-2">
        {!loading && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {tab === 'couple'
              ? `${couple.entries.length} film${couple.entries.length !== 1 ? 's' : ''} vus ensemble`
              : `${personal.entries.length} film${personal.entries.length !== 1 ? 's' : ''} vus en solo`}
            {currentFilter.activeCount > 0 && ` · ${entries.length} affiché${entries.length !== 1 ? 's' : ''}`}
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
            {tab === 'couple' ? 'Aucun film vu ensemble' : 'Aucun film dans ta collection perso'}
          </p>
          <p className="text-sm mt-1">
            {tab === 'couple'
              ? coupleId ? 'Marquez des films comme vus pour les ajouter' : 'Liez vos comptes depuis votre profil'
              : 'Ajoute des films vus en solo depuis la fiche film'}
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
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
          <p className="text-sm">Aucun film ne correspond aux filtres</p>
          <button onClick={currentFilter.clearAll} className="mt-2 text-xs text-[var(--color-accent)] hover:underline">
            Effacer les filtres
          </button>
        </div>
      ) : tab === 'couple' ? (
        /* --- COUPLE LIST --- */
        <ul className="px-4 space-y-4 pb-4">
          {coupleEntries.map(entry => (
            <li key={entry.id}>
              <SwipeToDelete onDelete={() => couple.removeFromCollection(entry.id)}>
                <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <button
                      onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)}
                      className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                    >
                      <img src={getPosterUrl(entry.movie.poster_path, 'small')} alt={entry.movie.title} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)} className="text-left">
                        <p className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">{entry.movie.title}</p>
                      </button>
                      <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                        Vu le {new Date(entry.watched_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <div className="mt-3 space-y-2">
                        <div>
                          <p className="text-[var(--color-text-muted)] text-xs mb-1">Ta note</p>
                          <StarRating value={getMyRating(entry)} onChange={r => handleCoupleRating(entry, r)} size="sm" />
                          {editingNote === entry.id ? (
                            <div className="flex gap-2 mt-1">
                              <input type="text" value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Ton avis…" autoFocus
                                className="flex-1 bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs focus:outline-none focus:border-[var(--color-accent)]" />
                              <button onClick={() => saveCoupleNote(entry.id)} className="text-xs text-[var(--color-accent)] font-medium px-2">OK</button>
                              <button onClick={() => setEditingNote(null)} className="text-xs text-[var(--color-text-muted)] px-1">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => startEditCoupleNote(entry)} className="text-left mt-1">
                              {getMyNote(entry) ? (
                                <p className="text-[var(--color-text-muted)] text-xs italic hover:text-[var(--color-text)] transition-colors">"{getMyNote(entry)}" ✏️</p>
                              ) : (
                                <p className="text-[var(--color-text-muted)] text-xs hover:text-[var(--color-accent)] transition-colors">+ Ajouter un avis</p>
                              )}
                            </button>
                          )}
                        </div>
                        {partner && (
                          <div>
                            <p className="text-[var(--color-text-muted)] text-xs mb-1">{partner.display_name}</p>
                            <StarRating value={getPartnerRating(entry)} readOnly size="sm" />
                            {getPartnerNote(entry) && (
                              <p className="text-[var(--color-text-muted)] text-xs italic mt-1">"{getPartnerNote(entry)}"</p>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeToDelete>
            </li>
          ))}
        </ul>
      ) : (
        /* --- PERSONAL LIST --- */
        <ul className="px-4 space-y-4 pb-4">
          {personalEntries.map(entry => (
            <li key={entry.id}>
              <SwipeToDelete onDelete={() => personal.removeFromPersonalCollection(entry.id)}>
                <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden">
                  <div className="flex gap-3 p-3">
                    <button
                      onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)}
                      className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                    >
                      <img src={getPosterUrl(entry.movie.poster_path, 'small')} alt={entry.movie.title} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <button onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)} className="text-left">
                        <p className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">{entry.movie.title}</p>
                      </button>
                      <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                        Vu le {new Date(entry.watched_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <div className="mt-3">
                        <p className="text-[var(--color-text-muted)] text-xs mb-1">Ma note</p>
                        <StarRating value={entry.rating} onChange={r => handlePersonalRating(entry, r)} size="sm" />
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
                      </div>
                    </div>
                  </div>
                </div>
              </SwipeToDelete>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
