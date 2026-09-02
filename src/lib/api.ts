/**
 * The single boundary between the AI Twin UI and whatever is answering it.
 *
 * Today: the local answer bank (no network, no cost).
 * Phase 2: point `CHAT_ENDPOINT` at the Cloudflare Worker and flip USE_REMOTE.
 * The UI never changes — it just consumes an async iterable of text chunks.
 */

import { answer, type Answer } from './answerBank'

const USE_REMOTE = true
const CHAT_ENDPOINT = 'https://api.shaden-ai.com/chat'
const SPEAK_ENDPOINT = 'https://api.shaden-ai.com/speak'

export type ChatResult = {
  /** Streams the answer chunk by chunk so the UI can type it out. */
  stream: AsyncIterable<string>
  /** Resolves once the full answer is known (sources, matched intent). */
  meta: Promise<{ sources: string[]; matched: string; mode: 'local' | 'remote' }>
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
  const res = await fetch(CHAT_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ question }),
    signal,
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

export function chat(question: string, signal?: AbortSignal): ChatResult {
  if (!USE_REMOTE) return localChat(question, signal)

  const a = answer(question)
  let usedRemote = true

  async function* guarded() {
    try {
      let any = false
      for await (const chunk of remoteStream(question, signal)) {
        any = true
        yield chunk
      }
      if (!any) throw new Error('empty')
    } catch {
      // Worker down, rate limited, or out of credits — fall back silently.
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
 * rate limit, or the reference audio not being deployed yet.
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
