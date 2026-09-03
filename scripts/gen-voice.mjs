/**
 * Pre-render the AI twin's canned lines in Shaden's cloned voice, so the common
 * playbacks are instant static files instead of a live ZeroGPU round trip.
 *
 *   npm run gen:voice            ->  generate every clip that's missing
 *   npm run gen:voice -- --force ->  regenerate all of them
 *
 * What it writes:
 *   public/voice/greeting.wav        the opening line (GREETING in AITwin.tsx)
 *   public/voice/bank/<intent>.wav   every answer-bank line (answerBank.ts)
 *
 * The suggestion chips and the greeting are served from the bank (see
 * src/lib/api.ts), so those clips cover the paths visitors actually click. A
 * genuinely novel LLM answer still speaks live via the Worker's /speak route,
 * with the browser voice as the last resort.
 *
 * Run this whenever GREETING.text or any intent's `en` wording changes, then
 * commit the .wav files like any other static asset.
 *
 * Talks to the same ZeroGPU Space the Worker uses, with the same reference audio
 * (public/voice-ref.wav) and transcript. The Space is ZeroGPU, which refuses an
 * unauthenticated API caller — so this needs an HF token: HF_TOKEN in the env,
 * or a `huggingface-cli login` (~/.cache/huggingface/token).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { basename, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { intents } from '../src/lib/answerBank.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SPACE = 'https://shadenshanab-qwen3-tts.hf.space'
const FORCE = process.argv.includes('--force')

function hfToken() {
  if (process.env.HF_TOKEN?.trim()) return process.env.HF_TOKEN.trim()
  for (const p of [
    join(homedir(), '.cache', 'huggingface', 'token'),
    join(homedir(), '.huggingface', 'token'),
  ]) {
    try {
      const t = readFileSync(p, 'utf8').trim()
      if (t) return t
    } catch {
      /* not there — try the next */
    }
  }
  throw new Error('no HF token — set HF_TOKEN, or run `huggingface-cli login`')
}

function extract(file, re, what) {
  const m = readFileSync(join(ROOT, file), 'utf8').match(re)
  if (!m) throw new Error(`couldn't find ${what} in ${file}`)
  return JSON.parse(m[1]) // the matched double-quoted literal is also valid JSON
}

const TOKEN = hfToken()
const AUTH = { authorization: `Bearer ${TOKEN}` }

const REF_TEXT = extract('worker/src/index.ts', /const REF_TEXT\s*=\s*\n?\s*("(?:[^"\\]|\\.)*")/, 'REF_TEXT')
const GREETING = extract(
  'src/components/AITwin.tsx',
  /const GREETING: Msg = \{[\s\S]*?text:\s*("(?:[^"\\]|\\.)*")/,
  'GREETING.text',
)

/** Upload the fixed reference voice once; every generation reuses the path. */
async function uploadRef() {
  const wav = readFileSync(join(ROOT, 'public', 'voice-ref.wav'))
  const fd = new FormData()
  fd.append('files', new Blob([wav], { type: 'audio/wav' }), 'voice-ref.wav')
  const up = await fetch(`${SPACE}/gradio_api/upload`, { method: 'POST', body: fd, headers: AUTH })
  if (!up.ok) throw new Error(`ref upload failed: ${up.status} ${await up.text()}`)
  const [path] = await up.json()
  if (!path) throw new Error('ref upload returned no path')
  return path
}

/** One generate_voice_clone call: POST to start, poll the SSE stream, fetch the
 *  finished file. Retries once — ZeroGPU throws the odd transient `event: error`. */
async function generate(text, refPath, attempt = 1) {
  const post = await fetch(`${SPACE}/gradio_api/call/generate_voice_clone`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...AUTH },
    body: JSON.stringify({
      data: [{ path: refPath, meta: { _type: 'gradio.FileData' } }, REF_TEXT, text, 'English', false, '0.6B'],
    }),
  })
  if (!post.ok) throw new Error(`call failed: ${post.status} ${await post.text()}`)
  const { event_id } = await post.json()

  const res = await fetch(`${SPACE}/gradio_api/call/generate_voice_clone/${event_id}`, {
    headers: { accept: 'text/event-stream', ...AUTH },
  })
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let fileUrl = null
  let errored = false
  loop: for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    const events = buf.split('\n\n')
    buf = events.pop() ?? ''
    for (const evt of events) {
      if (/^event: error/m.test(evt)) {
        errored = true
        break loop
      }
      const m = evt.match(/^data: (.*)$/m)
      if (!m) continue
      process.stdout.write('.')
      try {
        const file = JSON.parse(m[1])?.[0]
        const u = file?.url ?? (file?.path ? `${SPACE}/gradio_api/file=${file.path}` : null)
        if (u) {
          fileUrl = u
          break loop
        }
      } catch {
        /* heartbeat */
      }
    }
  }
  await reader.cancel().catch(() => {})

  if (errored || !fileUrl) {
    if (attempt < 2) {
      process.stdout.write(' retry ')
      await new Promise((r) => setTimeout(r, 5000))
      return generate(text, refPath, attempt + 1)
    }
    throw new Error('space returned an error (quota, cold GPU, or overloaded) — try again later')
  }

  const audio = await fetch(fileUrl, { headers: AUTH })
  if (!audio.ok) throw new Error(`fetch of generated audio failed: ${audio.status}`)
  return Buffer.from(await audio.arrayBuffer())
}

const jobs = [
  { text: GREETING, out: join(ROOT, 'public', 'voice', 'greeting.wav') },
  ...intents
    .filter((i) => i.id !== 'greeting')
    .map((i) => ({ text: i.en, out: join(ROOT, 'public', 'voice', 'bank', `${i.id}.wav`) })),
]

console.log(`${jobs.length} clips · token ${TOKEN.slice(0, 6)}…\n`)
const refPath = await uploadRef()

let made = 0
let skipped = 0
for (const job of jobs) {
  const name = basename(job.out)
  if (!FORCE && existsSync(job.out)) {
    console.log(`  skip   ${name}`)
    skipped++
    continue
  }
  process.stdout.write(`  gen    ${name} `)
  const bytes = await generate(job.text, refPath)
  mkdirSync(dirname(job.out), { recursive: true })
  writeFileSync(job.out, bytes)
  console.log(` ${(bytes.length / 1024).toFixed(0)}KB`)
  made++
  await new Promise((r) => setTimeout(r, 1500))
}

console.log(`\ndone — ${made} generated, ${skipped} already present`)
