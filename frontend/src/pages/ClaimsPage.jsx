import { AnimatePresence, motion } from 'framer-motion'
import { Award, CalendarPlus, Check, ChevronRight, FileUp, Plus, Search, Users, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import ClaimCard from '../components/app/ClaimCard'
import { Dialog, Empty, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { HOST_CATEGORIES, POSITIONS } from '../data'
import { CATEGORY_ICON } from '../lib/claims'
import { formatPoints } from '../lib/format'
import { btn, input } from '../lib/styles'

const RESULTS = POSITIONS.map((p) => ({ ...p, value: p.key === 'p' ? 'participation' : p.key }))
const MAX_FILES = 5
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['application/pdf', 'image/png', 'image/jpeg']

function Steps({ step }) {
  return (
    <ol className="mb-6 flex items-center gap-2 text-xs font-semibold">
      {['Event', 'Team', 'Result & proof'].map((label, i) => (
        <li key={label} className="flex items-center gap-2">
          <span
            className={`grid h-6 w-6 place-items-center rounded-full ${i + 1 < step ? 'bg-emerald-500 text-white' : i + 1 === step ? 'bg-gradient-brand text-white' : 'border border-line text-muted'}`}
          >
            {i + 1 < step ? <Check size={13} /> : i + 1}
          </span>
          <span className={i + 1 === step ? '' : 'text-muted'}>{label}</span>
          {i < 2 && <ChevronRight size={14} className="text-muted" />}
        </li>
      ))}
    </ol>
  )
}

function CategoryPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
      {HOST_CATEGORIES.map((c) => {
        const Icon = CATEGORY_ICON[c.key]
        const active = value === c.key
        return (
          <button
            type="button"
            key={c.key}
            onClick={() => onChange(c.key)}
            aria-pressed={active}
            className={`rounded-2xl border p-3 text-left transition ${active ? 'border-violet-400 bg-violet-500/10' : 'border-line hover:border-violet-400/60'}`}
          >
            <span className="flex items-center gap-2 font-semibold">
              <Icon size={16} /> {c.label} <span className="text-xs font-normal text-muted">×{c.multiplier.toFixed(1)}</span>
            </span>
            <span className="mt-1 block text-xs text-muted">{c.hint}</span>
          </button>
        )
      })}
    </div>
  )
}

