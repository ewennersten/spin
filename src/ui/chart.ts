import { totalDuration } from '../model/flatten'
import type { Segment } from '../model/types'
import { zoneFor } from '../model/zones'

export interface Shape { points: string; fromColor: string; toColor: string }
export interface Chart { setPlayhead(posSec: number | null): void }

// Procenten som bildens övre kant motsvarar: lite över passets högsta procent (8 %, uppåt till jämna 5),
// så att de högsta staplarna fyller bilden. Ett tomt pass får 100.
export function scaleTop(segments: Segment[]): number {
  if (!segments.length) return 100
  return Math.ceil((Math.max(...segments.flatMap(s => [s.fromPct, s.toPct])) * 1.08) / 5) * 5
}

// Skalsteg var 25:e procent, och var 50:e när skalan går över 200, så att etiketterna inte trängs.
// Steget i toppen hoppas över, så att etiketten inte klipps vid övre kanten.
export function scaleTicks(top: number): number[] {
  const step = top > 200 ? 50 : 25
  const ticks = []
  for (let t = step; t < top; t += step) ticks.push(t)
  return ticks
}

export function chartShapes(segments: Segment[], width: number, height: number): Shape[] {
  const total = totalDuration(segments)
  const top = scaleTop(segments)
  const y = (pct: number) => height - pct / top * height
  return segments.map(s => {
    // En enhets luft på var sida, men högst en fjärdedel av blockets bredd, så att ett mycket kort block syns och aldrig får negativ bredd.
    const gap = Math.min(1, s.durationSec / total * width / 4)
    const x0 = s.startSec / total * width + gap
    const x1 = (s.startSec + s.durationSec) / total * width - gap
    return {
      points: `${x0},${height} ${x0},${y(s.fromPct)} ${x1},${y(s.toPct)} ${x1},${height}`,
      fromColor: zoneFor(s.fromPct).color,
      toColor: zoneFor(s.toPct).color,
    }
  })
}

const NS = 'http://www.w3.org/2000/svg'
const W = 1000
const H = 200
const FLOOR = 44 // spegelgolvet under staplarna
// Flera bilder kan finnas på samma sida, så varje bild får egna id:n på övertoningarna.
let nextChartId = 0

function el(tag: string, attrs: Record<string, string | number>): SVGElement {
  const e = document.createElementNS(NS, tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v))
  return e
}

// En ram med skalans kolumn till vänster och bilden till höger. Ramen får storleken, bilden fyller resten.
export function chartFrame(svg: SVGSVGElement): { frame: HTMLElement; scale: HTMLElement } {
  const frame = document.createElement('div')
  frame.className = 'chart-frame'
  const scale = document.createElement('div')
  scale.className = 'scale'
  scale.setAttribute('aria-hidden', 'true')
  frame.append(scale, svg)
  return { frame, scale }
}

