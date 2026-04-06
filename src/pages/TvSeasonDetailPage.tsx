import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tmdb, getPosterUrl } from '../lib/tmdb'
import { ensureTvShow } from '../lib/tvShows'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useTvEpisodeRatings } from '../hooks/useTvEpisodeRatings'
import { useTvSeasonStatus } from '../hooks/useTvSeasonStatus'
import { StarRating } from '../components/movie/StarRating'
import { supabase } from '../lib/supabase'
import type { TmdbSeasonDetail, TmdbTvShowDetail } from '../lib/tmdb'

export function TvSeasonDetailPage() {
  const { id, seasonNumber } = useParams<{ id: string; seasonNumber: string }>()
  const [season, setSeason] = useState<TmdbSeasonDetail | null>(null)
  const [show, setShow] = useState<TmdbTvShowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbId, setDbId] = useState<string | null>(null)
  const [inCollection, setInCollection] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, isUser1 } = useCoupleContext()

  const sn = Number(seasonNumber)

  const { getEpisodeRating, rateEpisode, getSeasonAvg } = useTvEpisodeRatings(dbId, coupleId)
  const { getSeasonStatus, markSeason, unmarkSeason } = useTvSeasonStatus(dbId, coupleId, user?.id ?? null)

  useEffect(() => {
    if (!id || !seasonNumber) return
    setLoading(true)
    Promise.all([
      tmdb.getTvShow(Number(id)),
      tmdb.getTvSeason(Number(id), sn),
    ]).then(([showData, seasonData]) => {
      setShow(showData)
      setSeason(seasonData)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [id, seasonNumber, sn])

  // Get DB id + check collection
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
        let found = false
        if (coupleId) {
          const { data } = await supabase
            .from('tv_collection')
            .select('id')
            .eq('couple_id', coupleId)
            .eq('tv_show_id', tvRow.id)
            .maybeSingle()
          if (data) found = true
        }
        if (!found && user) {
          const { data } = await supabase
            .from('tv_personal_collection')
            .select('id')
            .eq('user_id', user.id)
            .eq('tv_show_id', tvRow.id)
            .maybeSingle()
          if (data) found = true
        }
        setInCollection(found)
      }
    })()
  }, [show, coupleId, user])

  async function handleAddToWatchlist() {
    if (!user || !coupleId || !show) return
    try {
      const tvShowDbId = await ensureTvShow(show)
      const { error } = await supabase.from('tv_watchlist').insert({
        tv_show_id: tvShowDbId,
        season_number: sn,
        added_by: user.id,
        couple_id: coupleId,
      })
      if (!error) {
        setToast('Saison ajoutée à voir ✓')
        setTimeout(() => setToast(null), 3000)
      }
    } catch (e) {
      console.error(e)
    }
  }

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate(`/tv/${id}`)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="h-6 bg-[var(--color-surface-2)] rounded animate-pulse w-1/2" />
        <div className="h-4 bg-[var(--color-surface-2)] rounded animate-pulse w-1/4" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-[var(--color-surface-2)] rounded-xl animate-pulse" />
        ))}
      </div>
    )
  }

  if (!season || !show) {
    return (
      <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
        <p>Saison introuvable</p>
        <button onClick={goBack} className="mt-4 text-[var(--color-accent)]">← Retour</button>
      </div>
    )
  }

  const seasonStatus = getSeasonStatus(sn)
  const seasonAvg = getSeasonAvg(sn)

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-600 text-white text-sm px-4 py-2 rounded-full shadow-lg">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="px-4 pt-4">
        <button onClick={goBack} className="text-[var(--color-accent)] text-sm mb-3">
          ← {show.name}
        </button>

        <div className="flex gap-4">
          <div className="w-20 flex-shrink-0 rounded-xl overflow-hidden shadow-xl">
            <img
              src={getPosterUrl(season.poster_path ?? show.poster_path, 'medium')}
              alt={season.name}
              className="w-full"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-lg text-[var(--color-text)]">{season.name}</h1>
            <p className="text-sm text-[var(--color-text-muted)] mt-1">
              {season.episodes.length} épisode{season.episodes.length > 1 ? 's' : ''}
              {season.air_date && ` · ${new Date(season.air_date).getFullYear()}`}
            </p>
            {coupleId && (
              <button
                onClick={handleAddToWatchlist}
                className="text-xs text-[var(--color-accent)] hover:underline mt-1"
              >
                + Ajouter à voir
              </button>
            )}
            {seasonAvg !== null && (
              <p className="text-sm text-[var(--color-gold)] mt-1">★ {seasonAvg}/10</p>
            )}
          </div>
        </div>

        {season.overview && (
          <p className="text-[var(--color-text-muted)] text-sm leading-relaxed mt-3">{season.overview}</p>
        )}

        {/* Vu ensemble / solo toggle — only if in collection */}
        {coupleId && inCollection && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => seasonStatus?.watched_type === 'couple' ? unmarkSeason(sn) : markSeason(sn, 'couple')}
              className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                seasonStatus?.watched_type === 'couple'
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-blue-500/40'
              }`}
            >
              👫 Vu ensemble
            </button>
            <button
              onClick={() => seasonStatus?.watched_type === 'solo' ? unmarkSeason(sn) : markSeason(sn, 'solo')}
              className={`flex-1 rounded-xl border py-2 text-sm font-medium transition-colors ${
                seasonStatus?.watched_type === 'solo'
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-400'
                  : 'bg-[var(--color-surface)] border-[var(--color-border)] text-[var(--color-text-muted)] hover:border-purple-500/40'
              }`}
            >
              🎬 Vu en solo
            </button>
          </div>
        )}
      </div>

      {/* Episodes */}
      <div className="mt-6 px-4">
        <h2 className="font-semibold text-[var(--color-text)] mb-3">Épisodes</h2>
        <div className="space-y-2">
          {season.episodes.map(ep => {
            const rating = getEpisodeRating(sn, ep.episode_number)
            const myRating = isUser1 ? rating?.rating_user1 : rating?.rating_user2
            const partnerRating = isUser1 ? rating?.rating_user2 : rating?.rating_user1

            return (
              <div
                key={ep.episode_number}
                className="bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] overflow-hidden"
              >
                <button
                  onClick={() => navigate(`/tv/${id}/season/${sn}/episode/${ep.episode_number}`)}
                  className="flex items-start gap-3 w-full p-3 text-left hover:bg-[var(--color-surface-2)] transition-colors"
                >
                  {ep.still_path ? (
                    <div className="w-20 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-[var(--color-surface-2)]">
                      <img
                        src={`https://image.tmdb.org/t/p/w300${ep.still_path}`}
                        alt={ep.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-20 h-12 flex-shrink-0 rounded-lg bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)] text-xs">
                      E{ep.episode_number}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[var(--color-text)] truncate">
                      <span className="text-[var(--color-text-muted)]">{ep.episode_number}.</span> {ep.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-[var(--color-text-muted)]">
                      {ep.air_date && <span>{new Date(ep.air_date).toLocaleDateString('fr-FR')}</span>}
                      {ep.runtime && <span>· {ep.runtime} min</span>}
                    </div>
                  </div>
                  <span className="text-[var(--color-text-muted)] text-sm mt-1">›</span>
                </button>

                {/* Inline rating — only if in collection */}
                {inCollection && (
                  <div className="border-t border-[var(--color-border)] px-3 py-2 flex items-center gap-3">
                    <div className="flex-1">
                      <StarRating
                        value={myRating ?? null}
                        onChange={(r) => rateEpisode(sn, ep.episode_number, isUser1, r)}
                        size="sm"
                      />
                    </div>
                    {partnerRating != null && (
                      <div className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                        <StarRating value={partnerRating} readOnly size="sm" max={10} />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
