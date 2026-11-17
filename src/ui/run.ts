import { IDLE, pause, position, seek, start, type ClockState } from '../clock/clock'
import { locate, nextStartMs, prevStartMs } from '../clock/lookup'
import { clearRun, loadRun, saveRun } from '../clock/runState'
import { flatten, totalDuration } from '../model/flatten'
import { mmss, pctText } from '../model/format'
import type { Block, Item, Segment, Workout } from '../model/types'
import { zoneFor } from '../model/zones'
import type { View } from '../router'
import type { Store } from '../storage/storage'
import { renderChart } from './chart'
import { bannerVisible, countdownNumber, jumped, pepAllowed, pepIntervalSec } from './cues'
import { el, link, message } from './dom'

// 30 s, 8 min, 1 min 30 s
function length(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return m === 0 ? `${s} s` : s === 0 ? `${m} min` : `${m} min ${s} s`
}
const part = (b: Block) => `${length(b.durationSec)} ${pctText(b.fromPct, b.toPct)}`
const itemText = (i: Item) => (i.kind === 'block' ? part(i) : `${i.repeat} × (${i.blocks.map(part).join(' + ')})`)

// Texten skrivs bara när den ändras, så att varje bildruta inte skriver om sidan.
const put = (e: HTMLElement, text: string) => { if (e.textContent !== text) e.textContent = text }

function bars(w: Workout, segments: Segment[]) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('role', 'img')
  svg.setAttribute('aria-label', `Stapelbild för ${w.name}`)
  svg.classList.add('chart')
  return { svg, chart: renderChart(svg, segments) }
}