// Med scale ritas linjer var 25:e procent i bilden och etiketterna i scale, som står bredvid bilden (se chartFrame).
// mirror: false tar bort spegelgolvet, så att staplarna står ända nere vid bildens underkant (passkärmen).
export function renderChart(svg: SVGSVGElement, segments: Segment[], scale?: HTMLElement, { mirror: withFloor = true } = {}): Chart {
  const floor = withFloor ? FLOOR : 0
  svg.replaceChildren()
  svg.setAttribute('viewBox', `0 0 ${W} ${H + floor}`)
  svg.setAttribute('preserveAspectRatio', 'none')

  const chartId = nextChartId++
  const id = (name: string) => `chart-${chartId}-${name}`
  const defs = el('defs', {})
  svg.append(defs)
  const grad = (name: string, attrs: Record<string, number>, stops: [number, string, number][]) => {
    const g = el('linearGradient', { id: id(name), ...attrs })
    for (const [offset, color, opacity] of stops) g.append(el('stop', { offset, 'stop-color': color, 'stop-opacity': opacity }))
    defs.append(g)
    return `url(#${id(name)})`
  }
  const DOWN = { x1: 0, y1: 0, x2: 0, y2: 1 }
  // Frostat glas: färgen är svag upptill och full nere vid golvet, där ljuset sitter.
  const frost = el('mask', { id: id('frost'), maskContentUnits: 'objectBoundingBox' })
  frost.append(el('rect', { width: 1, height: 1, fill: grad('frost-fill', DOWN, [[0, '#ffffff', 0.5], [0.6, '#ffffff', 0.8], [1, '#ffffff', 1]]) }))
  defs.append(frost)
  const floorLight = grad('floor-light', DOWN, [[0.45, '#ffffff', 0], [1, '#ffffff', 0.35]])
  const beatLight = grad('beat-light', DOWN, [[0.3, '#ffffff', 0], [1, '#ffffff', 1]])
  // Spegelgolvet: staplarna speglas suddigt och tonar bort nedåt.
  const blur = el('filter', { id: id('blur') })
  blur.append(el('feGaussianBlur', { stdDeviation: 4 }))
  const fade = el('mask', { id: id('fade') })
  fade.append(el('rect', { x: 0, y: H, width: W, height: FLOOR, fill: grad('fade-fill', DOWN, [[0, '#ffffff', 0.8], [1, '#ffffff', 0]]) }))
  defs.append(blur, fade)
  const reflection = el('g', { mask: `url(#${id('fade')})` })
  const mirror = el('g', { filter: `url(#${id('blur')})` })
  reflection.append(mirror)
  if (withFloor) svg.append(reflection, el('line', { x1: 0, y1: H, x2: W, y2: H, stroke: '#ffffff', 'stroke-opacity': 0.3, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }))
  // Det avklarade mörknar bara på staplarna och speglingen, så att bakgrunden bakom bilden (under passet animationen) syns orörd.
  const clipId = id('bars')
  const clip = el('clipPath', { id: clipId })
  defs.append(clip)
  const bars = chartShapes(segments, W, H).map((shape, i) => {
    const mirrored = shape.points.split(' ').map(p => { const [x, y] = p.split(','); return `${x},${2 * H - Number(y)}` }).join(' ')
    clip.append(el('polygon', { points: shape.points }), el('polygon', { points: mirrored }))
    let fill = shape.fromColor
    if (shape.toColor !== shape.fromColor) {
      // Utan x1/x2 går en linearGradient vågrätt över formens bredd.
      fill = grad(`${i}`, {}, [[0, shape.fromColor, 1], [1, shape.toColor, 1]])
    }
    // Stapelns övre kant (andra och tredje hörnet) får en ljus linje i zonens ljusa färg. Glow är ljuset nere vid
    // golvet som slår i takt på stapeln som pågår (se styles.css).
    const [, from, to] = shape.points.split(' ')
    const edge = zoneFor(segments[i].toPct).textColor
    // color ger glöden zonens färg, --i ordningen när staplarna växer fram i biblioteket.
    const bar = el('g', { class: 'bar', color: shape.toColor, style: `--i: ${i}` })
    bar.append(
      el('polygon', { points: shape.points, fill, mask: `url(#${id('frost')})` }),
      el('polygon', { points: shape.points, fill: floorLight }),
      el('polygon', { points: shape.points, fill: beatLight, opacity: 0, class: 'glow' }),
      el('polygon', { points: shape.points, fill: 'none', stroke: edge, 'stroke-opacity': 0.5, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }),
      el('polyline', { points: `${from} ${to}`, fill: 'none', stroke: edge, 'stroke-width': 2.5, 'vector-effect': 'non-scaling-stroke' }),
    )
    svg.append(bar)
    mirror.append(el('polygon', { points: mirrored, fill, class: 'bar-reflection', style: `--i: ${i}` }))
    return bar
  })

  // Ett snett ljussken sveper över glaset då och då (se styles.css).
  const sweep = el('g', { 'clip-path': `url(#${clipId})` })
  const skew = el('g', { transform: 'skewX(-22)' })
  skew.append(el('rect', { class: 'sweep', x: 0, y: 0, width: 70, height: H + floor, fill: grad('sweep', { x1: 0, y1: 0, x2: 1, y2: 0 }, [[0, '#ffffff', 0], [0.5, '#ffffff', 0.22], [1, '#ffffff', 0]]) }))
  sweep.append(skew)
  svg.append(sweep)

  if (scale) {
    const top = scaleTop(segments)
    // Etiketterna är vanlig text bredvid bilden, eftersom text i bilden skulle tänjas ut med den.
    scale.replaceChildren(...scaleTicks(top).map(t => {
      const y = H - t / top * H
      // Linjen är en bildpunkt tjock oavsett hur mycket bilden tänjs. FTP-linjen är ljusare.
      svg.append(el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#fff6f4', 'stroke-opacity': t === 100 ? 0.6 : 0.22, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }))
      const label = document.createElement('span')
      label.textContent = `${t} %`
      label.style.top = `${y / (H + floor) * 100}%`
      if (t === 100) label.className = 'ftp'
      return label
    }))
  }

  const dim = el('rect', { x: 0, y: 0, width: 0, height: H + floor, fill: '#000000', opacity: 0.6, display: 'none', 'clip-path': `url(#${clipId})` })
  const line = el('line', { x1: 0, y1: 0, x2: 0, y2: H, stroke: '#fff6f4', 'stroke-width': 4, display: 'none' })
  svg.append(dim, line)

  const total = totalDuration(segments)
  let now = -1
  return {
    setPlayhead(posSec) {
      const show = posSec !== null && total > 0
      dim.setAttribute('display', show ? 'inline' : 'none')
      line.setAttribute('display', show ? 'inline' : 'none')
      const i = posSec !== null && total > 0 ? segments.findIndex(s => posSec < s.startSec + s.durationSec) : -1
      if (i !== now) {
        bars[now]?.classList.remove('now')
        bars[i]?.classList.add('now')
        now = i
      }
      if (!show) return
      const x = Math.min(Math.max(posSec, 0), total) / total * W
      dim.setAttribute('width', String(x))
      // Linjen är 4 enheter bred, så dess mitt hålls inom 2 till 998 för att den ska synas hel vid kanterna.
      const lineX = String(Math.min(Math.max(x, 2), W - 2))
      line.setAttribute('x1', lineX)
      line.setAttribute('x2', lineX)
    },
  }
}
