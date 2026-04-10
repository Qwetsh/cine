import { useEffect, useRef } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const scrollPositions = new Map<string, number>()

export function ScrollRestoration() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const prevKeyRef = useRef<string | null>(null)

  // Save scroll position before navigating away
  useEffect(() => {
    const key = prevKeyRef.current
    return () => {
      if (key) {
        scrollPositions.set(key, window.scrollY)
      }
    }
  }, [location.key])

  // Restore or reset scroll position
  useEffect(() => {
    prevKeyRef.current = location.key

    if (navigationType === 'POP') {
      // Back/forward navigation → restore saved position
      const saved = scrollPositions.get(location.key)
      if (saved != null) {
        // Small delay to let the DOM render before scrolling
        requestAnimationFrame(() => {
          window.scrollTo(0, saved)
        })
        return
      }
    }

    // Push/Replace navigation → scroll to top
    window.scrollTo(0, 0)
  }, [location.key, navigationType])

  return null
}
