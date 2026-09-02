import { useCallback, useEffect, useRef, useState } from 'react'
import { chat, fetchClonedSpeech } from '../lib/api'
import { isArabic, suggestions } from '../lib/answerBank'
import { profile, projects } from '../content/cv'
import { useVoice } from '../hooks/useVoice'
import { SectionHead } from './SectionHead'
import { Reveal } from './Reveal'
import { Loader } from './Loader'
import { Mail, Mic, Phone, Send, Speaker, Stop } from './icons'

/** Which message the cloned/browser voice is working on, and where it is:
 *  'loading'  — fetching the audio (pre-baked clip, or a fresh clone ~15-25s)
 *  'speaking' — audio is playing (cloned file, or the browser fallback) */
type VoicePhase = 'idle' | 'loading' | 'speaking'
type Voice = { id: number | null; phase: VoicePhase; via: 'clone' | 'browser' }
const VOICE_IDLE: Voice = { id: null, phase: 'idle', via: 'clone' }

type Msg = {
  id: number
  role: 'user' | 'bot'
  text: string
  ar: boolean
  sources?: string[]
  streaming?: boolean
}

const GREETING: Msg = {
  id: 0,
  role: 'bot',
  ar: false,
  text: "I'm Shaden's AI Twin — the version of me that lives on this page and answers in my own voice. Ask me what you'd ask in an interview: the voice agents I've built, my LLM and agentic systems, Arabic NLP, PII detection, the data platforms underneath. Type it, or press the mic and talk to me.",
}

/** Answers whose audio is generated ahead of time and committed to /public, so
 *  playback is instant instead of a ~20s round trip to the voice-clone Space.
 *  Regenerate with `npm run gen:greeting` if GREETING.text changes. */
const BAKED_AUDIO: Record<number, string> = { [GREETING.id]: '/greeting.wav' }

const PHONE_HREF = `tel:${profile.phone.replace(/[^\d+]/g, '')}`

