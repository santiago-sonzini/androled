"use client"
import { useEffect, useRef } from "react"

interface MagicMIntroProps {
  onComplete: () => void
  /** duración total en ms — default 3000 */
  duration?: number
}

// Path real del glifo "M" de Dancing Script (weight 700, unitsPerEm 1000)
// extraído con fontTools. Coordenadas en espacio de fuente (Y hacia arriba).
const M_GLYPH_PATH =
  "M1320 1861 c-99 -20 -177 -105 -230 -249 -72 -199 -110 -459 -117 -807 -5 -261 5 -379 42 -504 29 -96 105 -141 154 -92 23 23 28 59 36 261 6 161 27 408 45 545 25 185 78 476 90 488 9 10 52 -127 130 -408 90 -325 152 -486 231 -602 60 -87 156 -91 238 -11 83 83 114 163 232 615 41 156 76 283 79 283 3 0 14 -218 23 -485 18 -520 19 -528 75 -603 26 -35 58 -48 91 -37 21 6 21 7 21 739 l0 733 -29 39 c-34 49 -65 69 -111 76 -42 6 -132 -15 -165 -40 -43 -32 -30 7 -236 -695 -51 -174 -96 -314 -100 -310 -4 5 -66 222 -138 483 -144 519 -146 524 -231 568 -45 23 -69 25 -130 13z"

interface Particle {
  x: number; y: number
  vx: number; vy: number
  life: number; maxLife: number
  r: number
  color: string
}

const COLORS = ["#f1a8c6", "#d76a98", "#ff8fc0", "#fce4ef", "#fff"]

