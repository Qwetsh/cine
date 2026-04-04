import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCoupleContext } from '../../contexts/CoupleContext'
import { useQuizLobby } from '../../hooks/useQuizLobby'
import type { QuizTheme } from '../../hooks/useQuizLobby'
import { tmdb, getPosterUrl, COUNTRIES } from '../../lib/tmdb'
import type { TmdbPerson, TmdbMovie } from '../../lib/tmdb'
import { generateQuestions, generateQuestionsFromTwoFilms, generatePosterQuestions, selectQuestions, createEmptyQuizData } from '../../lib/quiz'
import type { QuizData } from '../../lib/quiz'
import { LobbyPicking } from './LobbyPicking'
import { QuizGame } from './QuizGame'

const DECADES = [
  { label: '80s', start: 1980, end: 1989 },
  { label: '90s', start: 1990, end: 1999 },
  { label: '2000s', start: 2000, end: 2009 },
  { label: '2010s', start: 2010, end: 2019 },
  { label: '2020s', start: 2020, end: 2029 },
]

const THEME_LABELS: Record<QuizTheme, string> = {
  actor: '🎭 Acteur',
  director: '🎬 Réalisateur',
  country: '🌍 Pays',
  decade: '📅 Décennie',
  poster: '🖼️ Affiche floue',
  general: '🎲 Général',
}

