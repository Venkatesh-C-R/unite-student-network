import { motion } from 'framer-motion'
import { GraduationCap } from 'lucide-react'
import { TEAM } from '../data'
import { Reveal, SectionHeading } from './ui'

function initials(name) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
}

export default function Team() {
  return (
    <section id="team" className="relative px-5 py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHeading title={<>The people <span className="text-gradient">behind UNITE</span></>}>
          MCA, Department of Computer Applications, PSG College of Technology · 26MX17 Web Application Development ·
          2026–2027
        </SectionHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {TEAM.map((m, i) => (
            <Reveal key={m.roll} delay={i * 0.1}>
              <motion.div whileHover={{ y: -6 }} className="glass rounded-3xl p-7 text-center">
                <div className="bg-gradient-brand mx-auto grid h-20 w-20 place-items-center rounded-full p-[3px]">
                  <span className="grid h-full w-full place-items-center rounded-full bg-[var(--bg)] font-display text-2xl font-bold">
                    {initials(m.name)}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{m.name}</h3>
                <p className="text-sm text-muted">{m.roll}</p>
              </motion.div>
            </Reveal>
          ))}
        </div>
        <Reveal delay={0.2}>
          <div className="glass gradient-border mx-auto mt-6 flex max-w-md items-center gap-4 rounded-3xl p-6">
            <span className="bg-gradient-brand grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-white">
              <GraduationCap size={26} />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-widest text-muted uppercase">Faculty guide</p>
              <p className="font-display text-lg font-semibold">Dr. V. Umarani</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