export default function MagicMIntro({ onComplete, duration = 3000 }: MagicMIntroProps) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const svgPathRef = useRef<SVGPathElement>(null)
  const fillRef    = useRef<SVGPathElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const burstFired = useRef(false)
  const rafRef     = useRef<number>(0)
  const onCompleteRef = useRef(onComplete);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => {
    const canvas  = canvasRef.current
    const svgPath = svgPathRef.current
    const fill    = fillRef.current
    const wrapper = wrapperRef.current
    if (!canvas || !svgPath || !fill || !wrapper) return

    const ctx = canvas.getContext("2d")!

    const resize = () => {
      canvas.width  = canvas.offsetWidth  * devicePixelRatio
      canvas.height = canvas.offsetHeight * devicePixelRatio
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    }
    resize()

    const totalLength = svgPath.getTotalLength()
    svgPath.style.strokeDasharray  = String(totalLength)
    svgPath.style.strokeDashoffset = String(totalLength)

    // Convierte un punto del espacio del SVG al espacio del canvas overlay
    const svg = svgPath.ownerSVGElement!
    const svgToCanvas = (pt: DOMPoint): [number, number] => {
      const ctm = svgPath.getScreenCTM()
      if (!ctm) return [0, 0]
      const screen = pt.matrixTransform(ctm)
      const rect = canvas.getBoundingClientRect()
      return [screen.x - rect.left, screen.y - rect.top]
    }

    const particles: Particle[] = []
    const startTime = performance.now()
    const drawDuration = duration * 0.8
    let done = false

    const spawnParticles = (x: number, y: number) => {
      const n = 3 + Math.floor(Math.random() * 3)
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = 0.4 + Math.random() * 1.2
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          life: 1,
          maxLife: 0.6 + Math.random() * 0.6,
          r: 1.2 + Math.random() * 2.2,
          color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        })
      }
    }

    const loop = (now: number) => {
      const elapsed = now - startTime
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight)

      const t = Math.min(elapsed / drawDuration, 1)
      // ease in-out global
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t

      // ── Revelar el contorno de la M con dashoffset ──
      svgPath.style.strokeDashoffset = String(totalLength * (1 - eased))

      // ── Fill aparece gradualmente en el último tramo ──
      const fillAlpha = Math.max(0, (eased - 0.65) / 0.35)
      fill.style.opacity = String(fillAlpha * 0.9)

      // ── Dot siguiendo el path real ──
      if (t < 1) {
        const svgPt = svgPath.getPointAtLength(eased * totalLength)
        const dompt = new DOMPoint(svgPt.x, svgPt.y)
        const [dotX, dotY] = svgToCanvas(dompt)

        spawnParticles(dotX, dotY)

        // Glow exterior
        const grd = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 22)
        grd.addColorStop(0,   "rgba(241,168,198,0.55)")
        grd.addColorStop(0.4, "rgba(215,106,152,0.25)")
        grd.addColorStop(1,   "rgba(215,106,152,0)")
        ctx.fillStyle = grd
        ctx.beginPath()
        ctx.arc(dotX, dotY, 22, 0, Math.PI * 2)
        ctx.fill()

        // Dot sólido
        ctx.save()
        ctx.fillStyle = "#ff8fc0"
        ctx.shadowColor = "#f1a8c6"
        ctx.shadowBlur  = 12
        ctx.beginPath()
        ctx.arc(dotX, dotY, 5.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()

        // Core blanco
        ctx.fillStyle = "#fff"
        ctx.beginPath()
        ctx.arc(dotX, dotY, 2.2, 0, Math.PI * 2)
        ctx.fill()
      }

      // ── Partículas ──
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]!
        p.x += p.vx; p.y += p.vy
        p.vy += 0.04
        p.life -= 1 / (p.maxLife * 60)
        if (p.life <= 0) { particles.splice(i, 1); continue }
        ctx.save()
        ctx.globalAlpha = p.life * 0.9
        ctx.fillStyle   = p.color
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.restore()
      }

      // ── Final: explosión sutil de partículas + fade out ──
      if (t >= 1 && !done) {
        const fadeT = Math.min((elapsed - drawDuration) / (duration - drawDuration), 1)

        // El stroke se funde con el fill para que quede la M sólida fucsia
        svgPath.style.stroke = "#e84a9b"

        // Explosión una sola vez al llegar al final
        if (!burstFired.current) {
          burstFired.current = true
          const rect = canvas.getBoundingClientRect()
          const cx = rect.width / 2
          const cy = rect.height / 2
          for (let i = 0; i < 36; i++) {
            const angle = (i / 36) * Math.PI * 2 + Math.random() * 0.3
            const speed = 1.2 + Math.random() * 2.4
            particles.push({
              x: cx, y: cy,
              vx: Math.cos(angle) * speed,
              vy: Math.sin(angle) * speed - 0.5,
              life: 1,
              maxLife: 0.9 + Math.random() * 0.8,
              r: 1.5 + Math.random() * 2.5,
              color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
            })
          }
        }

        // Fade out de toda la pantalla
        if (fadeT > 0.45) {
          wrapper.style.opacity = String(1 - Math.min((fadeT - 0.45) / 0.55, 1))
        }

        if (fadeT >= 1) {
          done = true
          cancelAnimationFrame(rafRef.current)
          onCompleteRef.current();
          return;
                  
        }
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [duration])

  return (
    <div
      ref={wrapperRef}
      style={{
        position:        "fixed",
        inset:           0,
        zIndex:          100,
        background:      "radial-gradient(ellipse at 50% 40%, rgba(124,28,100,0.55) 0%, rgba(60,20,90,0.7) 40%, #0c0920 100%)",
        display:         "flex",
        alignItems:      "center",
        justifyContent:  "center",
        transition:      "opacity .1s linear",
      }}>
      <div style={{
        position:    "relative",
        width:       "min(78vw, 360px)",
        aspectRatio: "1",
      }}>
        {/* SVG con el glifo real de Dancing Script.
            viewBox abarca el glifo: x -40..830, y -120..760 (espacio fuente, Y invertida con transform) */}
        <svg
          viewBox="66.6 6.2 209.9 209.9"
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}
        >
          <g transform="translate(0,214) scale(0.1,-0.1)">
            {/* Fill rosa — aparece al final */}
            <path
              ref={fillRef}
              d={M_GLYPH_PATH}
              fill="#e84a9b"
              opacity="0"
            />
            {/* Contorno que se revela con dashoffset */}
            <path
              ref={svgPathRef}
              d={M_GLYPH_PATH}
              fill="none"
              stroke="#f1a8c6"
              strokeWidth="10"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ filter: "drop-shadow(0 0 8px rgba(241,168,198,0.7))" }}
            />
          </g>
        </svg>

        {/* Canvas overlay para dot + partículas */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            inset:    "-25%",
            width:    "150%",
            height:   "150%",
            pointerEvents: "none",
          }}
        />
      </div>
    </div>
  )
}