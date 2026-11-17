import type { BeatSource } from '../audio/beatSource'
import { NoAudioError, type Mic } from '../audio/mic'
import type { MicSettings } from '../model/types'
import type { Store } from '../storage/storage'
import { el, message } from './dom'

export interface MicControl { getMic(): Mic | null; enableMic(): Promise<void>; enableSystem(): Promise<void> }   // ägs av run.ts

const DENIED = 'Mikrofonen är inte tillåten. Appen använder intern takt.'
const FAILED = 'Mikrofonen gick inte att slå på. Appen använder intern takt.'
const NO_SHARE = 'Ingen skärm delades, så appen hör inte datorns ljud. Appen använder intern takt.'
const NO_AUDIO = 'Inget ljud delades. Välj Hela skärmen och slå på systemljud, eller en flik där musiken spelas och slå på flikens ljud.'
const BAD_BAND = 'Basbandet ska ligga mellan 20 och 500 Hz, och den undre gränsen måste vara lägre än den övre.'
const LAMP_MS = 120

// Mätaren visar nivån i decibel från −60 dB, så att även tal syns. Tystnad ger 0.
const meterValue = (level: number) => Math.max(0, 1 + (20 * Math.log10(level)) / 60)

function field(text: string, input: HTMLElement, after = '') {
  const label = el('label')
  label.append(text, input, after)
  return label
}

// draw ritar nivå, lampa och läge. Skärmen anropar den en gång per bildruta efter source.update.
export function mountMicPanel(root: HTMLElement, store: Store, source: BeatSource, ctl: MicControl): { draw(): void } {
  // Mikrofonens fel och inställningarnas fel står var för sig, så att det ena inte tar bort det andra.
  const micStatus = el('p', { className: 'error', role: 'alert' })
  const status = el('p', { className: 'error', role: 'alert' })
  const button = el('button', { type: 'button', textContent: 'Slå på mikrofonen' })
  const systemButton = el('button', { type: 'button', textContent: 'Lyssna på datorns ljud' })
  const meter = el('meter', { min: 0, max: 1, value: 0 })
  const lamp = el('span', { className: 'lamp', ariaHidden: 'true' })
  const modeText = el('span', { className: 'mode' })
  const sens = el('input', { type: 'range', min: '1', max: '10', step: '1' })
  const sensText = el('span', { className: 'value' })
  const lo = el('input', { type: 'number', min: '20', max: '500', ariaLabel: 'Basbandets undre gräns i Hz' })
  const hi = el('input', { type: 'number', min: '20', max: '500', ariaLabel: 'Basbandets övre gräns i Hz' })
  const lead = el('input', { type: 'range', min: '0', max: '300', step: '10' })
  const leadText = el('span', { className: 'value' })
  const showLead = () => { leadText.textContent = `${lead.value} ms före` }

  // Läser om inställningarna före varje sparning, så att en ändring här inte skriver över en annan.
  const save = (change: Partial<MicSettings>) =>
    store.getMicSettings().then(s => store.saveMicSettings({ ...s, ...change })).catch(e => { status.textContent = message(e) })

  button.onclick = () => {
    button.blur() // så att mellanslag direkt efteråt startar passet
    micStatus.textContent = ''
    ctl.enableMic().catch(e => {
      micStatus.textContent = e instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(e.name) ? DENIED : FAILED
    })
  }
  systemButton.onclick = () => {
    systemButton.blur()
    micStatus.textContent = ''
    ctl.enableSystem().catch(e => {
      micStatus.textContent = e instanceof NoAudioError ? NO_AUDIO
        : e instanceof DOMException && e.name === 'NotAllowedError' ? NO_SHARE : FAILED
    })
  }
  sens.oninput = () => {
    source.detector.sensitivity = sens.valueAsNumber
    sensText.textContent = sens.value
    void save({ sensitivity: source.detector.sensitivity })
  }
  // Flyttar pulsen tidigare än slaget, så att den syns i takt trots fördröjningen i ljud och skärm.
  lead.oninput = () => {
    source.leadMs = lead.valueAsNumber
    showLead()
    void save({ leadMs: source.leadMs })
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
  const sources = el('div', { className: 'row' })
  sources.append(button, systemButton)
  row1.append(field('Nivå', meter), lamp, modeText)
  const row2 = el('div', { className: 'row' })
  row2.append(field('Känslighet', sens), sensText, field('Basband', lo, 'Hz'), field('till', hi, 'Hz'))
  const row3 = el('div', { className: 'row' })
  row3.append(field('Synk', lead), leadText)
  root.append(sources, row1, row2, row3, micStatus, status)

  store.getMicSettings().then(s => {
    sens.value = String(s.sensitivity)
    sensText.textContent = sens.value
    lo.value = String(s.bassLoHz)
    hi.value = String(s.bassHiHz)
    lead.value = String(s.leadMs)
    showLead()
  }).catch(e => { status.textContent = message(e) })

  // Lampan visar bara slag som mikrofonen hör. Den interna takten tänder den aldrig, så att den inte ser ut att följa musiken.
  let litUntil = 0
  return {
    draw() {
      const f = source.frame
      const t = performance.now()
      const mic = f.mode === 'mic'
      if (mic && f.beat) litUntil = t + LAMP_MS
      lamp.classList.toggle('on', mic && t < litUntil)
      meter.value = meterValue(f.level)
      // När takten är hittad står den bredvid källan, så att man ser att pulsen följer låten.
      const bpm = mic && source.predictor.locked(t) ? `, ${Math.round(source.predictor.bpm)} slag per minut` : ''
      const text = mic ? `${ctl.getMic()?.label ?? 'Mikrofon'}${bpm}` : 'Intern takt: inget ljud används just nu'
      if (modeText.textContent !== text) modeText.textContent = text
    },
  }
}
