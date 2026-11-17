export const RISE_PER_400MS = 0.08
export const MAX_MEAN = 0.2

/**
 * Håller bildens medelljus (relativ luminans enligt WCAG) inom reglerna: högst +0,08 per 400 ms och aldrig över 0,20.
 * Mätningen kommer en eller två bildrutor efter bilden (läses asynkront i scenen), men slagpulsens
 * stigtid på 80 ms gör att ljuset hinner stiga mycket lite innan förstärkningen tar.
 *
 * Kontrakt: scenen skickar in det uppmätta ljuset gånger sin egen toning (scenbyte, döljning), och 0 medan
 * scenen är dold. Då gäller spärren även när bilden tonar upp från svart eller visas igen.
 */
export class LightGovernor {
  private shown = 0
  private gain = 1

  update(measured: number, dtMs: number): number {
    // Ett trasigt värde får aldrig fastna i shown: då slutar spärren fungera för resten av vyn.
    if (!Number.isFinite(measured) || !Number.isFinite(dtMs)) return this.gain
    // Glappet räknas som högst 100 ms, så en dold flik ger inget hopp.
    const dt = Math.min(Math.max(dtMs, 0), 100)
    const target = Math.min(measured, this.shown + RISE_PER_400MS * dt / 400, MAX_MEAN)
    this.shown = target
    this.gain = measured > 0 ? target / measured : 1
    return this.gain
  }
}
