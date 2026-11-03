import { motion } from 'framer-motion'
import { useEffect } from 'react'

const RAYS = [
  [0, 0, 14, 0],
  [50, 0, 64, 0],
  [64, 22, 64, 34],
  [0, 22, 0, 34],
]
const STAR = '32,6 35,15 44.5,15 36.8,20.6 39.7,29.6 32,24 24.3,29.6 27.2,20.6 19.5,15 29,15'

// Poster-style intro: an open book, a star rising over it and the rays breaking out behind.
export default function Loader({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <motion.div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center overflow-hidden bg-[#1E1B16]"
      exit={{ opacity: 0, transition: { duration: 0.6, ease: 'easeInOut' } }}
      role="status"
      aria-label="Loading UNITE"
    >
      <motion.svg
        viewBox="0 0 64 64"
        className="h-40 w-40 overflow-visible"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        aria-hidden="true"
      >
        <rect width="64" height="64" rx="14" fill="#BB2525" />
        {RAYS.map(([x1, y1, x2, y2], i) => (
          <motion.polygon
            key={i}
            points={`32,30 ${x1},${y1} ${x2},${y2}`}
            fill="#9A1916"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.9 + i * 0.08, duration: 0.4 }}
          />
        ))}
        <motion.polygon
          points={STAR}
          fill="#F2C14E"
          stroke="#1E1B16"
          strokeWidth="1.8"
          strokeLinejoin="round"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.45, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        />
        <motion.g
          style={{ transformOrigin: '32px 47px' }}
          initial={{ scaleX: 0.15 }}
          animate={{ scaleX: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        >
          <path
            d="M8 38 Q20 33 32 39 Q44 33 56 38 V56 Q44 51 32 57 Q20 51 8 56 Z"
            fill="#E9D8B4"
            stroke="#1E1B16"
            strokeWidth="2.5"
            strokeLinejoin="round"
          />
          <line x1="32" y1="39" x2="32" y2="57" stroke="#1E1B16" strokeWidth="2.5" />
        </motion.g>
      </motion.svg>
      <motion.h1
        className="mt-8 pl-[0.35em] font-display text-4xl font-bold text-[#E9D8B4] sm:text-5xl"
        initial={{ opacity: 0, y: 16, letterSpacing: '0.6em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0.35em' }}
        transition={{ delay: 1.2, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        UNITE
      </motion.h1>
      <motion.p
        className="mt-3 px-6 text-center text-sm font-semibold tracking-wide text-[#E9D8B4]/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.6 }}
      >
        Students of all programmes, unite!
      </motion.p>
      <div className="mt-8 h-1 w-48 overflow-hidden rounded-full bg-white/10">
        <motion.div
          className="h-full bg-[#BB2525]"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{ duration: 2.2, ease: 'easeInOut' }}
        />
      </div>
    </motion.div>
  )
}
