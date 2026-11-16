import { flatten, totalDuration } from '../model/flatten'
import { mmss } from '../model/format'
import type { Workout } from '../model/types'
import { LIMITS } from '../model/validate'
import type { View } from '../router'
import type { Store } from '../storage/storage'
import { renderChart } from './chart'

const COPY = ' (kopia)'
const newId = () => crypto.randomUUID()

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}): HTMLElementTagNameMap[K] =>
  Object.assign(document.createElement(tag), props)
const button = (textContent: string, onclick: () => void) => el('button', { textContent, onclick })

// Webbläsarens eget fel när lagringen är full är på engelska.
const message = (e: unknown) =>
  e instanceof DOMException && e.name === 'QuotaExceededError' ? 'Webbläsarens lagring är full, så ändringen sparades inte.'
    : e instanceof Error ? e.message : String(e)

// Resultatet eller felet visas alltid som text, så att inget fel från lagringen försvinner tyst.
async function attempt(status: HTMLElement, action: () => Promise<string | void>) {
  status.textContent = ''
  try {
    status.textContent = (await action()) || ''
  } catch (e) {
    status.textContent = message(e)
  }
}

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

      const start = button('Starta', () => { location.hash = `#/run/${w.id}` })
      start.disabled = segments.length === 0
      const actions = el('div', { className: 'actions' })
      actions.append(
        start,
        ...(segments.length ? [] : [el('span', { className: 'note', textContent: 'Passet är tomt' })]),
        button('Redigera', () => { location.hash = `#/edit/${w.id}` }),
        button('Duplicera', () => change(() => store.saveWorkout(copyOf(w)))),
        button('Ta bort', () => { if (confirm(`Ta bort passet ${w.name}?`)) change(() => store.deleteWorkout(w.id)) }),
      )
      const info = el('div', { className: 'info' })
      info.append(el('span', { className: 'name', textContent: w.name }), el('span', { className: 'time', textContent: mmss(totalDuration(segments)) }))
      const li = el('li', { className: 'workout' })
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

    const pep = el('textarea', { id: 'peppord', rows: 8 })
    const pepStatus = el('p', { className: 'status', role: 'status' })
    const pepSection = el('section', { className: 'pep' })
    pepSection.append(
      el('h2', { textContent: 'Peppord' }),
      el('label', { htmlFor: 'peppord', textContent: 'Ett ord eller en fras per rad' }),
      pep,
      button('Spara', () => attempt(pepStatus, async () => {
        const words = pep.value.split('\n').map(s => s.trim()).filter(Boolean)
        await store.savePepWords(words)
        pep.value = words.join('\n')
        return 'Pepporden är sparade'
      })),
      pepStatus,
    )

    const main = el('main', { className: 'library' })
    main.append(el('h1', { textContent: 'Dina pass' }), toolbar, status, list, pepSection)
    root.append(main)

    void refresh()
    void attempt(pepStatus, async () => { pep.value = (await store.getPepWords()).join('\n') })
  }
}
