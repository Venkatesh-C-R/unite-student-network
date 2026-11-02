import { motion, useMotionValue, useSpring } from 'framer-motion'
import { useEffect, useState } from 'react'

// Glowing dot + ring that follows the mouse. Only on fine pointers without reduced motion.
export default function Cursor() {
  const [enabled] = useState(
    () =>
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [hover, setHover] = useState(false)
  const x = useMotionValue(-100)
  const y = useMotionValue(-100)
  const rx = useSpring(x, { stiffness: 300, damping: 28, mass: 0.5 })
  const ry = useSpring(y, { stiffness: 300, damping: 28, mass: 0.5 })

  useEffect(() => {
    if (!enabled) return
    document.documentElement.classList.add('has-custom-cursor')
    const move = (e) => {
      x.set(e.clientX)
      y.set(e.clientY)
      const t = e.target.closest?.('a, button, select, input, label, [data-cursor="hover"]')
      setHover(Boolean(t))
    }
    window.addEventListener('mousemove', move)
    return () => {
      window.removeEventListener('mousemove', move)
      document.documentElement.classList.remove('has-custom-cursor')
    }
  }, [enabled, x, y])

  if (!enabled) return null
  return (
    <>
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[90] h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400"
        style={{ x, y }}
      />
      <motion.div
        className="pointer-events-none fixed top-0 left-0 z-[90] -translate-x-1/2 -translate-y-1/2 rounded-full border border-violet-400/70"
        style={{ x: rx, y: ry }}
        animate={{
          width: hover ? 56 : 32,
          height: hover ? 56 : 32,
          backgroundColor: hover ? 'rgba(139,92,246,0.15)' : 'rgba(139,92,246,0)',
        }}
        transition={{ duration: 0.2 }}
      />
    </>
  )
}
