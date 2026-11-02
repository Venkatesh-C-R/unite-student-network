import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { BadgeCheck, Search, ShieldCheck, Trophy, UserRound, Users, Vote } from 'lucide-react'
import { Reveal, SectionHeading } from './ui'

const FEATURES = [
  { icon: Users, title: 'Interdisciplinary groups', body: 'Create or join a group of up to six — one student from each programme. Every join is checked on the server, so the rules can’t be broken.', span: 'lg:col-span-2' },
  { icon: UserRound, title: 'Simple profiles', body: 'Just About, Interests and Links — add GitHub, LinkedIn, LeetCode or any URL you like.' },
  { icon: Search, title: 'Discover & connect', body: 'Search students by programme and interests, then send a friend request. Friends can be from any programme.' },
  { icon: Vote, title: 'Group polls', body: 'Decide meetups, roles and plans together. One vote per member, per poll.' },
  { icon: Trophy, title: 'Group leaderboard', body: 'Points scale with where the event was hosted: College, State or National.' },
  { icon: BadgeCheck, title: 'Verified achievements', body: 'Submit your result with a certificate or proof. Faculty approve or reject — only verified wins count.', span: 'lg:col-span-2' },
  { icon: ShieldCheck, title: 'Campus-only & safe', body: 'Sign up with your PSG email. Report or block anyone, any time.' },
]

function TiltCard({ f, i }) {
  const mx = useMotionValue(0.5)
  const my = useMotionValue(0.5)
  const rx = useSpring(useTransform(my, [0, 1], [8, -8]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [0, 1], [-8, 8]), { stiffness: 200, damping: 20 })
  const glow = useTransform([mx, my], ([x, y]) => `radial-gradient(400px circle at ${x * 100}% ${y * 100}%, rgba(139,92,246,0.18), transparent 60%)`)
  const Icon = f.icon

  return (
    <Reveal delay={(i % 3) * 0.08} className={f.span || ''}>
      <motion.div
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          mx.set((e.clientX - r.left) / r.width)
          my.set((e.clientY - r.top) / r.height)
        }}
        onMouseLeave={() => {
          mx.set(0.5)
          my.set(0.5)
        }}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
        className="glass group relative h-full overflow-hidden rounded-3xl p-7"
        data-cursor="hover"
      >
        <motion.div className="pointer-events-none absolute inset-0" style={{ background: glow }} />
        <div className="bg-gradient-brand relative mb-5 grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg shadow-violet-500/30">
          <Icon size={22} />
        </div>
        <h3 className="relative font-display text-xl font-semibold">{f.title}</h3>
        <p className="relative mt-2 text-muted">{f.body}</p>
      </motion.div>
    </Reveal>
  )
}

export default function Features() {
  return (
    <section id="features" className="relative px-5 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading eyebrow="Features" title={<>Everything a team needs, <span className="text-gradient">nothing it doesn’t</span></>}>
          No feeds, no noise. Just the tools to meet the right people, work together and get credit for it.
        </SectionHeading>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <TiltCard key={f.title} f={f} i={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
