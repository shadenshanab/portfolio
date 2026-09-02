import { useEffect, useState } from 'react'

const SEQUENCE = [
  'ArrowUp',
  'ArrowUp',
  'ArrowDown',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ArrowLeft',
  'ArrowRight',
  'b',
  'a',
]

/** ↑↑↓↓←→←→BA flips the whole site into 8-bit mode for a few seconds. */
export function useKonami(duration = 6000) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    let pos = 0
    const onKey = (e: KeyboardEvent) => {
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      pos = key === SEQUENCE[pos] ? pos + 1 : key === SEQUENCE[0] ? 1 : 0
      if (pos === SEQUENCE.length) {
        pos = 0
        setActive(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!active) return
    // On <html>, not <body>, so the rem-based type scale shrinks with it.
    document.documentElement.classList.add('eightbit')
    const t = setTimeout(() => setActive(false), duration)
    return () => {
      clearTimeout(t)
      document.documentElement.classList.remove('eightbit')
    }
  }, [active, duration])

  return active
}
