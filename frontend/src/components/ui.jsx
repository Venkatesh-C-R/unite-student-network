import { motion } from 'framer-motion'

// The union star: five arms folded red and cream, one centre. Also the favicon (public/favicon.svg).
const STAR_ARMS = [
  [[0, -24], [6, -8], [-6, -8]],
  [[22.8, -7.4], [10, 3], [6, -8]],
  [[14.1, 19.4], [0, 10], [10, 3]],
  [[-14.1, 19.4], [-9, 4], [0, 10]],
  [[-22.8, -7.4], [-6, -8], [-9, 4]],
]

export function Star({ size = 32, className = '', tile = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden="true">
      {tile && <rect width="64" height="64" rx="14" fill="#1E1B16" />}
      <g transform="translate(32 33)">
        {STAR_ARMS.map(([tip, red, cream], i) => (
          <g key={i}>
            <polygon points={`${tip} ${red} 0,0`} fill="#BB2525" />
            <polygon points={`${tip} ${cream} 0,0`} fill="#E9D8B4" />
          </g>
        ))}
        <circle r="3.2" fill="#1E1B16" />
      </g>
    </svg>
  )
}

export function Logo({ size = 32, className = '' }) {
  return <Star size={size} className={className} />
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
