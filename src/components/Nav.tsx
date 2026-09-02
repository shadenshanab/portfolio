import { useEffect, useState } from 'react'
import { sections } from '../content/cv'
import { Command, Moon, Sun } from './icons'
import type { Theme } from '../hooks/useTheme'

export function Nav({
  theme,
  onToggleTheme,
  onOpenPalette,
}: {
  theme: Theme
  onToggleTheme: () => void
  onOpenPalette: () => void
}) {
  const [stuck, setStuck] = useState(false)
  const [active, setActive] = useState('top')

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Track which section is in view for the nav underline.
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        if (visible) setActive(visible.target.id)
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    sections.forEach((s) => {
      const el = document.getElementById(s.id)
      if (el) io.observe(el)
    })
    return () => io.disconnect()
  }, [])

  return (
    <nav className="nav" data-stuck={stuck}>
      <a href="#top" className="nav-mark">
        shaden<span>.ai</span>
      </a>

      <div className="nav-links">
        {sections
          .filter((s) => s.id !== 'top')
          .map((s) => (
            <a key={s.id} href={`#${s.id}`} className="nav-link" data-active={active === s.id}>
              {s.label}
            </a>
          ))}
      </div>

      <div className="nav-actions">
        <button className="icon-btn" onClick={onOpenPalette} aria-label="Open command palette (Ctrl or Cmd + K)">
          <Command />
        </button>
        <button
          className="icon-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun /> : <Moon />}
        </button>
      </div>
    </nav>
  )
}
