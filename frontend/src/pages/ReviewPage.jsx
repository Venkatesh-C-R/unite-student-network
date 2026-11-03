import { LayoutGroup, motion } from 'framer-motion'
import { Check, ClipboardCheck, ShieldAlert, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import ClaimCard from '../components/app/ClaimCard'
import { Empty, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { HOST_CATEGORIES, POSITIONS } from '../data'
import { CATEGORY_ICON } from '../lib/claims'
import { formatPoints } from '../lib/format'
import { btn, input } from '../lib/styles'

const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Verified'],
  ['rejected', 'Not approved'],
]

function baseFor(result) {
  return POSITIONS.find((p) => (p.key === 'p' ? 'participation' : p.key) === result).base
}

// Decision panel under each pending claim
function ReviewForm({ claim, onDone }) {
  const toast = useToast()
  const [category, setCategory] = useState(claim.hostCategory)
  const [note, setNote] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [busy, setBusy] = useState(false)
  const multiplier = HOST_CATEGORIES.find((c) => c.key === category).multiplier
  const points = baseFor(claim.result) * multiplier

  async function decide(decision) {
    setBusy(true)
    try {
      const body = { decision }
      if (note.trim()) body.note = note.trim()
      if (decision === 'approve' && category !== claim.hostCategory) body.hostCategory = category
      await api(`/review/achievements/${claim.id}`, { method: 'POST', body })
      toast(decision === 'approve' ? `Approved — ${formatPoints(points)} points awarded.` : 'Claim rejected. The students have been told why.')
      onDone()
    } catch (e) {
      toast(e.message, 'error')
      setBusy(false)
    }
  }

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-line bg-[var(--bg)]/40 p-4">
      <div>
        <p className="mb-2 text-sm font-semibold">Check the host category</p>
        <div className="flex flex-wrap gap-2">
          {HOST_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c.key]
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                aria-pressed={category === c.key}
                title={c.hint}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
                  category === c.key ? 'border-violet-400 bg-violet-500/15 font-semibold' : 'border-line text-muted hover:text-ink'
                }`}
              >
                <Icon size={14} /> {c.label} ×{c.multiplier.toFixed(1)}
              </button>
            )
          })}
        </div>
        {category !== claim.hostCategory && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-500">
            <ShieldAlert size={14} /> You are changing the category the students chose ({claim.hostCategory}). It applies to the event.
          </p>
        )}
      </div>
      <div>
        <label htmlFor={`note-${claim.id}`} className="mb-1.5 block text-sm font-semibold">
          {rejecting ? 'Reason for rejecting (required)' : 'Note to students (optional)'}
        </label>
        <textarea
          id={`note-${claim.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          className={`${input} min-h-16`}
          placeholder={rejecting ? 'e.g. The certificate does not show the team’s position.' : 'e.g. Well done!'}
        />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm">
          Approving awards <b>{formatPoints(points)} pts</b>
          {claim.groups.length > 1 ? ` to each of ${claim.groups.length} unions` : ''}.
        </p>
        <div className="flex gap-2">
          {rejecting ? (
            <>
              <button onClick={() => setRejecting(false)} className={btn.ghost} disabled={busy}>
                Cancel
              </button>
              <button onClick={() => decide('reject')} disabled={busy || note.trim().length < 3} className={btn.danger}>
                <X size={16} /> Reject claim
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

export default function ReviewPage() {
  const { user } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('pending')
  const [claims, setClaims] = useState(null)
  const [pendingCount, setPendingCount] = useState(null)

  const load = useCallback(() => {
    api(`/review/achievements?status=${tab}`)
      .then((d) => {
        setClaims(d.achievements)
        if (tab === 'pending') setPendingCount(d.achievements.length)
      })
      .catch((e) => toast(e.message, 'error'))
  }, [tab, toast])

  useEffect(() => {
    if (user.role === 'student') return
    load()
  }, [load, user.role])

  if (user.role === 'student')
    return (
      <Empty icon={ClipboardCheck} title="Faculty only">
        Claims are reviewed by faculty coordinators and admins.
      </Empty>
    )

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Review <span className="text-gradient">claims</span>
        </h1>
        <p className="mt-1 max-w-2xl text-muted">
          Check each result against its proof. Approving adds the points to every union in the team; rejecting needs a short reason the students will see.
        </p>
      </section>

      <LayoutGroup id="review-tabs">
        <div role="tablist" className="glass inline-flex rounded-full p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => {
                setClaims(null)
                setTab(key)
              }}
              className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${tab === key ? 'text-white' : 'text-muted hover:text-ink'}`}
            >
              {tab === key && <motion.span layoutId="review-pill" className="bg-gradient-brand absolute inset-0 rounded-full" />}
              <span className="relative flex items-center gap-1.5">
                {label}
                {key === 'pending' && pendingCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] text-slate-900">{pendingCount}</span>}
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      {!claims ? (
        <Skeleton className="h-64" />
      ) : claims.length === 0 ? (
        <Empty icon={ClipboardCheck} title={tab === 'pending' ? 'All caught up' : 'Nothing here yet'}>
          {tab === 'pending' ? 'No claims are waiting for review.' : 'Reviewed claims will be listed here.'}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {claims.map((c) => (
            <ClaimCard key={c.id} claim={c} showSubmitter>
              {tab === 'pending' && c.submitterId !== user.id && <ReviewForm claim={c} onDone={load} />}
            </ClaimCard>
          ))}
        </div>
      )}
    </div>
  )
}
