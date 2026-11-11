import { motion } from 'framer-motion'
import { BadgeCheck, Crown, Medal, Trophy, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import { Empty, Skeleton, SlotDots } from '../components/app/kit'
import { useToast } from '../context'
import { HOST_CATEGORIES, POSITIONS } from '../data'
import { formatPoints } from '../lib/format'
import { btn } from '../lib/styles'

const PODIUM = [
  // display order: 2nd, 1st, 3rd
  { place: 2, height: 'h-28', tint: 'from-slate-300 to-slate-500', delay: 0.15 },
  { place: 1, height: 'h-40', tint: 'from-amber-300 to-amber-500', delay: 0 },
  { place: 3, height: 'h-20', tint: 'from-orange-300 to-orange-600', delay: 0.3 },
]

function Podium({ rows, mine }) {
  const top = rows.slice(0, 3)
  return (
    <div className="grid grid-cols-3 items-end gap-3 sm:gap-6">
      {PODIUM.map(({ place, height, tint, delay }) => {
        const g = top[place - 1]
        if (!g) return <div key={place} />
        return (
          <motion.div
            key={place}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay, type: 'spring', stiffness: 160, damping: 18 }}
            className="flex min-w-0 flex-col items-center text-center"
          >
            {place === 1 && <Crown size={28} className="mb-1 text-amber-400" />}
            <Link to={`/groups/${g.id}`} className="w-full min-w-0 truncate font-display text-sm font-semibold hover:underline sm:text-lg">
              {g.name}
            </Link>
            <p className="text-gradient font-display text-xl font-bold sm:text-3xl">{formatPoints(g.points)}</p>
            <p className="mb-2 text-[11px] text-muted sm:text-xs">points</p>
            <motion.div
              initial={{ scaleY: 0 }}
              animate={{ scaleY: 1 }}
              transition={{ delay: delay + 0.2, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              style={{ originY: 1 }}
              className={`relative w-full ${height} rounded-t-2xl bg-gradient-to-b ${tint} ${mine.has(g.id) ? 'ring-4 ring-violet-400' : ''}`}
            >
              <span className="absolute inset-x-0 top-2 font-display text-3xl font-bold text-white/90">{place}</span>
            </motion.div>
          </motion.div>
        )
      })}
    </div>
  )
}

export default function LeaderboardPage() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [mine, setMine] = useState(new Set())

  useEffect(() => {
    api('/leaderboard')
      .then((d) => setRows(d.leaderboard))
      .catch((e) => toast(e.message, 'error'))
    api('/groups/mine')
      .then((d) => setMine(new Set(d.groups.map((g) => g.id))))
      .catch(() => {})
  }, [toast])

  const max = Math.max(1, ...(rows || []).map((r) => Number(r.points)))
  const ranked = (rows || []).filter((r) => Number(r.points) > 0)
  const unranked = (rows || []).filter((r) => Number(r.points) === 0)

  return (
    <div className="space-y-10">
      <section className="text-center">
        <span className="glass mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold tracking-widest text-violet-600 uppercase dark:text-violet-300">
          <Trophy size={14} /> Union leaderboard
        </span>
        <h1 className="font-display text-3xl font-bold sm:text-5xl">
          Teams that <span className="text-gradient">win together</span>
        </h1>
        <p className="mx-auto mt-2 max-w-xl text-muted">Unions are ranked by verified points. Only results approved by faculty count.</p>
      </section>

      {!rows ? (
        <Skeleton className="h-72" />
      ) : ranked.length === 0 ? (
        <Empty icon={Trophy} title="No verified points yet" action={<Link to="/claims" className={btn.primary}>Submit a result</Link>}>
          Once faculty approve a union’s first result, it appears here.
        </Empty>
      ) : (
        <>
          <section className="glass rounded-[2rem] px-4 pt-8 sm:px-10">
            <Podium rows={ranked} mine={mine} />
          </section>

          <section aria-labelledby="rank-h">
            <h2 id="rank-h" className="sr-only">
              All rankings
            </h2>
            <ol className="space-y-3">
              {ranked.map((g, i) => {
                const isMine = mine.has(g.id)
                return (
                  <motion.li
                    key={g.id}
                    initial={{ opacity: 0, x: -16 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: Math.min(i, 10) * 0.04 }}
                  >
                    <Link
                      to={`/groups/${g.id}`}
                      className={`glass flex items-center gap-4 rounded-2xl p-4 transition hover:border-violet-400/60 ${isMine ? 'border-violet-400/70 shadow-[0_0_0_1px_rgba(139,92,246,0.5)]' : ''}`}
                    >
                      <span
                        className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-lg font-bold ${
                          g.rank === 1 ? 'bg-gradient-brand text-white' : g.rank <= 3 ? 'bg-amber-400/15 text-amber-500' : 'bg-violet-500/10 text-muted'
                        }`}
                      >
                        {g.rank <= 3 ? <Medal size={18} /> : g.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2 truncate font-semibold">
                          {g.name}
                          {isMine && <span className="rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-500">Your union</span>}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted">
                          <span className="flex items-center gap-1.5">
                            <SlotDots count={g.memberCount} size={7} /> {g.memberCount}/6
                          </span>
                          <span className="flex items-center gap-1">
                            <BadgeCheck size={13} /> {g.wins} verified
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-violet-500/10">
                          <motion.div
                            className="bg-gradient-brand h-full rounded-full"
                            initial={{ width: 0 }}
                            whileInView={{ width: `${(Number(g.points) / max) * 100}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.9 }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-right">
                        <span className="block font-display text-xl font-bold">{formatPoints(g.points)}</span>
                        <span className="text-[11px] text-muted">pts</span>
                      </span>
                    </Link>
                  </motion.li>
                )
              })}
            </ol>
            {unranked.length > 0 && (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                <Users size={15} /> {unranked.length} more union{unranked.length > 1 ? 's' : ''} without verified points yet.
              </p>
            )}
          </section>
        </>
      )}

      <section className="glass rounded-3xl p-6">
        <h2 className="font-display text-lg font-semibold">How points work</h2>
        <p className="mt-1 text-sm text-muted">
          Base points by result, multiplied by who hosted the event. When unions enter an event together, every union in the team receives the full points.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-sm">
            <thead>
              <tr className="text-left text-muted">
                <th className="py-2 font-medium">Result</th>
                {HOST_CATEGORIES.map((c) => (
                  <th key={c.key} className="py-2 text-right font-medium">
                    {c.label} ×{c.multiplier.toFixed(1)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {POSITIONS.map((p) => (
                <tr key={p.key} className="border-t border-line">
                  <td className="py-1.5">{p.label}</td>
                  {HOST_CATEGORIES.map((c) => (
                    <td key={c.key} className="py-1.5 text-right tabular-nums">
                      {formatPoints(p.base * c.multiplier)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}
