// Uppbyggnaden de sista tio sekunderna av ett hårt block, som i en låt precis innan basen kommer tillbaka: streck rusar
// mot mitten allt tätare och snabbare, en ring pulserar ut allt oftare och kanterna mörknar. Vid noll tar effekten efter
// intervallen över (drops.ts). Ritas på en duk mellan 3D-bilden och texten (se .buildup i styles.css).
// Ringen pulserar högst 2,5 gånger per sekund. calm: ljusspärren är på, och allt lyser hälften så starkt.

const STREAKS = 60
const RING_SLOW_MS = 1000
const RING_FAST_MS = 400 // 2,5 per sekund

export interface Buildup {
  // k är hur långt uppbyggnaden har kommit, 0 till 1, eller null när den inte ska synas.
  draw(k: number | null, color: string, light: string, calm: boolean, nowMs: number): void
  dispose(): void
}

export function createBuildup(): Buildup {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let shown = false
  let last = 0
  let ringPhase = 0
  const streaks = Array.from({ length: STREAKS }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() }))

  return {
    draw(k, color, light, calm, nowMs) {
      if (k === null) {
        if (shown && canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
        shown = false
        return
      }
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvas.className = 'buildup'
        document.body.append(canvas)
        ctx = canvas.getContext('2d')
      }
      const g = ctx
      if (!g) return
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      const [w, h] = [innerWidth, innerHeight]
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      const dt = shown ? Math.min(nowMs - last, 50) / 1000 : 0
      last = nowMs
      shown = true
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.clearRect(0, 0, w, h)
      const max = calm ? 0.5 : 1
      const [cx, cy, R] = [w / 2, h / 2, Math.hypot(w, h) * 0.55]

      // Kanterna mörknar, så att blicken dras mot mitten.
      const vignette = g.createRadialGradient(cx, cy, h * 0.25, cx, cy, R)
      vignette.addColorStop(0, 'rgba(0, 0, 0, 0)')
      vignette.addColorStop(1, `rgba(0, 0, 0, ${0.55 * k})`)
      g.fillStyle = vignette
      g.fillRect(0, 0, w, h)

      g.globalCompositeOperation = 'lighter'
      // Strecken rusar inåt, fler och snabbare ju närmare noll.
      const active = Math.round(STREAKS * (0.2 + 0.8 * k))
      const speed = 0.35 + 1.6 * k
      for (let i = 0; i < active; i++) {
        const s = streaks[i]
        s.r -= speed * dt
        if (s.r < 0.12) { s.r = 1; s.a = Math.random() * Math.PI * 2 }
        const r1 = s.r * R
        const r2 = r1 + (20 + 70 * k) * (0.5 + s.r)
        g.strokeStyle = i % 3 ? color : light
        g.globalAlpha = max * (0.2 + 0.55 * k) * Math.min(1, (1 - s.r) * 4)
        g.lineWidth = 1 + 2 * k
        g.beginPath()
        g.moveTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1)
        g.lineTo(cx + Math.cos(s.a) * r2, cy + Math.sin(s.a) * r2)
        g.stroke()
      }
      // Ringen pulserar ut från mitten, allt oftare.
      const period = RING_SLOW_MS + (RING_FAST_MS - RING_SLOW_MS) * k
      ringPhase = (ringPhase + (dt * 1000) / period) % 1
      g.strokeStyle = light
      g.globalAlpha = max * (1 - ringPhase) * (0.25 + 0.45 * k)
      g.lineWidth = 2 + 4 * k * (1 - ringPhase)
      g.beginPath()
      g.ellipse(cx, cy, ringPhase * w * 0.45, ringPhase * h * 0.45, 0, 0, Math.PI * 2)
      g.stroke()
    },
    dispose() {
      canvas?.remove()
      canvas = ctx = null
      shown = false
    },
  }
}
