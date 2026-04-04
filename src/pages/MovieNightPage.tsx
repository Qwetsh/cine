import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useCollection } from '../hooks/useCollection'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useGenres } from '../hooks/useGenres'
import { usePreferences } from '../hooks/usePreferences'
import { useSmartSuggestion } from '../hooks/useSmartSuggestion'
import { SuggestionCard } from '../components/movienight/SuggestionCard'
import { WatchlistPicker } from '../components/movienight/WatchlistPicker'
import { ensureMovie } from '../lib/movies'
import { supabase } from '../lib/supabase'
import type { TmdbMovie } from '../lib/tmdb'
import type { WatchlistMovieEntry } from '../types'

type Tab = 'suggest' | 'pick'

export function MovieNightPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()
  const watchlist = useWatchlist(coupleId)
  const couple = useCollection(coupleId)
  const personal = usePersonalCollection(user?.id ?? null)
  const { genres } = useGenres()
  const preferences = usePreferences(couple.entries, personal.entries)
  const smartSuggestion = useSmartSuggestion(preferences, genres)

  const [tab, setTab] = useState<Tab>('suggest')
  const [toast, setToast] = useState<string | null>(null)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAcceptSuggestion(movie: TmdbMovie) {
    if (!user || !coupleId) {
      navigate('/profile')
      return
    }
    try {
      const movieDbId = await ensureMovie(movie)
      await supabase.from('watchlist').insert({
        movie_id: movieDbId,
        added_by: user.id,
        couple_id: coupleId,
      })
      showToast('Ajouté à la liste !')
      smartSuggestion.reset()
    } catch (e) {
      console.error(e)
    }
  }

  async function handleMarkWatched(entry: WatchlistMovieEntry) {
    if (!coupleId) return
    const { addToCollection } = couple
    const { error } = await addToCollection(entry.movie.id)
    if (!error) {
      await watchlist.removeFromWatchlist(entry.id)
      showToast('Bon film !')
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      <div className="px-4 pt-6 pb-2">
        <h1 className="text-xl font-bold text-[var(--color-text)]">Soirée Ciné</h1>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">
          Trouvez le film parfait pour ce soir
        </p>
      </div>

      {/* Tabs */}
      <div className="flex mx-4 mb-4 rounded-xl bg-[var(--color-surface-2)] p-1">
        <button
          onClick={() => setTab('suggest')}
          className={[
            'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
            tab === 'suggest'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          Suggestion
        </button>
        <button
          onClick={() => setTab('pick')}
          className={[
            'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
            tab === 'pick'
              ? 'bg-[var(--color-accent)] text-white'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
          ].join(' ')}
        >
          Piocher dans la liste
        </button>
      </div>

      {tab === 'suggest' ? (
        <div className="px-4 space-y-4 pb-4">
          {/* Intro / start */}
          {!smartSuggestion.suggestion && !smartSuggestion.loading && !smartSuggestion.noMoreResults && (
            <div className="text-center py-8">
              <span className="text-6xl block mb-4">🎬</span>
              <p className="text-[var(--color-text)] font-medium mb-1">
                Laissez-nous vous suggérer un film
              </p>
              <p className="text-sm text-[var(--color-text-muted)] mb-6">
                {couple.entries.length + personal.entries.length > 0
                  ? 'Basé sur vos goûts et films déjà vus'
                  : 'Découvrez des films populaires bien notés'}
              </p>
              <button
                onClick={smartSuggestion.suggest}
                className="bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white px-8 py-3 rounded-xl font-medium text-sm transition-colors"
              >
                Suggérer un film
              </button>
            </div>
          )}

          {/* Loading */}
          {smartSuggestion.loading && (
            <div className="bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] h-64 animate-pulse" />
          )}

          {/* Suggestion card */}
          {smartSuggestion.suggestion && !smartSuggestion.loading && (
            <SuggestionCard
              movie={smartSuggestion.suggestion}
              genres={genres}
              onFeedback={smartSuggestion.giveFeedback}
              onAccept={handleAcceptSuggestion}
            />
          )}

          {/* No more results */}
          {smartSuggestion.noMoreResults && (
            <div className="text-center py-8">
              <span className="text-4xl block mb-3">🤷</span>
              <p className="text-[var(--color-text-muted)] text-sm mb-4">
                Plus de suggestions avec ces critères
              </p>
              <button
                onClick={smartSuggestion.reset}
                className="bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] px-6 py-2.5 rounded-xl text-sm font-medium border border-[var(--color-border)] transition-colors"
              >
                Recommencer
              </button>
            </div>
          )}
        </div>
      ) : (
        <WatchlistPicker
          entries={watchlist.entries}
          loading={watchlist.loading}
          onMarkWatched={handleMarkWatched}
        />
      )}
    </div>
  )
}
