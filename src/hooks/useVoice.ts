import { useCallback, useEffect, useState } from 'react'

/**
 * The browser's built-in speech synthesis — the fallback voice for the AI twin
 * when Shaden's cloned voice (a pre-recorded clip, or the /speak Space) can't be
 * reached. Output only; the twin takes questions as text.
 */
export function useVoice() {
  const [speaking, setSpeaking] = useState(false)

  /** `onDone` fires when the browser voice finishes or errors — the cloned-voice
   *  path has its own audio-element events, but this fallback path needs it to
   *  know when to clear the "speaking" UI. */
  const speak = useCallback((text: string, arabic = false, onDone?: () => void) => {
    if (typeof window.speechSynthesis === 'undefined') {
      onDone?.()
      return
    }
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = arabic ? 'ar-SA' : 'en-US'
    u.rate = 1.02
    u.pitch = 1
    u.onstart = () => setSpeaking(true)
    u.onend = () => {
      setSpeaking(false)
      onDone?.()
    }
    u.onerror = () => {
      setSpeaking(false)
      onDone?.()
    }
    window.speechSynthesis.speak(u)
  }, [])

  const shutUp = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => () => window.speechSynthesis?.cancel(), [])

  return { speaking, speak, shutUp }
}
