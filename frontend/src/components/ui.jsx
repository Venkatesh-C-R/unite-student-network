import { motion, useMotionValue, useSpring, useReducedMotion } from 'framer-motion'
import { useRef } from 'react'

export function Logo({ size = 32, className = '' }) {
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [32 + 18 * Math.cos(a), 32 + 18 * Math.sin(a)]
  })
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="logo-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="0.5" stopColor="#8B5CF6" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="url(#logo-g)" />
      ))}
      <circle cx="32" cy="32" r="7" fill="none" stroke="url(#logo-g)" strokeWidth="3" />
    </svg>
  )
}

export function Reveal({ children, delay = 0, y = 32, className = '' }) {
  return (
    <motion.div
      className={`min-w-0 ${className}`}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-80px' }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  )
}

// Soft blurred colour blob to give each section some depth.
export function Glow({ className = '', color = 'bg-violet-600' }) {
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute h-[28rem] w-[28rem] rounded-full opacity-20 blur-[120px] dark:opacity-25 ${color} ${className}`}
    />
  )
}

export function SectionHeading({ eyebrow, title, children, center = true }) {
  return (
    <Reveal className={`mb-14 max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <span className="glass mb-4 inline-block rounded-full px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-violet-600 dark:text-violet-300">
        {eyebrow}
      </span>
      <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-base text-muted sm:text-lg">{children}</p>}
    </Reveal>
  )
}

export function MagneticButton({ as = 'button', className = '', children, strength = 0.35, ...props }) {
  const ref = useRef(null)
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const sx = useSpring(x, { stiffness: 200, damping: 15 })
  const sy = useSpring(y, { stiffness: 200, damping: 15 })
  const Comp = motion[as]

  function onMove(e) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    x.set((e.clientX - (r.left + r.width / 2)) * strength)
    y.set((e.clientY - (r.top + r.height / 2)) * strength)
  }
  function onLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <Comp
      ref={ref}
      style={{ x: sx, y: sy }}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      whileTap={{ scale: 0.96 }}
      data-cursor="hover"
      className={className}
      {...props}
    >
      {children}
    </Comp>
  )
}

export const btnPrimary =
  'bg-gradient-brand inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold text-white shadow-[0_10px_40px_-10px_rgba(139,92,246,0.7)] transition-shadow hover:shadow-[0_10px_50px_-6px_rgba(139,92,246,0.9)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400'
export const btnGhost =
  'glass inline-flex items-center justify-center gap-2 rounded-full px-7 py-3.5 font-semibold text-ink transition-colors hover:border-violet-400 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-violet-400'
