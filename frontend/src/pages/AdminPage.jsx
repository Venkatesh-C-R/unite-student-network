import { LayoutGroup, motion } from 'framer-motion'
import { Ban, CheckCircle2, ClipboardCheck, Flag, GraduationCap, RotateCcw, Search, ShieldCheck, UserCog, Users, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import { Avatar, Dialog, Empty, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { timeAgo } from '../lib/format'
import { programmeColor } from '../lib/programme'
import { btn, input } from '../lib/styles'

const ROLE_STYLE = {
  student: 'bg-violet-500/15 text-violet-500',
  faculty: 'bg-cyan-500/15 text-cyan-500',
  admin: 'bg-amber-400/15 text-amber-500',
}

function RoleBadge({ role }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${ROLE_STYLE[role]}`}>{role}</span>
}

function StatusBadge({ active }) {
  return active ? (
    <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-500">Active</span>
  ) : (
    <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-[11px] font-semibold text-rose-400">Suspended</span>
  )
}

// Shared confirm dialog: { title, body, action, danger, run }
function Confirm({ confirm, onClose }) {
  const [busy, setBusy] = useState(false)
  return (
    <Dialog open={Boolean(confirm)} onClose={onClose} title={confirm?.title || ''}>
      <p className="text-muted">{confirm?.body}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button onClick={onClose} className={btn.ghost} disabled={busy}>
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
          className={confirm?.danger ? btn.danger : btn.primary}
        >
          {confirm?.action}
        </button>
      </div>
    </Dialog>
  )
}

// ---------- Reports ----------
function ReportsTab({ onChanged }) {
  const toast = useToast()
  const [status, setStatus] = useState('open')
  const [reports, setReports] = useState(null)
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(() => {
    api(`/admin/reports?status=${status}`)
      .then((d) => setReports(d.reports))
      .catch((e) => toast(e.message, 'error'))
  }, [status, toast])

  useEffect(() => {
    load()
  }, [load])

  async function act(fn, message) {
    try {
      await fn()
      toast(message)
    } catch (e) {
      toast(e.message, 'error')
    }
    load()
    onChanged()
  }

  const resolve = (r) => api(`/admin/reports/${r.id}/resolve`, { method: 'POST' })
  const setActive = (userId, active) => api(`/admin/users/${userId}/active`, { method: 'POST', body: { active } })

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[
          ['open', 'Open'],
          ['resolved', 'Resolved'],
        ].map(([k, l]) => (
          <button
            key={k}
            onClick={() => {
              setReports(null)
              setStatus(k)
            }}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${status === k ? 'bg-gradient-brand text-white' : 'glass text-muted hover:text-ink'}`}
          >
            {l}
          </button>
        ))}
      </div>

      {!reports ? (
        <Skeleton className="h-40" />
      ) : reports.length === 0 ? (
        <Empty icon={CheckCircle2} title={status === 'open' ? 'No open reports' : 'No resolved reports yet'}>
          {status === 'open' ? 'When students report someone, it shows up here.' : 'Reports you close are kept here for reference.'}
        </Empty>
      ) : (
        <ul className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {reports.map((r) => (
            <motion.li key={r.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-3xl p-5">
              <div className="flex items-start gap-3">
                <Avatar name={r.reportedName} size={44} color={r.reportedActive ? undefined : '#64748b'} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {r.reportedName} <RoleBadge role={r.reportedRole} /> <StatusBadge active={r.reportedActive} />
                  </p>
                  <p className="truncate text-xs text-muted">{r.reportedEmail}</p>
                  {r.reportsAgainst > 1 && (
                    <p className="mt-1 inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-400">
                      <Flag size={12} /> Reported {r.reportsAgainst} times
                    </p>
                  )}
                </div>
              </div>
              <blockquote className="mt-4 rounded-2xl border-l-4 border-violet-400 bg-violet-500/5 px-4 py-3 text-sm">“{r.reason}”</blockquote>
              <p className="mt-2 text-xs text-muted">
                Reported by {r.reporterName} · {timeAgo(r.createdAt)}
                {r.status === 'resolved' && ` · resolved by ${r.resolvedByName || 'an admin'} ${timeAgo(r.resolvedAt)}`}
              </p>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Link to={`/students/${r.reportedId}`} className={`${btn.ghost} px-4 py-2`}>
                  View profile
                </Link>
                {r.reportedActive ? (
                  r.reportedRole !== 'admin' && (
                    <button
                      onClick={() =>
                        setConfirm({
                          title: `Suspend ${r.reportedName}?`,
                          body: 'They are signed out at once and cannot sign in until restored. Their data is kept.' + (r.status === 'open' ? ' This report will be marked resolved.' : ''),
                          action: 'Suspend',
                          danger: true,
                          run: () =>
                            act(async () => {
                              await setActive(r.reportedId, false)
                              if (r.status === 'open') await resolve(r)
                            }, `${r.reportedName} is suspended.`),
                        })
                      }
                      className={`${btn.danger} px-4 py-2`}
                    >
                      <Ban size={15} /> Suspend{r.status === 'open' ? ' & resolve' : ''}
                    </button>
                  )
                ) : (
                  <button onClick={() => act(() => setActive(r.reportedId, true), `${r.reportedName} is restored.`)} className={`${btn.ghost} px-4 py-2`}>
                    <RotateCcw size={15} /> Restore account
                  </button>
                )}
                {r.status === 'open' && (
                  <button onClick={() => act(() => resolve(r), 'Report dismissed.')} className={`${btn.primary} px-4 py-2`}>
                    <CheckCircle2 size={15} /> Dismiss
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
      <Confirm confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

// ---------- Users ----------
function UsersTab({ onChanged }) {
  const { user: me } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [users, setUsers] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let current = true
    const t = setTimeout(() => {
      const p = new URLSearchParams({ page: String(page) })
      if (q.trim()) p.set('q', q.trim())
      if (role) p.set('role', role)
      if (status) p.set('status', status)
      api(`/admin/users?${p}`)
        .then((d) => {
          if (!current) return
          setUsers((prev) => (page === 1 ? d.users : [...(prev || []), ...d.users]))
          setHasMore(d.hasMore)
        })
        .catch((e) => current && toast(e.message, 'error'))
    }, 250)
    return () => {
      current = false
      clearTimeout(t)
    }
  }, [q, role, status, page, reload, toast])

  // Filters start again from the first page
  const filterKey = `${q}|${role}|${status}`
  const [lastKey, setLastKey] = useState(filterKey)
  if (lastKey !== filterKey) {
    setLastKey(filterKey)
    setPage(1)
  }

  async function act(fn, message) {
    try {
      await fn()
      toast(message)
    } catch (e) {
      toast(e.message, 'error')
    }
    setPage(1)
    setReload((n) => n + 1)
    onChanged()
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_10rem_10rem]">
        <label className="relative block">
          <span className="sr-only">Search users</span>
          <Search size={17} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or roll number" className={`${input} pl-11`} />
        </label>
        <select value={role} onChange={(e) => setRole(e.target.value)} className={input} aria-label="Filter by role">
          <option value="">All roles</option>
          <option value="student">Students</option>
          <option value="faculty">Faculty</option>
          <option value="admin">Admins</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={input} aria-label="Filter by status">
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {!users ? (
        <Skeleton className="h-64" />
      ) : users.length === 0 ? (
        <Empty icon={Users} title="No users match">
          Try a different search or filter.
        </Empty>
      ) : (
        <>
          <ul className="space-y-2">
            {users.map((u) => {
              const isMe = u.id === me.id
              return (
                <li key={u.id} className={`glass flex flex-col gap-3 rounded-2xl p-4 md:flex-row md:items-center ${u.isActive ? '' : 'opacity-75'}`}>
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={u.name} size={42} color={!u.isActive ? '#64748b' : u.programmeId ? programmeColor(u.programmeId) : undefined} />
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 font-semibold">
                        {u.name} {isMe && <span className="text-xs font-normal text-muted">(you)</span>}
                        <RoleBadge role={u.role} /> <StatusBadge active={u.isActive} />
                        {u.openReports > 0 && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[11px] font-semibold text-rose-400">
                            <Flag size={11} /> {u.openReports} open
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {u.email}
                        {u.programmeName ? ` · ${u.programmeLevel} ${u.programmeName}` : ''}
                        {u.role === 'student' ? ` · ${u.groupCount} group${u.groupCount === 1 ? '' : 's'}` : ''} · joined {timeAgo(u.createdAt)}
                      </p>
                    </div>
                  </div>
                  {!isMe && (
                    <div className="flex shrink-0 items-center gap-2">
                      <label className="sr-only" htmlFor={`role-${u.id}`}>
                        Role for {u.name}
                      </label>
                      <select
                        id={`role-${u.id}`}
                        value={u.role}
                        onChange={(e) => {
                          const next = e.target.value
                          setConfirm({
                            title: `Make ${u.name} ${next === 'admin' ? 'an admin' : next}?`,
                            body:
                              next === 'admin'
                                ? 'Admins can review claims, handle reports, change roles and suspend accounts.'
                                : next === 'faculty'
                                  ? 'Faculty can approve and reject achievement claims. They cannot join groups or submit claims.'
                                  : 'Students can join groups, submit claims and use Discover.',
                            action: 'Change role',
                            run: () => act(() => api(`/admin/users/${u.id}/role`, { method: 'POST', body: { role: next } }), `${u.name} is now ${next}.`),
                          })
                        }}
                        className={`${input} w-auto py-2 text-sm`}
                      >
                        <option value="student" disabled={!u.programmeId}>
                          Student
                        </option>
                        <option value="faculty">Faculty</option>
                        <option value="admin">Admin</option>
                      </select>
                      {u.isActive ? (
                        <button
                          onClick={() =>
                            setConfirm({
                              title: `Suspend ${u.name}?`,
                              body: 'They are signed out at once and cannot sign in until restored. Their data is kept.',
                              action: 'Suspend',
                              danger: true,
                              run: () => act(() => api(`/admin/users/${u.id}/active`, { method: 'POST', body: { active: false } }), `${u.name} is suspended.`),
                            })
                          }
                          className={`${btn.danger} px-4 py-2`}
                        >
                          <Ban size={15} /> Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => act(() => api(`/admin/users/${u.id}/active`, { method: 'POST', body: { active: true } }), `${u.name} is restored.`)}
                          className={`${btn.ghost} px-4 py-2`}
                        >
                          <RotateCcw size={15} /> Restore
                        </button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
          {hasMore && (
            <div className="text-center">
              <button onClick={() => setPage((p) => p + 1)} className={btn.ghost}>
                Load more
              </button>
            </div>
          )}
        </>
      )}
      <Confirm confirm={confirm} onClose={() => setConfirm(null)} />
    </div>
  )
}

// ---------- Page ----------
export default function AdminPage() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'users' ? 'users' : 'reports'
  const [stats, setStats] = useState(null)

  const loadStats = useCallback(() => {
    api('/admin/stats')
      .then((d) => setStats(d.stats))
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (user.role === 'admin') loadStats()
  }, [loadStats, user.role])

  if (user.role !== 'admin')
    return (
      <Empty icon={ShieldCheck} title="Admins only">
        This page is for UNITE administrators.
      </Empty>
    )

  const cards = [
    ['Open reports', stats?.openReports, Flag, 'text-rose-400'],
    ['Pending claims', stats?.pendingClaims, ClipboardCheck, 'text-amber-500'],
    ['Students', stats?.students, GraduationCap, ''],
    ['Faculty & admins', stats?.staff, UserCog, ''],
    ['Groups', stats?.groupCount, UsersRound, ''],
    ['Suspended', stats?.suspended, Ban, 'text-muted'],
  ]

  return (
    <div className="space-y-8">
      <section>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Admin <span className="text-gradient">console</span>
        </h1>
        <p className="mt-1 text-muted">Handle reports, manage roles and keep UNITE safe.</p>
      </section>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map(([label, value, Icon, cls]) => {
          const content = (
            <>
              <dt className="flex items-center gap-1.5 text-xs text-muted">
                <Icon size={14} /> {label}
              </dt>
              <dd className={`mt-1 font-display text-2xl font-bold ${cls}`}>{value ?? '–'}</dd>
            </>
          )
          return label === 'Pending claims' ? (
            <Link key={label} to="/review" className="glass rounded-2xl p-4 transition hover:border-violet-400/60">
              {content}
            </Link>
          ) : (
            <div key={label} className="glass rounded-2xl p-4">
              {content}
            </div>
          )
        })}
      </dl>

      <LayoutGroup id="admin-tabs">
        <div role="tablist" className="glass inline-flex rounded-full p-1">
          {[
            ['reports', 'Reports'],
            ['users', 'Users'],
          ].map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setParams(key === 'reports' ? {} : { tab: key }, { replace: true })}
              className={`relative rounded-full px-5 py-2 text-sm font-semibold transition-colors ${tab === key ? 'text-white' : 'text-muted hover:text-ink'}`}
            >
              {tab === key && <motion.span layoutId="admin-pill" className="bg-gradient-brand absolute inset-0 rounded-full" />}
              <span className="relative flex items-center gap-1.5">
                {label}
                {key === 'reports' && stats?.openReports > 0 && (
                  <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">{stats.openReports}</span>
                )}
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      {tab === 'reports' ? <ReportsTab onChanged={loadStats} /> : <UsersTab onChanged={loadStats} />}
    </div>
  )
}
