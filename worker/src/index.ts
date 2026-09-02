import { SYSTEM_PROMPT } from './systemPrompt'

export interface Env {
  HF_TOKEN: string
  /** Both KV bindings are optional — see hasKv() below. */
  CACHE?: KVNamespace
  RL?: KVNamespace
}

const ALLOWED_ORIGINS = new Set([
  'https://shaden-ai.com',
  'https://www.shaden-ai.com',
  'http://localhost:5173',
])

// Model choice, verified against the live HF router before shipping:
// - Llama-3.1-8B-Instruct (the previous pick) was cheap and fast but weak on the
//   two rules that matter most here: it answered in Arabic when a user asked it
//   to, and it drifted off the CV facts / into the third person.
// - Llama-3.3-70B-Instruct via `novita` holds the first-person voice, stays
//   grounded, answers Arabic-dialect questions in English, and refuses
//   off-topic ones cleanly. Cost ~$0.13 / $0.39 per 1M input/output tokens —
//   with the ~1.2k-token prompt and the daily cap below, a few cents a day.
// - Qwen2.5-7B-Instruct still leaks the odd non-English token; not used.
const MODEL = 'meta-llama/Llama-3.3-70B-Instruct:novita'
const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions'

const MAX_INPUT_CHARS = 1000
const MAX_OUTPUT_TOKENS = 400
const RATE_LIMIT_PER_HOUR = 15
const GLOBAL_DAILY_CAP = 300
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

// Voice cloning: a ZeroGPU Gradio Space (Qwen3-TTS-12Hz-0.6B-Base), cloning
// Shaden's own recorded voice. Both the reference audio and its transcript are
// fixed server-side — the browser only ever sends the text to speak, never a
// voice to clone, so this can't be repurposed to clone an arbitrary voice.
// 0.6B chosen over 1.7B after listening to both: clearly good enough, and
// meaningfully faster/cheaper against the daily ZeroGPU quota.
const TTS_SPACE = 'https://shadenshanab-qwen3-tts.hf.space'
const REF_AUDIO_URL = 'https://shaden-ai.com/voice-ref.wav'
const REF_TEXT =
  "Hi, I'm Shaden. I build AI systems that actually ship — voice agents, data platforms, and everything in between. Thanks for stopping by my portfolio, and I hope you find something interesting here."
const TTS_MODEL_SIZE = '0.6B'
const MAX_SPEAK_CHARS = 600 // a chat answer is at most ~400 tokens anyway
const SPEAK_RATE_LIMIT_PER_HOUR = 5 // generation burns real ZeroGPU quota (~20s each) — cache absorbs repeats
const SPEAK_GLOBAL_DAILY_CAP = 40
const SPEAK_CACHE_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days — the voice never changes for the same text
const SPEAK_TIMEOUT_MS = 28_000 // stay under Cloudflare's free-plan wall-clock ceiling

function corsHeaders(origin: string | null): HeadersInit {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : ''
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...corsHeaders(origin) },
  })
}

const isArabic = (text: string) => /[؀-ۿ]/.test(text)
const normCacheKey = (q: string) => 'q:' + q.trim().toLowerCase().replace(/\s+/g, ' ').slice(0, 200)

/** `prefix` keeps /chat and /speak counted separately — burning the chat
 *  limit should never block voice generation or vice versa. */
async function checkRateLimit(
  env: Env,
  ip: string,
  prefix: string,
  perHour: number,
  perDay: number,
): Promise<boolean> {
  if (!env.RL) return true // no binding configured yet — allow, don't crash
  const hourKey = `${prefix}:ip:${ip}:${new Date().toISOString().slice(0, 13)}`
  const dayKey = `${prefix}:day:${new Date().toISOString().slice(0, 10)}`

  const [ipCount, dayCount] = await Promise.all([env.RL.get(hourKey), env.RL.get(dayKey)])
  if (Number(ipCount ?? 0) >= perHour) return false
  if (Number(dayCount ?? 0) >= perDay) return false

  await Promise.all([
    env.RL.put(hourKey, String(Number(ipCount ?? 0) + 1), { expirationTtl: 3600 }),
    env.RL.put(dayKey, String(Number(dayCount ?? 0) + 1), { expirationTtl: 86400 }),
  ])
  return true
}

/** Streams an already-known string back the same way a live model reply would look. */
function streamText(text: string, origin: string | null) {
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text))
      controller.close()
    },
  })
  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders(origin) } })
}

