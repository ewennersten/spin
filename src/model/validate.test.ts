import { expect, it } from 'vitest'
import { validateWorkout } from './validate'

const block = (over: object = {}) => ({ kind: 'block', id: 'b', name: '', durationSec: 60, fromPct: 100, toPct: 100, ...over })
const workout = (items: unknown[]) => ({ id: 'w', name: 'Pass', items, updatedAt: 1 })
const err = (input: unknown) => { const r = validateWorkout(input); return r.ok ? '' : r.error }

it('godkänner ett giltigt pass', () => {
  expect(validateWorkout(workout([block(), { kind: 'group', id: 'g', repeat: 4, blocks: [block()] }])).ok).toBe(true)
  expect(validateWorkout(workout([])).ok).toBe(true)
})
it('avvisar värden utanför gränserna', () => {
  expect(err(workout([block({ fromPct: 19 })]))).toContain('20 och 300')
  expect(err(workout([block({ toPct: 301 })]))).toContain('20 och 300')
  expect(err(workout([block({ durationSec: 4 })]))).toContain('5 sekunder')
  expect(err(workout([block({ durationSec: 10801 })]))).toContain('3 timmar')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 0, blocks: [block()] }]))).toContain('1 och 50')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 51, blocks: [block()] }]))).toContain('1 och 50')
})
it('avvisar fel form', () => {
  expect(err(null)).not.toBe('')
  expect(err('text')).not.toBe('')
  expect(err({ ...workout([]), name: '' })).toContain('namn')
  expect(err(workout([block({ durationSec: '300' })]))).not.toBe('')
  expect(err(workout([block({ fromPct: NaN })]))).not.toBe('')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 2, blocks: [{ kind: 'group', id: 'h', repeat: 2, blocks: [] }] }]))).not.toBe('')
})
it('pekar ut vilket block som är fel', () => {
  expect(err(workout([block(), block(), block({ fromPct: 5 })]))).toContain('Block 3')
})

it('pekar ut block inuti en grupp', () => {
  expect(err(workout([block(), { kind: 'group', id: 'g', repeat: 2, blocks: [block({ toPct: 301 })] }])))
    .toBe('Grupp 2, block 1: procent måste vara mellan 20 och 300')
})
it('sätter saknad updatedAt till 0 och tar bara med kända fält', () => {
  expect(validateWorkout({ id: 'w', name: 'Pass', items: [block({ extra: 1 })], extra: 1 }))
    .toEqual({ ok: true, workout: { id: 'w', name: 'Pass', items: [block()], updatedAt: 0 } })
})
it('begränsar namnen till 80 tecken', () => {
  expect(validateWorkout({ ...workout([block({ name: 'x'.repeat(80) })]), name: 'x'.repeat(80) }).ok).toBe(true)
  expect(err({ ...workout([]), name: 'x'.repeat(81) })).toContain('80')
  expect(err(workout([block({ name: 'x'.repeat(81) })]))).toBe('Block 1: namn får vara högst 80 tecken')
})
it('kräver heltal för längd, procent och upprepningar', () => {
  expect(err(workout([block({ durationSec: 90.5 })]))).toBe('Block 1: längd måste vara hela sekunder')
  expect(err(workout([block({ fromPct: 33.3 })]))).toBe('Block 1: procent måste vara ett heltal')
  expect(err(workout([block({ toPct: 99.5 })]))).toBe('Block 1: procent måste vara ett heltal')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 2.5, blocks: [block()] }]))).toBe('Grupp 1: upprepningar måste vara ett heltal')
})
it('skriver kolon efter platsen när ett block inte är ett objekt', () => {
  expect(err(workout([null]))).toBe('Block 1: måste vara ett objekt')
  expect(err(workout([{ kind: 'group', id: 'g', repeat: 2, blocks: ['x'] }]))).toBe('Grupp 1, block 1: måste vara ett objekt')
})
