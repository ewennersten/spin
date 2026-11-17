import type { BeatSource } from '../audio/beatSource'
import type { Mic } from '../audio/mic'
import type { MicSettings } from '../model/types'
import type { Store } from '../storage/storage'
import { el, message } from './dom'

export interface MicControl { getMic(): Mic | null; enableMic(): Promise<void> }   // ägs av run.ts

const DENIED = 'Mikrofonen är inte tillåten. Appen använder intern takt.'
const FAILED = 'Mikrofonen gick inte att slå på. Appen använder intern takt.'
const BAD_BAND = 'Basbandet ska ligga mellan 20 och 500 Hz, och den undre gränsen måste vara lägre än den övre.'
const LAMP_MS = 120

// Mätaren visar nivån i decibel från −60 dB, så att även tal syns. Tystnad ger 0.
const meterValue = (level: number) => Math.max(0, 1 + (20 * Math.log10(level)) / 60)

function field(text: string, input: HTMLElement, after = '') {
  const label = el('label')
  label.append(text, input, after)
  return label
}

// Funktionen som returneras ritar nivå, lampa och läge. Skärmen anropar den en gång per bildruta efter source.update.
export function mountMicPanel(root: HTMLElement, store: Store, source: BeatSource, ctl: MicControl): () => void {
  const status = el('p', { className: 'error', role: 'alert' })
  const button = el('button', { type: 'button', textContent: 'Slå på mikrofonen' })
  const meter = el('meter', { min: 0, max: 1, value: 0 })
  const lamp = el('span', { className: 'lamp', ariaHidden: 'true' })
  const modeText = el('span', { className: 'mode' })
  const sens = el('input', { type: 'range', min: '1', max: '10', step: '1' })
  const sensText = el('span', { className: 'value' })
  const lo = el('input', { type: 'number', min: '20', max: '500', ariaLabel: 'Basbandets undre gräns i Hz' })
  const hi = el('input', { type: 'number', min: '20', max: '500', ariaLabel: 'Basbandets övre gräns i Hz' })

  // Läser om inställningarna före varje sparning, så att en ändring här inte skriver över en annan.
  const save = (change: Partial<MicSettings>) =>
    store.getMicSettings().then(s => store.saveMicSettings({ ...s, ...change })).catch(e => { status.textContent = message(e) })

  button.onclick = () => {
    status.textContent = ''
    ctl.enableMic().catch(e => {
      status.textContent = e instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(e.name) ? DENIED : FAILED
    })
  }
  sens.oninput = () => {
    source.detector.sensitivity = sens.valueAsNumber
    sensText.textContent = sens.value
    void save({ sensitivity: source.detector.sensitivity })
  }
  // change och inte input, så att ett halvskrivet tal inte ger fel medan man skriver.
  lo.onchange = hi.onchange = () => {
    const [a, b] = [lo.valueAsNumber, hi.valueAsNumber]
    const ok = a >= 20 && b <= 500 && a < b // NaN från ett tomt fält ger false
    lo.ariaInvalid = hi.ariaInvalid = ok ? null : 'true'
    status.textContent = ok ? '' : BAD_BAND
    if (!ok) return
    ctl.getMic()?.setBassBand(a, b)
    void save({ bassLoHz: a, bassHiHz: b })
  }

  const row1 = el('div', { className: 'row' })
  row1.append(button, field('Nivå', meter), lamp, modeText)
  const row2 = el('div', { className: 'row' })
  row2.append(field('Känslighet', sens), sensText, field('Basband', lo, 'Hz'), field('till', hi, 'Hz'))
  root.append(row1, row2, status)

  store.getMicSettings().then(s => {
    sens.value = String(s.sensitivity)
    sensText.textContent = sens.value
    lo.value = String(s.bassLoHz)
    hi.value = String(s.bassHiHz)
  }).catch(e => { status.textContent = message(e) })

  let litUntil = 0
  return () => {
    const f = source.frame
    const t = performance.now()
    if (f.beat) litUntil = t + LAMP_MS
    lamp.classList.toggle('on', t < litUntil)
    meter.value = meterValue(f.level)
    const text = f.mode === 'mic' ? 'Mikrofon' : 'Intern takt'
    if (modeText.textContent !== text) modeText.textContent = text
  }
}
