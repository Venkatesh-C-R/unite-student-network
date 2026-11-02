import { AnimatePresence, motion } from 'framer-motion'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { FAQS } from '../data'
import { Reveal, SectionHeading } from './ui'

export default function Faq() {
  const [open, setOpen] = useState(0)
  return (
    <section id="faq" className="relative px-5 py-28">
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="FAQ" title={<>Questions, <span className="text-gradient">answered</span></>} />
        <div className="space-y-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i
            return (
              <Reveal key={f.q} delay={i * 0.04} y={16}>
                <div className={`glass overflow-hidden rounded-2xl transition-colors ${isOpen ? 'border-violet-400/60' : ''}`}>
                  <button
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold"
                    aria-expanded={isOpen}
                  >
                    {f.q}
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isOpen ? 'bg-gradient-brand text-white' : 'bg-violet-500/10'}`}
                    >
                      <Plus size={16} />
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                      >
                        <p className="px-6 pb-5 text-muted">{f.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
