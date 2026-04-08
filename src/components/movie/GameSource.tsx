import { useEffect, useState } from 'react'
import { tmdb } from '../../lib/tmdb'
import { fetchRelatedGames, type GameInfo } from '../../lib/games'
import { AccordionSection } from './AccordionSection'

interface Props {
  tmdbId: number
  movieTitle: string
}

// Dédup des appels external_ids
const externalIdsCache = new Map<number, Promise<{ wikidata_id: string | null }>>()

function getExternalIds(tmdbId: number) {
  if (externalIdsCache.has(tmdbId)) return externalIdsCache.get(tmdbId)!
  const promise = tmdb.getMovieExternalIds(tmdbId)
  externalIdsCache.set(tmdbId, promise)
  promise.finally(() => setTimeout(() => externalIdsCache.delete(tmdbId), 5000))
  return promise
}

export function GameSource({ tmdbId, movieTitle }: Props) {
  const [games, setGames] = useState<GameInfo[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedGame, setSelectedGame] = useState<GameInfo | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    getExternalIds(tmdbId)
      .then(ids => {
        if (cancelled || !ids.wikidata_id) return null
        return fetchRelatedGames(ids.wikidata_id, movieTitle)
      })
      .then(result => {
        if (!cancelled && result) setGames(result)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [tmdbId, movieTitle])

  if (loading) return null
  if (games.length === 0) return null

  return (
    <>
      <AccordionSection
        icon="🎮"
        title="Jeux vidéo liés"
        badge={`${games.length} jeu${games.length > 1 ? 'x' : ''}`}
      >
        <div className="flex gap-3 overflow-x-auto py-3 px-4 scrollbar-hide">
          {games.map(game => (
            <button
              key={game.wikidataId}
              onClick={() => setSelectedGame(game)}
              className="flex-shrink-0 w-24 text-left group"
            >
              <div className="relative aspect-[3/4] rounded-lg overflow-hidden border border-[var(--color-border)] group-hover:border-[var(--color-accent)] transition-colors">
                {game.coverUrl ? (
                  <img
                    src={game.coverUrl}
                    alt={game.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-[var(--color-surface-2)] flex items-center justify-center text-2xl">
                    🎮
                  </div>
                )}
              </div>
              <p className="text-xs text-[var(--color-text)] mt-1.5 leading-tight line-clamp-2">{game.title}</p>
              {game.year && <p className="text-[10px] text-[var(--color-text-muted)]">{game.year}</p>}
            </button>
          ))}
        </div>
      </AccordionSection>

      {/* Modale détail jeu */}
      {selectedGame && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedGame(null)}
        >
          <div
            className="w-full max-w-2xl bg-[var(--color-bg)] rounded-t-2xl border-t border-[var(--color-border)] p-5 pb-8 animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-10 h-1 bg-[var(--color-border)] rounded-full mx-auto mb-4" />

            <div className="flex gap-4">
              {selectedGame.coverUrl ? (
                <img
                  src={selectedGame.coverUrl}
                  alt={selectedGame.title}
                  className="w-24 h-32 rounded-xl object-cover flex-shrink-0 border border-[var(--color-border)]"
                />
              ) : (
                <div className="w-24 h-32 rounded-xl bg-[var(--color-surface-2)] flex items-center justify-center text-4xl flex-shrink-0 border border-[var(--color-border)]">
                  🎮
                </div>
              )}

              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-lg text-[var(--color-text)] leading-tight">{selectedGame.title}</h3>
                {selectedGame.year && (
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">{selectedGame.year}</p>
                )}
                {selectedGame.publishers.length > 0 && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    {selectedGame.publishers.join(', ')}
                  </p>
                )}
              </div>
            </div>

            {selectedGame.genres.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-4">
                {selectedGame.genres.map(g => (
                  <span
                    key={g}
                    className="text-[10px] px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)]"
                  >
                    {g}
                  </span>
                ))}
              </div>
            )}

            {selectedGame.platforms.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-[var(--color-text-muted)] mb-1.5">Plateformes</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedGame.platforms.map(p => (
                    <span
                      key={p}
                      className="text-[10px] px-2 py-1 rounded-full bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-muted)]"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {selectedGame.description && (
              <p className="text-sm text-[var(--color-text-muted)] mt-4 leading-relaxed line-clamp-4">
                {selectedGame.description}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  )
}
