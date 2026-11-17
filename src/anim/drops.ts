// En kort rave-effekt när ett hårt block är klart, i stället för fyrverkeri: som när basen kommer tillbaka i en låt.
// Sex varianter, och en slumpas varje gång (aldrig samma två gånger i rad). Effekten ritas på en duk mellan
// 3D-bilden och texten (se .drop i styles.css); peppordet står i texten ovanpå.
// calm: ljusspärren är på. Då ritas allt svagare, och skärmen varken skakar eller glitchar.

export const DURATION_MS = 2000
export const VARIANTS = ['hyperfart', 'golvvag', 'glitchchock', 'ljudvag', 'equalizer', 'pulsringar'] as const
export type Variant = (typeof VARIANTS)[number]
// Varianter som också skakar eller glitchar hela skärmen (run.ts sätter en klass en kort stund).
export const SCREEN_EFFECT: Partial<Record<Variant, 'quake' | 'glitching'>> = { golvvag: 'quake', glitchchock: 'glitching', hyperfart: 'glitching' }

const CY = 0.3 // ordets höjd på skärmen, ungefär (se .cheer)
const TRAIL = 0.3 // så mycket av förra bilden som suddas varje bildruta: det som rör sig drar en svans efter sig
const TAIL_MS = 450 // efter effekten bleknar svansarna ut så här länge innan duken töms

// Hur starkt effekten lyser över tiden: full styrka första halvan, sedan en mjuk uttoning ned till noll.
export function envelope(p: number): number {
  if (p <= 0.5) return 1
  if (p >= 1) return 0
  return 0.5 * (1 + Math.cos(Math.PI * (p - 0.5) / 0.5))
}
const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - (1 - t) ** 3)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

// Väljer en variant, aldrig samma som förra gången.
export function pickVariant(last: Variant | null, random: () => number = Math.random): Variant {
  const pool = VARIANTS.filter(v => v !== last)
  return pool[Math.floor(random() * pool.length)]
}

type Draw = (g: CanvasRenderingContext2D, w: number, h: number, p: number) => void

// En linje som glöder: bred och svag under, smal och ljus överst. Billigare än canvas-skugga på hela skärmen.
function glowStroke(g: CanvasRenderingContext2D, color: string, width: number, alpha: number) {
  g.strokeStyle = color
  g.globalAlpha = alpha * 0.25
  g.lineWidth = width * 4
  g.stroke()
  g.globalAlpha = alpha
  g.lineWidth = width
  g.stroke()
}

