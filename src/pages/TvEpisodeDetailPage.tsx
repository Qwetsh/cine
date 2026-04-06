import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { tmdb, getPosterUrl } from '../lib/tmdb'
import { useAuth } from '../contexts/AuthContext'
import { useCoupleContext } from '../contexts/CoupleContext'
import { useTvEpisodeRatings } from '../hooks/useTvEpisodeRatings'
import { StarRating } from '../components/movie/StarRating'
import { supabase } from '../lib/supabase'
import type { TmdbEpisode, TmdbTvShowDetail } from '../lib/tmdb'

export function TvEpisodeDetailPage() {
  const { id, seasonNumber, episodeNumber } = useParams<{
    id: string
    seasonNumber: string
    episodeNumber: string
  }>()
  const [episode, setEpisode] = useState<TmdbEpisode | null>(null)
  const [show, setShow] = useState<TmdbTvShowDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [dbId, setDbId] = useState<string | null>(null)
  const [inCollection, setInCollection] = useState(false)
  const navigate = useNavigate()
  const { user } = useAuth()
  const { coupleId, isUser1, partner } = useCoupleContext()

  const sn = Number(seasonNumber)
  const en = Number(episodeNumber)

  const { getEpisodeRating, rateEpisode } = useTvEpisodeRatings(dbId, coupleId)

  useEffect(() => {
    if (!id || !seasonNumber || !episodeNumber) return
    setLoading(true)
    Promise.all([
      tmdb.getTvShow(Number(id)),
      tmdb.getTvEpisode(Number(id), sn, en),
    ]).then(([showData, epData]) => {
      setShow(showData)
      setEpisode(epData)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [id, seasonNumber, episodeNumber, sn, en])

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

  function goBack() {
    if (window.history.length > 1) navigate(-1)
    else navigate(`/tv/${id}/season/${sn}`)
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-4 space-y-3">
        <div className="aspect-video bg-[var(--color-surface-2)] rounded-xl animate-pulse" />
        <div className="h-6 bg-[var(--color-surface-2)] rounded animate-pulse w-3/4" />
        <div className="h-20 bg-[var(--color-surface-2)] rounded animate-pulse" />
      </div>
    )
  }

  if (!episode || !show) {
    return (
      <div className="flex flex-col items-center py-20 text-[var(--color-text-muted)]">
        <p>Épisode introuvable</p>
        <button onClick={goBack} className="mt-4 text-[var(--color-accent)]">← Retour</button>
      </div>
    )
  }

  const rating = getEpisodeRating(sn, en)
  const myRating = isUser1 ? rating?.rating_user1 : rating?.rating_user2
  const partnerRating = isUser1 ? rating?.rating_user2 : rating?.rating_user1
  const guestStars = episode.guest_stars?.slice(0, 10) ?? []

  return (
    <div className="max-w-2xl mx-auto pb-6">
      {/* Header */}
      <div className="px-4 pt-4">
        <button onClick={goBack} className="text-[var(--color-accent)] text-sm mb-3">
          ← {show.name} · Saison {sn}
        </button>
      </div>

      {/* Still image */}
      {episode.still_path ? (
        <div className="aspect-video bg-[var(--color-surface-2)] overflow-hidden">
          <img
            src={`https://image.tmdb.org/t/p/w780${episode.still_path}`}
            alt={episode.name}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-video bg-[var(--color-surface-2)] flex items-center justify-center text-[var(--color-text-muted)]">
          S{sn}E{en}
        </div>
      )}

      <div className="px-4 mt-4">
        <h1 className="font-bold text-lg text-[var(--color-text)]">
          <span className="text-[var(--color-text-muted)]">{en}.</span> {episode.name}
        </h1>
        <div className="flex items-center gap-2 mt-1 text-sm text-[var(--color-text-muted)]">
          {episode.air_date && <span>{new Date(episode.air_date).toLocaleDateString('fr-FR')}</span>}
          {episode.runtime && <span>· {episode.runtime} min</span>}
          {episode.vote_average > 0 && (
            <span className="text-[var(--color-gold)]">★ {episode.vote_average.toFixed(1)}</span>
          )}
        </div>

        {/* Synopsis */}
        {episode.overview && (
          <div className="mt-4">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Synopsis</h2>
            <p className="text-[var(--color-text-muted)] text-sm leading-relaxed">{episode.overview}</p>
          </div>
        )}

        {/* Rating section — only if in collection */}
        {inCollection ? (
          <div className="mt-6 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 space-y-3">
            <h2 className="font-semibold text-[var(--color-text)]">Ma note</h2>
            <StarRating
              value={myRating ?? null}
              onChange={(r) => rateEpisode(sn, en, isUser1, r)}
              size="lg"
            />

            {partnerRating != null && (
              <div className="pt-2 border-t border-[var(--color-border)]">
                <p className="text-xs text-[var(--color-text-muted)] mb-1">
                  {partner?.display_name ?? 'Partenaire'}
                </p>
                <StarRating value={partnerRating} readOnly size="md" max={10} />
              </div>
            )}
          </div>
        ) : (
          <div className="mt-6 bg-[var(--color-surface)] rounded-xl border border-[var(--color-border)] p-4 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              Ajoutez cette série a la collection pour noter les épisodes
            </p>
          </div>
        )}

        {/* Guest stars */}
        {guestStars.length > 0 && (
          <div className="mt-6">
            <h2 className="font-semibold text-[var(--color-text)] mb-2">Guest stars</h2>
            <div className="flex flex-wrap gap-2">
              {guestStars.map(a => (
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
                  <div className="text-left">
                    <span className="text-xs text-[var(--color-text)] block">{a.name}</span>
                    {a.character && (
                      <span className="text-[10px] text-[var(--color-text-muted)]">{a.character}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
