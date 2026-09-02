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
// - Qwen2.5-7B-Instruct is only servable (for this account) via `together`
//   (which silently redirects to a paid "-Turbo" dedicated variant — 400s)
//   or `featherless-ai`, which leaked a stray Chinese sentence into an
//   Arabic reply during testing — unacceptable for production.
// - meta-llama/Llama-3.1-8B-Instruct via `novita` was clean, ~2x faster,
//   and correctly grounded on the CV facts below, so it's what ships.
//   Cost: $0.02 / $0.05 per 1M input/output tokens — a full conversation
//   is a fraction of a cent.
const MODEL = 'meta-llama/Llama-3.1-8B-Instruct:novita'
const HF_CHAT_URL = 'https://router.huggingface.co/v1/chat/completions'

const MAX_INPUT_CHARS = 1000
const MAX_OUTPUT_TOKENS = 400
const RATE_LIMIT_PER_HOUR = 15
const GLOBAL_DAILY_CAP = 300
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 7 // 7 days

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

async function checkRateLimit(env: Env, ip: string): Promise<boolean> {
  if (!env.RL) return true // no binding configured yet — allow, don't crash
  const hourKey = `ip:${ip}:${new Date().toISOString().slice(0, 13)}`
  const dayKey = `day:${new Date().toISOString().slice(0, 10)}`

  const [ipCount, dayCount] = await Promise.all([env.RL.get(hourKey), env.RL.get(dayKey)])
  if (Number(ipCount ?? 0) >= RATE_LIMIT_PER_HOUR) return false
  if (Number(dayCount ?? 0) >= GLOBAL_DAILY_CAP) return false

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

/** Converts HF's OpenAI-style SSE chat stream into plain text chunks, and tees the
 *  full answer into KV once it's done — the frontend only ever reads raw text. */
function relayAndCache(upstream: ReadableStream<Uint8Array>, env: Env, cacheKey: string, origin: string | null) {
  const decoder = new TextDecoder()
  const encoder = new TextEncoder()
  let buffer = ''
  let full = ''

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader()
      try {
        for (;;) {
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
  const allowed = await checkRateLimit(env, ip)
  if (!allowed) return json({ error: 'rate limit exceeded, try again later' }, 429, origin)

  const ar = isArabic(question)
  // Language-suffixed: the same question text can legitimately get an English
  // or Arabic answer depending on which script it was typed in.
  const cacheKey = `${normCacheKey(question)}:${ar ? 'ar' : 'en'}`
  if (env.CACHE) {
    const cached = await env.CACHE.get(cacheKey)
    if (cached) return streamText(cached, origin)
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

    if (url.pathname === '/health') {
      return json({ ok: true }, 200, origin)
    }

    return json({ error: 'not found' }, 404, origin)
  },
}
