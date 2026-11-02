import { motion } from 'framer-motion'
import { useEffect } from 'react'

const COLORS = ['#4F46E5', '#6366F1', '#8B5CF6', '#A78BFA', '#22D3EE', '#06B6D4']

// Six programme dots start scattered, gather into a hexagon (one group), then reveal the logo.
export default function Loader({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#070B1F]"
      exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
      role="status"
      aria-label="Loading UNITE"
    >
      <div className="relative h-40 w-40">
        {COLORS.map((c, i) => {
          const a = (Math.PI / 3) * i - Math.PI / 2
          const tx = Math.cos(a) * 52
          const ty = Math.sin(a) * 52
          const fromX = Math.cos(a + 1.3) * 260
          const fromY = Math.sin(a + 1.3) * 260
          return (
            <motion.span
              key={i}
              className="absolute top-1/2 left-1/2 -mt-3 -ml-3 h-6 w-6 rounded-full"
              style={{ background: c, boxShadow: `0 0 24px ${c}` }}
              initial={{ x: fromX, y: fromY, opacity: 0, scale: 0.4 }}
              animate={{ x: tx, y: ty, opacity: 1, scale: 1 }}
              transition={{ duration: 0.9, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            />
          )
        })}
        <motion.span
          className="absolute top-1/2 left-1/2 -mt-6 -ml-6 h-12 w-12 rounded-full border-[3px] border-violet-400"
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1.0, duration: 0.5, type: 'spring' }}
        />
        <motion.span
          className="absolute inset-0 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.45), transparent 65%)' }}
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1.6, opacity: [0, 1, 0] }}
          transition={{ delay: 1.1, duration: 1.1 }}
        />
      </div>
      <motion.h1
        className="text-gradient mt-8 pl-[0.35em] font-display text-4xl font-bold sm:text-5xl"
        initial={{ opacity: 0, y: 16, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.35em' }}
        transition={{ delay: 1.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        UNITE
      </motion.h1>
      <motion.p
        className="mt-3 px-6 text-center text-sm text-slate-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        Six programmes. One team.
      </motion.p>
      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="bg-gradient-brand h-full"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  )
}
