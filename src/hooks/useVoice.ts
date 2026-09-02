import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Browser-native speech in and out. No backend, no cost, no audio leaves the device.
 * SpeechRecognition is Chromium/Safari only — `supported` is false in Firefox
 * so the UI can hide the mic instead of showing a button that errors.
 */

type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start(): void
  stop(): void
  abort(): void
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

function getCtor(): (new () => SpeechRecognitionLike) | null {
  const w = window as unknown as Record<string, unknown>
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null
}

export function useVoice(onFinal: (text: string) => void) {
  const [supported] = useState(() => !!getCtor() && typeof window.speechSynthesis !== 'undefined')
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [speaking, setSpeaking] = useState(false)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const finalRef = useRef(onFinal)

  useEffect(() => {
    finalRef.current = onFinal
  }, [onFinal])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  const start = useCallback((lang: 'en-US' | 'ar-JO' = 'en-US') => {
    const Ctor = getCtor()
    if (!Ctor) return
    recRef.current?.abort()

    const rec = new Ctor()
    rec.lang = lang
    rec.continuous = false
    rec.interimResults = true

    rec.onresult = (e) => {
      let text = ''
      let done = false
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i]
        text += r[0].transcript
        if (r.isFinal) done = true
      }
      setInterim(text)
      if (done && text.trim()) {
        setInterim('')
        finalRef.current(text.trim())
      }
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    rec.onerror = () => {
      setListening(false)
      setInterim('')
    }

    recRef.current = rec
    try {
      rec.start()
      setListening(true)
    } catch {
      setListening(false)
    }
  }, [])

  const speak = useCallback((text: string, arabic = false) => {
    if (typeof window.speechSynthesis === 'undefined') return
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = arabic ? 'ar-SA' : 'en-US'
    u.rate = 1.02
    u.pitch = 1
    u.onstart = () => setSpeaking(true)
    u.onend = () => setSpeaking(false)
    u.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(u)
  }, [])

  const shutUp = useCallback(() => {
    window.speechSynthesis?.cancel()
    setSpeaking(false)
  }, [])

  useEffect(() => () => {
    recRef.current?.abort()
    window.speechSynthesis?.cancel()
  }, [])

  return { supported, listening, interim, speaking, start, stop, speak, shutUp }
}
