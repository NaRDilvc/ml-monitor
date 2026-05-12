import { useEffect, useRef } from 'react'

const COLORS = ['#6366f1', '#00d4ff', '#22c55e', '#a78bfa', '#f59e0b']

export default function ParticleBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx    = canvas.getContext('2d')
    let animId

    const resize = () => {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    // ── Particles ──────────────────────────────────────────────
    const COUNT = Math.min(70, Math.floor(window.innerWidth / 20))
    const particles = Array.from({ length: COUNT }, () => {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      return {
        x:       Math.random() * canvas.width,
        y:       Math.random() * canvas.height,
        vx:      (Math.random() - 0.5) * 0.45,
        vy:      (Math.random() - 0.5) * 0.45,
        r:       Math.random() * 1.6 + 0.4,
        alpha:   Math.random() * 0.55 + 0.2,
        color,
      }
    })

    // ── Shooting stars ─────────────────────────────────────────
    const stars   = []
    let starTimer = 0

    function spawnStar() {
      const color = Math.random() > 0.5 ? '#6366f1' : '#00d4ff'
      stars.push({
        x:     Math.random() * canvas.width * 0.6,
        y:     Math.random() * canvas.height * 0.4,
        vx:    Math.random() * 4 + 3,
        vy:    Math.random() * 2 + 0.5,
        trail: Math.random() * 90 + 50,
        alpha: 0.9,
        color,
      })
    }

    // ── Ripples ────────────────────────────────────────────────
    const ripples = []
    let rippleTimer = 0

    function spawnRipple() {
      const color = COLORS[Math.floor(Math.random() * COLORS.length)]
      ripples.push({
        x:     Math.random() * canvas.width,
        y:     Math.random() * canvas.height,
        r:     0,
        maxR:  Math.random() * 80 + 40,
        alpha: 0.25,
        color,
      })
    }

    // ── Draw loop ──────────────────────────────────────────────
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      /* --- particle movement --- */
      particles.forEach(p => {
        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1

        ctx.save()
        ctx.shadowBlur  = 7
        ctx.shadowColor = p.color
        ctx.globalAlpha = p.alpha
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()
        ctx.restore()
      })

      /* --- connection lines --- */
      const DIST = 130
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx   = particles[i].x - particles[j].x
          const dy   = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          if (dist < DIST) {
            const op = (1 - dist / DIST) * 0.18
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.strokeStyle = `rgba(99,102,241,${op})`
            ctx.lineWidth   = 0.6
            ctx.stroke()
          }
        }
      }

      /* --- shooting stars --- */
      starTimer++
      if (starTimer > 140 && stars.length < 4) {
        spawnStar()
        starTimer = 0
      }
      for (let i = stars.length - 1; i >= 0; i--) {
        const s = stars[i]
        const tailX = s.x - (s.vx / Math.sqrt(s.vx ** 2 + s.vy ** 2)) * s.trail
        const tailY = s.y - (s.vy / Math.sqrt(s.vx ** 2 + s.vy ** 2)) * s.trail
        const grad  = ctx.createLinearGradient(s.x, s.y, tailX, tailY)
        grad.addColorStop(0, s.color + 'cc')
        grad.addColorStop(1, 'transparent')
        ctx.save()
        ctx.globalAlpha = s.alpha
        ctx.shadowBlur  = 12
        ctx.shadowColor = s.color
        ctx.beginPath()
        ctx.moveTo(s.x, s.y)
        ctx.lineTo(tailX, tailY)
        ctx.strokeStyle = grad
        ctx.lineWidth   = 1.8
        ctx.stroke()
        ctx.restore()
        s.x     += s.vx
        s.y     += s.vy
        s.alpha -= 0.007
        if (s.alpha <= 0 || s.x > canvas.width + 50 || s.y > canvas.height + 50) {
          stars.splice(i, 1)
        }
      }

      /* --- ripples --- */
      rippleTimer++
      if (rippleTimer > 200 && ripples.length < 5) {
        spawnRipple()
        rippleTimer = 0
      }
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i]
        rp.r     += 0.6
        rp.alpha -= 0.0025
        ctx.save()
        ctx.globalAlpha = rp.alpha
        ctx.beginPath()
        ctx.arc(rp.x, rp.y, rp.r, 0, Math.PI * 2)
        ctx.strokeStyle = rp.color
        ctx.lineWidth   = 1
        ctx.stroke()
        ctx.restore()
        if (rp.alpha <= 0 || rp.r >= rp.maxR) ripples.splice(i, 1)
      }

      animId = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width:  '100vw',
        height: '100vh',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