export function QuizMode() {
  const { user } = useAuth()
  const { coupleId, partner, isUser1 } = useCoupleContext()
  const quiz = useQuizLobby(coupleId, user?.id ?? null, isUser1)

  const partnerName = partner?.display_name ?? 'Partenaire'

  // Track if partner left mid-quiz
  const [partnerLeft, setPartnerLeft] = useState(false)
  const prevSessionRef = useRef<typeof quiz.session>(null)

  useEffect(() => {
    const prev = prevSessionRef.current
    // Session was active (playing/setup with theme) and now it's gone → partner left
    if (prev && !quiz.session && (prev.status === 'playing' || (prev.status === 'setup' && prev.theme))) {
      // Only show "partner left" if WE didn't cancel it ourselves
      setPartnerLeft(true)
    }
    prevSessionRef.current = quiz.session
  }, [quiz.session])

  if (!coupleId) {
    return (
      <div className="flex flex-col items-center py-16 text-[var(--color-text-muted)]">
        <span className="text-5xl mb-4">💑</span>
        <p className="font-medium">Liez vos comptes d'abord</p>
        <p className="text-sm mt-1">Le quiz nécessite un couple configuré</p>
      </div>
    )
  }

  if (quiz.loading) {
    return (
      <div className="px-4 py-8">
        <div className="h-40 bg-[var(--color-surface)] rounded-2xl animate-pulse border border-[var(--color-border)]" />
      </div>
    )
  }

  // Partner left message
  if (partnerLeft && !quiz.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">👋</span>
        <p className="text-[var(--color-text)] font-medium">
          {partnerName} a quitté le quiz
        </p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La session a été interrompue
        </p>
        <button
          onClick={() => setPartnerLeft(false)}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          OK
        </button>
      </div>
    )
  }

  // No active session → choose quiz type
  if (!quiz.session) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-6xl block">🧠</span>
        <p className="text-[var(--color-text)] font-medium">Quiz Ciné</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          Testez vos connaissances ciné en duo !
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => quiz.create('classic')}
            className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
          >
            🎯 Quiz Classique
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            Choisissez un thème et répondez ensemble
          </p>
          <button
            onClick={() => quiz.create('fight')}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3.5 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            ⚔️ Quiz Fight
          </button>
          <p className="text-xs text-[var(--color-text-muted)]">
            Chacun choisit le film des questions de l'autre
          </p>
        </div>
      </div>
    )
  }

  const { session } = quiz
  const isCreator = session.created_by === user?.id

  // Done → results
  if (session.status === 'done') {
    const myScore = isUser1 ? session.score_user1 : session.score_user2
    const theirScore = isUser1 ? session.score_user2 : session.score_user1
    const winner = myScore > theirScore ? 'Toi'
      : theirScore > myScore ? partnerName
      : 'Égalité'

    return (
      <div className="px-4 text-center py-8 space-y-5">
        <span className="text-6xl block">🏆</span>
        <p className="text-xl font-bold text-[var(--color-text)]">
          {winner === 'Égalité' ? 'Égalité !' : `${winner} gagne !`}
        </p>
        <div className="flex justify-center gap-8">
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">Toi</p>
            <p className="text-3xl font-bold text-[var(--color-accent)]">{myScore}</p>
          </div>
          <div className="text-[var(--color-text-muted)] self-center text-lg">vs</div>
          <div className="text-center">
            <p className="text-xs text-[var(--color-text-muted)]">{partnerName}</p>
            <p className="text-3xl font-bold text-red-400">{theirScore}</p>
          </div>
        </div>
        {session.theme && (
          <p className="text-sm text-[var(--color-text-muted)]">
            {THEME_LABELS[session.theme]}
            {session.theme_value ? ` — ${session.theme_value}` : ''}
          </p>
        )}
        <button
          onClick={quiz.dismiss}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3 font-medium text-sm transition-colors"
        >
          Terminer
        </button>
      </div>
    )
  }

  // Classic: setup phase
  if (session.type === 'classic' && session.status === 'setup') {
    // Theme not yet chosen → creator picks theme
    if (!session.theme) {
      if (isCreator) {
        return (
          <ClassicSetup
            onSelectTheme={quiz.setTheme}
            onCancel={quiz.cancel}
          />
        )
      }
      // Partner waiting for creator to pick theme
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block animate-pulse">🎯</span>
          <p className="text-[var(--color-text)] font-medium">Quiz Classique</p>
          <p className="text-sm text-[var(--color-text-muted)]">
            {partnerName} choisit le thème du quiz…
          </p>
          <button
            onClick={quiz.cancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Quitter
          </button>
        </div>
      )
    }

    // Theme chosen → waiting for partner to join
    if (isCreator) {
      return (
        <div className="px-4 text-center py-12 space-y-4">
          <span className="text-5xl block">🎯</span>
          <p className="text-[var(--color-text)] font-medium">Quiz Classique</p>
          <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
            <p className="text-sm text-[var(--color-text-muted)]">Thème choisi :</p>
            <p className="text-lg font-bold text-[var(--color-text)] mt-1">
              {THEME_LABELS[session.theme]}
              {session.theme_value ? ` — ${session.theme_value}` : ''}
            </p>
          </div>
          <div className="animate-pulse">
            <span className="text-3xl">⏳</span>
          </div>
          <p className="text-sm text-[var(--color-text-muted)]">
            En attente de {partnerName}…
          </p>
          <button
            onClick={quiz.cancel}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
          >
            Annuler
          </button>
        </div>
      )
    }

    // Partner sees the invite → can join
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">🎯</span>
        <p className="text-[var(--color-text)] font-medium">
          {partnerName} te lance un Quiz !
        </p>
        <div className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4">
          <p className="text-sm text-[var(--color-text-muted)]">Thème :</p>
          <p className="text-lg font-bold text-[var(--color-text)] mt-1">
            {THEME_LABELS[session.theme]}
            {session.theme_value ? ` — ${session.theme_value}` : ''}
          </p>
        </div>
        <button
          onClick={quiz.startPlaying}
          className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white rounded-xl py-3.5 font-medium text-sm transition-colors"
        >
          Rejoindre le quiz !
        </button>
        <button
          onClick={quiz.cancel}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
        >
          Refuser
        </button>
      </div>
    )
  }

  // Fight: picking films
  if (session.type === 'fight' && session.status === 'picking') {
    return (
      <LobbyPicking
        myFilm={quiz.myFilm ?? null}
        partnerFilm={quiz.partnerFilm ?? null}
        partnerName={partnerName}
        onSubmit={quiz.submitFilm}
        onCancel={quiz.cancel}
      />
    )
  }

  // Playing → generate questions if needed, then QuizGame
  if (session.status === 'playing') {
    return (
      <QuizPlayPhase
        quiz={quiz}
        partnerName={partnerName}
        isUser1={isUser1}
      />
    )
  }

  return null
}

