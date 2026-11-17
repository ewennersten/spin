export const RISE_PER_400MS = 0.08
export const MAX_MEAN = 0.2

/**
 * Håller bildens medelljus (relativ luminans enligt WCAG) inom reglerna: högst +0,08 per 400 ms och aldrig över 0,20.
 * Mätningen kommer en eller två bildrutor efter bilden (läses asynkront i scenen), men slagpulsens
 * stigtid på 80 ms gör att ljuset hinner stiga mycket lite innan förstärkningen tar.
 */
export class LightGovernor {
  private shown = 0

  update(measured: number, dtMs: number): number {
    // Glappet räknas som högst 100 ms, så en dold flik ger inget hopp.
    const target = Math.min(measured, this.shown + RISE_PER_400MS * Math.min(dtMs, 100) / 400, MAX_MEAN)
    this.shown = target
    return measured > 0 ? target / measured : 1
  }
}
