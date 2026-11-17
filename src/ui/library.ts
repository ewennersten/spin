import { position } from '../clock/clock'
import { locate } from '../clock/lookup'
import { clearRun, loadRun } from '../clock/runState'
import { flatten, totalDuration } from '../model/flatten'
import { mmss } from '../model/format'
import type { Workout } from '../model/types'
import { LIMITS } from '../model/validate'
import type { View } from '../router'
import type { Store } from '../storage/storage'
import { renderChart } from './chart'
import { attempt, clubHeader } from './dom'

const COPY = ' (kopia)'
const newId = () => crypto.randomUUID()

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), props)
const button = (textContent: string, onclick: () => void) => el('button', { textContent, onclick })

// Webbläsarens eget fel när lagringen är full är på engelska.
const message = (e: unknown) =>
  e instanceof DOMException && e.name === 'QuotaExceededError' ? 'Webbläsarens lagring är full, så ändringen sparades inte.'
    : e instanceof Error ? e.message : String(e)

function copyOf(w: Workout): Workout {
  // Namnet kortas så att suffixet ryms inom gränsen, utan att ett tecken utanför BMP delas på mitten.
  const name = w.name.slice(0, LIMITS.nameMax - COPY.length).replace(/[\uD800-\uDBFF]$/, '') + COPY
  return {
    ...w,
    id: newId(),
    name,
    items: w.items.map(i => i.kind === 'block'
      ? { ...i, id: newId() }
      : { ...i, id: newId(), blocks: i.blocks.map(b => ({ ...b, id: newId() })) }),
  }
}

function download(json: string) {
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  // sv-SE skriver datumet som ÅÅÅÅ-MM-DD.
  el('a', { href: url, download: `spinningpass-${new Date().toLocaleDateString('sv-SE')}.json` }).click()
  setTimeout(() => URL.revokeObjectURL(url))
}

export function libraryView(store: Store): View {
  return (root) => {
    const status = el('p', { className: 'status', role: 'status' })
    const list = el('div')
    const file = el('input', { type: 'file', accept: '.json', hidden: true })

    async function refresh() {
      try {
        const workouts = await store.listWorkouts()
        const ul = el('ul', { className: 'workouts' })
        ul.append(...workouts.map(row))
        list.replaceChildren(workouts.length ? ul : el('p', { textContent: 'Inga sparade pass.' }))
        newButton.disabled = importButton.disabled = false
      } catch (e) {
        // Den trasiga datan får inte skrivas över, så allt som skriver nya pass stängs av.
        list.replaceChildren(el('p', { textContent: message(e) }))
        newButton.disabled = importButton.disabled = true
      }
    }

    const change = (action: () => Promise<unknown>) => attempt(status, async () => { await action(); await refresh() })

    function row(w: Workout) {
      const segments = flatten(w)
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      svg.setAttribute('role', 'img')
      svg.setAttribute('aria-label', `Stapelbild för ${w.name}`)
      renderChart(svg, segments)

      // Ett pass som pågår (eller är pausat) har ett sparat läge. Starta fortsätter då där det var, och Stoppa rensar läget.
      const nowMs = Date.now()
      const saved = loadRun(store.kv, w, nowMs)
      const posMs = saved ? position(saved, nowMs) : 0
      const ongoing = saved !== null && !locate(segments, posMs).done
      const start = button(ongoing ? 'Fortsätt' : 'Starta', () => { location.hash = `#/run/${w.id}` })
      start.disabled = segments.length === 0
      start.className = 'primary'
      const stop = button('Stoppa', () => change(async () => clearRun(store.kv)))
      stop.ariaLabel = `Stoppa ${w.name} så att det börjar om från början`
      const actions = el('div', { className: 'actions' })
      actions.append(
        start,
        ...(ongoing ? [stop] : []),
        ...(segments.length ? [] : [el('span', { className: 'note', textContent: 'Passet är tomt' })]),
        button('Redigera', () => { location.hash = `#/edit/${w.id}` }),
        button('Duplicera', () => change(() => store.saveWorkout(copyOf(w)))),
        button('Ta bort', () => { if (confirm(`Ta bort passet ${w.name}?`)) change(() => store.deleteWorkout(w.id)) }),
      )
      const info = el('div', { className: 'info' })
      info.append(el('span', { className: 'name', textContent: w.name }), el('span', { className: 'time', textContent: mmss(totalDuration(segments)) }))
      if (ongoing) {
        const state = saved?.running ? 'Pågår' : 'Pausat'
        info.append(el('span', { className: 'ongoing', textContent: `${state} vid ${mmss(Math.floor(posMs / 1000))}` }))
      }
      const li = el('li', { className: ongoing ? 'workout ongoing' : 'workout' })
      li.append(info, svg, actions)
      return li
    }

    const newButton = button('Nytt pass', () => attempt(status, async () => {
      const w: Workout = {
        id: newId(),
        name: 'Nytt pass',
        items: [{ kind: 'block', id: newId(), name: '', durationSec: 300, fromPct: 55, toPct: 55 }],
        updatedAt: 0,
      }
      await store.saveWorkout(w)
      location.hash = `#/edit/${w.id}`
    }))
    const importButton = button('Importera pass', () => file.click())
    file.onchange = () => attempt(status, async () => {
      const chosen = file.files?.[0]
      file.value = '' // samma fil ska kunna väljas igen
      if (!chosen) return
      const n = await store.importAll(await chosen.text())
      await refresh()
      return `${n} pass importerade`
    })
    const toolbar = el('div', { className: 'toolbar' })
    toolbar.append(newButton, button('Exportera pass', () => attempt(status, async () => download(await store.exportAll()))), importButton, file)

    const main = el('main', { className: 'library' })
    main.append(el('h2', { textContent: 'Dina pass' }), toolbar, status, list)
    root.append(clubHeader('Torsdagsspinning', 'pass'), main)

    void refresh()
  }
}

