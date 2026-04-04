import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useCollection } from '../hooks/useCollection'
import { getPosterUrl } from '../lib/tmdb'
import { StarRating } from '../components/movie/StarRating'
import type { CollectionMovieEntry } from '../types'

type SortKey = 'date' | 'rating' | 'title'

export function CollectionPage() {
  const navigate = useNavigate()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const { entries, loading, updateRating } = useCollection(coupleId)
  const [sort, setSort] = useState<SortKey>('date')
  const [editingNote, setEditingNote] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')

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

  async function handleRatingChange(entry: CollectionMovieEntry, rating: number) {
    await updateRating(entry.id, isUser1, rating)
  }

  function startEditNote(entry: CollectionMovieEntry) {
    setEditingNote(entry.id)
    setNoteText(getMyNote(entry) ?? '')
  }

  async function saveNote(entryId: string) {
    const entry = entries.find(e => e.id === entryId)
    if (!entry) return
    const currentRating = getMyRating(entry) ?? 0
    await updateRating(entryId, isUser1, currentRating, noteText)
    setEditingNote(null)
  }

  const sorted = [...entries].sort((a, b) => {
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

  if (!coupleId) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-16 text-center">
        <div className="text-5xl mb-4">⭐</div>
        <p className="font-semibold text-[var(--color-text)] mb-2">Invitez votre partenaire d'abord</p>
        <p className="text-[var(--color-text-muted)] text-sm mb-6">
          La collection est partagée — liez vos comptes depuis votre profil.
        </p>
        <button
          onClick={() => navigate('/profile')}
          className="bg-[var(--color-accent)] text-white px-6 py-3 rounded-xl text-sm font-medium"
        >
          Aller au profil
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Notre collection</h1>
        {!loading && (
          <p className="text-sm text-[var(--color-text-muted)] mt-1">
            {entries.length} film{entries.length !== 1 ? 's' : ''} regardés ensemble
          </p>
        )}
      </div>

      {/* Tri */}
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

      {loading ? (
        <ul className="px-4 space-y-4">
          {[1, 2, 3].map(i => (
            <li key={i} className="bg-[var(--color-surface)] rounded-xl h-40 animate-pulse border border-[var(--color-border)]" />
          ))}
        </ul>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
          <span className="text-5xl mb-4">⭐</span>
          <p className="font-medium">Aucun film dans la collection</p>
          <p className="text-sm mt-1">Marquez des films comme vus pour les ajouter</p>
        </div>
      ) : (
        <ul className="px-4 space-y-4 pb-4">
          {sorted.map(entry => (
            <li
              key={entry.id}
              className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden"
            >
              <div className="flex gap-3 p-3">
                {/* Affiche */}
                <button
                  onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)}
                  className="w-16 h-24 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]"
                >
                  <img
                    src={getPosterUrl(entry.movie.poster_path, 'small')}
                    alt={`Affiche ${entry.movie.title}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </button>

                {/* Infos */}
                <div className="flex-1 min-w-0">
                  <button onClick={() => navigate(`/movie/${entry.movie.tmdb_id}`)} className="text-left">
                    <p className="font-semibold text-[var(--color-text)] hover:text-[var(--color-accent)] transition-colors">
                      {entry.movie.title}
                    </p>
                  </button>
                  <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
                    Vu le{' '}
                    {new Date(entry.watched_at).toLocaleDateString('fr-FR', {
                      day: 'numeric', month: 'long', year: 'numeric',
                    })}
                  </p>

                  {/* Note courante utilisateur */}
                  <div className="mt-3 space-y-2">
                    <div>
                      <p className="text-[var(--color-text-muted)] text-xs mb-1">Ta note</p>
                      <StarRating
                        value={getMyRating(entry)}
                        onChange={rating => handleRatingChange(entry, rating)}
                        size="sm"
                      />
                      {editingNote === entry.id ? (
                        <div className="flex gap-2 mt-1">
                          <input
                            type="text"
                            value={noteText}
                            onChange={e => setNoteText(e.target.value)}
                            placeholder="Ton avis…"
                            autoFocus
                            className="flex-1 bg-[var(--color-surface-2)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-2 py-1 rounded-lg border border-[var(--color-border)] text-xs focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <button
                            onClick={() => saveNote(entry.id)}
                            className="text-xs text-[var(--color-accent)] font-medium px-2"
                          >
                            OK
                          </button>
                          <button
                            onClick={() => setEditingNote(null)}
                            className="text-xs text-[var(--color-text-muted)] px-1"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditNote(entry)}
                          className="text-left mt-1"
                        >
                          {getMyNote(entry) ? (
                            <p className="text-[var(--color-text-muted)] text-xs italic hover:text-[var(--color-text)] transition-colors">
                              "{getMyNote(entry)}" ✏️
                            </p>
                          ) : (
                            <p className="text-[var(--color-text-muted)] text-xs hover:text-[var(--color-accent)] transition-colors">
                              + Ajouter un avis
                            </p>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Note partenaire */}
                    {partner && (
                      <div>
                        <p className="text-[var(--color-text-muted)] text-xs mb-1">
                          {partner.display_name}
                        </p>
                        <StarRating value={getPartnerRating(entry)} readOnly size="sm" />
                        {getPartnerNote(entry) && (
                          <p className="text-[var(--color-text-muted)] text-xs italic mt-1">
                            "{getPartnerNote(entry)}"
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
