import { useEffect, useState } from 'react'
import { fetchAwards, type Award } from '../../lib/awards'

interface Props {
  imdbId: string | null
}

export function AwardsButton({ imdbId }: Props) {
  const [awards, setAwards] = useState<Award[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!imdbId) { setLoading(false); return }
    let cancelled = false

    fetchAwards(imdbId)
      .then(result => { if (!cancelled) setAwards(result) })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [imdbId])

  if (loading || awards.length === 0) return null

  const won = awards.filter(a => a.won)
  const nominated = awards.filter(a => !a.won)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs px-2 py-1 rounded-full bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
      >
        🏆 {won.length > 0 ? `${won.length}` : ''}{won.length > 0 && nominated.length > 0 ? '/' : ''}{nominated.length > 0 ? `${nominated.length} nom.` : won.length > 0 ? ' prix' : ''}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md sm:mx-4 bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl border-t sm:border border-[var(--color-border)] max-h-[80dvh] flex flex-col animate-slide-up"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
              <h3 className="font-bold text-[var(--color-text)]">🏆 Récompenses</h3>
              <button
                onClick={() => setOpen(false)}
                className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] text-lg"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1 px-4 py-3 space-y-4">
              {won.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-gold)] font-medium mb-2">
                    Remporté ({won.length})
                  </p>
                  <ul className="space-y-2">
                    {won.map((a, i) => (
                      <AwardRow key={`w-${i}`} award={a} />
                    ))}
                  </ul>
                </div>
              )}

              {nominated.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-[var(--color-text-muted)] font-medium mb-2">
                    Nominations ({nominated.length})
                  </p>
                  <ul className="space-y-2">
                    {nominated.map((a, i) => (
                      <AwardRow key={`n-${i}`} award={a} />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function AwardRow({ award }: { award: Award }) {
  return (
    <li className="flex items-start gap-2">
      <span className="text-sm mt-0.5">{award.won ? '🏆' : '📋'}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--color-text)] leading-tight">{award.awardLabel}</p>
        {award.categoryLabel && (
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{award.categoryLabel}</p>
        )}
        {award.year && (
          <p className="text-[10px] text-[var(--color-text-muted)]">{award.year}</p>
        )}
      </div>
    </li>
  )
}
