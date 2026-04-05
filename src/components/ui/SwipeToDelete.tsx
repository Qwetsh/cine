import { useRef, useState } from 'react'

interface Props {
  onDelete: () => void
  children: React.ReactNode
}

const THRESHOLD = 80
const DELETE_WIDTH = 80

export function SwipeToDelete({ onDelete, children }: Props) {
  const startXRef = useRef(0)
  const currentXRef = useRef(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const [offset, setOffset] = useState(0)
  const [swiping, setSwiping] = useState(false)
  const [confirming, setConfirming] = useState(false)

  function handleTouchStart(e: React.TouchEvent) {
    startXRef.current = e.touches[0].clientX
    currentXRef.current = 0
    setSwiping(true)
  }

  function handleTouchMove(e: React.TouchEvent) {
    if (!swiping) return
    const diff = startXRef.current - e.touches[0].clientX
    currentXRef.current = diff
    // Only allow swipe left (positive diff), cap at DELETE_WIDTH + extra
    const clamped = Math.max(0, Math.min(diff, DELETE_WIDTH + 30))
    setOffset(clamped)
  }

  function handleTouchEnd() {
    setSwiping(false)
    if (currentXRef.current >= THRESHOLD) {
      // Snap open
      setOffset(DELETE_WIDTH)
      setConfirming(true)
    } else {
      // Snap closed
      setOffset(0)
      setConfirming(false)
    }
  }

  function handleDelete() {
    // Animate out
    if (containerRef.current) {
      containerRef.current.style.transition = 'max-height 0.3s ease, opacity 0.3s ease, margin 0.3s ease'
      containerRef.current.style.maxHeight = '0px'
      containerRef.current.style.opacity = '0'
      containerRef.current.style.marginBottom = '0px'
    }
    setTimeout(onDelete, 300)
  }

  function handleCancel() {
    setOffset(0)
    setConfirming(false)
  }

  return (
    <div ref={containerRef} className="relative overflow-hidden rounded-xl" style={{ maxHeight: '500px' }}>
      {/* Delete button behind */}
      <div
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-red-600"
        style={{ width: `${DELETE_WIDTH}px` }}
      >
        {confirming ? (
          <button
            onClick={handleDelete}
            className="text-white text-xs font-bold px-2 py-6 w-full h-full flex items-center justify-center"
          >
            Supprimer
          </button>
        ) : (
          <span className="text-white/60 text-xs">←</span>
        )}
      </div>

      {/* Main content */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={confirming ? handleCancel : undefined}
        style={{
          transform: `translateX(-${offset}px)`,
          transition: swiping ? 'none' : 'transform 0.2s ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}
