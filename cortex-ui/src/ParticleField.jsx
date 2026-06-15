import { useEffect, useRef } from 'react'

const NODE_COUNT = 65
const MAX_DIST = 155
const NODE_RGB = '217,119,87'
const NODE_LIGHT_RGB = '232,168,130'

export default function ParticleField() {
  const canvasRef = useRef(null)
  const stateRef = useRef({ nodes: [], mouse: { x: -9999, y: -9999 }, raf: null })

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const state = stateRef.current

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      state.nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 1.5 + 0.7,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.6,
      }))
    }

    function onMouseMove(e) {
      state.mouse.x = e.clientX
      state.mouse.y = e.clientY
    }

    function tick() {
      const { nodes, mouse } = state
      const t = Date.now() * 0.001
      const w = canvas.width
      const h = canvas.height

      ctx.clearRect(0, 0, w, h)

      nodes.forEach(n => {
        n.x += n.vx + Math.sin(t * n.speed + n.phase) * 0.18
        n.y += n.vy + Math.cos(t * n.speed + n.phase) * 0.18
        if (n.x < 0) n.x = w
        if (n.x > w) n.x = 0
        if (n.y < 0) n.y = h
        if (n.y > h) n.y = 0
      })

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x
          const dy = nodes[i].y - nodes[j].y
          const d = Math.sqrt(dx * dx + dy * dy)
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.22
            ctx.beginPath()
            ctx.moveTo(nodes[i].x, nodes[i].y)
            ctx.lineTo(nodes[j].x, nodes[j].y)
            ctx.strokeStyle = `rgba(${NODE_RGB},${alpha})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        }
      }

      // Nodes
      nodes.forEach(n => {
        const mdx = n.x - mouse.x
        const mdy = n.y - mouse.y
        const md = Math.sqrt(mdx * mdx + mdy * mdy)
        const influence = Math.max(0, 1 - md / 180)
        const radius = n.r + influence * 2.5
        const alpha = 0.45 + influence * 0.55

        // Glow ring
        const grd = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, radius * 7)
        grd.addColorStop(0, `rgba(${NODE_RGB},${0.12 + influence * 0.2})`)
        grd.addColorStop(1, `rgba(${NODE_RGB},0)`)
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius * 7, 0, Math.PI * 2)
        ctx.fillStyle = grd
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(${NODE_LIGHT_RGB},${alpha})`
        ctx.fill()
      })

      state.raf = requestAnimationFrame(tick)
    }

    resize()
    window.addEventListener('resize', resize)
    window.addEventListener('mousemove', onMouseMove)
    tick()

    return () => {
      cancelAnimationFrame(state.raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMouseMove)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
