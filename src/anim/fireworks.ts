// Fyrverkeri när ett hårt block är klart: fem smällar i skärmens övre del under knappt tre sekunder.
// Ljuset hålls nere, som för 3D-bilden: små gnistor, ingen blixt över skärmen och högst 2,5 smällar per sekund.
// Duken ligger mellan 3D-bilden och texten (se .fireworks i styles.css).

const BURSTS = 5
const SPACING_MS = 420 // 1000 / 420 ≈ 2,4 smällar per sekund
const LIFE_MS = 1600
const SPARKS = 130

interface Spark { x: number; y: number; vx: number; vy: number; born: number; life: number; color: string; size: number }

export interface Fireworks {
  launch(colors: string[]): void
  dispose(): void
}

export function createFireworks(): Fireworks {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let sparks: Spark[] = []
  let pending: { at: number; colors: string[] }[] = []
  let frameId = 0
  let last = 0
  let dpr = 1

  function burst(now: number, colors: string[]) {
    const { width: w, height: h } = canvas!
    const cx = w * (0.12 + Math.random() * 0.76)
    const cy = h * (0.12 + Math.random() * 0.38)
    const speed = Math.min(w, h) * 0.75
    for (let i = 0; i < SPARKS; i++) {
      const a = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.15
      const v = speed * (0.3 + Math.random() * 0.7)
      sparks.push({
        x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: now,
        life: LIFE_MS * (0.65 + Math.random() * 0.35), color: colors[i % colors.length], size: (2 + Math.random() * 2.2) * dpr,
      })
    }
  }

  function tick(now: number) {
    const c = ctx!
    const { width: w, height: h } = canvas!
    const dt = Math.min(now - last, 50) / 1000
    last = now
    while (pending.length && pending[0].at <= now) burst(now, pending.shift()!.colors)
    // Förra bilden bleknar i stället för att suddas helt, så att gnistorna drar svansar efter sig.
    c.globalCompositeOperation = 'destination-out'
    c.globalAlpha = 1
    c.fillStyle = 'rgba(0, 0, 0, 0.3)'
    c.fillRect(0, 0, w, h)
    c.globalCompositeOperation = 'lighter'
    const drag = Math.pow(0.2, dt)
    const gravity = Math.min(w, h) * 0.45
    sparks = sparks.filter(s => now - s.born < s.life)
    for (const s of sparks) {
      s.vx *= drag
      s.vy = s.vy * drag + gravity * dt
      s.x += s.vx * dt
      s.y += s.vy * dt
      c.globalAlpha = 1 - (now - s.born) / s.life
      c.fillStyle = s.color
      c.beginPath()
      c.arc(s.x, s.y, s.size, 0, Math.PI * 2)
      c.fill()
    }
    if (sparks.length || pending.length) frameId = requestAnimationFrame(tick)
    else {
      c.clearRect(0, 0, w, h)
      frameId = 0
    }
  }

  return {
    launch(colors) {
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvas.className = 'fireworks'
        document.body.append(canvas)
        ctx = canvas.getContext('2d')
      }
      if (!ctx) return
      dpr = Math.min(devicePixelRatio || 1, 2)
      const [w, h] = [Math.round(innerWidth * dpr), Math.round(innerHeight * dpr)]
      if (canvas.width !== w || canvas.height !== h) [canvas.width, canvas.height] = [w, h]
      const now = performance.now()
      for (let i = 0; i < BURSTS; i++) pending.push({ at: now + i * SPACING_MS, colors })
      pending.sort((a, b) => a.at - b.at)
      if (!frameId) {
        last = now
        frameId = requestAnimationFrame(tick)
      }
    },
    dispose() {
      cancelAnimationFrame(frameId)
      canvas?.remove()
      canvas = ctx = null
      sparks = []
      pending = []
      frameId = 0
    },
  }
}
