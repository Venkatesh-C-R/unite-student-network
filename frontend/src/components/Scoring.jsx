import { animate, LayoutGroup, motion } from 'framer-motion'
import { Building2, Crown, Landmark, MapPin, Medal } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { DEMO_GROUPS, HOST_CATEGORIES, POSITIONS, points } from '../data'
import { Reveal, SectionHeading } from './ui'

const CAT_ICONS = { college: Building2, state: MapPin, national: Landmark }

function AnimatedNumber({ value }) {
  const [shown, setShown] = useState(value)
  const prev = useRef(value)
  useEffect(() => {
    const c = animate(prev.current, value, { duration: 0.6, ease: 'easeOut', onUpdate: setShown })
    prev.current = value
    return () => c.stop()
  }, [value])
  return <>{Number.isInteger(value) ? Math.round(shown) : shown.toFixed(1)}</>
}

function Calculator() {
  const [cat, setCat] = useState('national')
  const [pos, setPos] = useState('1')
  const position = POSITIONS.find((p) => p.key === pos)
  const category = HOST_CATEGORIES.find((c) => c.key === cat)
  const total = points(pos, cat)

  return (
    <div className="glass h-full rounded-[2rem] p-6 sm:p-8">
      <h3 className="font-display text-2xl font-semibold">Points calculator</h3>
      <p className="mt-1 text-sm text-muted">The host institution decides the category — not the venue or the event name.</p>

      <p className="mt-6 mb-2 text-sm font-semibold">Who hosted the event?</p>
      <LayoutGroup id="cat">
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-violet-500/10 p-1.5">
          {HOST_CATEGORIES.map((c) => {
            const Icon = CAT_ICONS[c.key]
            const active = c.key === cat
            return (
              <button
                key={c.key}
                onClick={() => setCat(c.key)}
                className={`relative rounded-xl px-2 py-3 text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-muted hover:text-ink'}`}
                aria-pressed={active}
              >
                {active && <motion.span layoutId="cat-pill" className="bg-gradient-brand absolute inset-0 rounded-xl" />}
                <span className="relative flex flex-col items-center gap-1">
                  <Icon size={18} />
                  {c.label}
                  <span className="text-[11px] font-medium opacity-80">×{c.multiplier.toFixed(1)}</span>
                </span>
              </button>
            )
          })}
        </div>
      </LayoutGroup>
      <p className="mt-2 text-xs text-muted">{category.hint}</p>

      <label htmlFor="pos" className="mt-6 mb-2 block text-sm font-semibold">
        Result
      </label>
      <select
        id="pos"
        value={pos}
        onChange={(e) => setPos(e.target.value)}
        className="w-full rounded-2xl border border-line bg-surface-strong px-4 py-3.5 text-ink outline-none focus:border-violet-400"
      >
        {POSITIONS.map((p) => (
          <option key={p.key} value={p.key}>
            {p.label} — base {p.base}
          </option>
        ))}
      </select>

      <div className="mt-6 flex items-end justify-between gap-4 rounded-2xl bg-violet-500/10 p-5">
        <div className="text-sm text-muted">
          {position.base} base × {category.multiplier.toFixed(1)}
          <p className="text-xs">after faculty verification</p>
        </div>
        <p className="text-gradient font-display text-5xl font-bold">
          <AnimatedNumber value={total} />
          <span className="ml-1 text-lg">pts</span>
        </p>
      </div>

      <p className="mt-6 mb-3 text-sm font-semibold">
        {position.label} at each level
      </p>
      <div className="space-y-2.5">
        {HOST_CATEGORIES.map((c) => {
          const v = points(pos, c.key)
          const active = c.key === cat
          return (
            <button key={c.key} onClick={() => setCat(c.key)} className="flex w-full items-center gap-3 text-left text-sm">
              <span className={`w-16 shrink-0 ${active ? 'font-semibold' : 'text-muted'}`}>{c.label}</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-violet-500/10">
                <motion.span
                  className={`block h-full rounded-full ${active ? 'bg-gradient-brand' : 'bg-violet-500/35'}`}
                  animate={{ width: `${(v / 200) * 100}%` }}
                  transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                />
              </span>
              <span className={`w-12 shrink-0 text-right tabular-nums ${active ? 'font-semibold' : 'text-muted'}`}>
                {v % 1 ? v.toFixed(1) : v}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

function Leaderboard() {
  const [view, setView] = useState('total')
  const rows = [...DEMO_GROUPS].sort((a, b) =>
    view === 'total' ? b.total - a.total : b.programmes.length - a.programmes.length || b.total - a.total,
  )
  const max = Math.max(...DEMO_GROUPS.map((g) => g.total))

  return (
    <div className="glass h-full rounded-[2rem] p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-2xl font-semibold">Union leaderboard</h3>
          <p className="mt-1 text-sm text-muted">Unions are ranked, not individuals.</p>
        </div>
        <span className="rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-500">
          Demo data
        </span>
      </div>
      <div className="mt-5 flex gap-2 text-xs">
        {[
          ['total', 'By points'],
          ['size', 'By programmes'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => setView(k)}
            className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${view === k ? 'bg-gradient-brand text-white' : 'glass text-muted'}`}
          >
            {l}
          </button>
        ))}
      </div>
      <ol className="mt-5 space-y-3">
        {rows.map((g, i) => (
          <motion.li
            layout
            key={g.name}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="rounded-2xl border border-line bg-surface-strong p-4"
          >
            <div className="flex items-center gap-3">
              <span
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl font-display font-bold ${
                  i === 0 ? 'bg-gradient-brand text-white' : 'bg-violet-500/10 text-muted'
                }`}
              >
                {i === 0 ? <Crown size={16} /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{g.name}</p>
                <p className="truncate text-xs text-muted">
                  {g.programmes.length}/6 · {g.programmes.join(', ')}
                </p>
              </div>
              <p className="font-display text-lg font-bold">{g.total % 1 ? g.total.toFixed(1) : g.total}</p>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-violet-500/10">
              <motion.div
                className="bg-gradient-brand h-full rounded-full"
                initial={{ width: 0 }}
                whileInView={{ width: `${(g.total / max) * 100}%` }}
                viewport={{ once: true }}
                transition={{ duration: 1, delay: i * 0.1 }}
              />
            </div>
          </motion.li>
        ))}
      </ol>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
        <Medal size={14} /> Fictional unions for illustration. Only verified results earn points.
      </p>
    </div>
  )
}

export default function Scoring() {
  return (
    <section id="scoring" className="relative px-5 py-28">
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading title={<>Fair points, <span className="text-gradient">verified</span> wins</>}>
          1st place earns 100 base points, down to 10 for taking part. The host institution then multiplies it.
        </SectionHeading>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Reveal>
            <Calculator />
          </Reveal>
          <Reveal delay={0.1}>
            <Leaderboard />
          </Reveal>
        </div>
      </div>
    </section>
  )
}
