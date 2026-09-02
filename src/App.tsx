import { useEffect, useState } from 'react'
import { Nav } from './components/Nav'
import { Hero } from './components/Hero'
import { AITwin } from './components/AITwin'
import { Work } from './components/Work'
import { Projects } from './components/Projects'
import { Skills } from './components/Skills'
import { Proof } from './components/Proof'
import { Contact } from './components/Contact'
import { CommandPalette } from './components/CommandPalette'
import { useTheme } from './hooks/useTheme'
import { useKonami } from './hooks/useKonami'

export default function App() {
  const { theme, toggle } = useTheme()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const eightbit = useKonami()

  // ⌘K / Ctrl+K anywhere, Esc to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
      } else if (e.key === 'Escape') {
        setPaletteOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <a className="skip" href="#twin">
        Skip to content
      </a>

      <Nav theme={theme} onToggleTheme={toggle} onOpenPalette={() => setPaletteOpen(true)} />

      <main>
        <Hero />
        <AITwin />
        <Work />
        <Projects />
        <Skills />
        <Proof />
        <Contact />
      </main>

      {paletteOpen && (
        <CommandPalette open onClose={() => setPaletteOpen(false)} onToggleTheme={toggle} />
      )}

      {eightbit && (
        <div className="egg-toast" role="status">
          ★ 8-BIT MODE ★
        </div>
      )}
    </>
  )
}
