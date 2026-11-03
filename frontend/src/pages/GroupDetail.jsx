import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeft, Check, CheckCircle2, Clock, Crown, Lock, LogOut, Pencil, Plus, Shield, ShieldOff, Trophy, UserMinus, Vote, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { useAuth, useToast } from '../context'
import { Avatar, Dialog, Empty, ProgrammeChip, Skeleton, SlotDots } from '../components/app/kit'
import { formatPoints, timeAgo } from '../lib/format'
import { btn, input } from '../lib/styles'
import { programmeColor, shortProgramme } from '../lib/programme'

// ---------- Polls ----------
function PollCard({ poll, onVote, busy }) {
  const total = poll.options.reduce((s, o) => s + o.votes, 0)
  const voted = poll.myVote != null
  const showResults = voted || poll.isClosed
  return (
    <li className="rounded-3xl border border-line bg-surface-strong p-5">
      <div className="flex items-start justify-between gap-3">
        <h4 className="font-semibold">{poll.question}</h4>
        {poll.isClosed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-500/15 px-2 py-0.5 text-xs text-muted">
            <Lock size={11} /> Closed
          </span>
        ) : poll.closesAt ? (
          <span className="shrink-0 text-xs text-muted">Closes {new Date(poll.closesAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
        ) : null}
      </div>
      <p className="mt-0.5 text-xs text-muted">
        {poll.createdBy ? `${poll.createdBy} · ` : ''}
        {timeAgo(poll.createdAt)} · {total} vote{total === 1 ? '' : 's'}
      </p>
      <ul className="mt-4 space-y-2">
        {poll.options.map((o) => {
          const pct = total ? Math.round((o.votes / total) * 100) : 0
          const mine = poll.myVote === o.id
          return (
            <li key={o.id}>
              <button
                disabled={showResults || busy}
                onClick={() => onVote(poll.id, o.id)}
                className={`relative w-full overflow-hidden rounded-2xl border px-4 py-2.5 text-left text-sm transition ${
                  mine ? 'border-violet-400' : 'border-line'
                } ${showResults ? 'cursor-default' : 'hover:border-violet-400 hover:bg-violet-500/5'}`}
              >
                {showResults && (
                  <motion.span
                    className={`absolute inset-y-0 left-0 ${mine ? 'bg-gradient-brand opacity-30' : 'bg-violet-500/15'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ type: 'spring', stiffness: 90, damping: 20 }}
                  />
                )}
                <span className="relative flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2 font-medium">
                    {mine && <CheckCircle2 size={16} className="text-violet-500" />}
                    {o.label}
                  </span>
                  {showResults && (
                    <span className="text-xs text-muted tabular-nums">
                      {o.votes} · {pct}%
                    </span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {!showResults && <p className="mt-3 text-xs text-muted">Tap an option to vote. You can vote once.</p>}
    </li>
  )
}

function CreatePollDialog({ open, onClose, groupId, onCreated }) {
  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState(['', ''])
  const [closesAt, setClosesAt] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const body = { question, options: options.map((o) => o.trim()).filter(Boolean) }
      if (closesAt) body.closesAt = new Date(closesAt).toISOString()
      const { poll } = await api(`/groups/${groupId}/polls`, { method: 'POST', body })
      setQuestion('')
      setOptions(['', ''])
      setClosesAt('')
      onCreated(poll)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="New poll" wide>
      <p className="-mt-2 mb-4 text-sm text-muted">Decide meetups, roles or plans together. Every member gets one vote.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="p-q" className="mb-1.5 block text-sm font-semibold">
            Question
          </label>
          <input id="p-q" className={input} value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={200} placeholder="When should we meet this week?" autoFocus />
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">Options</legend>
          <div className="space-y-2">
            {options.map((o, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={input}
                  value={o}
                  maxLength={100}
                  aria-label={`Option ${i + 1}`}
                  placeholder={['Saturday 10 AM, Library', 'Sunday 4 PM, Canteen', 'Online call'][i] || `Option ${i + 1}`}
                  onChange={(e) => setOptions((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {options.length > 2 && (
                  <button type="button" onClick={() => setOptions((all) => all.filter((_, j) => j !== i))} className={btn.icon} aria-label={`Remove option ${i + 1}`}>
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < 8 && (
            <button type="button" onClick={() => setOptions((all) => [...all, ''])} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 dark:text-violet-400">
              <Plus size={15} /> Add option
            </button>
          )}
        </fieldset>
        <div>
          <label htmlFor="p-close" className="mb-1.5 block text-sm font-semibold">
            Closes <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="p-close" type="datetime-local" className={input} value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
        </div>
        {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button disabled={busy || question.trim().length < 3 || options.filter((o) => o.trim()).length < 2} className={btn.primary}>
            {busy ? 'Creating…' : 'Create poll'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

// ---------- Small dialogs ----------
function EditGroupDialog({ open, onClose, group, onSaved }) {
  const [name, setName] = useState(group.name)
  const [description, setDescription] = useState(group.description)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api(`/groups/${group.id}`, { method: 'PATCH', body: { name, description } })
      onSaved()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Edit union">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="e-name" className="mb-1.5 block text-sm font-semibold">
            Name
          </label>
          <input id="e-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </div>
        <div>
          <label htmlFor="e-desc" className="mb-1.5 block text-sm font-semibold">
            Description
          </label>
          <textarea id="e-desc" className={`${input} min-h-24`} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </div>
        {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button disabled={busy || name.trim().length < 3} className={btn.primary}>
            Save
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function ConfirmDialog({ confirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={Boolean(confirm)} onClose={onClose} title={confirm?.title || ''}>
      <p className="text-muted">{confirm?.body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btn.ghost}>
          Cancel
        </button>
        <button
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            await confirm.run()
            setBusy(false)
            onClose()
          }}
          className={btn.danger}
        >
          {confirm?.action}
        </button>
      </div>
    </Dialog>
  )
}

// ---------- Page ----------
export default function GroupDetail() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [polls, setPolls] = useState(null)
  const [myPending, setMyPending] = useState(false)
  const [notFound, setNotFound] = useState(false)
  const [busy, setBusy] = useState(null)
  const [dialog, setDialog] = useState(null) // 'poll' | 'edit'
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const d = await api(`/groups/${id}`)
      setData(d)
      if (d.myRole) {
        setPolls((await api(`/groups/${id}/polls`)).polls)
      } else {
        const mine = await api('/groups/mine')
        setMyPending(mine.pendingRequests.some((r) => r.groupId === Number(id)))
      }
    } catch (e) {
      if (e.status === 404) setNotFound(true)
      else toast(e.message, 'error')
    }
  }, [id, toast])

  useEffect(() => {
    // Fetching on mount / id change; state is only set after the request resolves
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  async function act(key, fn, success) {
    setBusy(key)
    try {
      await fn()
      if (success) toast(success)
      await load()
    } catch (e) {
      toast(e.message, 'error')
      await load()
    } finally {
      setBusy(null)
    }
  }

  if (notFound)
    return (
      <Empty icon={X} title="Union not found" action={<Link to="/groups" className={btn.primary}>Back to Unions</Link>}>
        It may have been deleted when its last member left.
      </Empty>
    )
  if (!data)
    return (
      <div className="space-y-4">
        <Skeleton className="h-40" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    )

  const { group, members, myRole, maxSize, joinRequests = [] } = data
  const isOwner = myRole === 'owner'
  const isLead = isOwner || myRole === 'deputy'
  const takenProgrammes = new Set(members.map((m) => m.programmeId))
  const full = members.length >= maxSize
  const myProgrammeTaken = takenProgrammes.has(user.programmeId)

  return (
    <div className="space-y-8">
      <Link to="/groups" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> All unions
      </Link>

      {/* Header */}
      <section className="glass gradient-border relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="bg-gradient-brand pointer-events-none absolute -bottom-28 -left-20 h-64 w-64 rounded-full opacity-20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-bold break-words sm:text-4xl">{group.name}</h1>
              {myRole && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isOwner ? 'bg-amber-400/15 text-amber-500' : 'bg-violet-500/15 text-violet-500'}`}>
                  {isOwner ? 'Leader' : myRole === 'deputy' ? 'Second in command' : 'Member'}
                </span>
              )}
            </div>
            <p className="mt-2 max-w-2xl text-muted">{group.description || 'No description yet.'}</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
              <span className="flex items-center gap-2">
                <SlotDots count={members.length} max={maxSize} size={12} />
                <span>
                  <b>{members.length}</b>/{maxSize} members
                </span>
              </span>
              <span className="flex items-center gap-1.5">
                <Trophy size={16} className="text-amber-500" /> <b>{formatPoints(group.points)}</b> verified points
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {isOwner && (
              <button onClick={() => setDialog('edit')} className={btn.ghost}>
                <Pencil size={16} /> Edit
              </button>
            )}
            {myRole && (
              <button
                onClick={() =>
                  setConfirm({
                    title: 'Leave this union?',
                    body:
                      isOwner && members.length > 1
                        ? members.some((m) => m.role === 'deputy')
                          ? 'Your second in command will become the leader.'
                          : 'The longest-standing member will become the leader.'
                        : isOwner
                          ? 'You are the only member, so the union will be deleted.'
                          : 'You can ask to join again later if there is still room for your programme.',
                    action: 'Leave union',
                    run: async () => {
                      try {
                        await api(`/groups/${group.id}/members/me`, { method: 'DELETE' })
                        toast(`You left ${group.name}.`)
                        navigate('/groups')
                      } catch (e) {
                        toast(e.message, 'error')
                      }
                    },
                  })
                }
                className={btn.danger}
              >
                <LogOut size={16} /> Leave
              </button>
            )}
            {/* Only students can ask to join; faculty and admins just view */}
            {!myRole &&
              user.role === 'student' &&
              (myPending ? (
                <button
                  disabled={busy === 'join'}
                  onClick={() => act('join', () => api(`/groups/${group.id}/join-requests/mine`, { method: 'DELETE' }), 'Request cancelled.')}
                  className={btn.ghost}
                >
                  <Clock size={16} className="text-amber-500" /> Requested · Cancel
                </button>
              ) : full ? (
                <span className="rounded-full border border-line px-5 py-2.5 text-sm text-muted">Union is full</span>
              ) : myProgrammeTaken ? (
                <span className="rounded-full border border-line px-5 py-2.5 text-sm text-muted">Your programme is taken</span>
              ) : (
                <button
                  disabled={busy === 'join'}
                  onClick={() => act('join', () => api(`/groups/${group.id}/join-requests`, { method: 'POST', body: {} }), 'Request sent.')}
                  className={btn.primary}
                >
                  Ask to join
                </button>
              ))}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        {/* Members + requests */}
        <div className="space-y-8">
          <section aria-labelledby="members-h">
            <h2 id="members-h" className="mb-1 font-display text-xl font-semibold">
              Members
            </h2>
            <p className="mb-4 text-sm text-muted">One student per programme, up to {maxSize}.</p>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {members.map((m) => (
                  <motion.li
                    key={m.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center gap-3 rounded-2xl border border-line bg-surface-strong p-3"
                  >
                    <Avatar name={m.name} size={44} color={programmeColor(m.programmeId)} />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 truncate font-semibold">
                        <Link to={`/students/${m.id}`} className="truncate hover:underline">
                          {m.name}
                        </Link>
                        {m.id === user.id && <span className="text-xs font-normal text-muted">(you)</span>}
                        {m.role === 'owner' && <Crown size={14} className="shrink-0 text-amber-500" aria-label="Leader" />}
                        {m.role === 'deputy' && <Shield size={14} className="shrink-0 text-violet-500" aria-label="Second in command" />}
                      </p>
                      <p className="truncate text-xs text-muted" title={`${m.programmeLevel} · ${m.programmeName}`}>
                        {m.programmeLevel} · {m.programmeName}
                      </p>
                    </div>
                    {isOwner && m.id !== user.id && (
                      <button
                        disabled={busy === `dep-${m.id}`}
                        onClick={() =>
                          act(
                            `dep-${m.id}`,
                            () => api(`/groups/${group.id}/deputy`, { method: 'PUT', body: { userId: m.role === 'deputy' ? null : m.id } }),
                            m.role === 'deputy' ? `${m.name} is no longer second in command.` : `${m.name} is now second in command.`,
                          )
                        }
                        className={btn.icon}
                        aria-label={m.role === 'deputy' ? `Remove ${m.name} as second in command` : `Make ${m.name} second in command`}
                        title={m.role === 'deputy' ? 'Remove as second in command' : 'Make second in command'}
                      >
                        {m.role === 'deputy' ? <ShieldOff size={16} /> : <Shield size={16} />}
                      </button>
                    )}
                    {isOwner && m.id !== user.id && (
                      <button
                        onClick={() =>
                          setConfirm({
                            title: `Remove ${m.name}?`,
                            body: `${shortProgramme(m.programmeLevel, m.programmeName)} will become an open slot again.`,
                            action: 'Remove',
                            run: () => act(`rm-${m.id}`, () => api(`/groups/${group.id}/members/${m.id}`, { method: 'DELETE' }), `${m.name} was removed.`),
                          })
                        }
                        className={btn.icon}
                        aria-label={`Remove ${m.name}`}
                        title="Remove member"
                      >
                        <UserMinus size={16} />
                      </button>
                    )}
                  </motion.li>
                ))}
                {Array.from({ length: maxSize - members.length }, (_, i) => (
                  <motion.li
                    key={`open-${i}`}
                    layout
                    className="grid min-h-[70px] place-items-center rounded-2xl border border-dashed border-line px-3 text-center text-xs text-muted"
                  >
                    Open slot · any other programme
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </section>

          {isLead && (
            <section aria-labelledby="req-h">
              <h2 id="req-h" className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
                Join requests
                {joinRequests.length > 0 && <span className="bg-gradient-brand rounded-full px-2 py-0.5 text-xs text-white">{joinRequests.length}</span>}
              </h2>
              {joinRequests.length === 0 ? (
                <p className="glass rounded-2xl px-5 py-6 text-center text-sm text-muted">No requests right now. Students who ask to join will appear here.</p>
              ) : (
                <ul className="space-y-3">
                  {joinRequests.map((r) => {
                    const clash = takenProgrammes.has(r.programmeId)
                    const blocked = full ? 'Union is full' : clash ? 'Programme already in union' : null
                    return (
                      <li key={r.id} className="glass rounded-2xl p-4">
                        <div className="flex items-start gap-3">
                          <Avatar name={r.name} size={40} />
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{r.name}</p>
                            <ProgrammeChip id={r.programmeId} level={r.programmeLevel} name={r.programmeName} className="mt-1" />
                            {r.message && <p className="mt-2 text-sm text-muted">“{r.message}”</p>}
                            <p className="mt-1 text-xs text-muted">{timeAgo(r.createdAt)}</p>
                          </div>
                        </div>
                        {blocked && <p className="mt-3 rounded-xl bg-rose-500/10 px-3 py-2 text-xs text-rose-400">{blocked} — approving will be refused.</p>}
                        <div className="mt-3 flex justify-end gap-2">
                          <button
                            disabled={busy === `r-${r.id}`}
                            onClick={() => act(`r-${r.id}`, () => api(`/groups/${group.id}/join-requests/${r.id}/reject`, { method: 'POST' }), 'Request declined.')}
                            className={btn.ghost}
                          >
                            <X size={16} /> Decline
                          </button>
                          <button
                            disabled={busy === `r-${r.id}` || Boolean(blocked)}
                            onClick={() => act(`r-${r.id}`, () => api(`/groups/${group.id}/join-requests/${r.id}/approve`, { method: 'POST' }), `${r.name} joined the group.`)}
                            className={btn.primary}
                          >
                            <Check size={16} /> Approve
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Polls */}
        <section aria-labelledby="polls-h">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <h2 id="polls-h" className="font-display text-xl font-semibold">
                Polls
              </h2>
              <p className="text-sm text-muted">Plan meetups and decisions together.</p>
            </div>
            {myRole && (
              <button onClick={() => setDialog('poll')} className={btn.primary}>
                <Plus size={16} /> New poll
              </button>
            )}
          </div>
          {!myRole ? (
            <p className="glass flex items-center gap-3 rounded-2xl px-5 py-6 text-sm text-muted">
              <Lock size={18} className="shrink-0" /> Polls are visible to union members only.
            </p>
          ) : !polls ? (
            <Skeleton className="h-40" />
          ) : polls.length === 0 ? (
            <Empty icon={Vote} title="No polls yet" action={<button onClick={() => setDialog('poll')} className={btn.primary}><Plus size={16} /> Start a poll</button>}>
              Ask the union when and where to meet, or which event to take on next.
            </Empty>
          ) : (
            <ul className="space-y-4">
              {polls.map((p) => (
                <PollCard
                  key={p.id}
                  poll={p}
                  busy={busy === `v-${p.id}`}
                  onVote={(pollId, optionId) =>
                    act(`v-${pollId}`, async () => {
                      const { poll } = await api(`/polls/${pollId}/vote`, { method: 'POST', body: { optionId } })
                      setPolls((all) => all.map((x) => (x.id === poll.id ? poll : x)))
                    }, 'Vote recorded.')
                  }
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <CreatePollDialog
        open={dialog === 'poll'}
        onClose={() => setDialog(null)}
        groupId={group.id}
        onCreated={(poll) => {
          setDialog(null)
          setPolls((all) => [poll, ...(all || [])])
          toast('Poll created. Members have been notified.')
        }}
      />
      {dialog === 'edit' && (
        <EditGroupDialog
          open
          onClose={() => setDialog(null)}
          group={group}
          onSaved={() => {
            setDialog(null)
            toast('Union updated.')
            load()
          }}
        />
      )}
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}
