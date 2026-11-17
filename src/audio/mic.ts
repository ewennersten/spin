import type { MicSettings } from '../model/types'
import { bandLevel } from './bands'
import type { MicReading } from './beatSource'

// label är vad skärmen kallar källan: Mikrofon eller Datorns ljud.
export interface Mic { label: string; read(): MicReading; setBassBand(loHz: number, hiHz: number): void; close(): void }

// Ekosläckning, brusreducering och automatisk nivå filtrerar bort basen.
const RAW = { echoCancellation: false, noiseSuppression: false, autoGainControl: false }

// Nekad åtkomst eller en saknad mikrofon kastar, och anroparen fortsätter utan mikrofon.
export async function openMic(settings: MicSettings): Promise<Mic> {
  return listen(await navigator.mediaDevices.getUserMedia({ audio: RAW }), settings, 'Mikrofon')
}

// Datorns eget ljud, när musiken spelas från samma dator. Chrome tar ljudet via skärmdelning: man väljer
// Hela skärmen och slår på systemljud (Chrome 141 och macOS 14.2 eller senare), eller en flik med flikens ljud.
// Bilden behövs inte och stängs direkt. Delas inget ljud kastas NoAudioError.
export class NoAudioError extends Error {}
export async function openSystemAudio(settings: MicSettings): Promise<Mic> {
  const stream = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    audio: { ...RAW, suppressLocalAudioPlayback: false },
    systemAudio: 'include',
    selfBrowserSurface: 'exclude',
  } as DisplayMediaStreamOptions)
  stream.getVideoTracks().forEach(t => t.stop())
  if (!stream.getAudioTracks().length) {
    stream.getTracks().forEach(t => t.stop())
    throw new NoAudioError()
  }
  return listen(stream, settings, 'Datorns ljud')
}

function listen(stream: MediaStream, settings: MicSettings, label: string): Mic {
  const stop = () => stream.getTracks().forEach(t => t.stop())
  let ctx: AudioContext
  let analyser: AnalyserNode
  try {
    ctx = new AudioContext()
    // Öppnas mikrofonen av sig själv efter en omladdning kan kontexten starta pausad, och då blir analysen tyst.
    ctx.resume().catch(() => {})
    analyser = new AnalyserNode(ctx, { fftSize: 2048, smoothingTimeConstant: 0.5 })
    ctx.createMediaStreamSource(stream).connect(analyser)
  } catch (e) {
    stop() // annars lyser webbläsarens mikrofonsymbol kvar
    throw e
  }
  const time = new Float32Array(analyser.fftSize)
  const db = new Float32Array(analyser.frequencyBinCount)
  const band = (lo: number, hi: number) => bandLevel(db, ctx.sampleRate, analyser.fftSize, lo, hi)
  let bassLo = settings.bassLoHz
  let bassHi = settings.bassHiHz
  // En urkopplad mikrofon avslutar spåret. Då ger read() tystnad, och BeatSource går över till intern takt.
  let ended = false
  stream.getAudioTracks().forEach(t => t.addEventListener('ended', () => { ended = true }))

  return {
    label,
    read() {
      if (ended) return { level: 0, bass: 0, mid: 0, treble: 0 }
      analyser.getFloatTimeDomainData(time)
      analyser.getFloatFrequencyData(db)
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