// A user can explicitly ask the model to answer in Arabic/dialect despite the
// system prompt forbidding it, and this 8B model sometimes complies anyway —
// prompting alone couldn't close this out (verified: failures always start
// in Arabic from the very first token, never partway through). This is the
// deterministic backstop: every delta is checked for Arabic script BEFORE
// it's forwarded, so no Arabic can ever reach the browser regardless of what
// the model decides to do.
const ENGLISH_ONLY_FALLBACK =
  "I can only answer in English here — ask me that again and I'll reply in English."

/** Converts HF's OpenAI-style SSE chat stream into plain text chunks, and tees the
 *  full answer into KV once it's done — the frontend only ever reads raw text. */
function relayAndCache(upstream: ReadableStream<Uint8Array>, env: Env, cacheKey: string, origin: string | null) {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let full = ''
  let tainted = false

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader()
      try {
        for (;;) {
          if (tainted) break
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop() ?? ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue
            const payload = trimmed.slice(5).trim()
            if (payload === '[DONE]') continue
            try {
              const parsed = JSON.parse(payload)
              const delta: string | undefined = parsed?.choices?.[0]?.delta?.content
              if (delta) {
                if (isArabic(delta)) {
                  // Caught before a single Arabic character reaches the client.
                  // Discard everything generated so far, substitute a safe reply,
                  // and stop pulling further (already-wasted) tokens from HF.
                  tainted = true
                  full = ENGLISH_ONLY_FALLBACK
                  controller.enqueue(encoder.encode(ENGLISH_ONLY_FALLBACK))
                  await reader.cancel()
                  break
                }
                full += delta
                controller.enqueue(encoder.encode(delta))
              }
            } catch {
              // partial/non-JSON SSE line — skip rather than break the stream
            }
          }
        }
      } finally {
        controller.close()
        if (env.CACHE && full.trim()) {
          await env.CACHE.put(cacheKey, full, { expirationTtl: CACHE_TTL_SECONDS })
        }
      }
    },
  })

  return new Response(stream, { headers: { 'content-type': 'text/plain; charset=utf-8', ...corsHeaders(origin) } })
}

async function handleChat(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get('Origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin not allowed' }, 403, null)

  let body: { question?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400, origin)
  }

  const question = (body.question ?? '').trim()
  if (!question) return json({ error: 'question required' }, 400, origin)
  if (question.length > MAX_INPUT_CHARS) {
    return json({ error: `question too long (max ${MAX_INPUT_CHARS} chars)` }, 413, origin)
  }

  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  const allowed = await checkRateLimit(env, ip, 'chat', RATE_LIMIT_PER_HOUR, GLOBAL_DAILY_CAP)
  if (!allowed) return json({ error: 'rate limit exceeded, try again later' }, 429, origin)

  const ar = isArabic(question)
  // Language-suffixed: the same question text can legitimately get an English
  // or Arabic answer depending on which script it was typed in.
  const cacheKey = `${normCacheKey(question)}:${ar ? 'ar' : 'en'}`
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey)
    // Never serve a cached answer that contains Arabic — it predates the
    // language backstop; drop it and regenerate.
    if (cached && !isArabic(cached)) return streamText(cached, origin)
  }

  const upstream = await fetch(HF_CHAT_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.HF_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      stream: true,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: question },
      ],
    }),
  })

  if (!upstream.ok || !upstream.body) {
    // Bubble the real status (402 = out of credits, 429 = provider-side limit,
    // 503 = model loading) so it's visible in logs; the frontend treats any
    // non-2xx as "fall back to the local answer bank" regardless of the code.
    const detail = await upstream.text().catch(() => '')
    return json({ error: 'upstream unavailable', status: upstream.status, detail }, 502, origin)
  }

  return relayAndCache(upstream.body, env, cacheKey, origin)
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

type GradioFileResult = { url: string } | null

/** Uploads the fixed reference voice to the Space and returns the server-side
 *  path Gradio hands back. The Space's `generate_voice_clone` only accepts an
 *  uploaded file — a remote `url` FileData is rejected — so this has to happen
 *  before every generation. Gradio content-hashes uploads, and the path is
 *  cached in KV, so in practice this is one small request most of the time. */
async function uploadRefAudio(env: Env, signal: AbortSignal): Promise<string | null> {
  const cached = await env.CACHE?.get('speak:refpath')
  if (cached) return cached

  const audio = await fetch(REF_AUDIO_URL, { signal })
  if (!audio.ok) return null
  const form = new FormData()
  form.append('files', new Blob([await audio.arrayBuffer()], { type: 'audio/wav' }), 'voice-ref.wav')

  const up = await fetch(`${TTS_SPACE}/gradio_api/upload`, { method: 'POST', body: form, signal })
  if (!up.ok) return null
  const paths = (await up.json()) as string[]
  const path = paths?.[0]
  if (!path) return null

  // 30 min: long enough to amortise, short enough that a Space restart (which
  // invalidates the path) self-heals quickly.
  await env.CACHE?.put('speak:refpath', path, { expirationTtl: 1800 })
  return path
}

