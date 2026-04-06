import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tmdb, getBackdropUrl, getPosterUrl } from '../lib/tmdb'
import { ensureTvShow } from '../lib/tvShows'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useTvEpisodeRatings } from '../hooks/useTvEpisodeRatings'
import { useTvSeasonStatus } from '../hooks/useTvSeasonStatus'
import { useToast } from '../hooks/useToast'
import { WatchProviders } from '../components/movie/WatchProviders'
import { RecommendButton } from '../components/movie/RecommendButton'
import { FriendsCard } from '../components/movie/FriendsCard'
import { supabase } from '../lib/supabase'
import type { TmdbTvShowDetail } from '../lib/tmdb'

export function TvDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [show, setShow] = useState<TmdbTvShowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [inCollection, setInCollection] = useState(false)
  const [inPersonal, setInPersonal] = useState(false)
  const [actionLoading, setActionLoading] = useState<'collection' | 'personal' | null>(null)
  const [dbId, setDbId] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId } = useCoupleContext()
  const { toast, showToast } = useToast()

  const { getSeasonAvg, getSeriesAvg } = useTvEpisodeRatings(dbId, coupleId)
  const { getSeasonStatus } = useTvSeasonStatus(dbId, coupleId, user?.id ?? null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    tmdb.getTvShow(Number(id))
      .then(setShow)
      .catch(() => setLoading(false))
      .finally(() => setLoading(false))
  }, [id])

  // Check if in collection + get DB id
  useEffect(() => {
    if (!show) return
    ;(async () => {
      const { data: tvRow } = await supabase
        .from('tv_shows')
        .select('id')
        .eq('tmdb_id', show.id)
        .maybeSingle()

      if (tvRow) {
        setDbId(tvRow.id)
        if (coupleId) {
          const { data } = await supabase
            .from('tv_collection')
            .select('id')
            .eq('couple_id', coupleId)
            .eq('tv_show_id', tvRow.id)
            .maybeSingle()
          setInCollection(!!data)
        }
        if (user) {
          const { data } = await supabase
            .from('tv_personal_collection')
            .select('id')
            .eq('user_id', user.id)
            .eq('tv_show_id', tvRow.id)
            .maybeSingle()
          setInPersonal(!!data)
        }
      }
    })()
  }, [show, coupleId, user])

  async function handleAddToCollection() {
    if (!user || !coupleId) { navigate('/profile'); return }
    if (!show || actionLoading) return
    setActionLoading('collection')
    try {
      const tvShowDbId = await ensureTvShow(show)
      setDbId(tvShowDbId)
      const { error } = await supabase.from('tv_collection').insert({
        tv_show_id: tvShowDbId,
        couple_id: coupleId,
      })
      if (!error) {
        setInCollection(true)
        showToast('Série ajoutée à la collection ✓')
      }
    } catch {
      showToast('Erreur lors de l\'ajout à la collection')
    } finally {
      setActionLoading(null)
    }
  }

  async function handleAddToPersonal() {
    if (!user) { navigate('/login'); return }
    if (!show || actionLoading) return
    setActionLoading('personal')
    try {
      const tvShowDbId = await ensureTvShow(show)
      setDbId(tvShowDbId)
      const { error } = await supabase.from('tv_personal_collection').insert({
        tv_show_id: tvShowDbId,
        user_id: user.id,
        watched_at: new Date().toISOString(),
      })
      if (!error) {
        setInPersonal(true)
        showToast('Ajouté à ta collection perso ✓')
      }
    } catch {
      showToast('Erreur lors de l\'ajout à ta collection perso')
    } finally {
      setActionLoading(null)
    }
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
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

  if (!show) {
    return (
      <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
        <p>Série introuvable</p>
        <button onClick={goBack} className="mt-4 text-[var(--color-accent)]">← Retour</button>
      </div>
    )
  }

  const year = show.first_air_date ? new Date(show.first_air_date).getFullYear() : null
  const creators = show.created_by?.slice(0, 3) ?? []
  const cast = show.credits?.cast.slice(0, 5) ?? []
  const seasons = show.seasons?.filter(s => s.season_number > 0) ?? [] // Skip "Specials" (season 0)
  const seriesAvg = getSeriesAvg()

  const statusLabels: Record<string, string> = {
    'Returning Series': 'En cours',
    'Ended': 'Terminée',
    'Canceled': 'Annulée',
    'In Production': 'En production',
  }

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Backdrop */}
      <div className="relative">
        <div className="aspect-video bg-[var(--color-surface-2)] overflow-hidden">
          <img
            src={getBackdropUrl(show.backdrop_path, 'large')}
            alt={`Backdrop ${show.name}`}
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
              src={getPosterUrl(show.poster_path, 'medium')}
              alt={`Affiche ${show.name}`}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-0 pt-12">
            <h1 className="font-bold text-xl text-[var(--color-text)] leading-tight">{show.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-[var(--color-text-muted)]">
              {year && <span>{year}</span>}
              <span>· {show.number_of_seasons} saison{show.number_of_seasons > 1 ? 's' : ''}</span>
              {show.status && <span>· {statusLabels[show.status] ?? show.status}</span>}
              {show.vote_average > 0 && (
                <span className="text-[var(--color-gold)]">★ {show.vote_average.toFixed(1)}</span>
              )}
              {seriesAvg !== null && (
                <span className="text-[var(--color-accent)]">Notre note : {seriesAvg}/5</span>
              )}
            </div>
          </div>
        </div>

        {show.genres.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {show.genres.map(g => (
              <span key={g.id} className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]">
                {g.name}
              </span>
            ))}
          </div>
        )}

        {show.overview && (
          <div className="mt-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Synopsis</h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{show.overview}</p>
          </div>
        )}

        {creators.length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Créé par</p>
            <div className="flex flex-wrap gap-2">
              {creators.map(c => (
                <button
                  key={c.id}
                  onClick={() => navigate(`/person/${c.id}`)}
                  className="inline-flex items-center gap-2 bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2 transition-colors"
                >
                  {c.profile_path ? (
                    <img
                      src={getPosterUrl(c.profile_path, 'small').replace('/w185', '/w92')}
                      alt={c.name}
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs">🎬</div>
                  )}
                  <span className="text-sm font-medium text-[var(--color-text)]">{c.name}</span>
                </button>
              ))}
            </div>
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
                </button>
              ))}
            </div>
          </div>
        )}

        <WatchProviders tmdbId={show.id} releaseDate={show.first_air_date} isTv />

        {/* Carte amis */}
        <FriendsCard tmdbId={show.id} mediaType="tv" />

        {/* Actions */}
        <div className="space-y-3 mt-6">
          {coupleId && (
            inCollection ? (
              <div className="bg-[var(--color-surface)] text-green-400 rounded-xl py-3 text-sm font-medium text-center border border-green-400/30">
                ✓ Dans la collection
              </div>
            ) : (
              <button
                onClick={handleAddToCollection}
                disabled={actionLoading !== null}
                className="w-full bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] disabled:opacity-60 text-white rounded-xl py-3 font-medium text-sm transition-colors"
              >
                {actionLoading === 'collection' ? '…' : '👫 Vu ensemble'}
              </button>
            )
          )}

          {inPersonal ? (
            <div className="bg-[var(--color-surface)] text-green-400 rounded-xl py-3 text-sm font-medium text-center border border-green-400/30">
              ✓ Dans ma collection perso
            </div>
          ) : (
            <button
              onClick={handleAddToPersonal}
              disabled={actionLoading !== null}
              className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] disabled:opacity-60 text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
            >
              {actionLoading === 'personal' ? '…' : '🎬 Vu en solo'}
            </button>
          )}

          {/* Recommander à un ami */}
          <RecommendButton movieId={null} tvShowId={show.id} title={show.name} />
        </div>

        {/* Saisons */}
        {seasons.length > 0 && (
          <div className="mt-8">
            <h2 className="font-semibold text-[var(--color-text)] mb-3">
              Saisons ({seasons.length})
            </h2>
            <div className="space-y-3">
              {seasons.map(season => {
                const seasonAvg = getSeasonAvg(season.season_number)
                const status = getSeasonStatus(season.season_number)

                return (
                  <div
                    key={season.season_number}
                    className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden"
                  >
                    <button
                      onClick={() => navigate(`/tv/${id}/season/${season.season_number}`)}
                      className="flex items-center gap-3 w-full p-3 text-left hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                      <div className="w-12 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
                        <img
                          src={getPosterUrl(season.poster_path ?? show.poster_path, 'small')}
                          alt={season.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-[var(--color-text)] truncate">
                          {season.name}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                          {season.episode_count} épisode{season.episode_count > 1 ? 's' : ''}
                          {season.air_date && ` · ${new Date(season.air_date).getFullYear()}`}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          {seasonAvg !== null && (
                            <span className="text-xs text-[var(--color-gold)]">★ {seasonAvg}/5</span>
                          )}
                          {status && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                              status.watched_type === 'couple'
                                ? 'bg-blue-500/20 text-blue-400'
                                : 'bg-purple-500/20 text-purple-400'
                            }`}>
                              {status.watched_type === 'couple' ? 'Ensemble' : 'Solo'}
                            </span>
                          )}
                          {!status && seasonAvg === null && (
                            <span className="text-[10px] text-[var(--color-text-muted)]">Pas vu</span>
                          )}
                        </div>
                      </div>
                      <span className="text-[var(--color-text-muted)] text-sm">›</span>
                    </button>

                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
