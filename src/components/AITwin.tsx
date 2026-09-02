import { useCallback, useEffect, useRef, useState } from 'react'
import { chat } from '../lib/api'
import { isArabic, suggestions } from '../lib/answerBank'
import { projects } from '../content/cv'
import { useVoice } from '../hooks/useVoice'
import { SectionHead } from './SectionHead'
import { Reveal } from './Reveal'
import { Mic, Send, Speaker, Stop } from './icons'

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
  text: "I'm Shaden's AI twin. Ask me anything about her work — voice agents, LLM systems, Arabic NLP, PII detection, data platforms, forecasting. English or Arabic, typed or spoken.",
}

export function AITwin() {
  const [msgs, setMsgs] = useState<Msg[]>([GREETING])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const idRef = useRef(1)
  const speakRef = useRef<((text: string, arabic?: boolean) => void) | null>(null)

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
      setMsgs((m) => [...m, userMsg, { id: botId, role: 'bot', text: '', ar, streaming: true }])
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
      if (autoSpeak) speakRef.current?.(full, ar)
    },
    [busy, autoSpeak],
  )

  const { supported, listening, interim, speaking, start, stop, speak, shutUp } = useVoice((text) => ask(text))

  // `ask` is defined above `speak`, so it reaches the current one through a ref.
  useEffect(() => {
    speakRef.current = speak
  }, [speak])

  // Keep the transcript pinned to the newest message while it types.
  useEffect(() => {
    const el = bodyRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [msgs])

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
          label="Ask the twin"
          title="Don't read the CV. Interrogate it."
          lede="A conversational twin that only knows what's actually on Shaden's CV — so it answers specifics and refuses to invent the rest. Type or speak, in English or Arabic."
        />

        <Reveal delay={80}>
          <div className="term" style={{ marginTop: 'clamp(2rem,5vw,3rem)' }}>
            <div className="term-bar">
              <span className="lights" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              <span className="name">shaden-twin — local runtime</span>
              <button
                className="chip"
                style={{ marginInlineStart: 'auto' }}
                onClick={() => {
                  if (speaking) shutUp()
                  setAutoSpeak((v) => !v)
                }}
                aria-pressed={autoSpeak}
                title="Read answers aloud"
              >
                <Speaker />
                {autoSpeak ? 'voice on' : 'voice off'}
              </button>
            </div>

            <div className="term-body" ref={bodyRef} aria-live="polite" aria-atomic="false">
              {msgs.map((m) => (
                <div className={`msg ${m.role}`} key={m.id}>
                  <div className="who">{m.role === 'user' ? 'you' : 'shaden.twin'}</div>
                  <div className={`body ${m.ar ? 'ar' : ''}`}>
                    {m.text}
                    {m.streaming && <span className="caret" aria-hidden="true" />}
                  </div>

                  {!!m.sources?.length && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem', marginTop: '.8rem' }}>
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
                </div>
              ))}

              {listening && (
                <div className="msg user">
                  <div className="who">you · listening</div>
                  <div className="body" style={{ opacity: 0.6 }}>
                    {interim || '…'}
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
                Ask Shaden's AI twin a question
              </label>
              <input
                id="twin-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about her work…  /  اسألني عن شغلها…"
                autoComplete="off"
                disabled={busy}
              />

              {supported && (
                <button
                  type="button"
                  className="mic"
                  data-on={listening}
                  onClick={() => (listening ? stop() : start(isArabic(input) ? 'ar-JO' : 'en-US'))}
                  aria-label={listening ? 'Stop listening' : 'Ask by voice'}
                  title={listening ? 'Stop listening' : 'Ask by voice'}
                >
                  {listening ? <Stop /> : <Mic />}
                </button>
              )}

              <button type="submit" className="icon-btn" disabled={busy} aria-label="Send question">
                <Send />
              </button>
            </form>
          </div>
        </Reveal>

        <Reveal delay={140}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.5rem', marginTop: '1.1rem' }}>
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
          <p className="mono" style={{ color: 'var(--text-faint)', marginTop: '1.1rem', letterSpacing: '.08em' }}>
            Runs entirely in your browser — no data leaves this page.
            {!supported && ' Voice needs Chrome, Edge or Safari.'}
          </p>
        </Reveal>
      </div>
    </section>
  )
}