export function pepView(store: Store): View {
  return (root) => {
    let words: string[] = []
    const status = el('p', { className: 'status', role: 'status' })
    const list = el('ul', { className: 'pepwords' })
    const empty = el('p', { className: 'note', textContent: 'Inga peppord ännu. Utan ord visas inget under passet.', hidden: true })
    const input = el('input', { type: 'text', id: 'nytt-peppord', maxLength: 40, placeholder: 'Till exempel: Kör hårt!' })
    const add = el('button', { type: 'submit', textContent: 'Lägg till', className: 'primary' })
    // Tills listan är inläst går inget att lägga till, så att en misslyckad inläsning inte skriver över de sparade orden.
    input.disabled = add.disabled = true
    const label = el('label', { htmlFor: input.id, textContent: 'Nytt peppord' })
    const form = el('form', { className: 'pep-add' })
    form.append(label, input, add)

    // Varje ändring sparas direkt. Misslyckas sparningen står listan kvar som den är i lagringen.
    const update = (next: string[], done: string) => attempt(status, async () => {
      await store.savePepWords(next)
      words = next
      draw()
      return done
    })

    function draw() {
      empty.hidden = words.length > 0
      list.replaceChildren(...words.map((w, i) => {
        const del = button('Ta bort', () => update(words.filter((_, j) => j !== i), `Borttaget: ${w}`).then(() => {
          // Fokus går till raden som nu står på samma plats, annars till fältet.
          const rest = list.querySelectorAll('button')
          ;(rest[Math.min(i, rest.length - 1)] ?? input).focus()
        }))
        del.ariaLabel = `Ta bort ${w}`
        const li = el('li')
        li.append(el('span', { className: 'word', textContent: w }), del)
        return li
      }))
    }

    form.onsubmit = e => {
      e.preventDefault()
      const w = input.value.trim()
      if (!w) return
      if (words.includes(w)) { status.textContent = `${w} finns redan i listan`; return }
      void update([...words, w], `Tillagt: ${w}`).then(() => {
        if (words.includes(w)) input.value = ''
        input.focus()
      })
    }

    const main = el('main', { className: 'library pep' })
    main.append(
      el('h2', { textContent: 'Peppord' }),
      el('p', { className: 'note', textContent: 'Från 88 % av FTP visas ett slumpat ord stort på skärmen då och då, oftare ju hårdare det går.' }),
      form,
      status,
      list,
      empty,
    )
    root.append(clubHeader('Torsdagsspinning', 'pep'), main)
    void attempt(status, async () => {
      words = await store.getPepWords()
      draw()
      input.disabled = add.disabled = false
    })
  }
}
