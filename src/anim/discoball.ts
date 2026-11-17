// Ljusprickar från en discokula som sveper långsamt över skärmen i vila och uppvärmning, så att de lugna blocken också
// har fest. Prickarna tonas in och ut mjukt och blinkar aldrig. Ritas på en duk mellan 3D-bilden och texten
// (se .discoball i styles.css). calm: ljusspärren är på, och prickarna lyser hälften så starkt.

const DOTS = 90
const FADE_TAU_MS = 900
const SPRITE = 64

// Hur synliga prickarna är: följer målet mjukt, så att de tonas in när vilan börjar och ut när det blir hårt.
export function follow(current: number, target: number, dtMs: number): number {
  return current + (target - current) * (1 - Math.exp(-Math.min(dtMs, 100) / FADE_TAU_MS))
}

export interface Discoball {
  // on: om prickarna ska synas. tint: zonens ljusa färg, som prickarnas kant skiftar i.
  draw(on: boolean, tint: string, calm: boolean, nowMs: number): void
  dispose(): void
}

export function createDiscoball(): Discoball {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let shown = 0
  let last = 0
  let spin = 0
  let spriteTint = ''
  const sprite = document.createElement('canvas')
  sprite.width = sprite.height = SPRITE
  const dots = Array.from({ length: DOTS }, () => ({
    a: Math.random() * Math.PI * 2,
    r: 0.15 + Math.random() * 0.85,
    speed: 0.7 + Math.random() * 0.6,
    size: 0.6 + Math.random() * 0.8,
    phase: Math.random() * Math.PI * 2,
  }))

  // En prick: vit kärna som tonar ut i zonens ljusa färg. Ritas en gång per färg och kopieras sedan.
  function paintSprite(tint: string) {
    const g = sprite.getContext('2d')
    if (!g) return
    const c = SPRITE / 2
    const grad = g.createRadialGradient(c, c, 0, c, c, c)
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)')
    grad.addColorStop(0.25, 'rgba(255, 255, 255, 0.8)')
    grad.addColorStop(0.45, tint)
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)')
    g.clearRect(0, 0, SPRITE, SPRITE)
    g.fillStyle = grad
    g.fillRect(0, 0, SPRITE, SPRITE)
    spriteTint = tint
  }

  return {
    draw(on, tint, calm, nowMs) {
      const dt = last ? nowMs - last : 0
      last = nowMs
      shown = follow(shown, on ? 1 : 0, dt)
      if (shown < 0.01 && !on) {
        if (canvas && ctx && shown > 0) ctx.clearRect(0, 0, canvas.width, canvas.height)
        shown = 0
        return
      }
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvas.className = 'discoball'
        document.body.append(canvas)
        ctx = canvas.getContext('2d')
      }
      const g = ctx
      if (!g) return
      if (tint && tint !== spriteTint) paintSprite(tint)
      const dpr = Math.min(devicePixelRatio || 1, 1.5)
      const [w, h] = [innerWidth, innerHeight]
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr)
        canvas.height = Math.round(h * dpr)
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      g.globalCompositeOperation = 'source-over'
      g.globalAlpha = 1
      g.clearRect(0, 0, w, h)
      g.globalCompositeOperation = 'lighter'
      // Kulan hänger ovanför mitten och snurrar sakta; prickarna far i bågar runt den.
      spin += (dt / 1000) * 0.12
      const [cx, cy] = [w / 2, h * 0.35]
      const unit = Math.min(w, h) / 60
      for (const d of dots) {
        const a = d.a + spin * d.speed
        const x = cx + Math.cos(a) * d.r * w * 0.75
        const y = cy + Math.sin(a) * d.r * h * 0.85
        // Prickarna blir lite större och mindre i sin egen takt, som när ljuset glider över speglarna.
        const size = unit * d.size * (0.75 + 0.25 * Math.sin(nowMs / 900 + d.phase))
        g.globalAlpha = shown * (calm ? 0.35 : 0.7)
        g.drawImage(sprite, x - size, y - size, size * 2, size * 2)
      }
    },
    dispose() {
      canvas?.remove()
      canvas = ctx = null
      shown = 0
    },
  }
}
