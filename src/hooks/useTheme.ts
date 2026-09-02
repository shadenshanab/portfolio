import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'
const KEY = 'shaden-theme'

function initial(): Theme {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved === 'light' || saved === 'dark') return saved
  } catch {
    /* private mode / blocked storage — fall through to system preference */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(initial)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.style.colorScheme = theme
    try {
      localStorage.setItem(KEY, theme)
    } catch {
      /* nothing to do — the theme still applies for this visit */
    }
  }, [theme])

  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), [])
  return { theme, toggle }
}