function variant(name: Variant, color: string, light: string): Draw {
  switch (name) {
    // Streck rusar ut från mitten och sexkantiga ringar drar förbi, som i full fart genom en tunnel.
    case 'hyperfart': {
      const stars = Array.from({ length: 220 }, () => ({ a: Math.random() * Math.PI * 2, r: Math.random() * 0.3 }))
      let last = 0
      return (g, w, h, p) => {
        const dt = Math.max(0, p - last)
        last = p
        const speed = p < 0.3 ? ease(p / 0.3) : 1 - 0.8 * ease((p - 0.3) / 0.6)
        const [cx, cy, R] = [w / 2, h * CY, Math.hypot(w, h) * 0.6]
        for (const s of stars) {
          s.r += (0.3 + 2.4 * speed) * dt
          if (s.r > 1) s.r = Math.random() * 0.15
          const r1 = s.r * s.r * R
          const r2 = r1 * (1 + 0.5 * speed)
          g.beginPath()
          g.moveTo(cx + Math.cos(s.a) * r1, cy + Math.sin(s.a) * r1)
          g.lineTo(cx + Math.cos(s.a) * r2, cy + Math.sin(s.a) * r2)
          glowStroke(g, s.r > 0.5 ? light : color, 1 + 2 * s.r, Math.min(1, s.r * 3))
        }
        for (let i = 0; i < 5; i++) {
          const z = (i / 5 + p * 1.6) % 1
          const size = z * z * R
          g.beginPath()
          for (let k = 0; k <= 6; k++) g.lineTo(cx + Math.cos((k / 6) * Math.PI * 2 + 0.5) * size, cy + Math.sin((k / 6) * Math.PI * 2 + 0.5) * size)
          glowStroke(g, color, 2, z * 0.7)
        }
      }
    }
    // En våg reser sig i ett rutnätsgolv under ordet och rullar utåt, som från en högtalare.
    case 'golvvag':
      return (g, w, h, p) => {
        const fadeIn = Math.min(1, p / 0.08) // golvet tänds snabbt i stället för att dyka upp på en bildruta
        const front = ease((p - 0.05) / 0.7) * 1.6
        const horizon = h * 0.4 // golvet ligger mellan ordet och stapelbilden
        const lift = (x: number, z: number) => {
          const d = Math.hypot(x, z * 2.2)
          return Math.exp(-(((d - front) * 4) ** 2)) * (1 - front / 1.8) * h * 0.45
        }
        const at = (x: number, z: number): [number, number] => {
          const s = 1 / (0.3 + z)
          return [w / 2 + x * w * 0.4 * s, horizon + h * 0.09 * s - lift(x, z) * s * 0.45]
        }
        for (let zi = 0; zi <= 16; zi++) {
          const z = zi / 16
          g.beginPath()
          for (let xi = -24; xi <= 24; xi++) g.lineTo(...at(xi / 8, z))
          glowStroke(g, color, 1.4, (0.25 + 0.6 * (1 - z)) * fadeIn)
        }
        for (let xi = -24; xi <= 24; xi += 2) {
          g.beginPath()
          for (let zi = 0; zi <= 16; zi++) g.lineTo(...at(xi / 8, zi / 16))
          glowStroke(g, color, 1, 0.35 * fadeIn)
        }
      }
    // Förskjutna remsor och svepande linjer en kort stund, sedan en blixtring ut från ordet.
    case 'glitchchock':
      return (g, w, h, p) => {
        if (p < 0.25) {
          for (let i = 0; i < 10; i++) {
            g.globalAlpha = 0.35
            g.fillStyle = i % 2 ? color : light
            g.fillRect(Math.random() * w * 0.3 - w * 0.15, Math.random() * h, w * (0.5 + Math.random() * 0.6), 3 + Math.random() * h * 0.03)
          }
        }
        const q = ease((p - 0.18) / 0.7)
        if (q > 0 && q < 1) {
          g.beginPath()
          g.ellipse(w / 2, h * CY, q * w * 0.7, q * h * 0.55, 0, 0, Math.PI * 2)
          glowStroke(g, light, 2 + 10 * (1 - q), (1 - q) * 0.9)
        }
      }
    // En neonlinje tvärs över skärmen slår ut som en basvåg och rullar sedan utåt från mitten.
    case 'ljudvag':
      return (g, w, h, p) => {
        const front = ease(p / 0.7) * 0.6
        for (let line = 0; line < 3; line++) {
          g.beginPath()
          for (let x = 0; x <= w; x += 6) {
            const d = Math.abs(x - w / 2) / w
            const env = Math.exp(-(((d - front) * 7) ** 2)) * (1 - p) + Math.exp(-((d * 9) ** 2)) * Math.max(0, 1 - p * 3)
            const y = h * 0.62 + Math.sin(x * 0.045 - p * 40 + line * 1.3) * env * h * (0.2 - line * 0.05)
            g.lineTo(x, y)
          }
          glowStroke(g, line ? color : light, 2.5 - line * 0.6, (1 - line * 0.25))
        }
      }
    // Staplar längs golvet skjuter upp, från mitten och utåt, och sjunker tillbaka som en spektrumanalysator.
    case 'equalizer': {
      const bars = 48
      const peaks = Array.from({ length: bars }, () => 0.45 + 0.55 * Math.random())
      return (g, w, h, p) => {
        const width = w / bars
        for (let i = 0; i < bars; i++) {
          const d = Math.abs(i + 0.5 - bars / 2) / (bars / 2)
          const t = clamp01((p - d * 0.2) / 0.75)
          const level = Math.sin(t * Math.PI) ** 0.7 * peaks[i]
          const height = level * h * 0.6
          const grad = g.createLinearGradient(0, h, 0, h - height)
          grad.addColorStop(0, color)
          grad.addColorStop(1, light)
          g.globalAlpha = 0.75
          g.fillStyle = grad
          g.fillRect(i * width + width * 0.15, h - height, width * 0.7, height)
        }
      }
    }
    // Neonramar pulserar ut från ordet mot skärmens kanter.
    case 'pulsringar':
      return (g, w, h, p) => {
        for (let i = 0; i < 4; i++) {
          const q = ease((p - i * 0.12) / 0.6)
          if (q <= 0 || q >= 1) continue
          const [rw, rh] = [w * (0.25 + 0.85 * q), h * (0.12 + 0.95 * q)]
          g.beginPath()
          g.roundRect(w / 2 - rw / 2, h * CY - rh / 2, rw, rh, Math.min(rw, rh) * 0.1)
          glowStroke(g, i % 2 ? color : light, 2 + 6 * (1 - q), (1 - q) * 0.9)
        }
      }
  }
}

