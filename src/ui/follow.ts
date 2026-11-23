import { position } from '../clock/clock'
import { locate } from '../clock/lookup'
import { flatten, totalDuration } from '../model/flatten'
import { mmss, pctText } from '../model/format'
import type { Workout } from '../model/types'
import { zoneFor } from '../model/zones'
import type { View } from '../router'
import type { LiveRun, Live } from '../storage/cloud'
import type { Store } from '../storage/storage'
import { bars } from './chart'
import { el, link, message } from './dom'

const put = (e: HTMLElement, text: string) => { if (e.textContent !== text) e.textContent = text }

// Följvyn på mobilen: passet som pågår på datorn i salen, med klockor och staplar men utan animationer.
// Datorn skickar bara klockans läge när det ändras (start, paus, hopp); mobilen räknar fram positionen själv.
// Den räknar med sin egen klocka, så att datorns och mobilens klockor behöver gå lika (det gör de med nätets tid).
export function followView(store: Store, live: Live): View {
  return (root) => {
    const main = el('main', { className: 'follow' })
    const status = el('p', { className: 'status', role: 'status' })
    const body = el('div')
    main.append(body, status, link('Till biblioteket', '#/'))
    root.append(main)

    let run: LiveRun | null = null
    let shown: { w: Workout; draw: (posMs: number, running: boolean) => void } | null = null
    let loading = ''
    let frameId = 0
    let alive = true
    let lock: WakeLockSentinel | undefined

    function idle(text: string) {
      shown = null
      body.replaceChildren(el('h1', { textContent: text }), el('p', { className: 'label', textContent: 'Följvyn visar passet när det startar på datorn i salen.' }))
    }

    // Byggs om bara när ett annat pass startar; klockan ändras utan att något byggs om.
    async function apply(next: LiveRun | null) {
      run = next
      if (!next) return idle('Inget pass pågår')
      if (shown?.w.id === next.workoutId || loading === next.workoutId) return
      loading = next.workoutId
      try {
        const w = await store.getWorkout(next.workoutId)
        if (!alive || run?.workoutId !== next.workoutId) return
        if (!w || !flatten(w).length) return idle('Passet som pågår finns inte längre')
        shown = { w, draw: screen(body, w) }
        status.textContent = ''
      } finally {
        loading = ''
      }
    }

    const refresh = () => { live.get().then(apply).catch(e => { status.textContent = message(e) }) }
    const stop = live.subscribe(r => { apply(r).catch(e => { status.textContent = message(e) }) }, refresh)

    function frame() {
      frameId = requestAnimationFrame(frame)
      if (run && shown) shown.draw(position(run.clock, Date.now()), run.clock.running)
    }

    // Mobilen somnar och tappar förbindelsen; när den vaknar hämtas läget igen och skärmen hålls vaken.
    const wake = () => { navigator.wakeLock?.request('screen').then(l => { if (alive) lock = l; else void l.release() }).catch(() => {}) }
    const onVisible = () => { if (document.visibilityState === 'visible') { refresh(); wake() } }
    document.addEventListener('visibilitychange', onVisible)
    wake()
    idle('Ansluter …')
    frameId = requestAnimationFrame(frame)

    return () => {
      alive = false
      stop()
      cancelAnimationFrame(frameId)
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }

  // Ritar passet och returnerar funktionen som uppdaterar det för en position.
  function screen(body: HTMLElement, w: Workout): (posMs: number, running: boolean) => void {
    const segments = flatten(w)
    const total = totalDuration(segments)
    const elapsed = el('span', { className: 'num' })
    const totalLine = el('p', { className: 'total' })
    totalLine.append('Total tid ', elapsed, ` av ${mmss(total)}`)
    const blockName = el('p', { className: 'name' })
    const pct = el('p', { className: 'pct' })
    const remaining = el('p', { className: 'remaining' })
    const state = el('p', { className: 'state' })
    const next = el('p', { className: 'next' })
    const current = el('section', { className: 'current' })
    current.append(blockName, pct, remaining, state)
    const chart = bars(w, segments, false)
    body.replaceChildren(el('h1', { textContent: w.name }), totalLine, current, next, chart.node)

    return (posMs, running) => {
      const at = locate(segments, posMs)
      put(elapsed, mmss(Math.floor(Math.min(posMs, total * 1000) / 1000)))
      chart.chart.setPlayhead(posMs / 1000)
      const seg = at.segment
      if (!seg) {
        put(blockName, 'Klart!')
        put(pct, '')
        put(remaining, '')
        put(state, '')
        put(next, '')
        return
      }
      const shownPct = Math.round(at.pctNow)
      const zone = zoneFor(shownPct)
      current.style.setProperty('--zone', zone.color)
      current.style.setProperty('--zone-light', zone.textColor)
      put(blockName, seg.name)
      put(pct, `${shownPct} % av FTP`)
      put(remaining, mmss(Math.ceil(at.remainingMs / 1000)))
      put(state, running ? 'kvar av intervallen' : 'Pausad')
      const n = segments[at.index + 1]
      put(next, n ? `Nästa: ${n.name} · ${mmss(n.durationSec)} · ${pctText(n.fromPct, n.toPct)}` : 'Sista blocket')
    }
  }
}
