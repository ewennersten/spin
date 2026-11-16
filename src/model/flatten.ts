import { pctText } from './format'
import type { Segment, Workout } from './types'
import { zoneFor } from './zones'

export function flatten(workout: Workout): Segment[] {
  const flat = workout.items.flatMap(item => item.kind === 'block'
    ? [{ block: item, suffix: '' }]
    : Array.from({ length: item.repeat }, (_, i) => item.blocks.map(block =>
        ({ block, suffix: item.repeat > 1 ? ` ${i + 1} av ${item.repeat}` : '' }))).flat())
  const last = flat.length - 1
  const pcts = flat.map(({ block: b }) => pctText(b.fromPct, b.toPct))
  const base = flat.map(({ block: b }, i) =>
    b.name.trim() ||
    (i === 0 && b.toPct > b.fromPct ? 'Uppvärmning'
      : i === last && b.toPct < b.fromPct ? 'Nedvarvning'
      : zoneFor((b.fromPct + b.toPct) / 2).name))

  let startSec = 0
  return flat.map(({ block: b, suffix }, i) => {
    // base[j] är undefined utanför listan, så första och sista jämförs bara med en granne.
    const clash = !b.name.trim() && [i - 1, i + 1].some(j => base[j] === base[i] && pcts[j] !== pcts[i])
    const seg = { name: base[i] + (clash ? ` ${pcts[i]}` : '') + suffix, startSec, durationSec: b.durationSec, fromPct: b.fromPct, toPct: b.toPct }
    startSec += b.durationSec
    return seg
  })
}

export function totalDuration(segments: Segment[]): number {
  return segments.reduce((sum, s) => sum + s.durationSec, 0)
}