function screen(store: Store, main: HTMLElement, w: Workout, words: string[]): () => void {
  const segments = flatten(w)
  const total = totalDuration(segments)
  // ?fart=N ger en klocka som går N gånger fortare från att vyn öppnades. Den börjar om vid varje omladdning,
  // så i det läget sparas, laddas och rensas inget passläge.
  const fart = Number(new URLSearchParams(location.search).get('fart'))
  const fast = Number.isFinite(fart) && fart > 0
  const opened = Date.now()
  const now = fast ? () => opened + (Date.now() - opened) * fart : () => Date.now()

  let mode: 'overview' | 'live' | 'done' = 'overview'
  let clock: ClockState = IDLE
  let alive = true
  let frameId = 0
  let lock: WakeLockSentinel | undefined
  let movedAt = now()
  let quitting = false
  let hint = false
  let prevPos = 0
  // Peppord: positionen som nästa ord räknas från, slumpad avvikelse, när ordet försvinner och senaste ordet.
  let pepFrom = 0
  let pepSpread = 1
  let pepUntil = 0
  let lastWord = ''

  const live = bars(w, segments)
  const totalText = el('p', { className: 'total' })
  const top = el('header', { className: 'top' })
  top.append(el('h1', { textContent: w.name }), totalText)
  const status = el('p', { className: 'error', role: 'alert' })
  const blockName = el('p', { className: 'name' })
  const pct = el('span', { className: 'pct' })
  const pctRow = el('p', { className: 'pctrow' })
  pctRow.append(pct, ' av FTP')
  const next = el('p', { className: 'next' })
  const remaining = el('p', { className: 'remaining' })
  const pctLine = el('div', { className: 'split' })
  pctLine.append(pctRow, remaining)
  const nextLine = el('div', { className: 'split' })
  nextLine.append(next, el('p', { className: 'label', textContent: 'kvar av intervallet' }))
  const current = el('section', { className: 'current' })
  current.append(blockName, pctLine, nextLine)
  const bannerName = el('p', { className: 'banner-name' })
  const bannerInfo = el('p')
  const banner = el('div', { className: 'banner', hidden: true })
  banner.append(bannerName, bannerInfo)
  const countdown = el('p', { className: 'countdown', hidden: true })
  const pep = el('p', { className: 'pepword', hidden: true })
  const paused = el('p', { className: 'paused', textContent: 'Pausad', hidden: true })
  const fullscreenHint = el('p', { className: 'fullscreen-hint', textContent: 'Tryck F för fullskärm', hidden: true })
  const quit = el('p', { className: 'quit', role: 'alert', hidden: true })
  quit.append(el('strong', { textContent: 'Avsluta passet?' }), ' Enter avslutar, valfri annan tangent fortsätter')

  function show(m: typeof mode, ...children: Node[]) {
    mode = m
    main.dataset.mode = m
    main.replaceChildren(...children)
  }

  function overview() {
    const list = el('ul', { className: 'contents' })
    list.append(...w.items.map(i => el('li', { textContent: itemText(i) })))
    show('overview', el('h1', { textContent: w.name }), el('p', { className: 'total', textContent: `Total tid ${mmss(total)}` }),
      bars(w, segments).svg, list, el('p', { className: 'start', textContent: 'Mellanslag startar passet' }), el('div', { id: 'mic-panel' }))
  }

  function begin() {
    show('live', top, status, current, live.svg, banner, countdown, pep, paused, fullscreenHint, quit)
    prevPos = pepFrom = position(clock, now())
    wake()
  }

  function finish() {
    quitting = false
    forget()
    show('done', el('h1', { textContent: 'Bra jobbat' }), el('p', { className: 'total', textContent: `Total tid ${mmss(total)}` }), link('Till biblioteket', '#/'))
  }

  function persist() {
    if (fast) return
    try {
      saveRun(store.kv, w, clock, now())
      status.textContent = ''
    } catch (e) {
      status.textContent = `Passläget sparades inte: ${message(e)}`
    }
  }
  const forget = () => { if (!fast) clearRun(store.kv) }

  // Saknas stödet eller nekas begäran fortsätter passet utan vakenlås.
  function wake() {
    Promise.resolve()
      .then(() => navigator.wakeLock?.request('screen'))
      .then(l => { if (alive) lock = l; else return l?.release() })
      .catch(() => {})
  }

  function frame() {
    frameId = requestAnimationFrame(frame)
    const t = now()
    main.classList.toggle('nocursor', t - movedAt > 3000)
    if (mode === 'live') draw(t)
  }

  function draw(t: number) {
    const pos = position(clock, t)
    const at = locate(segments, pos)
    const seg = at.segment
    if (!seg) return finish()
    // Efter en dold flik, sömn eller ett hopp börjar tiden till nästa peppord om, så att inget spelas upp i efterhand.
    if (jumped(prevPos, pos)) { pepFrom = pos; pepUntil = 0 }
    prevPos = pos
    const run = clock.running

    const nextSeg = segments[at.index + 1]
    const shownPct = Math.round(at.pctNow)
    put(totalText, `Total tid ${mmss(Math.floor(pos / 1000))} av ${mmss(total)}`)
    put(blockName, seg.name)
    put(pct, `${shownPct} %`)
    pct.style.color = zoneFor(shownPct).textColor
    put(next, nextSeg ? `Nästa: ${nextSeg.name} · ${mmss(nextSeg.durationSec)} · ${pctText(nextSeg.fromPct, nextSeg.toPct)}` : 'Sista blocket')
    put(remaining, mmss(Math.ceil(at.remainingMs / 1000)))
    live.chart.setPlayhead(pos / 1000)

    const interval = pepIntervalSec(at.pctNow)
    if (run && words.length && interval !== null && pepAllowed(at.pctNow, at.elapsedMs, at.remainingMs) && pos - pepFrom >= interval * 1000 * pepSpread) {
      const others = words.filter(x => x !== lastWord)
      const pool = others.length ? others : words
      lastWord = pool[Math.floor(Math.random() * pool.length)]
      put(pep, lastWord)
      pepFrom = pos
      pepSpread = 0.7 + Math.random() * 0.6
      pepUntil = t + 4000
    }

    // Under paus visas bara "Pausad" stort, så att inget annat ligger över eller under den.
    const showBanner = run && bannerVisible(at.elapsedMs)
    const n = run && !showBanner ? countdownNumber(seg.durationSec, at.remainingMs) : null
    banner.hidden = !showBanner
    if (showBanner) {
      put(bannerName, seg.name)
      put(bannerInfo, `${pctText(seg.fromPct, seg.toPct)} · ${length(seg.durationSec)}`)
      banner.style.borderColor = zoneFor(seg.fromPct).color
    }
    countdown.hidden = n === null
    put(countdown, n === null ? '' : String(n))
    pep.hidden = !run || t >= pepUntil
    paused.hidden = run
    if (document.fullscreenElement) hint = false
    fullscreenHint.hidden = !hint
  }

  function onKey(e: KeyboardEvent) {
    // Mellanslag och pilar rullar annars sidan.
    if ([' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault()
    if (e.repeat) return
    // Medan rutan är öppen gör en tangent inget annat än att stänga den.
    if (quitting) {
      quitting = false
      quit.hidden = true
      if (e.key === 'Enter') { forget(); location.hash = '#/' }
      return
    }
    // Kortkommandon som Cmd+R är webbläsarens. Pil upp, pil ned, M och A gör ingenting här.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const key = e.key.toLowerCase()
    const t = now()
    if (key === 'f') {
      (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
      return
    }
    if (key === ' ' && mode === 'overview') {
      clock = start(clock, t)
      persist()
      return begin()
    }
    if (mode !== 'live') return
    if (key === ' ') clock = clock.running ? pause(clock, t) : start(clock, t)
    else if (key === 'arrowright') clock = seek(clock, nextStartMs(segments, position(clock, t)), t)
    else if (key === 'arrowleft') clock = seek(clock, prevStartMs(segments, position(clock, t)), t)
    else if (key === 'q') { quitting = true; quit.hidden = false; return }
    else return
    persist()
  }
  const onMove = () => { movedAt = now() }
  const onVisible = () => { if (document.visibilityState === 'visible' && mode === 'live') wake() }

  const saved = fast ? null : loadRun(store.kv, w, now())
  // Samma pass kört igen inom fyra timmar kan ge ett läge efter passets slut.
  if (saved && locate(segments, position(saved, now())).done) finish()
  else if (saved) { clock = saved; hint = true; begin() }
  else overview()

  addEventListener('keydown', onKey)
  addEventListener('mousemove', onMove)
  document.addEventListener('visibilitychange', onVisible)
  frameId = requestAnimationFrame(frame)
  return () => {
    alive = false
    cancelAnimationFrame(frameId)
    removeEventListener('keydown', onKey)
    removeEventListener('mousemove', onMove)
    document.removeEventListener('visibilitychange', onVisible)
    lock?.release().catch(() => {})
  }
}

export function runView(store: Store): View {
  return (root, id) => {
    // Vyn skriver bara i sin egen main, så att ett sparfel som redigeraren lägger överst i #app står kvar.
    const main = el('main', { className: 'run' })
    root.append(main)
    const back = () => link('Till biblioteket', '#/')
    let alive = true
    let leave = () => {}
    Promise.all([store.getWorkout(id ?? ''), store.getPepWords()])
      .then(([w, words]) => {
        if (!alive) return
        if (!w) main.append(el('h1', { textContent: 'Passet finns inte' }), back())
        else if (!flatten(w).length) main.append(el('h1', { textContent: 'Passet är tomt' }), link('Till redigeraren', `#/edit/${w.id}`))
        else leave = screen(store, main, w, words)
      })
      .catch(e => { if (alive) main.replaceChildren(el('p', { textContent: message(e) }), back()) })
    return () => { alive = false; leave() }
  }
}
