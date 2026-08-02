import { useRef } from 'react'
import type { ReactNode } from 'react'
import { useLongPress } from '../../hooks/useLongPress'
import { useHoldMenu } from '../../contexts/HoldMenuContext'
import { HoldRing } from './HoldRing'
import type { MediaItem } from '../../lib/media'

interface Props {
  movie: MediaItem
  /** UUID de la table movies si déjà connu (entrées collection/watchlist) */
  movieDbId?: string
  /** L'objet movie est incomplet (reco d'ami…) : refetch TMDB avant insertion */
  partial?: boolean
  /** Classes du conteneur (le wrapper est en position relative) */
  className?: string
  /** Rayon du liseré, à faire correspondre aux coins de l'affiche */
  radius?: number
  children: ReactNode
}

/**
 * Enrobe une affiche (film ou série, via media_type) pour lui donner
 * l'appui long → menu radial. Le tap/click reste intact.
 */
export function HoldablePoster({ movie, movieDbId, partial, className = '', radius = 8, children }: Props) {
  const menu = useHoldMenu()
  const ref = useRef<HTMLDivElement>(null)

  const { charging, ringDuration, handlers } = useLongPress({
    // Un peu plus long que le défaut : évite les ouvertures accidentelles
    // pendant la navigation dans les listes
    delay: 400,
    disabled: !menu.enabled,
    onComplete: (start) => {
      const rect = ref.current?.getBoundingClientRect()
      if (rect) menu.openMenu(movie, rect, start, { movieDbId, partial })
    },
    onMove: menu.moveDrag,
    onRelease: menu.releaseDrag,
    onAbort: menu.abortDrag,
  })

  return (
    <div
      ref={ref}
      {...handlers}
      className={`relative select-none [-webkit-touch-callout:none] ${className}`}
    >
      {children}
      {charging && <HoldRing duration={ringDuration} radius={radius} />}
    </div>
  )
}
