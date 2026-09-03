/**
 * The single boundary between the AI Twin UI and whatever is answering it.
 * The UI just consumes an async iterable of text chunks plus a `meta` promise.
 *
 * Routing:
 *   - "hi"/"hello" style openers are served straight from the answer bank — the
 *     canned line is fine and it has a pre-recorded voice clip, so there's
 *     nothing for a model to add.
 *   - Everything else goes to the hosted LLM (Cloudflare Worker -> HuggingFace).
 *     Every chunk it returns is checked for Arabic before display; on any
 *     failure (or if it goes off-script into Arabic) the UI falls back to the
 *     grounded answer-bank response for that question.
 *   - With USE_REMOTE off, everything is served from the bank.
 */

import { answer, isArabic, type Answer } from './answerBank'

const USE_REMOTE = true
const CHAT_ENDPOINT = 'https://api.shaden-ai.com/chat'
const SPEAK_ENDPOINT = 'https://api.shaden-ai.com/speak'

export type ChatMeta = {
  sources: string[]
  /** Intent id the answer bank matched, or 'none'. */
  matched: string
  /** 'local' = the displayed text is the bank's exact wording. 'remote' = the LLM wrote it. */
  mode: 'local' | 'remote'
}

export type ChatResult = {
  /** Streams the answer chunk by chunk so the UI can type it out. */
  stream: AsyncIterable<string>
  /** Resolves once the full answer is known. */
  meta: Promise<ChatMeta>
}

/** Split text into small chunks so local answers still feel like they're being typed. */
async function* typeOut(text: string, signal?: AbortSignal): AsyncIterable<string> {
  const tokens = text.match(/\S+\s*/g) ?? [text]
  for (const t of tokens) {
    if (signal?.aborted) return
    yield t
    await new Promise((r) => setTimeout(r, 14 + Math.random() * 26))
  }
}

function localChat(question: string, signal?: AbortSignal): ChatResult {
  const a: Answer = answer(question)
  return {
    stream: typeOut(a.text, signal),
    meta: Promise.resolve({ sources: a.sources, matched: a.matched, mode: 'local' as const }),
  }
}

async function* remoteStream(question: string, signal?: AbortSignal): AsyncIterable<string> {
  // Cap the whole round trip: a healthy answer either streams from KV instantly
  // or starts token-by-token within a second or two. If nothing lands in 22s the
  // Worker is wedged — abort so `guarded()` can fall back to the bank instead of
  // leaving "thinking…" on screen indefinitely.
  const timeout = AbortSignal.timeout(22_000)
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
  })
  if (!res.ok || !res.body) throw new Error(`chat ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    yield decoder.decode(value, { stream: true })
  }
}

export function chat(question: string, signal?: AbortSignal, preferLocal = false): ChatResult {
  const a = answer(question)

  // The opening turn never needs a model. Neither do the suggestion chips
  // (`preferLocal`) — those are served from the grounded bank on purpose:
  // instant, free, a pre-baked voice clip, and they work with the Worker down.
  if (!USE_REMOTE || preferLocal || a.matched === 'greeting') return localChat(question, signal)

  let usedRemote = true

  async function* guarded() {
    try {
      let any = false
      for await (const chunk of remoteStream(question, signal)) {
        // Deterministic backstop: no Arabic ever reaches the transcript. The
        // Worker has its own server-side version of this check; this one also
        // covers a stale Worker deploy or a poisoned cache entry.
        if (isArabic(chunk)) throw new Error('arabic')
        any = true
        yield chunk
      }
      if (!any) throw new Error('empty')
    } catch {
      // Worker down, rate limited, out of credits, or it went off-script —
      // fall back silently to the grounded bank answer.
      usedRemote = false
      yield* typeOut(a.text, signal)
    }
  }

  const stream = guarded()
  return {
    stream,
    meta: Promise.resolve({
      sources: a.sources,
      matched: a.matched,
      get mode() {
        return usedRemote ? ('remote' as const) : ('local' as const)
      },
    }) as ChatResult['meta'],
  }
}

/**
 * Cloned-voice text-to-speech (Shaden's own recorded voice, via a Cloudflare
 * Worker proxying a ZeroGPU HF Space). Generation takes ~15-25s, so this is
 * meant to be tried once and abandoned on any failure — never retried, never
 * thrown — the caller falls back to the browser's instant built-in voice.
 * Returns null on anything short of a clean 200: network error, cold Space,
 * rate limit, or the Space itself erroring out.
 */
export async function fetchClonedSpeech(text: string, signal?: AbortSignal): Promise<Blob | null> {
  try {
    const res = await fetch(SPEAK_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
      signal,
    })
    if (!res.ok) return null
    const blob = await res.blob()
    return blob.size > 0 ? blob : null
  } catch {
    return null
  }
}
