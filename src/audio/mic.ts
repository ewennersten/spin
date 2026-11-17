import type { MicSettings } from '../model/types'
import { bandEnergy } from './bands'
import type { MicReading } from './beatSource'

export interface Mic { read(): MicReading; setBassBand(loHz: number, hiHz: number): void; close(): void }

// Nekad åtkomst eller en saknad mikrofon kastar, och anroparen fortsätter utan mikrofon.
export async function openMic(settings: MicSettings): Promise<Mic> {
  // Ekosläckning, brusreducering och automatisk nivå filtrerar bort basen.
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const stop = () => stream.getTracks().forEach(t => t.stop())
  let ctx: AudioContext
  let analyser: AnalyserNode
  try {
    ctx = new AudioContext()
    analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0.5 })
    ctx.createMediaStreamSource(stream).connect(analyser)
  } catch (e) {
    stop() // annars lyser webbläsarens mikrofonsymbol kvar
    throw e
  }
  const time = new Float32Array(analyser.fftSize)
  const freq = new Uint8Array(analyser.frequencyBinCount)
  const band = (lo: number, hi: number) => bandEnergy(freq, ctx.sampleRate, analyser.fftSize, lo, hi)
  let bassLo = settings.bassLoHz
  let bassHi = settings.bassHiHz
  // En urkopplad mikrofon avslutar spåret. Då ger read() tystnad, och BeatSource går över till intern takt.
  let ended = false
  stream.getAudioTracks().forEach(t => t.addEventListener('ended', () => { ended = true }))

  return {
    read() {
      if (ended) return { level: 0, bass: 0, mid: 0, treble: 0 }
      analyser.getFloatTimeDomainData(time)
      analyser.getByteFrequencyData(freq)
      let sum = 0
      for (const x of time) sum += x * x
      return { level: Math.sqrt(sum / time.length), bass: band(bassLo, bassHi), mid: band(150, 2000), treble: band(2000, 8000) }
    },
    setBassBand(lo, hi) { bassLo = lo; bassHi = hi },
    close() {
      stop()
      ctx.close().catch(() => {})
    },
  }
}
