/**
 * Pre-render the AI twin's opening line in Shaden's cloned voice, so the very
 * first "hear this in my voice" is instant instead of a ~20s round trip.
 *
 *   npm run gen:greeting        ->  writes public/voice/greeting.wav
 *
 * Run it whenever GREETING.text in src/components/AITwin.tsx changes. The result
 * is committed to the repo like any other static asset. Every other answer is
 * spoken live via the Worker's /speak route (or the browser voice as fallback).
 *
 * Talks to the same ZeroGPU Space the Worker's /speak route uses, with the same
 * reference audio (public/voice-ref.wav) and reference transcript.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SPACE = 'https://shadenshanab-qwen3-tts.hf.space'
const OUT = join(ROOT, 'public', 'voice', 'greeting.wav')

function extract(file, re, what) {
  const m = readFileSync(join(ROOT, file), 'utf8').match(re)
  if (!m) throw new Error(`couldn't find ${what} in ${file}`)
  return JSON.parse(m[1]) // the matched double-quoted literal is also valid JSON
}

const GREETING = extract(
  'src/components/AITwin.tsx',
  /const GREETING: Msg = \{[\s\S]*?text:\s*("(?:[^"\\]|\\.)*")/,
  'GREETING.text',
)
const REF_TEXT = extract('worker/src/index.ts', /const REF_TEXT\s*=\s*\n?\s*("(?:[^"\\]|\\.)*")/, 'REF_TEXT')

console.log('greeting:', GREETING.slice(0, 70) + '…\n')

const refWav = readFileSync(join(ROOT, 'public', 'voice-ref.wav'))
const fd = new FormData()
fd.append('files', new Blob([refWav], { type: 'audio/wav' }), 'voice-ref.wav')
const up = await fetch(`${SPACE}/gradio_api/upload`, { method: 'POST', body: fd })
if (!up.ok) throw new Error(`upload failed: ${up.status} ${await up.text()}`)
const [refPath] = await up.json()

const post = await fetch(`${SPACE}/gradio_api/call/generate_voice_clone`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    data: [{ path: refPath, meta: { _type: 'gradio.FileData' } }, REF_TEXT, GREETING, 'English', false, '0.6B'],
  }),
})
if (!post.ok) throw new Error(`call failed: ${post.status} ${await post.text()}`)
const { event_id } = await post.json()

const res = await fetch(`${SPACE}/gradio_api/call/generate_voice_clone/${event_id}`, {
  headers: { accept: 'text/event-stream' },
})
const reader = res.body.getReader()
const dec = new TextDecoder()
let buf = ''
let fileUrl = null
process.stdout.write('generating')
loop: for (;;) {
  const { done, value } = await reader.read()
  if (done) break
  buf += dec.decode(value, { stream: true })
  const events = buf.split('\n\n')
  buf = events.pop() ?? ''
  for (const evt of events) {
    if (/^event: error/m.test(evt)) throw new Error(`space error (likely rate-limited — retry later): ${evt}`)
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
if (!fileUrl) throw new Error('no audio in the result stream')

const audio = await fetch(fileUrl)
const bytes = Buffer.from(await audio.arrayBuffer())
mkdirSync(dirname(OUT), { recursive: true })
writeFileSync(OUT, bytes)
console.log(`\nwrote ${OUT} — ${(bytes.length / 1024).toFixed(0)}KB`)