// ── Classic Setup: choose theme (creator only) ──

function ClassicSetup({
  onSelectTheme,
  onCancel,
}: {
  onSelectTheme: (theme: QuizTheme, value?: string) => Promise<void>
  onCancel: () => Promise<void>
}) {
  const [theme, setTheme] = useState<QuizTheme | null>(null)
  const [themeValue, setThemeValue] = useState('')
  const [personQuery, setPersonQuery] = useState('')
  const [personResults, setPersonResults] = useState<TmdbPerson[]>([])
  const [searching, setSearching] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  function handlePersonSearch(value: string) {
    setPersonQuery(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!value.trim()) { setPersonResults([]); return }
    debounceRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await tmdb.searchPerson(value.trim())
        const dept = theme === 'actor' ? 'Acting' : 'Directing'
        setPersonResults(data.results.filter(p => p.known_for_department === dept).slice(0, 6))
      } catch { /* ignore */ }
      setSearching(false)
    }, 400)
  }

  function selectPerson(person: TmdbPerson) {
    setThemeValue(person.name)
    setPersonQuery('')
    setPersonResults([])
  }

  async function handleConfirmTheme() {
    if (!theme || submitting) return
    setSubmitting(true)
    // Save theme — status stays 'setup', partner will see the invite
    await onSelectTheme(theme, themeValue || undefined)
    setSubmitting(false)
  }

  const needsPersonSearch = theme === 'actor' || theme === 'director'
  const needsSelection = needsPersonSearch || theme === 'country' || theme === 'decade'
  const canConfirm = theme && (!needsSelection || themeValue)

  return (
    <div className="px-4 space-y-4">
      <div className="text-center">
        <span className="text-5xl block mb-2">🎯</span>
        <p className="text-[var(--color-text)] font-medium">Quiz Classique</p>
        <p className="text-sm text-[var(--color-text-muted)] mt-1">Choisissez un thème</p>
      </div>

      {/* Theme buttons */}
      <div className="grid grid-cols-2 gap-2">
        {(Object.entries(THEME_LABELS) as [QuizTheme, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => { setTheme(key); setThemeValue('') }}
            className={[
              'rounded-xl border p-3 text-sm font-medium transition-all',
              theme === key
                ? 'bg-[var(--color-accent)]/20 border-[var(--color-accent)] text-[var(--color-accent)]'
                : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text)] hover:bg-[var(--color-surface-2)]',
            ].join(' ')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Person search (actor/director) */}
      {needsPersonSearch && (
        <div>
          {themeValue ? (
            <div className="flex items-center gap-2 bg-[var(--color-surface)] rounded-xl border border-[var(--color-accent)] p-3">
              <span className="text-sm font-medium text-[var(--color-text)] flex-1">{themeValue}</span>
              <button
                onClick={() => setThemeValue('')}
                className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
              >
                Changer
              </button>
            </div>
          ) : (
            <>
              <input
                type="search"
                value={personQuery}
                onChange={e => handlePersonSearch(e.target.value)}
                placeholder={theme === 'actor' ? 'Rechercher un acteur…' : 'Rechercher un réalisateur…'}
                className="w-full bg-[var(--color-surface)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] px-4 py-2.5 rounded-xl border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] text-sm"
                autoFocus
              />
              {searching && <p className="text-xs text-[var(--color-text-muted)] mt-2">Recherche…</p>}
              {personResults.length > 0 && (
                <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                  {personResults.map(p => (
                    <li key={p.id}>
                      <button
                        onClick={() => selectPerson(p)}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-[var(--color-surface-2)] transition-colors text-left"
                      >
                        <div className="w-8 h-8 flex-shrink-0 rounded-full overflow-hidden bg-[var(--color-surface-2)]">
                          {p.profile_path ? (
                            <img src={getPosterUrl(p.profile_path, 'small')} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-[var(--color-text-muted)]">?</div>
                          )}
                        </div>
                        <span className="text-sm text-[var(--color-text)]">{p.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Country picker */}
      {theme === 'country' && (
        <div className="flex flex-wrap gap-2">
          {COUNTRIES.slice(0, 12).map(c => (
            <button
              key={c.code}
              onClick={() => setThemeValue(c.code)}
              className={[
                'px-3 py-1.5 rounded-full text-xs font-medium transition-colors border',
                themeValue === c.code
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* Decade picker */}
      {theme === 'decade' && (
        <div className="flex gap-2">
          {DECADES.map(d => (
            <button
              key={d.label}
              onClick={() => setThemeValue(d.label)}
              className={[
                'flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors border',
                themeValue === d.label
                  ? 'bg-[var(--color-accent)] text-white border-[var(--color-accent)]'
                  : 'bg-[var(--color-surface)] text-[var(--color-text)] border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
              ].join(' ')}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {/* Confirm theme button (sends invite to partner) */}
      <button
        onClick={handleConfirmTheme}
        disabled={!canConfirm || submitting}
        className={[
          'w-full rounded-xl py-3 font-medium text-sm transition-colors',
          canConfirm && !submitting
            ? 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white'
            : 'bg-[var(--color-surface-2)] text-[var(--color-text-muted)] cursor-not-allowed',
        ].join(' ')}
      >
        {submitting ? 'Envoi…' : 'Proposer ce thème'}
      </button>

      <button
        onClick={onCancel}
        className="w-full text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] py-2 transition-colors"
      >
        Annuler
      </button>
    </div>
  )
}

// ── Play Phase: generate questions + QuizGame + quit button ──

function QuizPlayPhase({
  quiz,
  partnerName,
  isUser1,
}: {
  quiz: ReturnType<typeof useQuizLobby>
  partnerName: string
  isUser1: boolean
}) {
  const generatingRef = useRef(false)
  const [confirmQuit, setConfirmQuit] = useState(false)
  const { session } = quiz
  const quizData = session?.quiz_data as QuizData | null

  // Host generates questions
  useEffect(() => {
    if (!isUser1 || generatingRef.current || !session) return
    if (quizData && quizData.questions.length > 0) return

    generatingRef.current = true

    async function generate() {
      try {
        if (session!.type === 'fight') {
          const film1 = session!.film_user1
          const film2 = session!.film_user2
          if (!film1 || !film2) return

          const [m1, m2] = await Promise.all([
            tmdb.getMovie(film1.tmdb_id),
            tmdb.getMovie(film2.tmdb_id),
          ])
          const questions = generateQuestionsFromTwoFilms(m1, m2, 10)
          const data = createEmptyQuizData()
          data.questions = questions
          data.answers_user1 = new Array(questions.length).fill(null)
          data.answers_user2 = new Array(questions.length).fill(null)
          data.times_user1 = new Array(questions.length).fill(null)
          data.times_user2 = new Array(questions.length).fill(null)
          data.phase = 'countdown'
          await quiz.updateQuizData(data)
        } else {
          const movies = await discoverMoviesByTheme(
            session!.theme as QuizTheme,
            session!.theme_value
          )

          let questions
          if (session!.theme === 'poster') {
            // Poster mode: use movie titles + posters directly
            questions = generatePosterQuestions(movies.slice(0, 20), 10)
          } else {
            // Standard: fetch details and generate varied questions
            const details = await Promise.all(
              movies.slice(0, 5).map(m => tmdb.getMovie(m.id))
            )
            const pool = details.flatMap(m => generateQuestions(m))
            questions = selectQuestions(pool, 10)
          }

          if (questions.length === 0) {
            console.error('No questions generated')
            return
          }

          const data = createEmptyQuizData()
          data.questions = questions
          data.answers_user1 = new Array(questions.length).fill(null)
          data.answers_user2 = new Array(questions.length).fill(null)
          data.times_user1 = new Array(questions.length).fill(null)
          data.times_user2 = new Array(questions.length).fill(null)
          data.phase = 'countdown'
          await quiz.updateQuizData(data)
        }
      } catch (err) {
        console.error('Quiz generation error:', err)
      }
    }

    generate()
  }, [isUser1, session, quizData, quiz])

  const handleAdvance = useCallback((nextIndex: number, phase: QuizData['phase']) => {
    quiz.advanceQuiz(nextIndex, phase)
  }, [quiz])

  const handleGameEnd = useCallback((s1: number, s2: number) => {
    quiz.finish(s1, s2)
  }, [quiz])

  // Quit confirmation overlay
  if (confirmQuit) {
    return (
      <div className="px-4 text-center py-12 space-y-4">
        <span className="text-5xl block">⚠️</span>
        <p className="text-[var(--color-text)] font-medium">Quitter le quiz ?</p>
        <p className="text-sm text-[var(--color-text-muted)]">
          La session sera terminée pour les deux joueurs.
        </p>
        <div className="space-y-3 pt-2">
          <button
            onClick={() => quiz.cancel()}
            className="w-full bg-red-500 hover:bg-red-600 text-white rounded-xl py-3 font-medium text-sm transition-colors"
          >
            Oui, quitter
          </button>
          <button
            onClick={() => setConfirmQuit(false)}
            className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
          >
            Reprendre le quiz
          </button>
        </div>
      </div>
    )
  }

  if (!quizData || quizData.questions.length === 0) {
    return (
      <div className="px-4 text-center py-16">
        <span className="text-5xl block mb-4 animate-pulse">🧠</span>
        <p className="text-sm text-[var(--color-text-muted)]">Génération des questions...</p>
        <button
          onClick={() => setConfirmQuit(true)}
          className="mt-6 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
        >
          Quitter
        </button>
      </div>
    )
  }

  return (
    <div>
      <QuizGame
        quizData={quizData}
        partnerName={partnerName}
        isUser1={isUser1}
        isHost={isUser1}
        onAnswer={quiz.submitQuizAnswer}
        onAdvance={handleAdvance}
        onGameEnd={handleGameEnd}
      />
      {/* Quit button below the quiz */}
      <div className="px-4 pt-4 pb-2">
        <button
          onClick={() => setConfirmQuit(true)}
          className="w-full text-sm text-[var(--color-text-muted)] hover:text-red-400 py-2 transition-colors"
        >
          Quitter le quiz
        </button>
      </div>
    </div>
  )
}

// ── Helpers ──

async function discoverMoviesByTheme(
  theme: QuizTheme,
  themeValue: string | null,
): Promise<TmdbMovie[]> {
  switch (theme) {
    case 'actor': {
      if (!themeValue) return []
      const people = await tmdb.searchPerson(themeValue)
      const actor = people.results.find(p => p.known_for_department === 'Acting')
      if (!actor) return []
      const result = await tmdb.discoverMovies({
        with_cast: String(actor.id),
        sort_by: 'popularity.desc',
        'vote_count.gte': '50',
      })
      return result.results
    }
    case 'director': {
      if (!themeValue) return []
      const people = await tmdb.searchPerson(themeValue)
      const director = people.results.find(p => p.known_for_department === 'Directing')
      if (!director) return []
      const result = await tmdb.discoverMovies({
        with_crew: String(director.id),
        sort_by: 'popularity.desc',
        'vote_count.gte': '50',
      })
      return result.results
    }
    case 'country': {
      if (!themeValue) return []
      const result = await tmdb.discoverMovies({
        with_origin_country: themeValue,
        sort_by: 'popularity.desc',
        'vote_count.gte': '100',
      })
      return result.results
    }
    case 'decade': {
      const decade = DECADES.find(d => d.label === themeValue)
      if (!decade) return []
      const result = await tmdb.discoverMovies({
        'primary_release_date.gte': `${decade.start}-01-01`,
        'primary_release_date.lte': `${decade.end}-12-31`,
        sort_by: 'popularity.desc',
        'vote_count.gte': '200',
      })
      return result.results
    }
    case 'general':
    default: {
      const page = Math.floor(Math.random() * 5) + 1
      const result = await tmdb.discoverMovies({
        sort_by: 'popularity.desc',
        'vote_count.gte': '500',
        page,
      })
      return result.results
    }
  }
}
