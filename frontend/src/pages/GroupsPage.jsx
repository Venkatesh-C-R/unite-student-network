import { motion } from 'framer-motion'
import { Clock, Compass, Crown, Shield, Inbox, Plus, Search, Sparkles, Trophy, Users, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { api } from '../api'
import { useAuth, useToast } from '../context'
import { Dialog, Empty, ProgrammeChip, Skeleton, SlotDots } from '../components/app/kit'
import { formatPoints, timeAgo } from '../lib/format'
import { btn, input } from '../lib/styles'

const MAX = 6

// Why can't I ask to join this group? (null = I can)
function blocker(group, user, inUnion) {
  if (group.myRole) return 'You’re a member'
  if (inUnion) return 'You’re already in a union'
  if (group.memberCount >= MAX) return 'Union is full'
  if (group.programmes?.some((p) => p.id === user.programmeId)) return 'Your programme is taken'
  return null
}

function GroupCard({ group, footer, index = 0 }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="glass group relative flex flex-col overflow-hidden rounded-3xl p-5 transition-colors hover:border-violet-400/60"
    >
      <Link to={`/groups/${group.id}`} className="absolute inset-0 z-0" aria-label={`Open ${group.name}`} />
      <div className="pointer-events-none relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate font-display text-lg font-semibold">{group.name}</h3>
          <p className="mt-0.5 line-clamp-2 min-h-[2.5rem] text-sm text-muted">{group.description || 'No description yet.'}</p>
        </div>
        {group.myRole === 'owner' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-500">
            <Crown size={12} /> Leader
          </span>
        )}
        {group.myRole === 'deputy' && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-violet-500/15 px-2.5 py-1 text-xs font-semibold text-violet-500">
            <Shield size={12} /> Second in command
          </span>
        )}
      </div>
      <div className="pointer-events-none relative mt-4 flex flex-wrap gap-1.5">
        {group.programmes?.map((p) => <ProgrammeChip key={p.id} {...p} />)}
        {Array.from({ length: MAX - (group.programmes?.length || 0) }, (_, i) => (
          <span key={i} className="rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs text-muted/70">
            open
          </span>
        ))}
      </div>
      <div className="pointer-events-none relative mt-4 flex items-center justify-between border-t border-line pt-4 text-sm">
        <span className="flex items-center gap-2 text-muted">
          <SlotDots count={group.memberCount} /> {group.memberCount}/{MAX}
        </span>
        <span className="flex items-center gap-1.5 font-semibold">
          <Trophy size={15} className="text-amber-500" /> {formatPoints(group.points)} pts
        </span>
      </div>
      {footer && <div className="relative z-10 mt-4">{footer}</div>}
    </motion.li>
  )
}

