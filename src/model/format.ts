const pad = (n: number) => String(n).padStart(2, '0')

export function mmss(totalSec: number): string {
  return `${pad(Math.floor(totalSec / 60))}:${pad(totalSec % 60)}`
}

export function pctText(fromPct: number, toPct: number): string {
  return fromPct === toPct ? `${fromPct} %` : `${fromPct} → ${toPct} %`
}
