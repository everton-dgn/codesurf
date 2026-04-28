/**
 * useVoiceActivityDetector — Silero VAD wrapper for hands-free dictation.
 *
 * Backend: @ricky0123/vad-web (Silero VAD as ONNX in WebAssembly).
 *   start() opens mic + VAD. onSpeechStart fires when speech begins;
 *   onSpeechEnd fires with the captured Float32 PCM when the user pauses.
 *   stop() releases the mic and tears down VAD.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

interface UseVadOptions {
  onSpeechStart?: () => void
  onSpeechEnd?: (audio: Float32Array) => void
  onMisfire?: () => void
  positiveSpeechThreshold?: number
  negativeSpeechThreshold?: number
  redemptionFrames?: number
  baseAssetPath?: string
}

interface UseVadResult {
  isListening: boolean
  isSpeaking: boolean
  error: string | null
  start: () => Promise<void>
  stop: () => Promise<void>
}

type MicVAD = { start: () => void; pause: () => void; destroy: () => void }

function getDefaultVadAssetPath(): string {
  if (typeof window === 'undefined') return './vad/'
  if (window.location.protocol === 'file:') return new URL('./vad/', window.location.href).href
  return new URL('/vad/', window.location.origin).href
}

export function useVoiceActivityDetector(opts: UseVadOptions = {}): UseVadResult {
  const [isListening, setIsListening] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const vadRef = useRef<MicVAD | null>(null)
  const optsRef = useRef(opts)
  optsRef.current = opts

  const start = useCallback(async () => {
    if (vadRef.current) return
    try {
      const mod = await import('@ricky0123/vad-web')
      const MicVAD = (mod as { MicVAD: { new: (cfg: Record<string, unknown>) => Promise<MicVAD> } }).MicVAD
      // Bundled assets live in renderer/public/vad/ so production builds
      // don't depend on CDN reachability. Use an app-root URL in dev because
      // onnxruntime resolves relative wasmPaths from its optimized dependency
      // module, not from the page.
      const baseAssetPath = optsRef.current.baseAssetPath ?? getDefaultVadAssetPath()
      const vad = await MicVAD.new({
        positiveSpeechThreshold: optsRef.current.positiveSpeechThreshold ?? 0.5,
        negativeSpeechThreshold: optsRef.current.negativeSpeechThreshold ?? 0.35,
        redemptionFrames: optsRef.current.redemptionFrames ?? 24,
        baseAssetPath,
        onnxWASMBasePath: baseAssetPath,
        // The library defaults to silero_vad_v5.onnx; explicit just to be safe
        // and survivable under Electron's tighter loader policies.
        model: 'v5',
        onSpeechStart: () => { setIsSpeaking(true); optsRef.current.onSpeechStart?.() },
        onSpeechEnd: (audio: Float32Array) => { setIsSpeaking(false); optsRef.current.onSpeechEnd?.(audio) },
        onVADMisfire: () => { setIsSpeaking(false); optsRef.current.onMisfire?.() },
      })
      vadRef.current = vad
      vad.start()
      setIsListening(true)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setIsListening(false)
    }
  }, [])

  const stop = useCallback(async () => {
    const v = vadRef.current
    if (!v) return
    try { v.pause() } catch { /* ignore */ }
    try { v.destroy() } catch { /* ignore */ }
    vadRef.current = null
    setIsListening(false)
    setIsSpeaking(false)
  }, [])

  useEffect(() => () => { void stop() }, [stop])

  return { isListening, isSpeaking, error, start, stop }
}

/** Encode Float32 mono 16kHz PCM as a WAV ArrayBuffer for STT upload. */
export function float32ToWav(samples: Float32Array, sampleRate = 16000): ArrayBuffer {
  const dataSize = samples.length * 2
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)
  const writeString = (off: number, s: string): void => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    let s = Math.max(-1, Math.min(1, samples[i]))
    s = s < 0 ? s * 0x8000 : s * 0x7fff
    view.setInt16(offset, s, true)
    offset += 2
  }
  return buffer
}
