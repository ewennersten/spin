import type { Block, Group, Workout } from './types'

// Fasta id:n i stället för crypto.randomUUID, så att modulen kan laddas även utan säker kontext.
let n = 0
const b = (durationSec: number, fromPct: number, toPct = fromPct, name = ''): Block =>
  ({ kind: 'block', id: `exempel-${++n}`, name, durationSec, fromPct, toPct })
const g = (repeat: number, ...blocks: Block[]): Group => ({ kind: 'group', id: `exempel-${++n}`, repeat, blocks })

const workout = (id: string, name: string, main: Group): Workout => ({
  id,
  name,
  // Höjningarna i uppvärmningen har ett eget namn, annars heter de som zonen (VO2max) på skärmen.
  items: [b(600, 45, 70), g(3, b(30, 110, 110, 'Höjning'), b(90, 55)), main, b(600, 60, 40)],
  updatedAt: 0,
})

export const EXAMPLES: Workout[] = [
  workout('exempel-sweetspot', 'Sweetspot 3 × 12 min', g(3, b(720, 90), b(240, 55))),
  workout('exempel-troskel', 'Tröskel 4 × 8 min', g(4, b(480, 100), b(180, 55))),
  workout('exempel-vo2max', 'VO2max 5 × 4 min', g(5, b(240, 115), b(240, 50))),
  workout('exempel-sprint', 'Sprint 10 × 30 s', g(10, b(30, 150), b(90, 50))),
]