export interface Drops {
  // Spelar en slumpad variant i blockets färger och säger vilken det blev.
  launch(color: string, light: string, calm: boolean): Variant
  dispose(): void
}

export function createDrops(random: () => number = Math.random): Drops {
  let canvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null
  let frameId = 0
  let last: Variant | null = null

  return {
    launch(color, light, calm) {
      const name = pickVariant(last, random)
      last = name
      if (!canvas) {
        canvas = document.createElement('canvas')
        canvas.className = 'drop'
        document.body.append(canvas)
        ctx = canvas.getContext('2d')
      }
      const g = ctx
      if (!g) return name
      const dpr = Math.min(devicePixelRatio || 1, 1.5) // hela skärmen ritas om varje bildruta
      const [w, h] = [innerWidth, innerHeight]
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      const draw = variant(name, color, light)
      const start = performance.now()
      cancelAnimationFrame(frameId)
      g.clearRect(0, 0, w, h)
      const tick = (now: number) => {
        const p = (now - start) / DURATION_MS
        // Förra bilden bleknar i stället för att suddas helt.
        g.globalCompositeOperation = 'destination-out'
        g.globalAlpha = TRAIL
        g.fillStyle = '#000'
        g.fillRect(0, 0, w, h)
        if (now - start >= DURATION_MS + TAIL_MS) {
          g.globalAlpha = 1
          g.clearRect(0, 0, w, h)
          frameId = 0
          return
        }
        if (p < 1) {
          g.globalCompositeOperation = 'lighter'
          // Varje bild ritas svagare med TRAIL, så att det som står still lyser lika starkt som utan svans.
          // Med ljusspärren lyser allt hälften så starkt.
          draw(withMaxAlpha(g, TRAIL * envelope(p) * (calm ? 0.5 : 1)), w, h, p)
        }
        frameId = requestAnimationFrame(tick)
      }
      frameId = requestAnimationFrame(tick)
      return name
    },
    dispose() {
      cancelAnimationFrame(frameId)
      canvas?.remove()
      canvas = ctx = null
      frameId = 0
    },
  }
}

// Varianterna sätter globalAlpha själva; med ljusspärren skalas varje värde ned i stället för att skrivas över.
function withMaxAlpha(g: CanvasRenderingContext2D, max: number): CanvasRenderingContext2D {
  if (max >= 1) return g
  return new Proxy(g, {
    set(target, key, value) {
      if (key === 'globalAlpha') target.globalAlpha = value * max
      else (target as unknown as Record<string | symbol, unknown>)[key] = value
      return true
    },
    get(target, key) {
      const v = (target as unknown as Record<string | symbol, unknown>)[key]
      return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(target) : v
    },
  })
}
