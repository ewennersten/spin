import { totalDuration } from '../model/flatten'
import type { Segment } from '../model/types'
import { zoneFor } from '../model/zones'

export interface Shape { points: string; fromColor: string; toColor: string }
export interface Chart { setPlayhead(posSec: number | null): void }

export function chartShapes(segments: Segment[], width: number, height: number): Shape[] {
  const total = totalDuration(segments)
  const top = Math.max(120, ...segments.flatMap(s => [s.fromPct, s.toPct]))
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

export function renderChart(svg: SVGSVGElement, segments: Segment[]): Chart {
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

  const dim = el('rect', { x: 0, y: 0, width: 0, height: H, fill: '#0b0b0b', opacity: 0.6, display: 'none' })
  const line = el('line', { x1: 0, y1: 0, x2: 0, y2: H, stroke: '#f1efe8', 'stroke-width': 4, display: 'none' })
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
