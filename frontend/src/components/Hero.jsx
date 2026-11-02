import { motion } from 'framer-motion'
import { ArrowRight, BadgeCheck, Download, Users, Vote } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { PROGRAMMES } from '../data'
import { scrollToId } from '../hooks/useLenis'
import { btnGhost, btnPrimary, MagneticButton } from './ui'

const NetworkScene = lazy(() => import('./NetworkScene'))

const ease = [0.22, 1, 0.36, 1]
const word = {
  hidden: { opacity: 0, y: 40, rotateX: -60 },
  show: (i) => ({ opacity: 1, y: 0, rotateX: 0, transition: { delay: 0.15 + i * 0.08, duration: 0.8, ease } }),
}

function FloatCard({ className, delay = 0, children }) {
  return (
    <motion.div
      className={`glass absolute rounded-2xl p-4 shadow-2xl shadow-violet-900/20 ${className}`}
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1, y: [0, -12, 0] }}
      transition={{
        opacity: { delay: 0.8 + delay, duration: 0.6 },
        scale: { delay: 0.8 + delay, duration: 0.6 },
        y: { delay: 1.4 + delay, duration: 5 + delay * 2, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {children}
    </motion.div>
  )
}

const GROUP_CHIPS = [
  ['CSE', '#6366F1'],
  ['MECH', '#8B5CF6'],
  ['FT', '#A78BFA'],
  ['MCA', '#22D3EE'],
  ['DS', '#06B6D4'],
  ['VLSI', '#818CF8'],
]

export default function Hero({ onSignIn }) {
  const title = ['Six', 'programmes.', 'One', 'team.']
  return (
    <section id="top" className="relative flex min-h-[100svh] items-center overflow-hidden pt-28 pb-16">
      <div className="mesh" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <div className="grid-overlay pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />

      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass mb-6 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-muted sm:text-sm"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
            </span>
            Built for students of PSG College of Technology
          </motion.div>

          <h1 className="font-display text-5xl leading-[1.02] font-bold tracking-tight sm:text-7xl" style={{ perspective: 800 }}>
            {title.map((w, i) => (
              <motion.span
                key={i}
                custom={i}
                variants={word}
                initial="hidden"
                animate="show"
                className={`mr-3 inline-block ${i % 2 === 1 ? 'text-gradient' : ''}`}
              >
                {w}
              </motion.span>
            ))}
          </h1>

          <motion.p
            className="mt-4 font-display text-lg font-medium text-violet-600 dark:text-violet-300 sm:text-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
          >
            University Network for Interdisciplinary Teamwork and Engagement
          </motion.p>

          <motion.p
            className="mt-5 max-w-xl text-base text-muted sm:text-lg"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.6 }}
          >
            UNITE connects students across programmes into small, mixed teams — up to six members, each from a
            different programme. Make friends, plan with polls, win events together and climb the verified group
            leaderboard.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-wrap gap-3"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.9, duration: 0.6 }}
          >
            <MagneticButton onClick={onSignIn} className={btnPrimary}>
              Get started <ArrowRight size={18} />
            </MagneticButton>
            <MagneticButton onClick={() => scrollToId('downloads')} className={btnGhost}>
              <Download size={18} /> Project resources
            </MagneticButton>
          </motion.div>
        </div>

        <div className="relative h-[420px] sm:h-[520px]">
          <div className="absolute inset-0">
            <Suspense fallback={null}>
              <NetworkScene />
            </Suspense>
          </div>

          <FloatCard className="top-2 left-0 w-56 sm:top-6 sm:-left-4" delay={0}>
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span className="flex items-center gap-1.5 font-semibold text-ink">
                <Users size={14} /> Team Nova
              </span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-semibold text-emerald-500">6 / 6</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {GROUP_CHIPS.map(([p, c]) => (
                <span key={p} className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: c }}>
                  {p}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-muted">Every member from a different programme</p>
          </FloatCard>

          <FloatCard className="right-0 bottom-24 w-52 sm:-right-2 sm:bottom-28" delay={0.4}>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold">
              <Vote size={14} className="text-cyan-400" /> Poll · Meetup day?
            </p>
            {[
              ['Saturday', 4],
              ['Sunday', 2],
            ].map(([d, v]) => (
              <div key={d} className="mb-1.5">
                <div className="mb-0.5 flex justify-between text-[10px] text-muted">
                  <span>{d}</span>
                  <span>{v} votes</span>
                </div>
                <div className="h-1.5 rounded-full bg-violet-500/15">
                  <motion.div
                    className="bg-gradient-brand h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${(v / 6) * 100}%` }}
                    transition={{ delay: 1.6, duration: 1 }}
                  />
                </div>
              </div>
            ))}
          </FloatCard>

          <FloatCard className="bottom-0 left-6 w-60 sm:left-10" delay={0.8}>
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/15 text-emerald-500">
                <BadgeCheck size={20} />
              </span>
              <div>
                <p className="text-sm font-bold">
                  +200 pts <span className="text-xs font-medium text-emerald-500">Verified</span>
                </p>
                <p className="text-[11px] text-muted">1st place · National event (×2.0)</p>
              </div>
            </div>
          </FloatCard>
        </div>
      </div>

      <div className="absolute right-0 bottom-0 left-0 overflow-hidden border-y border-line py-3 [mask-image:linear-gradient(90deg,transparent,#000_10%,#000_90%,transparent)]">
        <div className="marquee flex w-max gap-8 whitespace-nowrap text-sm text-muted">
          {[...PROGRAMMES, ...PROGRAMMES].map((p, i) => (
            <span key={i} className="flex items-center gap-8">
              {p.label}
              <span className="h-1 w-1 rounded-full bg-violet-400" />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
