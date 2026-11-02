import { AnimatePresence, motion, useScroll, useMotionValueEvent } from 'framer-motion'
import { ArrowUp } from 'lucide-react'
import { useState } from 'react'
import { scrollToId } from '../hooks/useLenis'

// Round button with a progress ring; appears after the first screen.
export default function BackToTop() {
  const { scrollY, scrollYProgress } = useScroll()
  const [show, setShow] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setShow(y > window.innerHeight))

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          initial={{ opacity: 0, scale: 0.6, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 20 }}
          whileHover={{ y: -3 }}
          onClick={() => scrollToId('top')}
          className="glass fixed right-5 bottom-5 z-40 grid h-12 w-12 place-items-center rounded-full shadow-lg shadow-violet-900/20"
          aria-label="Back to top"
        >
          <svg className="absolute inset-0 -rotate-90" viewBox="0 0 48 48" aria-hidden="true">
            <motion.circle cx="24" cy="24" r="22" fill="none" stroke="url(#btt-g)" strokeWidth="2.5" style={{ pathLength: scrollYProgress }} />
            <defs>
              <linearGradient id="btt-g">
                <stop offset="0" stopColor="#4F46E5" />
                <stop offset="1" stopColor="#06B6D4" />
              </linearGradient>
            </defs>
          </svg>
          <ArrowUp size={18} />
        </motion.button>
      )}
    </AnimatePresence>
  )
}