// ---------- Step 1: choose or create the event ----------
function EventStep({ onPick }) {
  const [q, setQ] = useState('')
  const [events, setEvents] = useState(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState({ title: '', hostInstitution: '', hostCategory: '', eventDate: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let current = true
    const t = setTimeout(() => {
      api(`/events${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        .then((d) => current && setEvents(d.events))
        .catch((e) => current && setError(e.message))
    }, 250)
    return () => {
      current = false
      clearTimeout(t)
    }
  }, [q])

  async function create(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = { ...form }
      if (!body.eventDate) delete body.eventDate
      const { event } = await api('/events', { method: 'POST', body })
      onPick(event)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  if (creating)
    return (
      <form onSubmit={create} className="space-y-4">
        <div>
          <label htmlFor="ev-title" className="mb-1.5 block text-sm font-semibold">
            Event name
          </label>
          <input id="ev-title" className={input} value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Smart India Hackathon 2026" autoFocus />
        </div>
        <div>
          <label htmlFor="ev-host" className="mb-1.5 block text-sm font-semibold">
            Host institution
          </label>
          <input id="ev-host" className={input} value={form.hostInstitution} maxLength={150} onChange={(e) => setForm({ ...form, hostInstitution: e.target.value })} placeholder="e.g. IIT Madras" />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">Category (decided by the host, not the venue)</p>
          <CategoryPicker value={form.hostCategory} onChange={(hostCategory) => setForm({ ...form, hostCategory })} />
        </div>
        <div>
          <label htmlFor="ev-date" className="mb-1.5 block text-sm font-semibold">
            Date <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="ev-date" type="date" className={input} value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} />
        </div>
        {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
        <div className="flex justify-between gap-2">
          <button type="button" onClick={() => setCreating(false)} className={btn.ghost}>
            Back to list
          </button>
          <button disabled={busy || form.title.trim().length < 3 || form.hostInstitution.trim().length < 2 || !form.hostCategory} className={btn.primary}>
            Add event <ChevronRight size={16} />
          </button>
        </div>
      </form>
    )

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">Search events</span>
        <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
        <input className={`${input} pl-11`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search events or host institutions" autoFocus />
      </label>
      <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
        {!events && <Skeleton className="h-16" />}
        {events?.length === 0 && <li className="py-6 text-center text-sm text-muted">No matching events. Add it below.</li>}
        {events?.map((ev) => {
          const Icon = CATEGORY_ICON[ev.hostCategory]
          return (
            <li key={ev.id}>
              <button onClick={() => onPick(ev)} className="flex w-full items-center gap-3 rounded-2xl border border-line px-4 py-3 text-left transition hover:border-violet-400">
                <Icon size={18} className="shrink-0 text-violet-500" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{ev.title}</span>
                  <span className="block truncate text-xs text-muted">
                    {ev.hostInstitution} · {ev.hostCategory}
                    {ev.eventDate ? ` · ${new Date(ev.eventDate).toLocaleDateString()}` : ''}
                  </span>
                </span>
                <ChevronRight size={16} className="text-muted" />
              </button>
            </li>
          )
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}
      <button onClick={() => setCreating(true)} className={`${btn.ghost} mt-4 w-full`}>
        <CalendarPlus size={16} /> The event isn’t listed — add it
      </button>
    </div>
  )
}

// ---------- Step 2: choose the event team ----------
function TeamStep({ event, myGroups, onPick, onBack }) {
  const [teams, setTeams] = useState(null)
  const [groupId, setGroupId] = useState('')
  const [joinTeamId, setJoinTeamId] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(
    () =>
      api(`/events/${event.id}`)
        .then((d) => setTeams(d.teams))
        .catch((e) => setError(e.message)),
    [event.id],
  )
  useEffect(() => {
    load()
  }, [load])

  if (!teams) return <Skeleton className="h-40" />
  const myIds = new Set(myGroups.map((g) => g.id))
  const myTeams = teams.filter((t) => t.groups.some((g) => myIds.has(g.id)))
  const enteredIds = new Set(teams.flatMap((t) => t.groups.map((g) => g.id)))
  const freeGroups = myGroups.filter((g) => !enteredIds.has(g.id))
  const ownedFree = freeGroups.filter((g) => g.myRole === 'owner')
  const otherTeams = teams.filter((t) => !myTeams.includes(t))

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      const { team } = await fn()
      onPick(team)
    } catch (e) {
      setError(e.message)
      load()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      <p className="rounded-2xl bg-violet-500/10 px-4 py-3 text-sm">
        <b>{event.title}</b> · {event.hostInstitution}
      </p>

      {myTeams.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Your team for this event</h3>
          <ul className="space-y-2">
            {myTeams.map((t) => (
              <li key={t.id}>
                <button onClick={() => onPick(t)} className="flex w-full items-center gap-3 rounded-2xl border border-violet-400 bg-violet-500/10 px-4 py-3 text-left">
                  <Users size={18} className="text-violet-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{t.label}</span>
                    <span className="block truncate text-xs text-muted">
                      {t.groups.map((g) => g.name).join(' + ')} · {t.totalMembers} students
                    </span>
                  </span>
                  <ChevronRight size={16} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {freeGroups.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">{myTeams.length ? 'Or enter another of your unions' : 'Enter with one of your unions'}</h3>
          <div className="flex gap-2">
            <select className={input} value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Your union">
              <option value="">Choose a union…</option>
              {freeGroups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.memberCount}/6)
                </option>
              ))}
            </select>
            <button
              disabled={!groupId || busy}
              onClick={() => {
                const g = freeGroups.find((x) => String(x.id) === groupId)
                run(() => api(`/events/${event.id}/teams`, { method: 'POST', body: { label: g.name, groupId: g.id } }))
              }}
              className={`${btn.primary} shrink-0`}
            >
              Use
            </button>
          </div>
        </section>
      )}

      {ownedFree.length > 0 && otherTeams.length > 0 && (
        <section>
          <h3 className="mb-1 text-sm font-semibold">Event needs more than 6? Join an existing team</h3>
          <p className="mb-2 text-xs text-muted">Your union joins another union’s team. Both unions stay separate and keep their own six-member limit.</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
            <select className={input} value={joinTeamId} onChange={(e) => setJoinTeamId(e.target.value)} aria-label="Team to join">
              <option value="">Team…</option>
              {otherTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} ({t.groups.map((g) => g.name).join(' + ')})
                </option>
              ))}
            </select>
            <select className={input} value={groupId} onChange={(e) => setGroupId(e.target.value)} aria-label="Union you lead">
              <option value="">Union you lead…</option>
              {ownedFree.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              disabled={!joinTeamId || !ownedFree.some((g) => String(g.id) === groupId) || busy}
              onClick={() => run(() => api(`/events/${event.id}/teams/${joinTeamId}/groups`, { method: 'POST', body: { groupId: Number(groupId) } }))}
              className={btn.primary}
            >
              Join
            </button>
          </div>
        </section>
      )}

      {myTeams.length === 0 && freeGroups.length === 0 && (
        <p className="text-sm text-muted">
          You need to be in a union to submit a result. <Link to="/groups" className="font-semibold text-violet-600 dark:text-violet-400">Go to Unions</Link>
        </p>
      )}

      {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
      <button onClick={onBack} className={btn.ghost}>
        Back
      </button>
    </div>
  )
}

// ---------- Step 3: result and evidence ----------
function ResultStep({ event, team, onBack, onSubmitted }) {
  const [result, setResult] = useState('')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState([])
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)
  const multiplier = HOST_CATEGORIES.find((c) => c.key === event.hostCategory).multiplier
  const base = RESULTS.find((r) => r.value === result)?.base

  function addFiles(list) {
    setError('')
    const next = [...files]
    for (const f of list) {
      if (!TYPES.includes(f.type)) setError(`"${f.name}" is not a PDF, PNG or JPG.`)
      else if (f.size > MAX_BYTES) setError(`"${f.name}" is larger than 5 MB.`)
      else if (next.length >= MAX_FILES) setError('You can attach up to 5 files.')
      else if (!next.some((x) => x.name === f.name && x.size === f.size)) next.push(f)
    }
    setFiles(next)
  }

  async function submit() {
    setBusy(true)
    setError('')
    try {
      const form = new FormData()
      form.append('teamId', String(team.id))
      form.append('result', result)
      form.append('description', description)
      files.forEach((f) => form.append('evidence', f))
      const { achievement } = await api('/achievements', { method: 'POST', body: form })
      onSubmitted(achievement)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="rounded-2xl bg-violet-500/10 px-4 py-3 text-sm">
        <b>{event.title}</b> · team <b>{team.label}</b> ({team.groups.map((g) => g.name).join(' + ')})
      </p>
      <div>
        <label htmlFor="res" className="mb-1.5 block text-sm font-semibold">
          Result
        </label>
        <select id="res" className={input} value={result} onChange={(e) => setResult(e.target.value)}>
          <option value="">Choose…</option>
          {RESULTS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-muted">Placed below 10th? Choose Participation.</p>
      </div>
      <div>
        <label htmlFor="desc" className="mb-1.5 block text-sm font-semibold">
          Note for the reviewer <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="desc" className={`${input} min-h-20`} maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Track, project name, anything that helps verify the result." />
      </div>
      <div>
        <p className="mb-1.5 text-sm font-semibold">Proof (certificate, result list or photo)</p>
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDrag(true)
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDrag(false)
            addFiles(e.dataTransfer.files)
          }}
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
          role="button"
          tabIndex={0}
          className={`grid cursor-pointer place-items-center rounded-2xl border-2 border-dashed px-4 py-6 text-center text-sm transition ${drag ? 'border-violet-400 bg-violet-500/10' : 'border-line hover:border-violet-400/60'}`}
        >
          <FileUp size={24} className="mb-2 text-violet-500" />
          <span>
            <b>Drop files here</b> or click to choose
          </span>
          <span className="mt-1 text-xs text-muted">PDF, PNG or JPG · up to 5 files · 5 MB each</span>
          <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ''))} />
        </div>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {files.map((f, i) => (
              <li key={f.name + f.size} className="flex items-center justify-between gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm">
                <span className="truncate">{f.name}</span>
                <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                  {Math.max(1, Math.round(f.size / 1024))} KB
                  <button onClick={() => setFiles((all) => all.filter((_, j) => j !== i))} className="rounded-full p-1 hover:bg-violet-500/20" aria-label={`Remove ${f.name}`}>
                    <X size={14} />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {base !== undefined && (
        <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
          If approved: <b>{formatPoints(base * multiplier)} points</b> ({base} × {multiplier.toFixed(1)})
          {team.groups.length > 1 ? ' to each union in the team' : ''}.
        </p>
      )}
      {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
      <div className="flex justify-between gap-2">
        <button onClick={onBack} className={btn.ghost}>
          Back
        </button>
        <button disabled={!result || files.length === 0 || busy} onClick={submit} className={btn.primary}>
          {busy ? 'Submitting…' : 'Submit for review'}
        </button>
      </div>
    </div>
  )
}

function SubmitClaimDialog({ open, onClose, myGroups, onSubmitted }) {
  const [step, setStep] = useState(1)
  const [event, setEvent] = useState(null)
  const [team, setTeam] = useState(null)

  const close = () => {
    onClose()
    setStep(1)
    setEvent(null)
    setTeam(null)
  }

  return (
    <Dialog open={open} onClose={close} title="Submit a result" wide>
      <Steps step={step} />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.18 }}>
          {step === 1 && (
            <EventStep
              onPick={(ev) => {
                setEvent(ev)
                setStep(2)
              }}
            />
          )}
          {step === 2 && (
            <TeamStep
              event={event}
              myGroups={myGroups}
              onBack={() => setStep(1)}
              onPick={(t) => {
                setTeam(t)
                setStep(3)
              }}
            />
          )}
          {step === 3 && (
            <ResultStep
              event={event}
              team={team}
              onBack={() => setStep(2)}
              onSubmitted={(a) => {
                onSubmitted(a)
                close()
              }}
            />
          )}
        </motion.div>
      </AnimatePresence>
    </Dialog>
  )
}

// ---------- Page ----------
const FILTERS = [
  ['all', 'All'],
  ['pending', 'Pending'],
  ['approved', 'Verified'],
  ['rejected', 'Not approved'],
  ['withdrawn', 'Withdrawn'],
]

export default function ClaimsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [claims, setClaims] = useState(null)
  const [myGroups, setMyGroups] = useState([])
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    api('/achievements/mine')
      .then((d) => setClaims(d.achievements))
      .catch((e) => toast(e.message, 'error'))
    api('/groups/mine')
      .then((d) => setMyGroups(d.groups))
      .catch(() => {})
  }, [toast])

  useEffect(() => {
    load()
  }, [load])

  if (user.role !== 'student')
    return (
      <Empty icon={Award} title="Claims are submitted by students" action={<Link to="/review" className={btn.primary}>Go to Review</Link>}>
        As a reviewer you can approve or reject them on the Review page.
      </Empty>
    )

  const isLeader = myGroups.some((g) => g.myRole === 'owner')
  const shown = (claims || []).filter((c) => filter === 'all' || c.status === filter)
  const count = (s) => (claims || []).filter((c) => c.status === s).length

  return (
    <div className="space-y-8">
      <section className="glass gradient-border relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="bg-gradient-brand pointer-events-none absolute -right-20 -bottom-24 h-64 w-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Your <span className="text-gradient">achievements</span>
            </h1>
            <p className="mt-1 max-w-xl text-muted">Won or took part in an event with your union? Submit the result with proof. Faculty verify it, then your union earns the points.</p>
          </div>
          {isLeader ? (
            <button onClick={() => setOpen(true)} className={btn.primary}>
              <Plus size={17} /> Submit a result
            </button>
          ) : (
            <p className="max-w-56 text-sm text-muted">Only your union leader can submit a result for approval.</p>
          )}
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            ['Pending', count('pending'), 'text-amber-500'],
            ['Verified', count('approved'), 'text-emerald-500'],
            ['Not approved', count('rejected'), 'text-rose-400'],
          ].map(([label, n, cls]) => (
            <div key={label} className="rounded-2xl bg-violet-500/10 p-3 sm:p-4">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`mt-1 font-display text-2xl font-bold ${cls}`}>{claims ? n : '–'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist">
        {FILTERS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={filter === key}
            onClick={() => setFilter(key)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${filter === key ? 'bg-gradient-brand text-white' : 'glass text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!claims ? (
        <Skeleton className="h-48" />
      ) : shown.length === 0 ? (
        <Empty
          icon={Award}
          title={claims.length ? 'Nothing in this list' : 'No results submitted yet'}
          action={
            !claims.length && (
              <button onClick={() => setOpen(true)} className={btn.primary}>
                <Plus size={17} /> Submit your first result
              </button>
            )
          }
        >
          {claims.length ? 'Try another filter.' : 'Results your unions submit appear here, with their review status.'}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((c) => (
            <ClaimCard key={c.id} claim={c} showSubmitter />
          ))}
        </div>
      )}

      <SubmitClaimDialog
        open={open}
        onClose={() => setOpen(false)}
        myGroups={myGroups.filter((g) => g.myRole === 'owner')}
        onSubmitted={() => {
          toast('Submitted! It will count once faculty verify it.')
          load()
        }}
      />
    </div>
  )
}
