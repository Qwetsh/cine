import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tmdb, getBackdropUrl, getPosterUrl } from '../lib/tmdb'
import { ensureMovie } from '../lib/movies'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { WatchProviders } from '../components/movie/WatchProviders'
import type { TmdbMovieDetail } from '../lib/tmdb'

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [movie, setMovie] = useState<TmdbMovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [onWatchlist, setOnWatchlist] = useState(false)
  const [inCollection, setInCollection] = useState(false)
  const [inPersonal, setInPersonal] = useState(false)
  const [actionLoading, setActionLoading] = useState<'watchlist' | 'collection' | 'personal' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    tmdb.getMovie(Number(id))
      .then(setMovie)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  // Vérifier le statut dans watchlist/collection/perso une fois le film chargé
  useEffect(() => {
    if (!movie) return

    async function checkStatus() {
      const { data: movieRow } = await supabase
        .from('movies')
        .select('id')
        .eq('tmdb_id', movie!.id)
        .maybeSingle()

      if (!movieRow) return

      if (coupleId) {
        const [wl, col] = await Promise.all([
          supabase.from('watchlist').select('id').eq('couple_id', coupleId).eq('movie_id', movieRow.id).maybeSingle(),
          supabase.from('collection').select('id').eq('couple_id', coupleId).eq('movie_id', movieRow.id).maybeSingle(),
        ])
        setOnWatchlist(!!wl.data)
        setInCollection(!!col.data)
      }

      if (user) {
        const { data } = await supabase.from('personal_collection').select('id').eq('user_id', user.id).eq('movie_id', movieRow.id).maybeSingle()
        setInPersonal(!!data)
      }
    }

    checkStatus()
  }, [movie, coupleId, user])

  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current) }
  }, [])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }, [])

  async function handleAddToWatchlist() {
    if (!user || !coupleId) { navigate('/profile'); return }
    if (!movie || actionLoading) return
    setActionLoading('watchlist')
    try {
      const movieDbId = await ensureMovie(movie)
      const { error } = await supabase.from('watchlist').insert({
        movie_id: movieDbId,
        added_by: user.id,
        couple_id: coupleId,
      })
      if (!error) {
        setOnWatchlist(true)
        showToast('Ajouté à la liste ✓')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkWatched() {
    if (!user || !coupleId) { navigate('/profile'); return }
    if (!movie || actionLoading) return
    setActionLoading('collection')
    try {
      const movieDbId = await ensureMovie(movie)
      // Retirer de la watchlist si présent
      if (onWatchlist) {
        const { data: wlRow } = await supabase
          .from('watchlist')
          .select('id')
          .eq('couple_id', coupleId)
          .eq('movie_id', movieDbId)
          .maybeSingle()
        if (wlRow) {
          await supabase.from('watchlist').delete().eq('id', wlRow.id)
          setOnWatchlist(false)
        }
      }
      const { error } = await supabase.from('collection').insert({
        movie_id: movieDbId,
        couple_id: coupleId,
        watched_at: new Date().toISOString(),
      })
      if (!error) {
        setInCollection(true)
        showToast('Ajouté à la collection ✓')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkPersonal() {
    if (!user) { navigate('/login'); return }
    if (!movie || actionLoading) return
    setActionLoading('personal')
    try {
      const movieDbId = await ensureMovie(movie)
      const { error } = await supabase.from('personal_collection').insert({
        movie_id: movieDbId,
        user_id: user.id,
        watched_at: new Date().toISOString(),
      })
      if (!error) {
        setInPersonal(true)
        showToast('Ajouté à ta collection perso ✓')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setActionLoading(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="aspect-video bg-[var(--color-surface-2)] animate-pulse" />
        <div className="p-4 space-y-3">
          <div className="h-6 bg-[var(--color-surface-2)] rounded animate-pulse w-3/4" />
          <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/4" />
          <div className="h-20 bg-[var(--color-surface-2)] rounded animate-pulse" />
        </div>
      </div>
    )
  }

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/')
    }
  }

  if (!movie) {
    return (
      <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
        <p>Film introuvable</p>
        <button onClick={goBack} className="mt-4 text-[var(--color-accent)]">← Retour</button>
      </div>
    )
  }

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null
  const director = movie.credits?.crew.find(c => c.job === 'Director')
  const cast = movie.credits?.cast.slice(0, 5) ?? []
  const runtime = movie.runtime
    ? `${Math.floor(movie.runtime / 60)}h${(movie.runtime % 60).toString().padStart(2, '0')}`
    : null

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Backdrop */}
      <div className="relative">
        <div className="aspect-video bg-[var(--color-surface-2)] overflow-hidden">
          <img
            src={getBackdropUrl(movie.backdrop_path, 'large')}
            alt={`Backdrop ${movie.title}`}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--color-bg)] via-transparent to-transparent" />
        </div>
        <button
          onClick={goBack}
          className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm text-white rounded-full w-9 h-9 flex items-center justify-center"
        >
          ←
        </button>
      </div>

      {/* Contenu */}
      <div className="px-4 -mt-10 relative">
        <div className="flex gap-4">
          <div className="w-24 flex-shrink-0 rounded-xl overflow-hidden shadow-xl">
            <img
              src={getPosterUrl(movie.poster_path, 'medium')}
              alt={`Affiche ${movie.title}`}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-0 pt-12">
            <h1 className="font-bold text-xl text-[var(--color-text)] leading-tight">{movie.title}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[var(--color-text-muted)]">
              {year && <span>{year}</span>}
              {runtime && <span>· {runtime}</span>}
              {movie.vote_average > 0 && (
                <span className="text-[var(--color-gold)]">★ {movie.vote_average.toFixed(1)}</span>
              )}
            </div>
          </div>
        </div>

        {movie.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {movie.genres.map(g => (
              <span key={g.id} className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                {g.name}
              </span>
            ))}
          </div>
        )}

        {movie.overview && (
          <div className="mt-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Synopsis</h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{movie.overview}</p>
          </div>
        )}

        {director && (
          <div className="mt-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Réalisé par</p>
            <button
              onClick={() => navigate(`/person/${director.id}`)}
              className="inline-flex items-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 transition-colors"
            >
              {director.profile_path ? (
                <img
                  src={getPosterUrl(director.profile_path, 'small').replace('/w185', '/w92')}
                  alt={director.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs">🎬</div>
              )}
              <span className="text-sm font-medium text-[var(--color-text)]">{director.name}</span>
              <span className="text-[var(--color-text-muted)] text-xs">›</span>
            </button>
          </div>
        )}

        {cast.length > 0 && (
          <div className="mt-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Avec</h2>
            <div className="flex flex-wrap gap-2">
              {cast.map(a => (
                <button
                  key={a.id}
                  onClick={() => navigate(`/person/${a.id}`)}
                  className="inline-flex items-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 transition-colors"
                >
                  {a.profile_path ? (
                    <img
                      src={getPosterUrl(a.profile_path, 'small').replace('/w185', '/w92')}
                      alt={a.name}
                      className="w-6 h-6 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-[10px]">🎭</div>
                  )}
                  <span className="text-xs text-[var(--color-text)]">{a.name}</span>
                  <span className="text-[var(--color-text-muted)] text-[10px]">›</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Où regarder */}
        <WatchProviders tmdbId={movie.id} />

        {/* Actions */}
        <div className="space-y-3 mt-6">
          {/* Couple actions */}
          {coupleId && (
            <div className="flex gap-3">
              {inCollection ? (
                <div className="flex-1 bg-[var(--color-surface)] text-green-400 rounded-xl py-3 text-sm font-medium text-center border border-green-400/30">
                  ✓ Vu ensemble
                </div>
              ) : (
                <>
                  <button
                    onClick={handleAddToWatchlist}
                    disabled={onWatchlist || actionLoading !== null}
                    className="flex-1 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-white rounded-xl py-3 font-medium text-sm transition-colors"
                  >
                    {actionLoading === 'watchlist'
                      ? '…'
                      : onWatchlist
                      ? '✓ Dans la liste'
                      : '+ À regarder'}
                  </button>
                  <button
                    onClick={handleMarkWatched}
                    disabled={actionLoading !== null}
                    className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-60 text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
                  >
                    {actionLoading === 'collection' ? '…' : '👫 Vu ensemble'}
                  </button>
                </>
              )}
            </div>
          )}

          {/* Personal action */}
          {inPersonal ? (
            <div className="bg-[var(--color-surface)] text-green-400 rounded-xl py-3 text-sm font-medium text-center border border-green-400/30">
              ✓ Dans ma collection perso
            </div>
          ) : (
            <button
              onClick={handleMarkPersonal}
              disabled={actionLoading !== null}
              className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-60 text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
            >
              {actionLoading === 'personal' ? '…' : '🎬 Vu en solo'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
