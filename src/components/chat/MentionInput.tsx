import { useCallback, useEffect, useRef, useState } from 'react'
import { tmdb, type TmdbMultiSearchItem } from '../../lib/tmdb'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled?: boolean
  placeholder?: string
}

export function MentionInput({ value, onChange, onSubmit, disabled, placeholder }: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<TmdbMultiSearchItem[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [mentionStart, setMentionStart] = useState(-1)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Detect @ trigger
  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    onChange(newValue)

    const cursorPos = e.target.selectionStart ?? newValue.length
    // Find last @ before cursor that isn't preceded by a non-space char
    const textBeforeCursor = newValue.slice(0, cursorPos)
    const atMatch = textBeforeCursor.match(/(^|[\s])@([^@]*)$/)

    if (atMatch) {
      const query = atMatch[2]
      const start = textBeforeCursor.lastIndexOf('@' + query)
      setMentionStart(start)
      setMentionQuery(query)

      if (query.length >= 2) {
        // Debounced TMDB search
        if (debounceRef.current) clearTimeout(debounceRef.current)
        debounceRef.current = setTimeout(async () => {
          try {
            const res = await tmdb.searchMulti(query)
            const filtered = res.results
              .filter((r) => r.media_type === 'movie' || r.media_type === 'tv' || r.media_type === 'person')
              .slice(0, 6)
            setSuggestions(filtered)
            setShowSuggestions(filtered.length > 0)
            setSelectedIndex(0)
          } catch {
            setSuggestions([])
            setShowSuggestions(false)
          }
        }, 300)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } else {
      setShowSuggestions(false)
      setMentionQuery('')
    }
  }, [onChange])

  // Insert mention
  const insertMention = useCallback((item: TmdbMultiSearchItem) => {
    const label = item.title || item.name || ''
    const tag = `@[${label}](${item.media_type}:${item.id})`
    const before = value.slice(0, mentionStart)
    const after = value.slice(mentionStart + 1 + mentionQuery.length) // +1 for @
    const newValue = before + tag + after + ' '
    onChange(newValue)
    setShowSuggestions(false)
    setSuggestions([])
    inputRef.current?.focus()
  }, [value, mentionStart, mentionQuery, onChange])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showSuggestions && suggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((i) => (i + 1) % suggestions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((i) => (i - 1 + suggestions.length) % suggestions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(suggestions[selectedIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setShowSuggestions(false)
        return
      }
    }

    if (e.key === 'Enter' && !showSuggestions) {
      e.preventDefault()
      onSubmit()
    }
  }, [showSuggestions, suggestions, selectedIndex, insertMention, onSubmit])

  // Cleanup debounce
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [])

  function getItemIcon(type: string) {
    if (type === 'movie') return '🎬'
    if (type === 'tv') return '📺'
    return '🎭'
  }

  function getItemLabel(item: TmdbMultiSearchItem) {
    return item.title || item.name || '?'
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder ?? 'Message... (@ pour mentionner)'}
        className="w-full bg-[var(--color-surface-2)] text-[var(--color-text)] text-sm rounded-lg px-3 py-2 pr-10 border border-[var(--color-border)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-text-muted)]"
      />

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg shadow-lg overflow-hidden z-50">
          {suggestions.map((item, i) => (
            <button
              key={`${item.media_type}-${item.id}`}
              onClick={() => insertMention(item)}
              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                i === selectedIndex
                  ? 'bg-[var(--color-accent)]/20 text-[var(--color-text)]'
                  : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)]'
              }`}
            >
              <span className="text-xs">{getItemIcon(item.media_type)}</span>
              <span className="truncate">{getItemLabel(item)}</span>
              <span className="text-[10px] text-[var(--color-text-muted)] ml-auto flex-shrink-0">
                {item.media_type === 'movie' ? 'Film' : item.media_type === 'tv' ? 'Série' : 'Personne'}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
