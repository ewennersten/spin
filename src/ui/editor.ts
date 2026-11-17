import { duplicateAt, durationError, fieldError, moveItem, nameError, newBlock, newGroup, removeAt } from '../model/edit'
import { flatten, totalDuration } from '../model/flatten'
import { mmss } from '../model/format'
import type { Block, Group, Item, Workout } from '../model/types'
import { LIMITS, validateWorkout } from '../model/validate'
import type { View } from '../router'
import type { Store } from '../storage/storage'
import { chartFrame, renderChart } from './chart'

// Samma små hjälpare som i library.ts, som inte exporterar dem.
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), props)
const button = (textContent: string, onclick: () => void) => el('button', { textContent, onclick })
const link = (textContent: string, href: string) => el('a', { textContent, href, className: 'button' })

// Webbläsarens eget fel när lagringen är full är på engelska.
const message = (e: unknown) =>
  e instanceof DOMException && e.name === 'QuotaExceededError' ? 'Webbläsarens lagring är full, så ändringen sparades inte.'
    : e instanceof Error ? e.message : String(e)

// Fälten får sina värden från passet i guard.
const numberInput = (min: number, max: number) => el('input', { type: 'number', min: String(min), max: String(max) })
const textInput = () => el('input', { type: 'text', maxLength: LIMITS.nameMax })
let nextMessageId = 0

function field(text: string, input: HTMLInputElement) {
  const label = el('label', { className: 'field' })
  label.append(el('span', { textContent: text }), input)
  return label
}

const where = (text: string) => el('span', { className: 'where', textContent: text, ariaHidden: 'true' })

