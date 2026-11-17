export const QUALITY_LEVELS: readonly { scale: number; particles: number }[] = [
  { scale: 1, particles: 1 },
  { scale: 0.75, particles: 0.6 },
  { scale: 0.5, particles: 0.35 },
]

/** Sänker kvalitetsnivån när bildfrekvensen faller och höjer den igen när det finns marginal. 0 är bäst. */
export class QualityController {
  level = 0
  private frames = 0
  private sumMs = 0
  private goodWindows = 0
  private failures = QUALITY_LEVELS.map(() => 0) // hur många gånger varje nivå har fått lämnas nedåt

  frame(dtMs: number): number {
    this.level = Math.min(Math.max(this.level, 0), QUALITY_LEVELS.length - 1)
    if (dtMs > 250) return this.level // dold flik eller sovande dator: räknas inte
    this.frames++
    this.sumMs += dtMs
    if (this.sumMs < 2000) return this.level
    const fps = this.frames * 1000 / this.sumMs
    this.frames = 0
    this.sumMs = 0
    if (fps < 50) {
      this.goodWindows = 0
      if (this.level < QUALITY_LEVELS.length - 1) this.failures[this.level++]++
    } else if (fps >= 58 && ++this.goodWindows >= 3) {
      this.goodWindows = 0
      // En nivå som har fallerat två gånger prövas inte igen, annars pendlar bilden var åttonde sekund.
      if (this.level > 0 && this.failures[this.level - 1] < 2) this.level--
    } else if (fps < 58) {
      this.goodWindows = 0
    }
    return this.level
  }
}
