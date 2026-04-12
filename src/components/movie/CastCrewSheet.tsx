import { useNavigate } from 'react-router-dom'
import { getPosterUrl } from '../../lib/tmdb'
import type { TmdbCastMember, TmdbCrewMember } from '../../lib/tmdb'

const JOB_LABELS: Record<string, string> = {
  'Director of Photography': 'Photographie',
  'Editor': 'Montage',
  'Original Music Composer': 'Musique',
  'Producer': 'Production',
  'Executive Producer': 'Production exécutive',
  'Screenplay': 'Scénario',
  'Writer': 'Scénario',
  'Art Direction': 'Direction artistique',
  'Production Design': 'Design de production',
  'Costume Design': 'Costumes',
}

const KEY_JOBS = Object.keys(JOB_LABELS)

const JOB_MAX: Record<string, number> = {
  'Producer': 3,
  'Executive Producer': 2,
  'Screenplay': 3,
  'Writer': 3,
}

interface Props {
  cast: TmdbCastMember[]
  crew: TmdbCrewMember[]
  open: boolean
  onClose: () => void
}

export function CastCrewSheet({ cast, crew, open, onClose }: Props) {
  const navigate = useNavigate()

  if (!open) return null

  // Filter key crew, deduplicate by id+job, respect max per job
  const jobCounts: Record<string, number> = {}
  const seenCrew = new Set<string>()
  const keyCrew = crew.filter(c => {
    if (!KEY_JOBS.includes(c.job)) return false
    const key = `${c.id}-${c.job}`
    if (seenCrew.has(key)) return false
    seenCrew.add(key)
    const max = JOB_MAX[c.job] ?? 1
    jobCounts[c.job] = (jobCounts[c.job] ?? 0) + 1
    return jobCounts[c.job] <= max
  })

  function handleNavigate(personId: number) {
    onClose()
    navigate(`/person/${personId}`)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md sm:mx-4 bg-[var(--color-surface)] sm:rounded-2xl rounded-t-2xl border-t sm:border border-[var(--color-border)] max-h-[80dvh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-[var(--color-text)]">Cast & Crew</p>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-accent)] text-white font-medium">
              {cast.length + keyCrew.length}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="overflow-y-auto flex-1 px-4 pb-4 space-y-4">
          {/* Casting */}
          {cast.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">🎭 Casting</p>
              <div className="space-y-1">
                {cast.map(a => (
                  <button
                    key={a.id}
                    onClick={() => handleNavigate(a.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    {a.profile_path ? (
                      <img
                        src={getPosterUrl(a.profile_path, 'small').replace('/w185', '/w92')}
                        alt={a.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs flex-shrink-0">🎭</div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm text-[var(--color-text)] truncate">{a.name}</p>
                      {a.character && (
                        <p className="text-[11px] text-[var(--color-text-muted)] truncate">{a.character}</p>
                      )}
                    </div>
                    <span className="text-[var(--color-text-muted)] text-xs flex-shrink-0">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Équipe technique */}
          {keyCrew.length > 0 && (
            <div>
              <p className="text-xs text-[var(--color-text-muted)] mb-2">🎬 Équipe technique</p>
              <div className="space-y-1">
                {keyCrew.map(c => (
                  <button
                    key={`${c.id}-${c.job}`}
                    onClick={() => handleNavigate(c.id)}
                    className="w-full flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-[var(--color-surface-2)] transition-colors"
                  >
                    {c.profile_path ? (
                      <img
                        src={getPosterUrl(c.profile_path, 'small').replace('/w185', '/w92')}
                        alt={c.name}
                        className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--color-surface-2)] flex items-center justify-center text-xs flex-shrink-0">🎬</div>
                    )}
                    <div className="flex-1 min-w-0 text-left">
                      <p className="text-sm text-[var(--color-text)] truncate">{c.name}</p>
                      <p className="text-[11px] text-[var(--color-text-muted)] truncate">{JOB_LABELS[c.job] ?? c.job}</p>
                    </div>
                    <span className="text-[var(--color-text-muted)] text-xs flex-shrink-0">›</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
