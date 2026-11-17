const TAU_MS = 1000
const FLOOR = 0.02
const GAP_MS = 400 // högst 2,5 slag per sekund

// Ett slag är när energin plötsligt stiger över sitt eget glidande medelvärde, så att tröskeln följer salens ljudnivå.
export class BeatDetector {
  #sensitivity = 5
  #avg: number | null = null
  #lastT = 0
  #lastBeat = -Infinity

  get sensitivity() { return this.#sensitivity }
  set sensitivity(v: number) { this.#sensitivity = Math.min(10, Math.max(1, v)) }

  feed(energy: number, tMs: number): boolean {
    // Jämförelsen görs mot medelvärdet före det här värdet, så att slaget inte höjer sin egen tröskel.
    const avg = this.#avg ?? energy
    const beat = energy > avg * (2.2 - 0.12 * this.#sensitivity) && energy > FLOOR && tMs - this.#lastBeat >= GAP_MS
    this.#avg = this.#avg === null ? energy : avg + (energy - avg) * (1 - Math.exp(-(tMs - this.#lastT) / TAU_MS))
    this.#lastT = tMs
    if (beat) this.#lastBeat = tMs
    return beat
  }
}
