import { Component, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useCollection } from '../hooks/useCollection'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useGenres } from '../hooks/useGenres'
import { usePreferences } from '../hooks/usePreferences'
import { useSmartSuggestion } from '../hooks/useSmartSuggestion'
import { SwipeCard } from '../components/movienight/SwipeCard'
import { WatchlistPicker } from '../components/movienight/WatchlistPicker'
import { DuelMode } from '../components/movienight/DuelMode'
import { QuizMode } from '../components/movienight/QuizMode'
import { TournamentMode } from '../components/tournament/TournamentMode'
import { ensureMovie } from '../lib/movies'
import { supabase } from '../lib/supabase'
import type { TmdbMovie } from '../lib/tmdb'
import type { WatchlistMovieEntry } from '../types'

type Tab = 'suggest' | 'pick' | 'duel'
type Section = 'menu' | 'film' | 'quiz'

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

  const [section, setSection] = useState<Section>('menu')
  const [tab, setTab] = useState<Tab>('suggest')
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizStartScreen, setQuizStartScreen] = useState<'solo' | '1v1'>('solo')
  const [showTournament, setShowTournament] = useState(false)
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

  // Quiz mode takes over the whole page
  if (showQuiz) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-6 pb-4">
          <button
            onClick={() => setShowQuiz(false)}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            CinéQuiz
          </button>
        </div>
        <GameErrorBoundary onReset={() => setShowQuiz(false)}>
          <QuizMode startScreen={quizStartScreen} />
        </GameErrorBoundary>
      </div>
    )
  }

  // Tournament mode takes over the whole page
  if (showTournament) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-6 pb-4">
          <button
            onClick={() => setShowTournament(false)}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            CinéQuiz
          </button>
        </div>
        <GameErrorBoundary onReset={() => setShowTournament(false)}>
          <TournamentMode />
        </GameErrorBoundary>
      </div>
    )
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
        {section === 'menu' ? (
          <>
            <h1 className="text-xl font-bold text-[var(--color-text)]">Soirée Ciné</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Trouvez le film parfait pour ce soir
            </p>
          </>
        ) : (
          <button
            onClick={() => setSection('menu')}
            className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors mb-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
            Soirée Ciné
          </button>
        )}
      </div>

      {/* === MENU PRINCIPAL === */}
      {section === 'menu' && (
        <div className="px-4 space-y-3 pb-4">
          <button
            onClick={() => setSection('film')}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🎬</span>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)]">Choisir un film</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Suggestion, pioche dans la liste ou duel
                </p>
              </div>
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>

          <button
            onClick={() => setSection('quiz')}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-5 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <span className="text-3xl">🧠</span>
              </div>
              <div className="text-left flex-1 min-w-0">
                <p className="font-semibold text-[var(--color-text)]">CinéQuiz</p>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  Quiz et tournoi pour tester vos connaissances
                </p>
              </div>
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="text-[var(--color-text-muted)] group-hover:text-yellow-500 transition-colors flex-shrink-0"
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </div>
          </button>
        </div>
      )}

      {/* === SECTION CHOISIR UN FILM === */}
      {section === 'film' && (
        <>
          <div className="px-4 pb-2">
            <h2 className="text-lg font-bold text-[var(--color-text)]">Choisir un film</h2>
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
              Piocher
            </button>
            <button
              onClick={() => setTab('duel')}
              className={[
                'flex-1 py-2 rounded-lg text-xs font-medium transition-colors',
                tab === 'duel'
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]',
              ].join(' ')}
            >
              Duel
            </button>
          </div>

          {tab === 'suggest' ? (
            <div className="px-4 space-y-4 pb-4">
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

              {(smartSuggestion.suggestion || smartSuggestion.loading) && !smartSuggestion.noMoreResults && (
                <SwipeCard
                  movie={smartSuggestion.suggestion ?? ({} as TmdbMovie)}
                  genres={genres}
                  onFeedback={smartSuggestion.giveFeedback}
                  onAccept={handleAcceptSuggestion}
                  loading={smartSuggestion.loading}
                />
              )}

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
          ) : tab === 'pick' ? (
            <WatchlistPicker
              entries={watchlist.entries}
              loading={watchlist.loading}
              onMarkWatched={handleMarkWatched}
            />
          ) : (
            <DuelMode />
          )}
        </>
      )}

      {/* === SECTION CINÉQUIZ === */}
      {section === 'quiz' && (
        <>
          <div className="px-4 pb-2">
            <h2 className="text-lg font-bold text-[var(--color-text)]">CinéQuiz</h2>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              Testez vos connaissances cinéma
            </p>
          </div>

          <div className="px-4 space-y-3 pb-4">
            <button
              onClick={() => { setShowQuiz(true); setQuizStartScreen('solo') }}
              className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-4 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-[var(--color-accent)]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🧠</span>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text)] text-sm">Quiz Solo</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Testez vos connaissances seul
                  </p>
                </div>
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors flex-shrink-0"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => { setShowQuiz(true); setQuizStartScreen('1v1') }}
              className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-4 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">⚔️</span>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text)] text-sm">Quiz 1v1</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Défiez un ami en temps réel
                  </p>
                </div>
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-[var(--color-text-muted)] group-hover:text-purple-500 transition-colors flex-shrink-0"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>

            <button
              onClick={() => setShowTournament(true)}
              className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-2xl p-4 transition-colors group"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-2xl">🗺️</span>
                </div>
                <div className="text-left flex-1 min-w-0">
                  <p className="font-medium text-[var(--color-text)] text-sm">Tournoi Ciné</p>
                  <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                    Plateau de jeu — rues thématiques et fight final
                  </p>
                </div>
                <svg
                  width="20" height="20" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="text-[var(--color-text-muted)] group-hover:text-yellow-500 transition-colors flex-shrink-0"
                >
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

// Error boundary to catch crashes in game modes and return to Soirée Ciné
class GameErrorBoundary extends Component<
  { children: ReactNode; onReset: () => void },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Game mode crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block">💥</span>
          <p className="text-[var(--color-text)] font-medium">Oups, quelque chose a planté</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            Le mode de jeu a rencontré une erreur.
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false })
              this.props.onReset()
            }}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            Retour à Soirée Ciné
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