export function AITwin() {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [voice, setVoice] = useState<Voice>(VOICE_IDLE)
  const bodyRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idRef = useRef(1)
  const speakAnswerRef = useRef<((text: string, id: number) => void) | null>(null)
  const clonedAudioRef = useRef<HTMLAudioElement | null>(null)
  const speakAbortRef = useRef<AbortController | null>(null)

  const ask = useCallback(
    async (raw: string) => {
      const question = raw.trim()
      if (!question || busy) return

      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl

      const ar = isArabic(question)
      const userMsg: Msg = { id: idRef.current++, role: 'user', text: question, ar }
      const botId = idRef.current++
      // The answer is always in English, regardless of what the user spoke or typed —
      // only the user's own bubble reflects their input language.
      setMsgs((m) => [...m, userMsg, { id: botId, role: 'bot', text: '', ar: false, streaming: true }])
      setInput('')
      setBusy(true)

      const { stream, meta } = chat(question, ctrl.signal)
      let full = ''
      try {
        for await (const chunk of stream) {
          full += chunk
          setMsgs((m) => m.map((x) => (x.id === botId ? { ...x, text: full } : x)))
        }
      } catch {
        full = full || 'Something went wrong on my side. Try asking that again.'
      }

      const { sources } = await meta
      setMsgs((m) => m.map((x) => (x.id === botId ? { ...x, text: full, sources, streaming: false } : x)))
      setBusy(false)
      if (autoSpeak) speakAnswerRef.current?.(full, botId)
    },
    [busy, autoSpeak],
  )

  const {
    micSupported,
    recording,
    transcribing,
    loadingModel,
    modelProgress,
    error,
    speaking,
    start,
    stop,
    cancel,
    speak,
    shutUp,
  } = useVoice((text) => ask(text))

  /** Play an answer in Shaden's voice: a pre-baked clip if we have one, else her
   *  cloned voice from the Space, else the browser's built-in voice. Always English. */
  const speakAnswer = useCallback(
    async (text: string, id: number) => {
      speakAbortRef.current?.abort()
      clonedAudioRef.current?.pause()
      clonedAudioRef.current = null
      shutUp()

      const ctrl = new AbortController()
      speakAbortRef.current = ctrl
      setVoice({ id, phase: 'loading', via: 'clone' })

      let blob: Blob | null = null
      const baked = BAKED_AUDIO[id]
      if (baked) {
        try {
          const res = await fetch(baked, { signal: ctrl.signal })
          if (res.ok) blob = await res.blob()
        } catch {
          /* fall through to the live clone */
        }
      }
      if (ctrl.signal.aborted) return
      if (!blob) blob = await fetchClonedSpeech(text, ctrl.signal)
      if (ctrl.signal.aborted) return

      if (!blob) {
        setVoice({ id, phase: 'speaking', via: 'browser' })
        speak(text, false, () => setVoice((v) => (v.id === id ? VOICE_IDLE : v)))
        return
      }

      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      clonedAudioRef.current = audio
      const cleanup = () => {
        URL.revokeObjectURL(url)
        if (clonedAudioRef.current === audio) {
          clonedAudioRef.current = null
          setVoice((v) => (v.id === id ? VOICE_IDLE : v))
        }
      }
      audio.onended = cleanup
      audio.onerror = cleanup
      setVoice({ id, phase: 'speaking', via: 'clone' })
      audio.play().catch(cleanup)
    },
    [speak, shutUp],
  )

  useEffect(() => {
    speakAnswerRef.current = speakAnswer
  }, [speakAnswer])

  /** Stops whichever voice path is active (loading, cloned playback, or the
   *  browser's speech synthesis) and resets state. */
  const stopAllVoice = useCallback(() => {
    speakAbortRef.current?.abort()
    clonedAudioRef.current?.pause()
    clonedAudioRef.current = null
    shutUp()
    setVoice(VOICE_IDLE)
  }, [shutUp])

  const toggleAutoSpeak = () => {
    if (speaking || voice.phase !== 'idle') stopAllVoice()
    setAutoSpeak((v) => !v)
  }

  const onSpeakMsg = (m: Msg) => {
    if (voice.id === m.id && voice.phase !== 'idle') stopAllVoice()
    else speakAnswer(m.text, m.id)
  }

  const micBusy = recording || transcribing
  const fresh = msgs.length === 1 && !micBusy

  // Keep the transcript pinned to the newest message while it types.
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs, recording, transcribing])

  useEffect(
    () => () => {
      speakAbortRef.current?.abort()
      clonedAudioRef.current?.pause()
    },
    [],
  )

  const jumpToProject = (id: string) => {
    const el = document.getElementById(`proj-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.setAttribute('data-flash', 'true')
    setTimeout(() => el.removeAttribute('data-flash'), 1800)
  }

  return (
    <section className="section" id="twin">
      <div className="wrap">
        <SectionHead
          num="01"
          label="Interview"
          title="Don't read the CV. Ask me."
          lede="Whatever you'd ask me in an interview, ask it here — type it, or press the mic and hear me answer in my own voice."
        />

        <Reveal delay={80}>
          <div className="term twin" style={{ marginTop: 'clamp(2rem,5vw,3rem)' }}>
            <div className="term-bar twin-bar">
              <span className="twin-avatar pixel" aria-hidden="true">
                SS
              </span>
              <span className="twin-id">
                <span className="twin-name">Shaden Shanab</span>
                <span className="twin-state mono">
                  <span className="dot" aria-hidden="true" />
                  live · answers in my voice
                </span>
              </span>

              <button
                className="chip voice-toggle"
                onClick={toggleAutoSpeak}
                aria-pressed={autoSpeak}
                data-on={autoSpeak}
                title={
                  autoSpeak
                    ? 'Every answer plays automatically in my cloned voice'
                    : 'Auto-play every answer in my cloned voice'
                }
              >
                <Speaker />
                {autoSpeak ? 'auto-voice on' : 'auto-voice off'}
              </button>
            </div>

            <div className="term-body" ref={bodyRef} aria-live="polite" aria-atomic="false">
              {msgs.map((m) => (
                <div className={`msg ${m.role}`} key={m.id}>
                  <div className="who">{m.role === 'user' ? 'you' : 'shaden'}</div>
                  <div className={`body ${m.ar ? 'ar' : ''}`}>
                    {m.streaming && !m.text ? (
                      <Loader variant="spin" label="thinking…" />
                    ) : (
                      <>
                        {m.text}
                        {m.streaming && <span className="caret" aria-hidden="true" />}
                      </>
                    )}
                  </div>

                  {!!m.sources?.length && (
                    <div className="msg-sources">
                      <span className="mono" style={{ color: 'var(--text-faint)', alignSelf: 'center' }}>
                        drawn from
                      </span>
                      {m.sources.map((s) => {
                        const p = projects.find((x) => x.id === s)
                        if (!p) return null
                        return (
                          <button key={s} className="chip" onClick={() => jumpToProject(s)}>
                            {p.name} ↗
                          </button>
                        )
                      })}
                    </div>
                  )}

                  {m.role === 'bot' && !m.streaming && m.text && (
                    <button
                      className="say"
                      data-active={voice.id === m.id && voice.phase !== 'idle'}
                      onClick={() => onSpeakMsg(m)}
                      aria-label={
                        voice.id === m.id && voice.phase === 'loading'
                          ? "Loading Shaden's voice"
                          : voice.id === m.id && voice.phase === 'speaking'
                            ? 'Stop playback'
                            : "Hear this answer in Shaden's voice"
                      }
                    >
                      {voice.id === m.id && voice.phase === 'loading' ? (
                        <Loader variant="spin" label="loading my voice…" />
                      ) : voice.id === m.id && voice.phase === 'speaking' ? (
                        <Loader
                          variant="bars"
                          label={voice.via === 'browser' ? 'speaking' : 'speaking — tap to stop'}
                        />
                      ) : (
                        <>
                          <Speaker />
                          <span>hear this in my voice</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}

              {fresh && (
                <div className="twin-nudge">
                  <span className="mono">your move</span>
                  <p>
                    Ask me what you'd ask in an interview — type below, or press{' '}
                    <span className="twin-nudge-key" aria-hidden="true">
                      <Mic />
                    </span>{' '}
                    and talk to me.
                  </p>
                </div>
              )}

              {micBusy && (
                <div className="msg user">
                  <div className="who">you · {recording ? 'recording' : 'transcribing'}</div>
                  <div className="body twin-rec">
                    {recording ? (
                      <>
                        <span className="wave" aria-hidden="true">
                          <i />
                          <i />
                          <i />
                          <i />
                          <i />
                        </span>
                        <span className="rec-hint mono">tap the mic to stop</span>
                      </>
                    ) : (
                      <Loader
                        variant="spin"
                        label={
                          loadingModel && modelProgress > 0 && modelProgress < 1
                            ? `loading the speech model… ${Math.round(modelProgress * 100)}%`
                            : loadingModel
                              ? 'loading the speech model…'
                              : 'transcribing…'
                        }
                      />
                    )}
                  </div>
                </div>
              )}
            </div>

            <form
              className="term-input"
              onSubmit={(e) => {
                e.preventDefault()
                ask(input)
              }}
            >
              <span className="prompt" aria-hidden="true">
                ›
              </span>
              <label className="sr" htmlFor="twin-input">
                Ask Shaden a question
              </label>
              <input
                id="twin-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask me about my work…  /  اسألني عن شغلي…"
                autoComplete="off"
                disabled={busy}
              />

              {micSupported && (
                <button
                  type="button"
                  className="mic"
                  data-on={recording}
                  data-busy={transcribing}
                  data-nudge={fresh}
                  onClick={() => (recording ? stop() : transcribing ? cancel() : start())}
                  aria-label={recording ? 'Stop and transcribe' : transcribing ? 'Cancel' : 'Ask by voice'}
                  title={recording ? 'Stop and transcribe' : transcribing ? 'Cancel' : 'Ask by voice'}
                >
                  {recording ? <Stop /> : transcribing ? <Loader variant="spin" /> : <Mic />}
                </button>
              )}

              <button type="submit" className="icon-btn" disabled={busy} aria-label="Send question">
                <Send />
              </button>
            </form>

            {error && (
              <p className="twin-err mono">
                {error === 'mic-denied'
                  ? 'I need mic access for that — enable it in your browser and try again.'
                  : "Couldn't make out that recording — try again, or just type it."}
              </p>
            )}

            <div className="twin-foot">
              <p className="twin-tip mono">
                Enter to send · ● to talk (first use downloads a small speech model) · answers play in my
                cloned voice
              </p>
              <p className="twin-contact mono">
                <span>Not on the CV?</span>
                <a href={`mailto:${profile.email}`}>
                  <Mail />
                  {profile.email}
                </a>
                <a href={PHONE_HREF}>
                  <Phone />
                  {profile.phone}
                </a>
              </p>
            </div>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div className="twin-try">
            <span className="mono">try asking</span>
            <div className="twin-try-chips">
              {suggestions.map((s) => (
                <button
                  key={s.en}
                  className="chip"
                  onClick={() => ask(s.en)}
                  disabled={busy}
                  style={s.ar ? { fontFamily: 'var(--font-arabic)', letterSpacing: 0 } : undefined}
                >
                  {s.en}
                </button>
              ))}
            </div>
          </div>
          <p className="mono twin-note">
            Speech-to-text runs entirely in your browser — your recording never leaves the page.
            {!micSupported && ' Voice input needs a mic and a current browser.'}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
