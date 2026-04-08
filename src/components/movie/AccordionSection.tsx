import { useState, useRef, useEffect, type ReactNode } from 'react'

interface Props {
  icon: string
  title: string
  badge?: string
  defaultOpen?: boolean
  children: ReactNode
}

export function AccordionSection({ icon, title, badge, defaultOpen = false, children }: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(defaultOpen ? undefined : 0)

  useEffect(() => {
    if (!contentRef.current) return
    if (open) {
      setHeight(contentRef.current.scrollHeight)
      // After transition, switch to auto so dynamic content works
      const timer = setTimeout(() => setHeight(undefined), 300)
      return () => clearTimeout(timer)
    } else {
      // Set explicit height first so transition works from current height
      setHeight(contentRef.current.scrollHeight)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0))
      })
    }
  }, [open])

  return (
    <div className="mt-4 bg-[var(--color-surface)] rounded-2xl border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="text-lg flex-shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm text-[var(--color-text)] leading-tight">{title}</p>
        </div>
        {badge && (
          <span className="text-[10px] text-[var(--color-text-muted)] bg-[var(--color-surface-2)] px-2 py-0.5 rounded-full flex-shrink-0">
            {badge}
          </span>
        )}
        <span
          className={`text-[var(--color-text-muted)] text-sm flex-shrink-0 transition-transform duration-300 ${
            open ? 'rotate-90' : ''
          }`}
        >
          ›
        </span>
      </button>

      <div
        ref={contentRef}
        style={{ height: height === undefined ? 'auto' : height }}
        className="transition-[height] duration-300 ease-in-out overflow-hidden"
      >
        <div className="border-t border-[var(--color-border)]">
          {children}
        </div>
      </div>
    </div>
  )
}
