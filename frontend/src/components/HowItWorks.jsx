import { motion, useScroll, useSpring } from 'framer-motion'
import { useRef } from 'react'
import { STEPS } from '../data'
import { Reveal, SectionHeading } from './ui'

export default function HowItWorks() {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 100, damping: 25 })

  return (
    <section id="how" className="relative px-5 py-28">
      <div className="mx-auto max-w-4xl">
        <SectionHeading eyebrow="How it works" title={<>From sign-up to the <span className="text-gradient">leaderboard</span></>} />

        <div ref={ref} className="relative">
          <div className="absolute top-0 bottom-0 left-6 w-0.5 bg-violet-500/15 sm:left-1/2 sm:-translate-x-1/2" />
          <motion.div
            className="bg-gradient-brand absolute top-0 bottom-0 left-6 w-0.5 origin-top sm:left-1/2 sm:-translate-x-1/2"
            style={{ scaleY: fill }}
          />
          <ol className="space-y-12">
            {STEPS.map((s, i) => {
              const right = i % 2 === 1
              return (
                <motion.li
                  key={s.title}
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true, margin: '-80px' }}
                  className="relative grid grid-cols-1 items-center sm:grid-cols-2 sm:gap-16"
                >
                  <motion.span
                    variants={{ hidden: { scale: 0 }, show: { scale: 1 } }}
                    transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                    className="bg-gradient-brand absolute top-1/2 left-6 z-10 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full font-display font-bold text-white shadow-lg shadow-violet-500/40 ring-4 ring-[var(--bg)] sm:left-1/2"
                  >
                    {i + 1}
                  </motion.span>
                  <Reveal className={`pl-16 sm:pl-0 ${right ? 'sm:col-start-2' : 'sm:text-right'}`} y={20}>
                    <div className="glass rounded-3xl p-6">
                      <h3 className="font-display text-lg font-semibold">{s.title}</h3>
                      <p className="mt-1.5 text-sm text-muted">{s.body}</p>
                    </div>
                  </Reveal>
                </motion.li>
              )
            })}
          </ol>
        </div>
      </div>
    </section>
  )
}
