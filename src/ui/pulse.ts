// Pulsmätaren i sidhuvudet: en ljus punkt sveper från vänster till höger och åker upp och ned i varje hjärtslag.
// Den ritar kurvan efter sig, den äldre kurvan bleknar, och framför punkten suddas en lucka, som på en riktig
// pulsmätare. Ett slag per 240 bildpunkter i 480 bildpunkter per sekund ger 120 slag per minut.

export const PERIOD = 240
const SPEED = 480
const HEIGHT = 110
const BASE = 64 // nollinjen, uppifrån
const GAP = 46 // luckan framför punkten
const FADE_PER_S = 0.45

// Ett EKG-slag som hörn (avstånd in i slaget, höjd över nollinjen nedåt räknat). Raka linjer mellan hörnen.
const WAVE: [number, number][] = [
  [0, 0], [60, 0], [75, -8], [90, 0], [110, 0], [118, 10], [128, -52], [140, 32], [150, 0], [170, 0], [190, -12], [215, 0], [240, 0],
]

// Kurvans höjd (bildpunkter nedåt från nollinjen) efter d bildpunkter.
export function waveY(d: number): number {
  const p = ((d % PERIOD) + PERIOD) % PERIOD
  for (let i = 1; i < WAVE.length; i++) {
    const [x1, y1] = WAVE[i]
    if (p <= x1) {
      const [x0, y0] = WAVE[i - 1]
      return y0 + ((y1 - y0) * (p - x0)) / (x1 - x0)
    }
  }
  return 0
}

export function pulseLine(): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'pulse'
  wrap.ariaHidden = 'true'
  const canvas = document.createElement('canvas')
  const dot = document.createElement('span')
  dot.className = 'pulse-dot'
  wrap.append(canvas, dot)

  const still = matchMedia('(prefers-reduced-motion: reduce)').matches
  let ctx: CanvasRenderingContext2D | null = null
  let width = 0
  let x = 0 // punktens plats på skärmen
  let dist = 0 // hur långt kurvan har gått totalt, för var i slaget punkten är
  let last = 0

  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 2)
    width = wrap.clientWidth
    canvas.width = Math.round(width * dpr)
    canvas.height = HEIGHT * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${HEIGHT}px`
    ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.scale(dpr, dpr)
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    if (still) {
      // Minskade rörelser: hela kurvan står still och punkten visas inte.
      ctx.beginPath()
      for (let s = 0; s <= width; s += 2) ctx.lineTo(s, BASE + waveY(s))
      ctx.stroke()
    }
  }

  function tick(now: number) {
    if (!wrap.isConnected) {
      if (last) return // sidhuvudet har tagits bort: sluta rita
      requestAnimationFrame(tick)
      return
    }
    if (wrap.clientWidth !== width) size()
    const c = ctx
    if (!c || still) return
    const dt = last ? Math.min(now - last, 50) / 1000 : 0
    last = now
    // Den äldre kurvan bleknar sakta.
    c.globalCompositeOperation = 'destination-out'
    c.fillStyle = `rgba(0, 0, 0, ${FADE_PER_S * dt})`
    c.fillRect(0, 0, width, HEIGHT)
    c.globalCompositeOperation = 'source-over'
    // Ny bit av kurvan, två bildpunkter i taget så att topparna blir spetsiga.
    const step = SPEED * dt
    c.beginPath()
    c.moveTo(x, BASE + waveY(dist))
    for (let s = 2; s <= step; s += 2) c.lineTo(x + s, BASE + waveY(dist + s))
    c.lineTo(x + step, BASE + waveY(dist + step))
    c.stroke()
    x += step
    dist += step
    if (x > width) {
      x -= width
      c.beginPath() // nytt svep från vänster kanten
    }
    // Luckan framför punkten, även runt hörnet till vänster kanten.
    c.clearRect(x + 3, 0, GAP, HEIGHT)
    if (x + 3 + GAP > width) c.clearRect(0, 0, x + 3 + GAP - width, HEIGHT)
    dot.style.transform = `translate(${x}px, ${BASE + waveY(dist)}px)`
    requestAnimationFrame(tick)
  }

  dot.hidden = still
  requestAnimationFrame(tick)
  return wrap
}
