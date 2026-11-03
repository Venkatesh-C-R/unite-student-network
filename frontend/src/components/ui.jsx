import { motion } from 'framer-motion'

export function Logo({ size = 32, className = '' }) {
  const dots = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i - Math.PI / 2
    return [32 + 18 * Math.cos(a), 32 + 18 * Math.sin(a)]
  })
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      {dots.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r="5" fill="var(--accent)" />
      ))}
      <circle cx="32" cy="32" r="7" fill="none" stroke="var(--accent)" strokeWidth="3" />
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

// Kept so callers stay unchanged; the flat PSG look has no background glows
export function Glow() {
  return null
}

export function SectionHeading({ title, children, center = true }) {
  return (
    <Reveal className={`mb-14 max-w-3xl ${center ? 'mx-auto text-center' : ''}`}>
      <h2 className="font-display text-3xl font-bold leading-tight sm:text-5xl">{title}</h2>
      {children && <p className="mt-4 text-base text-muted sm:text-lg">{children}</p>}
    </Reveal>
  )
}

// Plain button kept under its old name so callers stay unchanged
export function MagneticButton({ as = 'button', className = '', children, ...props }) {
  const Comp = as
  return (
    <Comp className={className} {...props}>
      {children}
    </Comp>
  )
}

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-violet-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-violet-600'
export const btnGhost =
  'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-surface px-6 py-3 font-semibold text-ink transition-colors hover:border-violet-500'
