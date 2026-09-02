import { useCallback, useEffect, useRef, useState } from 'react'
import { decodePcm16k, loadTranscriber, transcriberReady, type ModelProgress } from '../lib/transcribe'

/**
 * Voice for the AI twin.
 *
 * IN  — records a question with MediaRecorder and transcribes it in-browser with
 *       Whisper (see ../lib/transcribe). Nothing is uploaded. Works in any
 *       browser with a mic, Firefox included — no Web Speech API dependency.
 * OUT — the browser's own speech synthesis, used only as the fallback when
 *       Shaden's cloned voice can't be reached.
 */

type MicPhase = 'idle' | 'recording' | 'loading-model' | 'transcribing'

export function useVoice(onFinal: (text: string) => void) {
  const [micSupported] = useState(
    () =>
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia &&
      typeof window.MediaRecorder !== 'undefined',
  )
  const [phase, setPhase] = useState<MicPhase>('idle')
  const [modelProgress, setModelProgress] = useState(0) // 0..1, only during the first-ever load
  const [error, setError] = useState<'mic-denied' | 'transcribe-failed' | null>(null)
  const [speaking, setSpeaking] = useState(false)

  const recRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const cancelledRef = useRef(false)
  const finalRef = useRef(onFinal)

  useEffect(() => {
    finalRef.current = onFinal
  }, [onFinal])

  const releaseMic = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  const onProgress = useCallback((p: ModelProgress) => {
    if (p.status === 'progress' && p.total) setModelProgress(p.loaded && p.total ? p.loaded / p.total : 0)
    if (p.status === 'ready' || p.status === 'done') setModelProgress(1)
  }, [])

  const start = useCallback(async () => {
    if (!micSupported || recRef.current) return
    setError(null)
    cancelledRef.current = false

    // Warm the model up in parallel with the permission prompt / recording, so
    // by the time they stop talking it's usually ready.
    loadTranscriber(onProgress).catch(() => {})

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch {
      setError('mic-denied')
      return
    }
    streamRef.current = stream
    chunksRef.current = []

    const rec = new MediaRecorder(
      stream,
      MediaRecorder.isTypeSupported('audio/webm') ? { mimeType: 'audio/webm' } : undefined,
    )
    rec.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    rec.onstop = async () => {
      recRef.current = null
      releaseMic()
      if (cancelledRef.current) {
        setPhase('idle')
        return
      }
      const chunks = chunksRef.current
      const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' })
      if (!blob.size) {
        setPhase('idle')
        return
      }
      try {
        setPhase(transcriberReady() ? 'transcribing' : 'loading-model')
        const pipe = await loadTranscriber(onProgress)
        setPhase('transcribing')
        const audio = await decodePcm16k(blob)
        if (audio.length < 1600) {
          setPhase('idle')
          return
        }
        const out = await pipe(audio, { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
        const text = (out.text ?? '').trim()
        setPhase('idle')
        if (text && !cancelledRef.current) finalRef.current(text)
      } catch {
        setError('transcribe-failed')
        setPhase('idle')
      }
    }

    recRef.current = rec
    rec.start()
    setPhase('recording')
  }, [micSupported, onProgress, releaseMic])

  const stop = useCallback(() => {
    if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
  }, [])

  const cancel = useCallback(() => {
    cancelledRef.current = true
    if (recRef.current && recRef.current.state !== 'inactive') {
      recRef.current.stop()
    } else {
      releaseMic()
      setPhase('idle')
    }
  }, [releaseMic])

  /** `onDone` fires when the browser voice finishes or errors — the cloned-voice
   *  path has its own audio-element events, but the fallback path needs this to
   *  know when to clear its "speaking" UI. */
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

  useEffect(
    () => () => {
      if (recRef.current && recRef.current.state !== 'inactive') recRef.current.stop()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      window.speechSynthesis?.cancel()
    },
    [],
  )

  return {
    micSupported,
    recording: phase === 'recording',
    // "loading-model" and "transcribing" are one state as far as the UI cares.
    transcribing: phase === 'loading-model' || phase === 'transcribing',
    loadingModel: phase === 'loading-model',
    modelProgress,
    error,
    speaking,
    start,
    stop,
    cancel,
    speak,
    shutUp,
  }
}
