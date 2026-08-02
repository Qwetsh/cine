import { useState } from 'react'
import { useCoupleContext } from '../../contexts/CoupleContext'
import { useFriendsContext } from '../../contexts/FriendsContext'
import { RecommendModal } from './RecommendModal'

interface Props {
  movieId: number | null
  tvShowId: number | null
  title: string
  onBeforeSend?: () => Promise<void>
}

export function RecommendButton({ movieId, tvShowId, title, onBeforeSend }: Props) {
  const { friends } = useFriendsContext()
  const { partner } = useCoupleContext()
  const [open, setOpen] = useState(false)

  // Ne pas afficher si aucun destinataire possible (partenaire ou ami)
  const hasRecipients = !!partner || friends.length > 0
  if (!hasRecipients) return null

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full bg-[var(--color-surface)] hover:bg-[var(--color-surface-2)] text-[var(--color-text)] rounded-xl py-3 font-medium text-sm border border-[var(--color-border)] transition-colors"
      >
        💌 Recommander à...
      </button>

      {open && (
        <RecommendModal
          movieId={movieId}
          tvShowId={tvShowId}
          title={title}
          open
          onClose={() => setOpen(false)}
          onBeforeSend={onBeforeSend}
        />
      )}
    </>
  )
}
