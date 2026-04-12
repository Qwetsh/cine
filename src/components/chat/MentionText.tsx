import { useNavigate } from 'react-router-dom'

// Parse @[Label](type:id) into clickable links
// Plain text without mentions is returned as-is

const MENTION_REGEX = /@\[([^\]]+)\]\((movie|tv|person):(\d+)\)/g

interface MentionTextProps {
  text: string
}

export function MentionText({ text }: MentionTextProps) {
  const navigate = useNavigate()
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null

  // Reset regex state
  MENTION_REGEX.lastIndex = 0

  while ((match = MENTION_REGEX.exec(text)) !== null) {
    // Push text before match
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }

    const label = match[1]
    const type = match[2] as 'movie' | 'tv' | 'person'
    const id = match[3]
    const route = type === 'person' ? `/person/${id}` : `/${type}/${id}`

    parts.push(
      <button
        key={`${match.index}-${id}`}
        onClick={(e) => {
          e.stopPropagation()
          navigate(route)
        }}
        className="inline text-[var(--color-accent)] font-medium hover:underline"
      >
        @{label}
      </button>
    )

    lastIndex = match.index + match[0].length
  }

  // Push remaining text
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return <span>{parts}</span>
}
