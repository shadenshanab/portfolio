import { useEffect, useMemo, useRef, useState } from 'react'
import { profile, sections } from '../content/cv'

export type Cmd = { id: string; label: string; hint: string; run: () => void }

export function CommandPalette({
  open,
  onClose,
  onToggleTheme,
}: {
  open: boolean
  onClose: () => void
  onToggleTheme: () => void
}) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands: Cmd[] = useMemo(() => {
    const go = (id: string) => () => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    return [
      ...sections
        .filter((s) => s.id !== 'top')
        .map((s) => ({ id: s.id, label: `Go to ${s.label}`, hint: 'jump', run: go(s.id) })),
      {
        id: 'ask',
        label: 'Ask the AI twin a question',
        hint: 'focus',
        run: () => {
          go('twin')()
          setTimeout(() => document.getElementById('twin-input')?.focus(), 550)
        },
      },
      { id: 'theme', label: 'Toggle light / dark mode', hint: 'theme', run: onToggleTheme },
      {
        id: 'cv',
        label: 'Download CV (PDF)',
        hint: 'file',
        run: () => window.open(`/${profile.cv}`, '_blank', 'noopener'),
      },
      { id: 'mail', label: `Email ${profile.email}`, hint: 'contact', run: () => (window.location.href = `mailto:${profile.email}`) },
      { id: 'gh', label: 'Open GitHub', hint: 'link', run: () => window.open(profile.github, '_blank', 'noopener') },
      { id: 'li', label: 'Open LinkedIn', hint: 'link', run: () => window.open(profile.linkedin, '_blank', 'noopener') },
    ]
  }, [onToggleTheme])

  const results = useMemo(() => {
    const needle = q.toLowerCase().trim()
    if (!needle) return commands
    return commands.filter((c) => c.label.toLowerCase().includes(needle) || c.hint.includes(needle))
  }, [q, commands])

  // App mounts this only while open, so state resets naturally each time.
  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 20)
    return () => clearTimeout(t)
  }, [])

  if (!open) return null

  const fire = (c?: Cmd) => {
    if (!c) return
    onClose()
    setTimeout(c.run, 10)
  }

  return (
    <div
      className="palette-scrim"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <label className="sr" htmlFor="palette-input">
          Search commands
        </label>
        <input
          id="palette-input"
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setCursor(0)
          }}
          placeholder="Type a command…  (esc to close)"
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setCursor((c) => Math.min(c + 1, results.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setCursor((c) => Math.max(c - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              fire(results[cursor])
            } else if (e.key === 'Escape') {
              onClose()
            }
          }}
        />

        <ul>
          {results.map((c, i) => (
            <li
              key={c.id}
              data-active={i === cursor}
              onMouseEnter={() => setCursor(i)}
              onClick={() => fire(c)}
            >
              <span className="k pixel">›</span>
              <span>{c.label}</span>
              <span className="hint">{c.hint}</span>
            </li>
          ))}
          {!results.length && (
            <li style={{ color: 'var(--text-faint)' }}>
              <span className="k pixel">×</span> Nothing matches that.
            </li>
          )}
        </ul>
      </div>
    </div>
  )
}
