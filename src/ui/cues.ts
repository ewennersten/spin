// Regler för skärmens signaler. Alla tider är i millisekunder av passet, utom där namnet säger Sec.

export function countdownNumber(durationSec: number, remainingMs: number): number | null {
  if (durationSec < 15 || remainingMs > 5000 || remainingMs <= 0) return null
  return Math.ceil(remainingMs / 1000)
}

export function bannerVisible(elapsedMs: number): boolean {
  return elapsedMs < 3000
}

// 90 s vid 88 %, rak linje ned till 25 s vid 120 %, och 25 s över det.
export function pepIntervalSec(pctNow: number): number | null {
  if (pctNow < 88) return null
  return Math.max(25, 90 - (pctNow - 88) * 65 / 32)
}

export function pepAllowed(pctNow: number, elapsedMs: number, remainingMs: number): boolean {
  return pctNow >= 88 && !bannerVisible(elapsedMs) && remainingMs > 10000
}

export function jumped(prevPosMs: number, posMs: number): boolean {
  return posMs < prevPosMs || posMs - prevPosMs > 2000
}
