import { animate, motion, useInView } from 'framer-motion'
import { Check, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { PROGRAMMES } from '../data'
import { Glow, Reveal, SectionHeading } from './ui'

function Counter({ to, suffix = '' }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!inView) return
    const c = animate(0, to, { duration: 1.6, ease: 'easeOut', onUpdate: (x) => setV(Math.round(x)) })
    return () => c.stop()
  }, [inView, to])
  return (
    <span ref={ref}>
      {v}
      {suffix}
    </span>
  )
}

const STATS = [
  { value: 6, label: 'Max members per group' },
  { value: PROGRAMMES.length, label: 'Eligible programmes' },
  { value: 1, label: 'Student per programme, per group' },
  { value: 3, label: 'Event tiers: College, State, National' },
]

const BEFORE = [
  'Teams form only inside one class or programme',
  'Hard to find a designer, a coder and a domain expert together',
  'Wins and certificates stay scattered and unverified',
  'Meetups are planned in noisy chat threads',
]
const AFTER = [
  'Groups mix up to six different programmes by design',
  'Discover students by interests and connect with a request',
  'Results are backed by proof and verified by faculty',
  'Groups decide meetups and plans with simple polls',
]

export default function About() {
  return (
    <section id="about" className="relative px-5 py-28">
      <Glow className="top-40 -left-48" color="bg-indigo-600" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading eyebrow="Why UNITE" title={<>Great ideas happen <span className="text-gradient">between</span> disciplines</>}>
          Most student teams are built from one classroom. UNITE helps you meet people from other programmes and build
          teams that bring different skills to the table.
        </SectionHeading>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} delay={i * 0.08}>
              <div className="glass gradient-border rounded-3xl p-6 text-center">
                <p className="text-gradient font-display text-5xl font-bold">
                  <Counter to={s.value} />
                </p>
                <p className="mt-2 text-sm text-muted">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
          <Reveal>
            <div className="glass h-full rounded-3xl p-8">
              <h3 className="mb-5 font-display text-xl font-semibold text-muted">Without UNITE</h3>
              <ul className="space-y-4">
                {BEFORE.map((t) => (
                  <li key={t} className="flex gap-3 text-muted">
                    <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-rose-500/15 text-rose-400">
                      <X size={14} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          <Reveal delay={0.1}>
            <motion.div
              whileHover={{ y: -4 }}
              className="glass gradient-border h-full rounded-3xl p-8 shadow-[0_20px_80px_-30px_rgba(139,92,246,0.6)]"
            >
              <h3 className="mb-5 font-display text-xl font-semibold">
                With <span className="text-gradient">UNITE</span>
              </h3>
              <ul className="space-y-4">
                {AFTER.map((t) => (
                  <li key={t} className="flex gap-3">
                    <span className="bg-gradient-brand mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-white">
                      <Check size={14} />
                    </span>
                    {t}
                  </li>
                ))}
              </ul>
            </motion.div>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
