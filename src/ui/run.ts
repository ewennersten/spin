import { createStage } from '../anim/stage'
import { SCENES } from '../anim/scenes'
import { BeatDetector } from '../audio/beat'
import { BeatSource, type MicReading } from '../audio/beatSource'
import { openMic, type Mic } from '../audio/mic'
import { IDLE, pause, position, seek, start, type ClockState } from '../clock/clock'
import { locate, nextStartMs, prevStartMs, type Located } from '../clock/lookup'
import { clearRun, loadRun, saveRun } from '../clock/runState'
import { flatten, totalDuration } from '../model/flatten'
import { mmss, pctText } from '../model/format'
import type { Block, Item, Segment, Workout } from '../model/types'
import { zoneFor } from '../model/zones'
import type { View } from '../router'
import type { Store } from '../storage/storage'
import { chartFrame, renderChart } from './chart'
import { bannerVisible, countdownNumber, jumped, pepAllowed, pepIntervalSec } from './cues'
import { el, link, logo, message, sports } from './dom'
import { mountMicPanel } from './micPanel'

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
  const { frame, scale } = chartFrame(svg)
  frame.classList.add('chart')
  return { node: frame, chart: renderChart(svg, segments, scale) }
}

function screen(store: Store, main: HTMLElement, w: Workout, words: string[]): () => void {
  const segments = flatten(w)
  const total = totalDuration(segments)
  // ?fart=N ger en klocka som går N gånger fortare från att vyn öppnades. Den börjar om vid varje omladdning,
  // så i det läget sparas, laddas och rensas inget passläge.
  const params = new URLSearchParams(location.search)
  const fart = Number(params.get('fart'))
  const fast = Number.isFinite(fart) && fart > 0
  const opened = Date.now()
  const now = fast ? () => opened + (Date.now() - opened) * fart : () => Date.now()
  // 3D-bilden bakom skärmen, null utan WebGL. ?scen=N tvingar scen N (1 till antalet scener), ?ljus=1 visar mätrutan.
  const scen = Number(params.get('scen'))
  const forcedScene = Number.isInteger(scen) && scen >= 1 && scen <= SCENES.length ? scen - 1 : null
  const stage = createStage({ forcedScene, lightMeter: params.get('ljus') === '1' })
  stage?.setVisible(false) // syns bara under passet
  let stageShown = false
  let animOn = true

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
  // Ljudet: skärmen äger mikrofonen. Med givet tillstånd öppnas den vid första tangenttryckningen eller klicket.
  const source = new BeatSource(new BeatDetector())
  let mic: Mic | null = null
  let micAuto = false
  let drawPanel = () => {}
  let litUntil = 0

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
  const animLine = el('p', { className: 'label', hidden: true })
  const beatDot = el('span', { className: 'lamp', ariaHidden: 'true' })
  const beatMode = el('span')
  const beatBox = el('p', { className: 'beat' })
  beatBox.append(beatDot, beatMode)

  function show(m: typeof mode, ...children: Node[]) {
    mode = m
    main.dataset.mode = m
    main.replaceChildren(...children)
  }

  function overview() {
    const list = el('ul', { className: 'contents' })
    // En grupp utan block ger inget på skärmen och skrivs inte heller här.
    list.append(...w.items.filter(i => i.kind === 'block' || i.blocks.length).map(i => el('li', { textContent: itemText(i) })))
    const panel = el('div', { id: 'mic-panel' })
    // Länken står på samma rad som uppmaningen, så att den inte hamnar under kanten.
    const startRow = el('div', { className: 'split' })
    startRow.append(el('p', { className: 'start', textContent: 'Mellanslag startar passet' }), link('Till biblioteket', '#/'))
    show('overview', logo(), el('h1', { textContent: w.name }), el('p', { className: 'total', textContent: `Total tid ${mmss(total)}` }),
      bars(w, segments).node, list, startRow, animLine, panel)
    drawPanel = mountMicPanel(panel, store, source, { getMic: () => mic, enableMic }).draw
  }

  function begin() {
    show('live', top, status, current, live.node, banner, countdown, pep, paused, fullscreenHint, quit, beatBox)
    prevPos = pepFrom = position(clock, now())
  }

  function finish() {
    quitting = false
    forget()
    show('done', sports(), el('h1', { textContent: 'Bra jobbat!' }), logo(), el('p', { className: 'total', textContent: `Total tid ${mmss(total)}` }), link('Till biblioteket', '#/'))
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
    if (mode === 'overview') {
      // Det sparade valet läses in efter att vyn har öppnats, så raden skrivs varje bildruta (put skriver bara ändringar).
      animLine.hidden = !stage || stage.broken
      put(animLine, animOn ? 'Animationer: på (A stänger av)' : 'Animationer: av (A sätter på)')
    }
    const at = mode === 'live' ? draw(t) : undefined
    sound()
    // Efter draw, som kan ha avslutat passet. Dold under nedräkningens och avslutsrutans slöja, så att bilden
    // tonar upp under ljusspärren när slöjan försvinner i stället för att synas med full styrka på en bildruta.
    const visible = mode === 'live' && animOn && countdown.hidden === true && quit.hidden === true
    if (visible !== stageShown) stage?.setVisible(stageShown = visible)
    if (visible && at) stage?.frame({ pctNow: at.pctNow, running: clock.running, blockIndex: at.index, beat: source.frame, nowMs: performance.now() })
  }

  // Ljudet räknas efter klockorna, och i verklig tid även med ?fart. Ett fel i mikrofonen ger intern takt.
  function sound() {
    let reading: MicReading | null = null
    try { reading = mic?.read() ?? null } catch { /* reading förblir null */ }
    const t = performance.now()
    const f = source.update(reading, t)
    if (mode === 'overview') drawPanel()
    if (mode !== 'live') return
    // Fylld prick för mikrofonen och tom ring för den interna takten, så att läget syns utan att läsa texten.
    if (f.beat) litUntil = t + 120
    beatDot.classList.toggle('on', t < litUntil)
    current.classList.toggle('pulse', t < litUntil && clock.running) // procenten och klockan studsar i takt
    beatDot.classList.toggle('ring', f.mode === 'intern')
    put(beatMode, (f.mode === 'mic' ? 'Mikrofon' : 'Intern takt') + (stage && !stage.broken && !animOn ? ' · Animationer av' : ''))
  }

  // Ett nytt tryck på knappen öppnar mikrofonen på nytt, till exempel efter att den har kopplats ur.
  async function enableMic() {
    micAuto = false
    const m = await openMic(await store.getMicSettings())
    if (!alive) return m.close()
    mic?.close()
    mic = m
  }
  // Webbläsaren startar bara ljud efter en tangenttryckning eller ett klick, och inte efter till exempel Esc.
  function autoMic() {
    if (micAuto && navigator.userActivation?.isActive) enableMic().catch(() => {})
  }

  function nudge(step: number) {
    const d = source.detector
    d.sensitivity += step
    const sensitivity = d.sensitivity
    store.getMicSettings().then(s => store.saveMicSettings({ ...s, sensitivity }))
      .catch(e => { status.textContent = `Känsligheten sparades inte: ${message(e)}` })
  }

  function draw(t: number): Located | undefined {
    const pos = position(clock, t)
    const at = locate(segments, pos)
    const seg = at.segment
    if (!seg) { finish(); return }
    // Efter en dold flik, sömn eller ett hopp börjar tiden till nästa peppord om, så att inget spelas upp i efterhand.
    if (jumped(prevPos, pos)) { pepFrom = pos; pepUntil = 0 }
    prevPos = pos
    const run = clock.running

    const nextSeg = segments[at.index + 1]
    const shownPct = Math.round(at.pctNow)
    put(totalText, `Total tid ${mmss(Math.floor(pos / 1000))} av ${mmss(total)}`)
    put(blockName, seg.name)
    put(pct, `${shownPct} %`)
    const zone = zoneFor(shownPct)
    pct.style.color = zone.textColor
    pct.style.setProperty('--zone', zone.color)
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
    return at
  }

  function onKey(e: KeyboardEvent) {
    // Kortkommandon som Cmd+R och Cmd+← är webbläsarens.
    if (e.ctrlKey || e.metaKey || e.altKey) return
    autoMic()
    // Mellanslag styr passet även från panelens reglage och talfält, men trycker på en knapp som har fokus.
    // Övriga tangenter i panelen, som pilarna i reglaget, går till panelen och styr inte passet.
    const inPanel = e.target instanceof Element && e.target.closest('#mic-panel')
    if (e.key === ' ' ? e.target instanceof HTMLButtonElement : inPanel) return
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
    const key = e.key.toLowerCase()
    const t = now()
    if (key === 'f') {
      (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen()).catch(() => {})
      return
    }
    if (key === ' ' && mode === 'overview') {
      // Ett ändrat talfält i panelen gäller och sparas, som när man klickar utanför det, innan panelen försvinner.
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
      clock = start(clock, t)
      persist()
      return begin()
    }
    // Före start pågår inget pass, så Q behöver ingen bekräftelse.
    if (key === 'q' && mode === 'overview') { location.hash = '#/'; return }
    if (key === 'a' && mode !== 'done') {
      // Utan WebGL, eller när scenen har slutat fungera, finns inga animationer att stänga av.
      if (!stage || stage.broken) return
      animOn = !animOn
      store.saveAnimationsOn(animOn).catch(e => { status.textContent = `Valet för animationerna sparades inte: ${message(e)}` })
      return
    }
    if (mode !== 'live') return
    if (key === ' ') clock = clock.running ? pause(clock, t) : start(clock, t)
    else if (key === 'arrowright') {
      // I sista blocket gör pil höger inget, så att passet inte avslutas utan bekräftelse.
      const to = nextStartMs(segments, position(clock, t))
      if (to >= total * 1000) return
      clock = seek(clock, to, t)
    }
    else if (key === 'arrowleft') clock = seek(clock, prevStartMs(segments, position(clock, t)), t)
    else if (key === 'q') { quitting = true; quit.hidden = false; return }
    else if (key === 'arrowup' || key === 'arrowdown') return nudge(key === 'arrowup' ? 1 : -1)
    else if (key === 'm') { source.enabled = !source.enabled; return }
    else return
    persist()
  }
  const onMove = () => { movedAt = now() }
  // Webbläsaren släpper vakenlåset när fliken döljs.
  const onVisible = () => { if (document.visibilityState === 'visible') wake() }

  let saved = fast ? null : loadRun(store.kv, w, now())
  // Samma pass kört igen inom fyra timmar kan ge ett läge efter passets slut. Det rensas, så att Starta börjar om.
  if (saved && locate(segments, position(saved, now())).done) { forget(); saved = null }
  if (saved) { clock = saved; hint = true; begin() }
  else overview()
  // Även i överblicken, så att skärmen inte släcks under genomgången före start.
  wake()

  store.getMicSettings().then(s => { source.detector.sensitivity = s.sensitivity }).catch(() => {})
  store.getAnimationsOn().then(on => { animOn = on }).catch(() => {})
  // Även efter en omladdning mitt i passet, då panelen med knappen inte visas.
  Promise.resolve()
    .then(() => navigator.permissions.query({ name: 'microphone' }))
    .then(p => { if (p.state === 'granted') micAuto = true })
    .catch(() => {})

  addEventListener('keydown', onKey)
  addEventListener('mousemove', onMove)
  main.addEventListener('click', autoMic)
  document.addEventListener('visibilitychange', onVisible)
  frameId = requestAnimationFrame(frame)
  return () => {
    alive = false
    cancelAnimationFrame(frameId)
    removeEventListener('keydown', onKey)
    removeEventListener('mousemove', onMove)
    main.removeEventListener('click', autoMic)
    document.removeEventListener('visibilitychange', onVisible)
    lock?.release().catch(() => {})
    mic?.close() // stoppar spåren och stänger ljudet, så att webbläsarens mikrofonsymbol slocknar
    stage?.dispose() // släpper WebGL-kontexten, så att upprepade pass i samma flik inte tar slut på dem
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
