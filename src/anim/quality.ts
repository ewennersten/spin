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

  frame(dtMs: number): number {
    if (dtMs > 250) return this.level // dold flik eller sovande dator: räknas inte
    this.frames++
    this.sumMs += dtMs
    if (this.sumMs < 2000) return this.level
    const fps = this.frames * 1000 / this.sumMs
    this.frames = 0
    this.sumMs = 0
    if (fps < 50) {
      this.goodWindows = 0
      this.level = Math.min(this.level + 1, QUALITY_LEVELS.length - 1)
    } else if (fps >= 58 && ++this.goodWindows >= 3) {
      this.goodWindows = 0
      this.level = Math.max(this.level - 1, 0)
    } else if (fps < 58) {
      this.goodWindows = 0
    }
    return this.level
  }
}
