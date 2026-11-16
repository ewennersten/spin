import { duplicateAt, moveItem, newBlock, newGroup, removeAt } from '../model/edit'
import { flatten, totalDuration } from '../model/flatten'
import { mmss } from '../model/format'
import type { Block, Group, Item, Workout } from '../model/types'
import { LIMITS, validateWorkout } from '../model/validate'
import { zoneFor } from '../model/zones'
import type { View } from '../router'
import type { Store } from '../storage/storage'
import { renderChart } from './chart'

// Samma små hjälpare som i library.ts, som inte exporterar dem.
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), props)
const button = (textContent: string, onclick: () => void) => el('button', { textContent, onclick })
const link = (textContent: string, href: string) => el('a', { textContent, href, className: 'button' })

// Webbläsarens eget fel när lagringen är full är på engelska.
const message = (e: unknown) =>
  e instanceof DOMException && e.name === 'QuotaExceededError' ? 'Webbläsarens lagring är full, så ändringen sparades inte.'
    : e instanceof Error ? e.message : String(e)

const numberInput = (value: number, min: number, max: number) =>
  el('input', { type: 'number', value: String(value), min: String(min), max: String(max) })

function field(text: string, input: HTMLInputElement) {
  const label = el('label', { className: 'field' })
  label.append(el('span', { textContent: text }), input)
  return label
}

const where = (text: string) => el('span', { className: 'where', textContent: text, ariaHidden: 'true' })

function editor(store: Store, main: HTMLElement, w: Workout): () => void {
  const status = el('p', { className: 'status', role: 'status' })
  const error = el('p', { className: 'error', role: 'status' })
  const total = el('span')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('role', 'img')
  const list = el('div', { className: 'items' })
  // Knappar som ska kunna få fokus igen efter att listan ritats om, med nyckeln "<id>:<åtgärd>".
  const buttons = new Map<string, HTMLButtonElement>()
  let timer: ReturnType<typeof setTimeout> | undefined
  let dirty = false
  const setItems = (l: Item[]) => { w.items = l }

  // Ritar om stapelbild och total tid när passet är giltigt, annars visas felet. Ger true om passet är giltigt.
  function check(): boolean {
    const r = validateWorkout(w)
    error.textContent = r.ok ? '' : r.error
    if (!r.ok) return false
    const segments = flatten(r.workout)
    renderChart(svg, segments)
    svg.setAttribute('aria-label', `Stapelbild för ${r.workout.name}`)
    total.textContent = mmss(totalDuration(segments))
    return true
  }

  function changed() {
    clearTimeout(timer)
    status.textContent = ''
    dirty = check()
    if (dirty) timer = setTimeout(() => {
      dirty = false
      store.saveWorkout(w).then(() => { status.textContent = 'Sparat' }, e => { status.textContent = message(e) })
    }, 300)
  }

  // När vyn lämnas finns ingen sida kvar att skriva felet på.
  function flush() {
    clearTimeout(timer)
    if (!dirty) return
    dirty = false
    store.saveWorkout(w).catch(e => alert(message(e)))
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
      const b = button(text, () => { set(next()); restructure(focus) })
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
    const name = el('input', { type: 'text', value: b.name, maxLength: LIMITS.nameMax })
    const min = numberInput(Math.floor(b.durationSec / 60), 0, LIMITS.durMaxSec / 60)
    const sec = numberInput(b.durationSec % 60, 0, 59)
    const from = numberInput(b.fromPct, LIMITS.pctMin, LIMITS.pctMax)
    const to = numberInput(b.toPct, LIMITS.pctMin, LIMITS.pctMax)
    const zone = () => { name.placeholder = zoneFor((b.fromPct + b.toPct) / 2).name }
    zone()
    const row = el('div', { className: 'block', role: 'group', ariaLabel: label })
    row.append(where(label), field('Namn', name), field('Min', min), field('Sek', sec), field('Från %', from), field('Till %', to), actions)
    row.oninput = () => {
      // valueAsNumber är NaN för ett tomt fält, så att valideringen säger till i stället för att värdet blir 0.
      // Delade minuter skulle tyst bli hela sekunder, så de räknas också som ogiltiga.
      const m = min.valueAsNumber
      Object.assign(b, { name: name.value, durationSec: Number.isInteger(m) ? m * 60 + sec.valueAsNumber : NaN, fromPct: from.valueAsNumber, toPct: to.valueAsNumber })
      zone()
      changed()
    }
    return row
  }

  function groupRow(g: Group, i: number) {
    const label = `Grupp ${i + 1}`
    const repeat = numberInput(g.repeat, LIMITS.repeatMin, LIMITS.repeatMax)
    repeat.oninput = () => { g.repeat = repeat.valueAsNumber; changed() }
    const addKey = `${g.id}:add`
    const add = button('Lägg till block i gruppen', () => { g.blocks = [...g.blocks, newBlock()]; restructure([addKey]) })
    buttons.set(addKey, add)
    const setBlocks = (l: Block[]) => { g.blocks = l }
    const blocks = el('div', { className: 'blocks' })
    blocks.append(...g.blocks.map((b, j) => {
      const bl = `${label}, block ${j + 1}`
      return blockRow(b, bl, controls(bl, g.blocks, j, setBlocks, addKey))
    }))
    const head = el('div', { className: 'head' })
    head.append(where(label), field('Upprepa', repeat), controls(label, w.items, i, setItems, 'add'))
    const box = el('div', { className: 'group', role: 'group', ariaLabel: label })
    box.append(head, blocks, add)
    return box
  }

  function renderList() {
    // Numreringen följer validateWorkout, så att felmeddelandets "Block 3" och "Grupp 2, block 1" går att hitta.
    list.replaceChildren(...w.items.map((item, i) => item.kind === 'group'
      ? groupRow(item, i)
      : blockRow(item, `Block ${i + 1}`, controls(`Block ${i + 1}`, w.items, i, setItems, 'add'))))
  }

  const nameInput = el('input', { type: 'text', value: w.name, maxLength: LIMITS.nameMax })
  nameInput.oninput = () => { w.name = nameInput.value; changed() }

  const toolbar = el('div', { className: 'toolbar' })
  toolbar.append(link('Starta passet', `#/run/${w.id}`), link('Till biblioteket', '#/'), status)
  const totalRow = el('p', { className: 'total', textContent: 'Total tid ' })
  totalRow.append(total)
  const addBlock = button('Lägg till block', () => { w.items = [...w.items, newBlock()]; restructure([]) })
  buttons.set('add', addBlock)
  const adds = el('div', { className: 'toolbar' })
  adds.append(addBlock, button('Lägg till grupp', () => { w.items = [...w.items, newGroup()]; restructure([]) }))

  main.append(el('h1', { textContent: 'Redigera pass' }), toolbar, field('Namn på passet', nameInput), totalRow, svg, error, list, adds)
  renderList()
  check()

  // Även en omladdning eller en stängd flik inom 300 ms ska få med den sista ändringen.
  addEventListener('pagehide', flush)
  return () => { removeEventListener('pagehide', flush); flush() }
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
        if (w) leave = editor(store, main, w)
        else main.append(el('h1', { textContent: 'Passet finns inte' }), back())
      })
      .catch(e => { if (alive) main.replaceChildren(el('p', { textContent: message(e) }), back()) })
    return () => { alive = false; leave() }
  }
}