function editor(store: Store, root: HTMLElement, main: HTMLElement, w: Workout): () => void {
  const status = el('p', { className: 'status', role: 'status' })
  const error = el('p', { className: 'error', role: 'status' })
  const total = el('span')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('role', 'img')
  const { frame, scale } = chartFrame(svg)
  const list = el('div', { className: 'items' })
  // Knappar som ska kunna få fokus igen efter att listan ritats om, med nyckeln "<id>:<åtgärd>".
  const buttons = new Map<string, HTMLButtonElement>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let unsaved = false // en ändring som inte har sparats, även efter en misslyckad sparning
  let failed = false
  let saved = JSON.stringify(w) // passet som det ser ut i lagringen
  let removedAt = -Infinity // när en rad senast togs bort
  const nameFields = new Map<Block, HTMLInputElement>() // blockens namnfält i listan som den är ritad
  const setItems = (l: Item[]) => { w.items = l }

  // Platshållaren är namnet som skärmen ger blocket (i en grupp dess första varv), utan tillägget "i av n".
  // Alla räknas om, eftersom ett block kan få ett annat namn när grannen ändras.
  function placeholders() {
    const segments = flatten(w)
    let n = 0
    for (const item of w.items) {
      const suffix = item.kind === 'group' && item.repeat > 1 ? ` 1 av ${item.repeat}` : ''
      ;(item.kind === 'block' ? [item] : item.blocks).forEach((b, j) => {
        const field = nameFields.get(b)
        const name = segments[n + j].name
        if (field) field.placeholder = name.slice(0, name.length - suffix.length)
      })
      n += item.kind === 'block' ? 1 : item.repeat * item.blocks.length
    }
  }

  // Ritar om platshållarna, och stapelbild och total tid när passet är giltigt, annars visas felet. Ger true om passet är giltigt.
  function check(): boolean {
    placeholders()
    const r = validateWorkout(w)
    error.textContent = r.ok ? '' : r.error
    if (!r.ok) return false
    const segments = flatten(r.workout)
    renderChart(svg, segments, scale)
    svg.setAttribute('aria-label', `Stapelbild för ${r.workout.name}`)
    total.textContent = mmss(totalDuration(segments))
    return true
  }

  function save(report: (text: string) => void) {
    const json = JSON.stringify(w)
    store.saveWorkout(w).then(() => {
      saved = json
      unsaved = failed = false
      // "Sparat" bredvid ett markerat fält skulle kunna läsas som att det ogiltiga värdet sparades.
      if (!main.querySelector('[aria-invalid]')) status.textContent = 'Sparat'
    }, e => { failed = true; report(message(e)) })
  }

  // Sparar bara när passet skiljer sig från lagringen, så en ogiltig tangenttryckning startar ingen sparning.
  function changed() {
    clearTimeout(timer)
    status.textContent = ''
    unsaved = check() && JSON.stringify(w) !== saved
    if (unsaved) timer = setTimeout(() => save(text => { status.textContent = text }), 300)
  }

  // När vyn lämnas finns redigeraren inte kvar, så ett fel skrivs överst på nästa vy.
  function flush() {
    clearTimeout(timer)
    if (unsaved) save(text => root.prepend(el('p', { className: 'error leave-error', role: 'alert', textContent: `${w.name}: ${text}` })))
  }
  // Har sparningen misslyckats frågar webbläsaren innan sidan laddas om eller stängs.
  const warn = (e: BeforeUnloadEvent) => { if (failed) e.preventDefault() }

  // Ett ogiltigt fältvärde går aldrig in i passet. Där gäller värdet från när fältet fick fokus, fältet markeras
  // och felet visas vid raden. När fältet lämnas får det tillbaka passets värde. Min och Sek är en längd
  // tillsammans: man kan gå mellan dem (5:00 till 0:30 via 0:00) utan att något återställs, och när paret
  // lämnas med något fel återställs båda, så att de visar exakt passets längd.
  function guard<T extends object>(row: HTMLElement, model: T, values: () => Map<HTMLInputElement, string | number>,
      read: (base: T) => Map<HTMLInputElement, string | null>, pair: HTMLInputElement[] = []) {
    const msg = el('p', { className: 'error', role: 'status', id: `fel-${++nextMessageId}` })
    row.append(msg)
    for (const [input, value] of values()) {
      input.value = String(value)
      input.setAttribute('aria-describedby', msg.id)
    }
    let base = { ...model }
    const run = () => {
      const errors = read(base)
      for (const [input, error] of errors) input.ariaInvalid = error ? 'true' : null
      msg.textContent = [...new Set(errors.values())].filter(Boolean).join(' ')
      changed()
    }
    const inPair = (t: EventTarget | null) => pair.some(p => p === t)
    row.addEventListener('input', run)
    row.addEventListener('focusin', () => { base = { ...model } })
    row.addEventListener('focusout', e => {
      if (inPair(e.target) && inPair(e.relatedTarget)) return
      const pairInvalid = pair.some(p => p.ariaInvalid)
      const restore = [...values()].filter(([input]) => input.ariaInvalid || (pairInvalid && inPair(input)))
      if (!restore.length) return
      for (const [input, value] of restore) input.value = String(value)
      run()
    })
  }

  // Listan ritas bara om när dess struktur ändras, så att fältet man skriver i behåller fokus och markör.
  function restructure(focus: string[]) {
    renderList()
    changed()
    focus.map(k => buttons.get(k)).find(b => b?.isConnected && !b.disabled)?.focus()
  }

  function controls<T extends Item>(label: string, items: T[], i: number, set: (l: T[]) => void, fallback: string) {
    const id = items[i].id
    const act = (key: string, text: string, verb: string, next: () => T[], focus: string[]) => {
      const b = button(text, () => {
        // Nästa rad flyttas upp under pekaren, så det andra klicket i ett dubbelklick på Ta bort ignoreras.
        if (key === 'del') {
          if (performance.now() - removedAt < 500) return
          removedAt = performance.now()
        }
        set(next())
        restructure(focus)
      })
      b.ariaLabel = `${verb} ${label.toLowerCase()}`
      buttons.set(`${id}:${key}`, b)
      return b
    }
    const up = act('up', '↑', 'Flytta upp', () => moveItem(items, i, -1), [`${id}:up`, `${id}:down`])
    const down = act('down', '↓', 'Flytta ned', () => moveItem(items, i, 1), [`${id}:down`, `${id}:up`])
    up.disabled = i === 0
    down.disabled = i === items.length - 1
    const box = el('div', { className: 'actions' })
    box.append(
      up,
      down,
      act('dup', 'Duplicera', 'Duplicera', () => duplicateAt(items, i), [`${id}:dup`]),
      act('del', 'Ta bort', 'Ta bort', () => removeAt(items, i), [`${items[i + 1]?.id}:del`, `${items[i - 1]?.id}:del`, fallback]),
    )
    return box
  }

  function blockRow(b: Block, label: string, actions: HTMLElement) {
    const name = textInput()
    const min = numberInput(0, LIMITS.durMaxSec / 60)
    const sec = numberInput(0, 59)
    const from = numberInput(LIMITS.pctMin, LIMITS.pctMax)
    const to = numberInput(LIMITS.pctMin, LIMITS.pctMax)
    nameFields.set(b, name)
    const line = el('div', { className: 'line' })
    line.append(where(label), field('Namn', name), field('Min', min), field('Sek', sec), field('Från %', from), field('Till %', to), actions)
    const row = el('div', { className: 'block', role: 'group', ariaLabel: label })
    row.append(line)
    const values = () => new Map<HTMLInputElement, string | number>(
      [[name, b.name], [min, Math.floor(b.durationSec / 60)], [sec, b.durationSec % 60], [from, b.fromPct], [to, b.toPct]])
    guard(row, b, values, base => {
      // valueAsNumber är NaN för ett tomt fält, så ett tomt fält blir ett fel och aldrig 0.
      const [m, s] = [min.valueAsNumber, sec.valueAsNumber]
      const errors = new Map([[name, nameError(name.value, false)], [min, fieldError('min', m)], [sec, fieldError('sec', s)],
        [from, fieldError('from', from.valueAsNumber)], [to, fieldError('to', to.valueAsNumber)]])
      if (!errors.get(min) && !errors.get(sec)) {
        const d = durationError(m, s)
        errors.set(min, d).set(sec, d)
      }
      b.name = errors.get(name) ? base.name : name.value
      b.durationSec = errors.get(min) || errors.get(sec) ? base.durationSec : m * 60 + s
      b.fromPct = errors.get(from) ? base.fromPct : from.valueAsNumber
      b.toPct = errors.get(to) ? base.toPct : to.valueAsNumber
      return errors
    }, [min, sec])
    return row
  }

  function groupRow(g: Group, i: number) {
    const label = `Grupp ${i + 1}`
    const repeat = numberInput(LIMITS.repeatMin, LIMITS.repeatMax)
    const addKey = `${g.id}:add`
    const add = button('Lägg till block i gruppen', () => { g.blocks = [...g.blocks, newBlock()]; restructure([addKey]) })
    buttons.set(addKey, add)
    const setBlocks = (l: Block[]) => { g.blocks = l }
    const blocks = el('div', { className: 'blocks' })
    blocks.append(...g.blocks.map((b, j) => {
      const bl = `${label}, block ${j + 1}`
      return blockRow(b, bl, controls(bl, g.blocks, j, setBlocks, addKey))
    }))
    const line = el('div', { className: 'line' })
    line.append(where(label), field('Upprepa', repeat), controls(label, w.items, i, setItems, 'add'))
    const head = el('div', { className: 'head' })
    head.append(line)
    guard(head, g, () => new Map([[repeat, g.repeat]]), base => {
      const error = fieldError('repeat', repeat.valueAsNumber)
      g.repeat = error ? base.repeat : repeat.valueAsNumber
      return new Map([[repeat, error]])
    })
    const box = el('div', { className: 'group', role: 'group', ariaLabel: label })
    box.append(head, blocks, add)
    return box
  }

  function renderList() {
    nameFields.clear()
    // Numreringen följer validateWorkout, så att felmeddelandets "Block 3" och "Grupp 2, block 1" går att hitta.
    list.replaceChildren(...w.items.map((item, i) => item.kind === 'group'
      ? groupRow(item, i)
      : blockRow(item, `Block ${i + 1}`, controls(`Block ${i + 1}`, w.items, i, setItems, 'add'))))
  }

  const nameInput = textInput()
  const nameRow = el('div', { className: 'passname' })
  nameRow.append(field('Namn på passet', nameInput))
  guard(nameRow, w, () => new Map([[nameInput, w.name]]), base => {
    const error = nameError(nameInput.value, true)
    w.name = error ? base.name : nameInput.value
    return new Map([[nameInput, error]])
  })

  const toolbar = el('div', { className: 'toolbar' })
  toolbar.append(link('Starta passet', `#/run/${w.id}`), link('Till biblioteket', '#/'), status)
  const totalRow = el('p', { className: 'total', textContent: 'Total tid ' })
  totalRow.append(total)
  const addBlock = button('Lägg till block', () => { w.items = [...w.items, newBlock()]; restructure([]) })
  buttons.set('add', addBlock)
  const adds = el('div', { className: 'toolbar' })
  adds.append(addBlock, button('Lägg till grupp', () => { w.items = [...w.items, newGroup()]; restructure([]) }))

  main.append(el('h1', { textContent: 'Redigera pass' }), toolbar, nameRow, totalRow, frame, error, list, adds)
  renderList()
  check()

  // Även en omladdning eller en stängd flik inom 300 ms ska få med den sista ändringen.
  addEventListener('pagehide', flush)
  addEventListener('beforeunload', warn)
  return () => {
    removeEventListener('pagehide', flush)
    removeEventListener('beforeunload', warn)
    flush()
  }
}

export function editorView(store: Store): View {
  return (root, id) => {
    const main = el('main', { className: 'editor' })
    root.append(main)
    const back = () => link('Till biblioteket', '#/')
    let alive = true
    let leave = () => {}
    store.getWorkout(id ?? '')
      .then(w => {
        if (!alive) return
        if (w) leave = editor(store, root, main, w)
        else main.append(el('h1', { textContent: 'Passet finns inte' }), back())
      })
      .catch(e => { if (alive) main.replaceChildren(el('p', { textContent: message(e) }), back()) })
    return () => { alive = false; leave() }
  }
}
