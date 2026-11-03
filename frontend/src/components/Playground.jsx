import { AnimatePresence, motion, useAnimation } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { MAX_GROUP_SIZE, PROGRAMMES } from '../data'
import { Glow, Reveal, SectionHeading } from './ui'

const COLORS = ['#C8231F', '#D8A227', '#9A1916', '#E2703A', '#6B5E4A', '#B3201E']
const NAMES = ['Aarav', 'Diya', 'Kavin', 'Meera', 'Rahul', 'Sneha', 'Arjun', 'Nila', 'Vikram', 'Priya']

// Interactive demo of the core rule: at most six members, one per programme.
export default function Playground() {
  const [members, setMembers] = useState([
    { id: 1, name: 'Aarav', programme: PROGRAMMES[3] },
    { id: 2, name: 'Diya', programme: PROGRAMMES[12] },
  ])
  const [choice, setChoice] = useState(String(PROGRAMMES[21].id))
  const [msg, setMsg] = useState({ ok: true, text: 'Pick a programme and add a student. Try adding the same programme twice, or a 7th member.' })
  const shake = useAnimation()

  function add() {
    const programme = PROGRAMMES.find((p) => String(p.id) === choice)
    if (members.length >= MAX_GROUP_SIZE) {
      reject(`Rejected: the union already has ${MAX_GROUP_SIZE} members. Team up with another union for bigger events.`)
      return
    }
    const clash = members.find((m) => m.programme.id === programme.id)
    if (clash) {
      reject(`Rejected: ${clash.name} is already the ${programme.label} member. One student per programme.`)
      return
    }
    const name = NAMES.find((n) => !members.some((m) => m.name === n))
    setMembers((m) => [...m, { id: Date.now(), name, programme }])
    const sameSubject = members.find((m) => m.programme.name === programme.name)
    setMsg({
      ok: true,
      text: sameSubject
        ? `Accepted: ${programme.label} and ${sameSubject.programme.label} are different programmes, so both can join.`
        : `Accepted: ${name} joins from ${programme.label}. ${
            members.length + 1 === MAX_GROUP_SIZE ? 'The union is now full.' : `${MAX_GROUP_SIZE - members.length - 1} slot(s) left.`
          }`,
    })
  }

  function reject(text) {
    setMsg({ ok: false, text })
    shake.start({ x: [0, -12, 12, -8, 8, 0], transition: { duration: 0.45 } })
  }

  const slots = Array.from({ length: MAX_GROUP_SIZE }, (_, i) => members[i])

  return (
    <section id="playground" className="relative px-5 py-28">
      <Glow className="top-1/4 -right-48" color="bg-cyan-500" />
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading title={<>The <span className="text-gradient">six-programme</span> rule, live</>}>
          Build a demo group. UNITE accepts up to six students, and never two from the same programme — just like the
          real server will.
        </SectionHeading>

        <Reveal>
          <div className="glass gradient-border grid grid-cols-1 gap-8 rounded-[2rem] p-5 sm:p-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="min-w-0">
              <label htmlFor="prog" className="mb-2 block text-sm font-semibold">
                Programme of the new student
              </label>
              <select
                id="prog"
                value={choice}
                onChange={(e) => setChoice(e.target.value)}
                className="w-full rounded-2xl border border-line bg-surface-strong px-4 py-3.5 text-ink outline-none focus:border-violet-400"
              >
                {['BE/BTech', 'BSc', 'ME/MTech', 'MSc', 'MCA'].map((lvl) => (
                  <optgroup key={lvl} label={lvl}>
                    {PROGRAMMES.filter((p) => p.level === lvl).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>

              <div className="mt-4 flex flex-wrap gap-3">
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={add}
                  className="bg-gradient-brand inline-flex items-center gap-2 rounded-full px-6 py-3 font-semibold text-white"
                >
                  <Plus size={18} /> Add student
                </motion.button>
                <button
                  onClick={() => {
                    setMembers([])
                    setMsg({ ok: true, text: 'Union cleared. Start adding students.' })
                  }}
                  className="glass inline-flex items-center gap-2 rounded-full px-5 py-3 font-medium"
                >
                  <RotateCcw size={16} /> Reset
                </button>
              </div>

              <motion.div
                animate={shake}
                role="status"
                aria-live="polite"
                className={`mt-6 flex gap-3 rounded-2xl border p-4 text-sm ${
                  msg.ok ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-rose-500/40 bg-rose-500/10'
                }`}
              >
                {msg.ok ? (
                  <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
                ) : (
                  <AlertTriangle size={20} className="shrink-0 text-rose-500" />
                )}
                <span>{msg.text}</span>
              </motion.div>

              <p className="mt-4 text-xs text-muted">
                Tip: BE CSE and ME CSE are different programmes — add both and see.
              </p>
            </div>

            <div>
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold">Demo union</h3>
                <span className="text-sm text-muted">
                  <span className="font-bold text-ink">{members.length}</span> / {MAX_GROUP_SIZE} members
                </span>
              </div>
              <div className="mb-4 h-2 overflow-hidden rounded-full bg-violet-500/15">
                <motion.div
                  className="bg-gradient-brand h-full"
                  animate={{ width: `${(members.length / MAX_GROUP_SIZE) * 100}%` }}
                />
              </div>
              <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {slots.map((m, i) => (
                  <li key={m ? m.id : `empty-${i}`} className="min-h-[76px]">
                    <AnimatePresence mode="popLayout">
                      {m ? (
                        <motion.div
                          layout
                          initial={{ opacity: 0, scale: 0.6 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.6 }}
                          className="flex h-full items-center gap-3 rounded-2xl border border-line bg-surface-strong p-3"
                        >
                          <span
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display font-bold text-white"
                            style={{ background: COLORS[i % COLORS.length] }}
                          >
                            {m.name[0]}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{m.name}</p>
                            <p className="truncate text-xs text-muted" title={m.programme.label}>
                              {m.programme.label}
                            </p>
                          </div>
                          <button
                            onClick={() => setMembers((all) => all.filter((x) => x.id !== m.id))}
                            className="rounded-lg p-1.5 text-muted hover:bg-rose-500/10 hover:text-rose-400"
                            aria-label={`Remove ${m.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        </motion.div>
                      ) : (
                        <div className="grid h-full place-items-center rounded-2xl border border-dashed border-line text-xs text-muted">
                          Open slot
                        </div>
                      )}
                    </AnimatePresence>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
