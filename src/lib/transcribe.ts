/**
 * Speech-to-text that runs entirely in the visitor's browser — no server, no API
 * key, no cost, and the recorded audio never leaves the page.
 *
 * Whisper (base, multilingual) via transformers.js. To keep it out of our own
 * bundle entirely, the library is imported at run time from its CDN the first
 * time someone uses the mic; the model (~75MB) and the onnxruntime wasm come
 * down alongside it, then the browser caches all of it for every later visit.
 * Nothing is added to the deploy — it ships exactly like the rest of the site.
 */

// jsDelivr serves transformers.js as a ready-to-run ESM bundle with its wasm
// paths already wired. Pinned to an exact version + the explicit web build file
// so a library release (or CDN entrypoint change) can't shift behaviour under us.
const TRANSFORMERS_URL =
  'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.2.0/dist/transformers.min.js'
const MODEL = 'onnx-community/whisper-base'

export type ModelProgress = { status: string; file?: string; loaded?: number; total?: number }

type Pipe = (audio: Float32Array, opts: Record<string, unknown>) => Promise<{ text?: string }>
type TransformersModule = {
  pipeline: (task: string, model: string, opts: Record<string, unknown>) => Promise<Pipe>
}

let pipePromise: Promise<Pipe> | null = null

/** Loads the ASR pipeline once per page load. `onProgress` only reports for the
 *  call that kicks off the download; later callers just await the same promise. */
export function loadTranscriber(onProgress?: (p: ModelProgress) => void): Promise<Pipe> {
  if (!pipePromise) {
    pipePromise = (async () => {
      const { pipeline }: TransformersModule = await import(/* @vite-ignore */ TRANSFORMERS_URL)
      const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator
      return pipeline('automatic-speech-recognition', MODEL, {
        device: webgpu ? 'webgpu' : 'wasm',
        dtype: webgpu ? 'fp32' : 'q8',
        progress_callback: onProgress,
      })
    })().catch((err) => {
      pipePromise = null // let the next attempt retry from scratch
      throw err
    })
  }
  return pipePromise
}

/** True once the model is in memory — lets the UI skip the "loading model" copy. */
export function transcriberReady(): boolean {
  return pipePromise !== null
}

/** Decode a recorded blob (webm/opus, mp4/aac, …) to the mono 16kHz Float32
 *  signal Whisper expects. OfflineAudioContext does the resample reliably across
 *  browsers. */
export async function decodePcm16k(blob: Blob): Promise<Float32Array> {
  const bytes = await blob.arrayBuffer()
  const Ctx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
  const ac = new Ctx()
  let decoded: AudioBuffer
  try {
    decoded = await ac.decodeAudioData(bytes)
  } finally {
    ac.close()
  }

  const Offline =
    window.OfflineAudioContext ??
    (window as unknown as { webkitOfflineAudioContext: typeof OfflineAudioContext }).webkitOfflineAudioContext
  const off = new Offline(1, Math.max(1, Math.ceil(decoded.duration * 16000)), 16000)
  const src = off.createBufferSource()
  src.buffer = decoded
  src.connect(off.destination)
  src.start()
  const rendered = await off.startRendering()
  return rendered.getChannelData(0)
}

export async function transcribe(blob: Blob, onProgress?: (p: ModelProgress) => void): Promise<string> {
  const pipe = await loadTranscriber(onProgress)
  const audio = await decodePcm16k(blob)
  if (audio.length < 1600) return '' // under ~0.1s of sound — a mis-tap
  const out = await pipe(audio, { task: 'transcribe', chunk_length_s: 30, stride_length_s: 5 })
  return (out.text ?? '').trim()
}
