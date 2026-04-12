import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tmdb, getBackdropUrl, getPosterUrl } from '../lib/tmdb'
import { ensureMovie } from '../lib/movies'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useToast } from '../hooks/useToast'
import { WatchProviders } from '../components/movie/WatchProviders'
import { RecommendButton } from '../components/movie/RecommendButton'
import { FriendsCard } from '../components/movie/FriendsCard'
import { TrailerButton } from '../components/movie/TrailerButton'
import { MovieCollection } from '../components/movie/MovieCollection'
import { CastCrewSheet } from '../components/movie/CastCrewSheet'
import { BookSource } from '../components/movie/BookSource'
import { GameSource } from '../components/movie/GameSource'
import { MusicSource } from '../components/movie/MusicSource'
import { AwardsButton } from '../components/movie/AwardsButton'
import { useSettings } from '../hooks/useSettings'
import type { TmdbMovieDetail } from '../lib/tmdb'

export function MovieDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [movie, setMovie] = useState<TmdbMovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [onWatchlistSolo, setOnWatchlistSolo] = useState(false)
  const [onWatchlistCouple, setOnWatchlistCouple] = useState(false)
  const [inCollection, setInCollection] = useState(false)
  const [inPersonal, setInPersonal] = useState(false)
  const [actionLoading, setActionLoading] = useState<'wl-solo' | 'wl-couple' | 'collection' | 'personal' | null>(null)
  const [showCastSheet, setShowCastSheet] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()
  const { toast, showToast } = useToast()
  const { settings } = useSettings()

  useEffect(() => {
    if (!id) return
    setLoading(true)
    setOnWatchlistSolo(false)
    setOnWatchlistCouple(false)
    setInCollection(false)
    setInPersonal(false)
    tmdb.getMovie(Number(id))
      .then(setMovie)
      .catch(() => setLoading(false))
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

      if (!movieRow) {
        setOnWatchlistSolo(false)
        setOnWatchlistCouple(false)
        setInCollection(false)
        setInPersonal(false)
        return
      }

      if (user) {
        // Solo watchlist — toujours vérifier
        const { data: wlSolo } = await supabase.from('watchlist').select('id').is('couple_id', null).eq('added_by', user.id).eq('movie_id', movieRow.id).maybeSingle()
        setOnWatchlistSolo(!!wlSolo)

        // Collection perso
        const { data: perso } = await supabase.from('personal_collection').select('id').eq('user_id', user.id).eq('movie_id', movieRow.id).maybeSingle()
        setInPersonal(!!perso)
      }

      if (coupleId) {
        const [wlCouple, col] = await Promise.all([
          supabase.from('watchlist').select('id').eq('couple_id', coupleId).eq('movie_id', movieRow.id).maybeSingle(),
          supabase.from('collection').select('id').eq('couple_id', coupleId).eq('movie_id', movieRow.id).maybeSingle(),
        ])
        setOnWatchlistCouple(!!wlCouple.data)
        setInCollection(!!col.data)
      }
    }

    checkStatus()
  }, [movie, coupleId, user])

  async function handleToggleWatchlistSolo() {
    if (!user) { navigate('/login'); return }
    if (!movie || actionLoading) return
    setActionLoading('wl-solo')
    try {
      const movieDbId = await ensureMovie(movie)
      if (onWatchlistSolo) {
        const { data: row } = await supabase.from('watchlist').select('id').is('couple_id', null).eq('added_by', user.id).eq('movie_id', movieDbId).maybeSingle()
        if (row) await supabase.from('watchlist').delete().eq('id', row.id)
        setOnWatchlistSolo(false)
        showToast('Retiré de ta liste solo')
      } else {
        const { error } = await supabase.from('watchlist').insert({ movie_id: movieDbId, added_by: user.id, couple_id: null })
        if (!error) { setOnWatchlistSolo(true); showToast('Ajouté à ta liste solo ✓') }
      }
    } catch {
      showToast('Erreur')
    } finally { setActionLoading(null) }
  }

  async function handleToggleWatchlistCouple() {
    if (!user || !coupleId) return
    if (!movie || actionLoading) return
    setActionLoading('wl-couple')
    try {
      const movieDbId = await ensureMovie(movie)
      if (onWatchlistCouple) {
        const { data: row } = await supabase.from('watchlist').select('id').eq('couple_id', coupleId).eq('movie_id', movieDbId).maybeSingle()
        if (row) await supabase.from('watchlist').delete().eq('id', row.id)
        setOnWatchlistCouple(false)
        showToast('Retiré de la liste couple')
      } else {
        const { error } = await supabase.from('watchlist').insert({ movie_id: movieDbId, added_by: user.id, couple_id: coupleId })
        if (!error) { setOnWatchlistCouple(true); showToast('Ajouté à la liste couple ✓') }
      }
    } catch {
      showToast('Erreur')
    } finally { setActionLoading(null) }
  }

  async function handleMarkWatched() {
    if (!user || !coupleId) return
    if (!movie || actionLoading) return
    setActionLoading('collection')
    try {
      const movieDbId = await ensureMovie(movie)
      // Retirer de la watchlist couple si présent
      if (onWatchlistCouple) {
        const { data: wlRow } = await supabase.from('watchlist').select('id').eq('couple_id', coupleId).eq('movie_id', movieDbId).maybeSingle()
        if (wlRow) { await supabase.from('watchlist').delete().eq('id', wlRow.id); setOnWatchlistCouple(false) }
      }
      const { error } = await supabase.from('collection').insert({ movie_id: movieDbId, couple_id: coupleId, watched_at: new Date().toISOString() })
      if (!error) { setInCollection(true); showToast('Ajouté à la collection ✓') }
    } catch {
      showToast('Erreur')
    } finally { setActionLoading(null) }
  }

  async function handleMarkPersonal() {
    if (!user) { navigate('/login'); return }
    if (!movie || actionLoading) return
    setActionLoading('personal')
    try {
      const movieDbId = await ensureMovie(movie)
      // Retirer de la watchlist solo si présent
      if (onWatchlistSolo) {
        const { data: wlRow } = await supabase.from('watchlist').select('id').is('couple_id', null).eq('added_by', user.id).eq('movie_id', movieDbId).maybeSingle()
        if (wlRow) { await supabase.from('watchlist').delete().eq('id', wlRow.id); setOnWatchlistSolo(false) }
      }
      const { error } = await supabase.from('personal_collection').insert({ movie_id: movieDbId, user_id: user.id, watched_at: new Date().toISOString() })
      if (!error) { setInPersonal(true); showToast('Ajouté à ta collection perso ✓') }
    } catch {
      showToast('Erreur')
    } finally { setActionLoading(null) }
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
              <TrailerButton tmdbId={movie.id} mediaType="movie" />
              {settings.showMusic && <MusicSource movieTitle={movie.title} originalTitle={movie.original_title} />}
              {settings.showBooks && <BookSource tmdbId={movie.id} keywords={movie.keywords} />}
              <AwardsButton imdbId={movie.imdb_id} />
              <WatchProviders tmdbId={movie.id} releaseDate={movie.release_date} />
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
                  <div className="flex flex-col items-start">
                    <span className="text-xs text-[var(--color-text)]">{a.name}</span>
                    {a.character && (
                      <span className="text-[10px] text-[var(--color-text-muted)] leading-tight">{a.character}</span>
                    )}
                  </div>
                  <span className="text-[var(--color-text-muted)] text-[10px]">›</span>
                </button>
              ))}
              {(movie.credits?.cast.length ?? 0) > 5 && (
                <button
                  onClick={() => setShowCastSheet(true)}
                  className="inline-flex items-center justify-center bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 transition-colors text-sm text-[var(--color-text-muted)] font-medium"
                >
                  ···
                </button>
              )}
            </div>
          </div>
        )}

        <CastCrewSheet
          cast={movie.credits?.cast ?? []}
          crew={movie.credits?.crew ?? []}
          open={showCastSheet}
          onClose={() => setShowCastSheet(false)}
        />

        {/* Jeux vidéo liés */}
        {settings.showGames && <GameSource tmdbId={movie.id} movieTitle={movie.title} />}

        {/* Saga / Collection */}
        {movie.belongs_to_collection && (
          <MovieCollection collectionId={movie.belongs_to_collection.id} currentMovieId={movie.id} />
        )}

        {/* Carte amis */}
        <FriendsCard tmdbId={movie.id} mediaType="movie" />

        {/* Actions */}
        <div className="space-y-4 mt-6">
          {/* — À regarder — */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium mb-2 text-center">À regarder</p>
            <div className={coupleId ? 'flex gap-3' : ''}>
              <button
                onClick={handleToggleWatchlistSolo}
                disabled={actionLoading !== null}
                className={[
                  coupleId ? 'flex-1' : 'w-full',
                  'rounded-xl py-3 font-medium text-sm transition-colors disabled:opacity-60',
                  onWatchlistSolo
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
                ].join(' ')}
              >
                {actionLoading === 'wl-solo' ? '…' : onWatchlistSolo ? '✓ À voir solo' : '🎬 À voir solo'}
              </button>
              {coupleId && (
                <button
                  onClick={handleToggleWatchlistCouple}
                  disabled={actionLoading !== null}
                  className={[
                    'flex-1 rounded-xl py-3 font-medium text-sm transition-colors disabled:opacity-60',
                    onWatchlistCouple
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[var(--color-surface)] text-[var(--color-text)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]',
                  ].join(' ')}
                >
                  {actionLoading === 'wl-couple' ? '…' : onWatchlistCouple ? '✓ À voir couple' : '👫 À voir couple'}
                </button>
              )}
            </div>
          </div>

          {/* — Déjà vu — */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] font-medium mb-2 text-center">Déjà vu</p>
            <div className={coupleId ? 'flex gap-3' : ''}>
              {inPersonal ? (
                <div className={[coupleId ? 'flex-1' : 'w-full', 'bg-[var(--color-surface)] text-green-400 rounded-xl py-3 text-sm font-medium text-center border border-green-400/30'].join(' ')}>
                  ✓ Vu solo
                </div>
              ) : (
                <button
                  onClick={handleMarkPersonal}
                  disabled={actionLoading !== null}
                  className={[
                    coupleId ? 'flex-1' : 'w-full',
                    'bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-60 text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors',
                  ].join(' ')}
                >
                  {actionLoading === 'personal' ? '…' : '🎬 Vu solo'}
                </button>
              )}
              {coupleId && (
                inCollection ? (
                  <div className="flex-1 bg-[var(--color-surface)] text-green-400 rounded-xl py-3 text-sm font-medium text-center border border-green-400/30">
                    ✓ Vu ensemble
                  </div>
                ) : (
                  <button
                    onClick={handleMarkWatched}
                    disabled={actionLoading !== null}
                    className="flex-1 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-60 text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
                  >
                    {actionLoading === 'collection' ? '…' : '👫 Vu ensemble'}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Recommander à un ami */}
          <RecommendButton movieId={movie.id} tvShowId={null} title={movie.title} onBeforeSend={() => ensureMovie(movie).then(() => {})} />
        </div>
      </div>
    </div>
  )
}