function CreateGroupDialog({ open, onClose, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const { group } = await api('/groups', { method: 'POST', body: { name, description } })
      setName('')
      setDescription('')
      onCreated(group)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Create a union">
      <p className="-mt-2 mb-4 text-sm text-muted">You’ll be the owner and first member. Up to five more students can join — each from a different programme.</p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="g-name" className="mb-1.5 block text-sm font-semibold">
            Union name
          </label>
          <input id="g-name" className={input} value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="e.g. Team Nova" required autoFocus />
        </div>
        <div>
          <label htmlFor="g-desc" className="mb-1.5 block text-sm font-semibold">
            What is the union about? <span className="font-normal text-muted">(optional)</span>
          </label>
          <textarea
            id="g-desc"
            className={`${input} min-h-24 resize-y`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={300}
            placeholder="Hackathons, research ideas, the skills you’re looking for…"
          />
          <p className="mt-1 text-right text-xs text-muted">{description.length}/300</p>
        </div>
        {error && <p className="text-sm text-rose-400" role="alert">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btn.ghost}>
            Cancel
          </button>
          <button disabled={busy || name.trim().length < 3} className={btn.primary}>
            {busy ? 'Creating…' : 'Create union'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

export default function GroupsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [mine, setMine] = useState(null)
  const [explore, setExplore] = useState(null)
  const [query, setQuery] = useState('')
  const [openOnly, setOpenOnly] = useState(true)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState(null)

  const [invites, setInvites] = useState([])

  const loadMine = useCallback(
    () =>
      // Only students receive union invites
      Promise.all([api('/groups/mine'), user.role === 'student' ? api('/invites') : { invites: [] }])
        .then(([m, i]) => {
          setMine(m)
          setInvites(i.invites)
        })
        .catch((e) => toast(e.message, 'error')),
    [toast, user.role],
  )

  async function answerInvite(invite, decision) {
    setBusyId(`inv-${invite.id}`)
    try {
      await api(`/invites/${invite.id}/${decision}`, { method: 'POST' })
      if (decision === 'accept') {
        toast(`You joined ${invite.groupName}.`)
        navigate(`/groups/${invite.groupId}`)
      } else await loadMine()
    } catch (e) {
      toast(e.message, 'error')
      await loadMine()
    } finally {
      setBusyId(null)
    }
  }

  useEffect(() => {
    loadMine()
  }, [loadMine])

  // Search groups (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      if (openOnly) params.set('openForMe', 'true')
      api(`/groups?${params}`)
        .then((d) => setExplore(d.groups))
        .catch((e) => toast(e.message, 'error'))
    }, 250)
    return () => clearTimeout(t)
  }, [query, openOnly, toast])

  const pendingByGroup = new Map((mine?.pendingRequests || []).map((r) => [r.groupId, r]))
  const firstName = user.name.split(' ')[0]
  const ownerInbox = (mine?.groups || []).reduce((s, g) => s + (g.pendingJoinRequests || 0), 0)
  const totalPoints = (mine?.groups || []).reduce((s, g) => s + Number(g.points), 0)

  async function requestJoin(group) {
    setBusyId(group.id)
    try {
      await api(`/groups/${group.id}/join-requests`, { method: 'POST', body: {} })
      toast(`Request sent to ${group.name}.`)
      await loadMine()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  async function cancelRequest(groupId, groupName) {
    setBusyId(groupId)
    try {
      await api(`/groups/${groupId}/join-requests/mine`, { method: 'DELETE' })
      toast(`Request to ${groupName} cancelled.`)
      await loadMine()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-12">
      {/* Header */}
      <section className="glass gradient-border relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="bg-gradient-brand pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <p className="text-sm text-muted">Welcome back,</p>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Hi, <span className="text-gradient">{firstName}</span>
            </h1>
            {user.programmeName && <ProgrammeChip id={user.programmeId} level={user.programmeLevel} name={user.programmeName} className="mt-3" />}
          </div>
          <div className="flex flex-wrap gap-2">
            {mine?.groups.length === 0 && (
              <>
                <button onClick={() => setCreating(true)} className={btn.primary}>
                  <Plus size={17} /> Create union
                </button>
                <a href="#explore" className={btn.ghost}>
                  <Compass size={17} /> Explore unions
                </a>
              </>
            )}
          </div>
        </div>
        <dl className="relative mt-6 grid grid-cols-3 gap-3">
          {[
            ['My unions', mine ? mine.groups.length : '–', Users],
            ['Requests to review', mine ? ownerInbox : '–', Inbox],
            ['Points (my unions)', mine ? formatPoints(totalPoints) : '–', Trophy],
          ].map(([label, value, Icon]) => (
            <div key={label} className="rounded-2xl bg-violet-500/10 p-3 sm:p-4">
              <dt className="flex items-center gap-1.5 text-[11px] text-muted sm:text-xs">
                <Icon size={13} /> {label}
              </dt>
              <dd className="mt-1 font-display text-2xl font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      {invites.length > 0 && (
        <section aria-labelledby="inv-h">
          <h2 id="inv-h" className="mb-4 font-display text-2xl font-semibold">
            Invitations
          </h2>
          <ul className="space-y-3">
            {invites.map((inv) => (
              <li key={inv.id} className="glass flex flex-wrap items-center justify-between gap-3 rounded-md p-4">
                <p>
                  <b>{inv.inviterName || 'A member'}</b> invited you to <b>{inv.groupName}</b>
                </p>
                <div className="flex gap-2">
                  <button disabled={busyId === `inv-${inv.id}`} onClick={() => answerInvite(inv, 'accept')} className={btn.primary}>
                    Accept
                  </button>
                  <button disabled={busyId === `inv-${inv.id}`} onClick={() => answerInvite(inv, 'decline')} className={btn.ghost}>
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* My groups */}
      <section aria-labelledby="mine-h">
        <div className="mb-4 flex items-end justify-between">
          <h2 id="mine-h" className="font-display text-2xl font-semibold">
            My unions
          </h2>
        </div>
        {!mine ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        ) : mine.groups.length === 0 ? (
          <Empty
            icon={Sparkles}
            title="You’re not in a union yet"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <button onClick={() => setCreating(true)} className={btn.primary}>
                  <Plus size={17} /> Create a union
                </button>
                <a href="#explore" className={btn.ghost}>
                  Find a union to join
                </a>
              </div>
            }
          >
            Start your own team, or ask to join one that still needs your programme.
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mine.groups.map((g, i) => (
              <GroupCard
                key={g.id}
                group={g}
                index={i}
                footer={
                  g.pendingJoinRequests > 0 && (
                    <Link
                      to={`/groups/${g.id}`}
                      className="flex items-center justify-between rounded-2xl bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-600 dark:text-violet-300"
                    >
                      <span className="flex items-center gap-2">
                        <Inbox size={16} /> {g.pendingJoinRequests} join request{g.pendingJoinRequests > 1 ? 's' : ''}
                      </span>
                      Review →
                    </Link>
                  )
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* My pending requests */}
      {mine?.pendingRequests.length > 0 && (
        <section aria-labelledby="pending-h">
          <h2 id="pending-h" className="mb-4 font-display text-xl font-semibold">
            Waiting for approval
          </h2>
          <ul className="space-y-2">
            {mine.pendingRequests.map((r) => (
              <li key={r.id} className="glass flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                <Link to={`/groups/${r.groupId}`} className="flex min-w-0 items-center gap-3">
                  <Clock size={18} className="shrink-0 text-amber-500" />
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{r.groupName}</span>
                    <span className="text-xs text-muted">Requested {timeAgo(r.createdAt)}</span>
                  </span>
                </Link>
                <button onClick={() => cancelRequest(r.groupId, r.groupName)} disabled={busyId === r.groupId} className={`${btn.icon} shrink-0`} aria-label={`Cancel request to ${r.groupName}`} title="Cancel request">
                  <X size={17} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Explore */}
      <section id="explore" aria-labelledby="explore-h" className="scroll-mt-24">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 id="explore-h" className="font-display text-2xl font-semibold">
              Explore unions
            </h2>
            <p className="text-sm text-muted">Ask to join a union that still needs your programme.</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="relative block">
              <span className="sr-only">Search unions</span>
              <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className={`${input} py-2.5 pl-11 sm:w-64`} />
            </label>
            <label className="glass inline-flex cursor-pointer items-center gap-2.5 rounded-full px-4 py-2.5 text-sm font-medium select-none">
              <input type="checkbox" checked={openOnly} onChange={(e) => setOpenOnly(e.target.checked)} className="h-4 w-4 accent-violet-500" />
              Has room for my programme
            </label>
          </div>
        </div>

        {!explore ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-60" />
            ))}
          </div>
        ) : explore.length === 0 ? (
          <Empty icon={Compass} title={query ? 'No unions match that name' : 'No open unions right now'} action={<button onClick={() => setCreating(true)} className={btn.primary}><Plus size={17} /> Start one</button>}>
            {openOnly ? 'Try turning off “Has room for my programme”, or create a new union.' : 'Be the first to create one.'}
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {explore.map((g, i) => {
              const reason = blocker(g, user, mine?.groups.length > 0)
              const pending = pendingByGroup.get(g.id)
              return (
                <GroupCard
                  key={g.id}
                  group={g}
                  index={i}
                  footer={
                    g.myRole ? (
                      <Link to={`/groups/${g.id}`} className={`${btn.ghost} w-full`}>
                        Open union
                      </Link>
                    ) : pending ? (
                      <button onClick={() => cancelRequest(g.id, g.name)} disabled={busyId === g.id} className={`${btn.ghost} w-full`}>
                        <Clock size={16} className="text-amber-500" /> Requested · Cancel
                      </button>
                    ) : reason ? (
                      <p className="rounded-full border border-line py-2.5 text-center text-sm text-muted">{reason}</p>
                    ) : (
                      <button onClick={() => requestJoin(g)} disabled={busyId === g.id} className={`${btn.primary} w-full`}>
                        {busyId === g.id ? 'Sending…' : 'Ask to join'}
                      </button>
                    )
                  }
                />
              )
            })}
          </ul>
        )}
      </section>

      <CreateGroupDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(g) => {
          setCreating(false)
          toast(`${g.name} is ready. Students from other programmes can now ask to join.`)
          navigate(`/groups/${g.id}`)
        }}
      />
    </div>
  )
}
