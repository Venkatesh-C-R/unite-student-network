import { BadgeCheck, CalendarDays, Check, Clock, FileSignature, FileText, FileUp, Plus, Undo2, X, XCircle } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api'
import { Dialog, Empty, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { timeAgo } from '../lib/format'
import { btn, input } from '../lib/styles'

const MAX_FACULTY = 5
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['application/pdf', 'image/png', 'image/jpeg']

const STATUS = {
  pending: { label: 'Waiting for approval', icon: Clock, cls: 'bg-amber-400/15 text-amber-500' },
  approved: { label: 'Approved', icon: BadgeCheck, cls: 'bg-emerald-500/15 text-emerald-500' },
  rejected: { label: 'Rejected', icon: XCircle, cls: 'bg-rose-500/15 text-rose-400' },
  withdrawn: { label: 'Withdrawn', icon: Undo2, cls: 'bg-[var(--bg-2)] text-muted' },
}

const DECISION = {
  pending: { label: 'Not decided', cls: 'border-line text-muted' },
  approved: { label: 'Approved', cls: 'border-emerald-500/40 text-emerald-500' },
  rejected: { label: 'Rejected', cls: 'border-rose-500/40 text-rose-400' },
}

// "2026-12-01" → "1 Dec 2026", read as a local date so it never shifts a day
function formatDay(day) {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function dayCount(from, to) {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
}

function StatusBadge({ status }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <Icon size={13} /> {s.label}
    </span>
  )
}

// One OD request. `children` holds the viewer's actions (decide, withdraw).
function OdCard({ od, showStudent, children }) {
  const days = dayCount(od.fromDate, od.toDate)
  return (
    <article className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {showStudent && (
            <p className="text-sm font-semibold">
              <Link to={`/students/${od.studentId}`} className="hover:underline">
                {od.studentName}
              </Link>{' '}
              <span className="font-normal text-muted">
                · {od.studentRollNo}
                {od.programmeLevel ? ` · ${od.programmeLevel} ${od.programmeName}` : ''}
                {od.studentYear ? ` · Year ${od.studentYear}` : ''}
              </span>
            </p>
          )}
          <h3 className="font-display text-lg font-semibold break-words">{od.purpose}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays size={14} />
            {od.fromDate === od.toDate ? formatDay(od.fromDate) : `${formatDay(od.fromDate)} – ${formatDay(od.toDate)}`} · {days} day{days > 1 ? 's' : ''}
          </p>
        </div>
        <StatusBadge status={od.status} />
      </div>

      <a
        href={od.letter.url}
        target="_blank"
        rel="noopener"
        className="mt-4 flex max-w-xs items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs transition hover:border-violet-400"
        title={od.letter.name}
      >
        <FileText size={18} className="shrink-0 text-rose-400" />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{od.letter.name}</span>
          <span className="text-muted">OD letter · {Math.max(1, Math.round(od.letter.size / 1024))} KB</span>
        </span>
      </a>

      <div className="mt-4">
        <p className="mb-2 text-xs font-semibold text-muted">Sent to · every one must approve</p>
        <ul className="space-y-2">
          {od.approvers.map((a) => (
            <li key={a.id} className="rounded-2xl border border-line px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-semibold">{a.name}</span> <span className="text-xs break-all text-muted">{a.email}</span>
                </span>
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${DECISION[a.decision].cls}`}>
                  {a.decision === 'pending' && od.status !== 'pending' ? 'No longer needed' : DECISION[a.decision].label}
                </span>
              </div>
              {a.note && <p className="mt-1 text-xs text-muted">“{a.note}”</p>}
            </li>
          ))}
        </ul>
      </div>

      <p className="mt-4 border-t border-line pt-3 text-xs text-muted">Sent {timeAgo(od.createdAt)}</p>
      {children}
    </article>
  )
}

// Email chips: type an address and press Enter, comma or space to add it
function FacultyEmails({ value, onChange }) {
  const [draft, setDraft] = useState('')
  const [hint, setHint] = useState('')

  function add(raw) {
    const parts = raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
    if (!parts.length) return
    const next = [...value]
    for (const e of parts) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) setHint(`"${e}" is not an email address.`)
      else if (next.length >= MAX_FACULTY) setHint(`You can send it to at most ${MAX_FACULTY} faculty.`)
      else if (!next.includes(e)) next.push(e)
    }
    onChange(next)
    setDraft('')
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-md border border-line bg-[var(--bg)] p-2 focus-within:border-violet-400">
        {value.map((e) => (
          <span key={e} className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 py-1 pr-1 pl-3 text-sm">
            {e}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== e))} className="rounded-full p-0.5 hover:bg-violet-500/25" aria-label={`Remove ${e}`}>
              <X size={13} />
            </button>
          </span>
        ))}
        <input
          id="od-faculty"
          type="email"
          value={draft}
          onChange={(e) => {
            setHint('')
            setDraft(e.target.value)
          }}
          onKeyDown={(e) => {
            if (['Enter', ',', ' ', ';'].includes(e.key)) {
              e.preventDefault()
              add(draft)
            } else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1))
          }}
          onBlur={() => add(draft)}
          onPaste={(e) => {
            e.preventDefault()
            add(e.clipboardData.getData('text'))
          }}
          placeholder={value.length ? 'Add another' : 'e.g. hod.cse@psgtech.ac.in'}
          className="min-w-48 flex-1 bg-transparent px-2 py-1.5 text-ink outline-none placeholder:text-muted"
        />
      </div>
      <p className={`mt-1 text-xs ${hint ? 'text-rose-400' : 'text-muted'}`}>
        {hint || 'Your HOD, tutor or any faculty on UNITE. Press Enter after each email.'}
      </p>
    </div>
  )
}

function RequestDialog({ open, onClose, onSent }) {
  const empty = { purpose: '', fromDate: '', toDate: '' }
  const [form, setForm] = useState(empty)
  const [faculty, setFaculty] = useState([])
  const [letter, setLetter] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const fileInput = useRef(null)

  const close = () => {
    onClose()
    setForm(empty)
    setFaculty([])
    setLetter(null)
    setError('')
  }

  function pick(file) {
    setError('')
    if (!file) return
    if (!TYPES.includes(file.type)) setError(`"${file.name}" is not a PDF, PNG or JPG.`)
    else if (file.size > MAX_BYTES) setError(`"${file.name}" is larger than 5 MB.`)
    else setLetter(file)
  }

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('purpose', form.purpose.trim())
      body.append('fromDate', form.fromDate)
      body.append('toDate', form.toDate)
      body.append('faculty', faculty.join(','))
      body.append('letter', letter)
      await api('/od', { method: 'POST', body })
      onSent()
      close()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const ready = form.purpose.trim().length >= 3 && form.fromDate && form.toDate && faculty.length && letter
  return (
    <Dialog open={open} onClose={close} title="Request OD">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="od-purpose" className="mb-1.5 block text-sm font-semibold">
            What is the OD for?
          </label>
          <input
            id="od-purpose"
            className={input}
            value={form.purpose}
            maxLength={150}
            onChange={(e) => setForm({ ...form, purpose: e.target.value })}
            placeholder="e.g. Smart India Hackathon at IIT Madras"
            autoFocus
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="od-from" className="mb-1.5 block text-sm font-semibold">
              From
            </label>
            <input
              id="od-from"
              type="date"
              className={input}
              value={form.fromDate}
              onChange={(e) => setForm({ ...form, fromDate: e.target.value, toDate: form.toDate && form.toDate < e.target.value ? e.target.value : form.toDate })}
            />
          </div>
          <div>
            <label htmlFor="od-to" className="mb-1.5 block text-sm font-semibold">
              To
            </label>
            <input id="od-to" type="date" className={input} value={form.toDate} min={form.fromDate || undefined} onChange={(e) => setForm({ ...form, toDate: e.target.value })} />
          </div>
        </div>
        <div>
          <label htmlFor="od-faculty" className="mb-1.5 block text-sm font-semibold">
            Send to (faculty email)
          </label>
          <FacultyEmails value={faculty} onChange={setFaculty} />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-semibold">OD letter</p>
          {letter ? (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-violet-500/10 px-3 py-2 text-sm">
              <span className="truncate">{letter.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                {Math.max(1, Math.round(letter.size / 1024))} KB
                <button type="button" onClick={() => setLetter(null)} className="rounded-full p-1 hover:bg-violet-500/20" aria-label={`Remove ${letter.name}`}>
                  <X size={14} />
                </button>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                pick(e.dataTransfer.files[0])
              }}
              className="grid w-full place-items-center rounded-2xl border-2 border-dashed border-line px-4 py-5 text-center text-sm transition hover:border-violet-400/60"
            >
              <FileUp size={22} className="mb-1.5 text-violet-500" />
              <span>
                <b>Drop the letter here</b> or click to choose
              </span>
              <span className="mt-1 text-xs text-muted">PDF, PNG or JPG · 5 MB at most</span>
            </button>
          )}
          <input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={(e) => (pick(e.target.files[0]), (e.target.value = ''))} />
        </div>
        {error && (
          <p className="text-sm text-rose-400" role="alert">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className={btn.ghost}>
            Cancel
          </button>
          <button disabled={!ready || busy} className={btn.primary}>
            {busy ? 'Sending…' : 'Send request'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

const STUDENT_FILTERS = [
  ['all', 'All'],
  ['pending', 'Waiting'],
  ['approved', 'Approved'],
  ['rejected', 'Rejected'],
  ['withdrawn', 'Withdrawn'],
]

function StudentOd() {
  const toast = useToast()
  const [requests, setRequests] = useState(null)
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(false)

  const load = useCallback(() => {
    api('/od/mine')
      .then((d) => setRequests(d.requests))
      .catch((e) => toast(e.message, 'error'))
  }, [toast])
  useEffect(() => {
    load()
  }, [load])

  async function withdraw(od) {
    try {
      await api(`/od/${od.id}/withdraw`, { method: 'POST' })
      toast('Request withdrawn.')
      load()
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const shown = (requests || []).filter((r) => filter === 'all' || r.status === filter)
  const count = (s) => (requests || []).filter((r) => r.status === s).length
  return (
    <div className="space-y-8">
      <section className="glass relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="bg-gradient-brand pointer-events-none absolute -right-20 -bottom-24 h-64 w-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              On-duty <span className="text-gradient">requests</span>
            </h1>
            <p className="mt-1 max-w-xl text-muted">
              Upload your OD letter and send it to your HOD, tutor or other faculty by email. It is approved once every one of them accepts.
            </p>
          </div>
          <button onClick={() => setOpen(true)} className={btn.primary}>
            <Plus size={17} /> Request OD
          </button>
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            ['Waiting', count('pending'), 'text-amber-500'],
            ['Approved', count('approved'), 'text-emerald-500'],
            ['Rejected', count('rejected'), 'text-rose-400'],
          ].map(([label, n, cls]) => (
            <div key={label} className="rounded-2xl bg-violet-500/10 p-3 sm:p-4">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className={`mt-1 font-display text-2xl font-bold ${cls}`}>{requests ? n : '–'}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Status">
        {STUDENT_FILTERS.map(([key, label]) => (
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

      {!requests ? (
        <Skeleton className="h-48" />
      ) : shown.length === 0 ? (
        <Empty
          icon={FileSignature}
          title={requests.length ? 'Nothing in this list' : 'No OD requests yet'}
          action={
            !requests.length && (
              <button onClick={() => setOpen(true)} className={btn.primary}>
                <Plus size={17} /> Request your first OD
              </button>
            )
          }
        >
          {requests.length ? 'Try another filter.' : 'Requests you send appear here with each faculty member’s decision.'}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {shown.map((od) => (
            <OdCard key={od.id} od={od}>
              {od.status === 'pending' && (
                <div className="mt-3 flex justify-end">
                  <button onClick={() => withdraw(od)} className={btn.ghost}>
                    <Undo2 size={15} /> Withdraw
                  </button>
                </div>
              )}
            </OdCard>
          ))}
        </div>
      )}

      <RequestDialog
        open={open}
        onClose={() => setOpen(false)}
        onSent={() => {
          toast('OD request sent. You’ll be notified as faculty decide.')
          load()
        }}
      />
    </div>
  )
}

// Accept or reject a request sent to me. Rejecting needs a reason.
function DecisionForm({ od, onDone }) {
  const toast = useToast()
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const others = od.approvers.length - 1

  async function decide(decision) {
    setBusy(true)
    try {
      const body = { decision }
      if (note.trim()) body.note = note.trim()
      const { od: updated } = await api(`/od/${od.id}/decision`, { method: 'POST', body })
      toast(
        decision === 'reject'
          ? 'OD rejected. The student has been told why.'
          : updated.status === 'approved'
            ? 'Approved. Everyone has approved, so the OD is granted.'
            : 'Approved. The OD is granted once the others approve too.',
      )
      onDone()
    } catch (e) {
      toast(e.message, 'error')
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-line bg-[var(--bg)]/40 p-4">
      <label htmlFor={`od-note-${od.id}`} className="block text-sm font-semibold">
        {rejecting ? 'Reason for rejecting (required)' : 'Note to the student (optional)'}
      </label>
      <textarea
        id={`od-note-${od.id}`}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={300}
        className={`${input} min-h-16`}
        placeholder={rejecting ? 'e.g. Internal assessment on those days.' : 'e.g. All the best!'}
      />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted">{others ? `${others} other faculty must also approve.` : 'You are the only approver.'}</p>
        <div className="flex gap-2">
          {rejecting ? (
            <>
              <button onClick={() => setRejecting(false)} className={btn.ghost} disabled={busy}>
                Cancel
              </button>
              <button onClick={() => decide('reject')} disabled={busy || note.trim().length < 3} className={btn.danger}>
                <X size={16} /> Reject OD
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setRejecting(true)} className={btn.ghost} disabled={busy}>
                <X size={16} /> Reject
              </button>
              <button onClick={() => decide('approve')} disabled={busy} className={btn.primary}>
                <Check size={16} /> Approve
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

const FACULTY_TABS = [
  ['waiting', 'Waiting for you'],
  ['done', 'Decided'],
]

function FacultyOd() {
  const toast = useToast()
  const [view, setView] = useState('waiting')
  const [requests, setRequests] = useState(null)

  const load = useCallback(() => {
    api(`/od/inbox?view=${view}`)
      .then((d) => setRequests(d.requests))
      .catch((e) => toast(e.message, 'error'))
  }, [view, toast])
  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          OD <span className="text-gradient">requests</span>
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          Requests students sent to your email. Check the letter, then approve or reject. An OD is granted only when everyone it was sent to approves.
        </p>
      </section>

      <div role="tablist" className="glass inline-flex rounded-full p-1">
        {FACULTY_TABS.map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={view === key}
            onClick={() => {
              if (key === view) return
              setRequests(null)
              setView(key)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${view === key ? 'bg-gradient-brand text-white' : 'text-muted hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {!requests ? (
        <Skeleton className="h-64" />
      ) : requests.length === 0 ? (
        <Empty icon={FileSignature} title={view === 'waiting' ? 'All caught up' : 'Nothing decided yet'}>
          {view === 'waiting' ? 'No OD requests are waiting for you.' : 'Requests you have approved or rejected are listed here.'}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {requests.map((od) => (
            <OdCard key={od.id} od={od} showStudent>
              {view === 'waiting' && <DecisionForm od={od} onDone={load} />}
            </OdCard>
          ))}
        </div>
      )}
    </div>
  )
}

export default function OdPage() {
  const { user } = useAuth()
  if (user.role === 'student') return <StudentOd />
  if (user.role === 'faculty') return <FacultyOd />
  return (
    <Empty icon={FileSignature} title="OD requests go to faculty">
      Students send OD requests to faculty by email, and only those faculty can approve or reject them.
    </Empty>
  )
}
