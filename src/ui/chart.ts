import { totalDuration } from '../model/flatten'
import type { Segment } from '../model/types'
import { zoneFor } from '../model/zones'

export interface Shape { points: string; fromColor: string; toColor: string }
export interface Chart { setPlayhead(posSec: number | null): void }

// Procenten som bildens övre kant motsvarar.
const scaleTop = (segments: Segment[]) => Math.max(120, ...segments.flatMap(s => [s.fromPct, s.toPct]))

// Skalsteg var 25:e procent. Steget i toppen hoppas över, så att etiketten inte klipps vid övre kanten.
export function scaleTicks(top: number): number[] {
  const ticks = []
  for (let t = 25; t < top; t += 25) ticks.push(t)
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
export function renderChart(svg: SVGSVGElement, segments: Segment[], scale?: HTMLElement): Chart {
  svg.replaceChildren()
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`)
  svg.setAttribute('preserveAspectRatio', 'none')

  const chartId = nextChartId++
  const defs = el('defs', {})
  svg.append(defs)
  chartShapes(segments, W, H).forEach((shape, i) => {
    let fill = shape.fromColor
    if (shape.toColor !== shape.fromColor) {
      const id = `chart-${chartId}-${i}`
      // Utan x1/x2 går en linearGradient vågrätt över formens bredd.
      const grad = el('linearGradient', { id })
      grad.append(el('stop', { offset: 0, 'stop-color': shape.fromColor }), el('stop', { offset: 1, 'stop-color': shape.toColor }))
      defs.append(grad)
      fill = `url(#${id})`
    }
    svg.append(el('polygon', { points: shape.points, fill }))
  })

  if (scale) {
    const top = scaleTop(segments)
    // Etiketterna är vanlig text bredvid bilden, eftersom text i bilden skulle tänjas ut med den.
    scale.replaceChildren(...scaleTicks(top).map(t => {
      const y = H - t / top * H
      // Linjen är en bildpunkt tjock oavsett hur mycket bilden tänjs. FTP-linjen är ljusare.
      svg.append(el('line', { x1: 0, y1: y, x2: W, y2: y, stroke: '#fff6f4', 'stroke-opacity': t === 100 ? 0.6 : 0.22, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }))
      const label = document.createElement('span')
      label.textContent = `${t} %`
      label.style.top = `${y / H * 100}%`
      if (t === 100) label.className = 'ftp'
      return label
    }))
  }

  const dim = el('rect', { x: 0, y: 0, width: 0, height: H, fill: '#000000', opacity: 0.6, display: 'none' })
  const line = el('line', { x1: 0, y1: 0, x2: 0, y2: H, stroke: '#fff6f4', 'stroke-width': 4, display: 'none' })
  svg.append(dim, line)

  const total = totalDuration(segments)
  return {
    setPlayhead(posSec) {
      const show = posSec !== null && total > 0
      dim.setAttribute('display', show ? 'inline' : 'none')
      line.setAttribute('display', show ? 'inline' : 'none')
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
