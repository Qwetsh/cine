import { Component, useEffect, useMemo, useState } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useWatchlist } from '../hooks/useWatchlist'
import { useCollection } from '../hooks/useCollection'
import { usePersonalCollection } from '../hooks/usePersonalCollection'
import { useTvWatchlist } from '../hooks/useTvWatchlist'
import { useTvCollection } from '../hooks/useTvCollection'
import { useGenres } from '../hooks/useGenres'
import { usePreferences } from '../hooks/usePreferences'
import { useSettings } from '../hooks/useSettings'
import { useSmartSuggestion } from '../hooks/useSmartSuggestion'
import { SwipeCard } from '../components/movienight/SwipeCard'
import { WatchlistPicker } from '../components/movienight/WatchlistPicker'
import { DuelMode } from '../components/movienight/DuelMode'
import { QuizMode } from '../components/movienight/QuizMode'
import { ensureMovie } from '../lib/movies'
import { ensureTvShow } from '../lib/tvShows'
import { tvShowToPosterMovie } from '../lib/media'
import { supabase } from '../lib/supabase'
import { tmdb } from '../lib/tmdb'
import type { TmdbMovie } from '../lib/tmdb'
import type { UnifiedWatchlistEntry } from '../types'

type Tab = 'suggest' | 'pick' | 'duel'
type Section = 'menu' | 'film' | 'quiz'

export function MovieNightPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()
  const { settings } = useSettings()
  const includeSeries = !settings.hideSeries
  const watchlist = useWatchlist(coupleId)
  const couple = useCollection(coupleId)
  const personal = usePersonalCollection(user?.id ?? null)
  const tvWatchlist = useTvWatchlist(includeSeries ? coupleId : null)
  const tvCollection = useTvCollection(coupleId)
  const { genres } = useGenres()
  const preferences = usePreferences(couple.entries, personal.entries)
  const smartSuggestion = useSmartSuggestion(preferences, genres, includeSeries)

  // Watchlist mixte films + séries pour la pioche
  const unifiedWatchlist: UnifiedWatchlistEntry[] = useMemo(() => [
    ...watchlist.entries.map(e => ({ ...e, media_type: 'movie' as const })),
    ...tvWatchlist.entries.map(e => ({
      id: e.id,
      added_by: e.added_by,
      note: e.note,
      created_at: e.created_at,
      movie: tvShowToPosterMovie(e.tv_show),
      media_type: 'tv' as const,
      season_number: e.season_number,
      number_of_seasons: e.tv_show.number_of_seasons,
    })),
  ], [watchlist.entries, tvWatchlist.entries])

  const [section, setSection] = useState<Section>('menu')
  const [tab, setTab] = useState<Tab>('suggest')
  const [showQuiz, setShowQuiz] = useState(false)
  const [quizStartScreen, setQuizStartScreen] = useState<'solo' | '1v1'>('solo')
  const [toast, setToast] = useState<string | null>(null)

  // Deep links de défi quiz : ?join=CODE (défi reçu via push) et
  // ?challenge=USERID (bouton ⚔️ sur un ami). Capturés une fois puis
  // retirés de l'URL.
  const [searchParams, setSearchParams] = useSearchParams()
  const [quizJoinCode] = useState(() => searchParams.get('join'))
  const [challengeUserId] = useState(() => searchParams.get('challenge'))
  useEffect(() => {
    if (quizJoinCode || challengeUserId) {
      setShowQuiz(true)
      setQuizStartScreen('1v1')
      setSearchParams({}, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleAcceptSuggestion(movie: TmdbMovie) {
    if (!user || !coupleId) {
      navigate('/profile')
      return
    }
    const isTv = (movie as TmdbMovie & { media_type?: string }).media_type === 'tv'
    const alreadyIn = isTv
      ? tvWatchlist.entries.some(e => e.tv_show.tmdb_id === movie.id)
      : watchlist.entries.some(e => e.movie.tmdb_id === movie.id)
    if (alreadyIn) {
      showToast('Déjà dans la liste')
      smartSuggestion.reset()
      return
    }
    try {
      let error: { code?: string } | null
      if (isTv) {
        // Objet normalisé : refetch de la fiche TV brute avant insertion
        const tvDbId = await ensureTvShow(await tmdb.getTvShow(movie.id))
        ;({ error } = await supabase.from('tv_watchlist').insert({
          tv_show_id: tvDbId,
          added_by: user.id,
          couple_id: coupleId,
        }))
      } else {
        const movieDbId = await ensureMovie(movie)
        ;({ error } = await supabase.from('watchlist').insert({
          movie_id: movieDbId,
          added_by: user.id,
          couple_id: coupleId,
        }))
      }
      if (error) {
        showToast(error.code === '23505' ? 'Déjà dans la liste' : "Échec de l'ajout, réessaie")
        return
      }
      showToast('Ajouté à la liste !')
      smartSuggestion.reset()
    } catch (e) {
      console.error(e)
      showToast("Échec de l'ajout, réessaie")
    }
  }

  async function handleMarkWatched(entry: UnifiedWatchlistEntry) {
    if (!coupleId) return
    const { error } = entry.media_type === 'tv'
      ? await tvCollection.addToTvCollection(entry.movie.id)
      : await couple.addToCollection(entry.movie.id)
    if (!error) {
      if (entry.media_type === 'tv') await tvWatchlist.removeFromTvWatchlist(entry.id)
      else await watchlist.removeFromWatchlist(entry.id)
      showToast(entry.media_type === 'tv' ? 'Bonne série !' : 'Bon film !')
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
          <QuizMode
            startScreen={quizStartScreen}
            initialJoinCode={quizJoinCode}
            challengeUserId={challengeUserId}
          />
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
                  Quiz pour tester vos connaissances
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
              entries={unifiedWatchlist}
              loading={watchlist.loading || tvWatchlist.loading}
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
