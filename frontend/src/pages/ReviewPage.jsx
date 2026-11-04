import { LayoutGroup, motion } from 'framer-motion'
import { Check, ClipboardCheck, RotateCcw, Search, ShieldAlert, Undo2, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { api } from '../api'
import ClaimCard from '../components/app/ClaimCard'
import { Empty, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { HOST_CATEGORIES, POSITIONS } from '../data'
import { CATEGORY_ICON, claimRef } from '../lib/claims'
import { formatPoints } from '../lib/format'
import { btn, input } from '../lib/styles'

const TABS = [
  ['pending', 'Pending'],
  ['approved', 'Verified'],
  ['rejected', 'Not approved'],
  ['withdrawn', 'Withdrawn'],
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

// Admin only: undo a decision. Reopen sends a reviewed claim back to faculty; withdraw cancels it so the team can resubmit.
function AdminRevert({ claim, onDone }) {
  const toast = useToast()
  const [mode, setMode] = useState(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const canReopen = ['approved', 'rejected'].includes(claim.status)

  async function run() {
    setBusy(true)
    try {
      await api(`/admin/claims/${claim.id}/${mode}`, { method: 'POST', body: { reason: reason.trim() } })
      toast(mode === 'reopen' ? 'Claim reopened. Its points were taken back and it is pending again.' : 'Claim withdrawn. The team can submit it again.')
      onDone()
    } catch (e) {
      toast(e.message, 'error')
      setBusy(false)
    }
  }

  if (!mode)
    return (
      <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
        <span className="mr-auto self-center text-xs text-muted">Admin</span>
        {canReopen && (
          <button onClick={() => setMode('reopen')} className={btn.ghost}>
            <RotateCcw size={15} /> Reopen for review
          </button>
        )}
        <button onClick={() => setMode('withdraw')} className={btn.ghost}>
          <Undo2 size={15} /> Withdraw claim
        </button>
      </div>
    )
  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-line bg-[var(--bg)]/40 p-4">
      <label htmlFor={`rev-${claim.id}`} className="block text-sm font-semibold">
        {mode === 'reopen'
          ? `Why reopen? ${claim.status === 'approved' ? 'Its points are taken back and ' : ''}faculty review it again.`
          : 'Why withdraw? The team can then submit it again.'}
      </label>
      <textarea id={`rev-${claim.id}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} className={`${input} min-h-16`} placeholder="The students will see this reason." />
      <div className="flex justify-end gap-2">
        <button onClick={() => setMode(null)} className={btn.ghost} disabled={busy}>
          Cancel
        </button>
        <button onClick={run} disabled={busy || reason.trim().length < 3} className={mode === 'withdraw' ? btn.danger : btn.primary}>
          {mode === 'reopen' ? 'Reopen claim' : 'Withdraw claim'}
        </button>
      </div>
    </div>
  )
}

export default function ReviewPage() {
  const { user } = useAuth()
  const toast = useToast()
  // /review/:id (the link in "review needed" notifications) opens that claim
  const { id: linkedId } = useParams()
  const [tab, setTab] = useState('pending')
  const [query, setQuery] = useState(linkedId ? claimRef(linkedId) : '')
  const [claims, setClaims] = useState(null)
  const [pendingCount, setPendingCount] = useState(null)
  const q = query.trim()

  // A search looks across every status; otherwise list the chosen tab
  const load = useCallback(() => {
    api(q ? `/review/achievements?q=${encodeURIComponent(q)}` : `/review/achievements?status=${tab}`)
      .then((d) => {
        setClaims(d.achievements)
        if (!q && tab === 'pending') setPendingCount(d.achievements.length)
      })
      .catch((e) => toast(e.message, 'error'))
  }, [q, tab, toast])

  useEffect(() => {
    if (user.role === 'student') return
    const t = setTimeout(load, q ? 250 : 0)
    return () => clearTimeout(t)
  }, [load, q, user.role])

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

      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <LayoutGroup id="review-tabs">
          <div role="tablist" className="glass inline-flex self-start rounded-full p-1">
            {TABS.map(([key, label]) => {
              const active = !q && tab === key
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setClaims(null)
                    setQuery('')
                    setTab(key)
                  }}
                  className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${active ? 'text-white' : 'text-muted hover:text-ink'}`}
                >
                  {active && <motion.span layoutId="review-pill" className="bg-gradient-brand absolute inset-0 rounded-full" />}
                  <span className="relative flex items-center gap-1.5">
                    {label}
                    {key === 'pending' && pendingCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[10px] text-slate-900">{pendingCount}</span>}
                  </span>
                </button>
              )
            })}
          </div>
        </LayoutGroup>
        <label className="relative block md:w-80">
          <span className="sr-only">Search claims</span>
          <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Claim ID (CLM-0007), student or event"
            className={`${input} py-2.5 pl-11`}
          />
        </label>
      </div>

      {!claims ? (
        <Skeleton className="h-64" />
      ) : claims.length === 0 ? (
        q ? (
          <Empty icon={Search} title="No claims match">
            Check the claim ID, for example CLM-0007, or search by student or event.
          </Empty>
        ) : (
          <Empty icon={ClipboardCheck} title={tab === 'pending' ? 'All caught up' : 'Nothing here yet'}>
            {tab === 'pending' ? 'No claims are waiting for review.' : 'Reviewed claims will be listed here.'}
          </Empty>
        )
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {claims.map((c) => (
            <ClaimCard key={c.id} claim={c} showSubmitter>
              {c.status === 'pending' && c.submitterId !== user.id && <ReviewForm claim={c} onDone={load} />}
              {user.role === 'admin' && c.status !== 'withdrawn' && <AdminRevert claim={c} onDone={load} />}
            </ClaimCard>
          ))}
        </div>
      )}
    </div>
  )
}