/** Calls one Gradio `/gradio_api/call/<fn>` endpoint (POST to start, then poll
 *  its SSE result stream) and returns the first file result it completes with. */
async function callGradioForFile(fnName: string, data: unknown[], timeoutMs: number): Promise<GradioFileResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const post = await fetch(`${TTS_SPACE}/gradio_api/call/${fnName}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ data }),
      signal: controller.signal,
    })
    if (!post.ok) return null
    const { event_id } = (await post.json()) as { event_id?: string }
    if (!event_id) return null

    const res = await fetch(`${TTS_SPACE}/gradio_api/call/${fnName}/${event_id}`, {
      headers: { accept: 'text/event-stream' },
      signal: controller.signal,
    })
    if (!res.ok || !res.body) return null

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''
      for (const evt of events) {
        const m = evt.match(/^data: (.*)$/m)
        if (!m) continue
        if (evt.includes('event: error')) return null
        try {
          const parsed = JSON.parse(m[1])
          const file = parsed?.[0]
          const url: string | undefined =
            file?.url ?? (file?.path ? `${TTS_SPACE}/gradio_api/file=${file.path}` : undefined)
          if (url) {
            await reader.cancel()
            return { url }
          }
        } catch {
          // heartbeat or partial payload — keep polling
        }
      }
    }
    return null
  } catch {
    return null // network error, or aborted by the timeout above
  } finally {
    clearTimeout(timeout)
  }
}

async function handleSpeak(req: Request, env: Env): Promise<Response> {
  const origin = req.headers.get('Origin')
  if (origin && !ALLOWED_ORIGINS.has(origin)) return json({ error: 'origin not allowed' }, 403, null)

  let body: { text?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid json' }, 400, origin)
  }

  const text = (body.text ?? '').trim().slice(0, MAX_SPEAK_CHARS)
  if (!text) return json({ error: 'text required' }, 400, origin)

  const ip = req.headers.get('CF-Connecting-IP') ?? 'unknown'
  const cacheKey = `speak:${await sha256Hex(text)}`

  // Cache check happens before the rate limit: a repeat of a common answer
  // should never cost the visitor their quota, only a genuinely new line does.
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey, { type: 'arrayBuffer' })
    if (cached) {
      return new Response(cached, { headers: { 'content-type': 'audio/wav', ...corsHeaders(origin) } })
    }
  }

  const allowed = await checkRateLimit(env, ip, 'speak', SPEAK_RATE_LIMIT_PER_HOUR, SPEAK_GLOBAL_DAILY_CAP)
  if (!allowed) return json({ error: 'rate limit exceeded, try again later' }, 429, origin)

  const uploadCtl = new AbortController()
  const uploadTimer = setTimeout(() => uploadCtl.abort(), 12_000)
  let refPath: string | null
  try {
    refPath = await uploadRefAudio(env, uploadCtl.signal)
  } catch {
    refPath = null
  } finally {
    clearTimeout(uploadTimer)
  }
  if (!refPath) return json({ error: 'reference audio unavailable' }, 502, origin)

  const result = await callGradioForFile(
    'generate_voice_clone',
    [
      { path: refPath, meta: { _type: 'gradio.FileData' } },
      REF_TEXT,
      text,
      'English',
      false,
      TTS_MODEL_SIZE,
    ],
    SPEAK_TIMEOUT_MS,
  )
  if (!result) return json({ error: 'voice generation unavailable' }, 502, origin)

  const audioRes = await fetch(result.url)
  if (!audioRes.ok || !audioRes.body) return json({ error: 'failed to fetch generated audio' }, 502, origin)
  const audioBytes = await audioRes.arrayBuffer()

  if (env.CACHE) {
    await env.CACHE.put(cacheKey, audioBytes, { expirationTtl: SPEAK_CACHE_TTL_SECONDS })
  }

  return new Response(audioBytes, { headers: { 'content-type': 'audio/wav', ...corsHeaders(origin) } })
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const origin = req.headers.get('Origin')
    const url = new URL(req.url)

    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders(origin) })
    }

    if (url.pathname === '/chat' && req.method === 'POST') {
      return handleChat(req, env)
    }

    if (url.pathname === '/speak' && req.method === 'POST') {
      return handleSpeak(req, env)
    }

    if (url.pathname === '/health') {
      return json({ ok: true }, 200, origin)
    }

    return json({ error: 'not found' }, 404, origin)
  },
}
