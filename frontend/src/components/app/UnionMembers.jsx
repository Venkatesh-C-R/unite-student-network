import { ArrowDownUp, Crown, Inbox, Search, Shield, Trophy, UserRound, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api'
import { formatPoints } from '../../lib/format'
import { programmeColor } from '../../lib/programme'
import { input } from '../../lib/styles'
import { Avatar, ProgrammeChip, Skeleton, SlotDots } from './kit'

const ROLE = {
  owner: { label: 'Leader', icon: Crown, cls: 'bg-amber-400/15 text-amber-600 dark:text-amber-300' },
  deputy: { label: 'Second in command', icon: Shield, cls: 'bg-violet-500/15 text-violet-600 dark:text-violet-300' },
  member: { label: 'Member', icon: UserRound, cls: 'bg-[var(--bg-2)] text-muted' },
}
const RANK = { owner: 0, deputy: 1, member: 2 }
const SORTS = [
  ['role', 'Role'],
  ['newest', 'Newest member'],
  ['oldest', 'Oldest member'],
  ['name', 'Name A–Z'],
]

const when = (d) => new Date(d).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })

// "My union" opened out like a server's member list: who is in it, since when, and their role.
export default function UnionMembers({ group }) {
  const [data, setData] = useState(null)
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('role')

  useEffect(() => {
    api(`/groups/${group.id}`)
      .then(setData)
      .catch(() => setData({ members: [] }))
  }, [group.id])

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (data?.members || []).filter((m) => !needle || m.name.toLowerCase().includes(needle) || (m.rollNo || '').toLowerCase().includes(needle))
    const by = {
      role: (a, b) => RANK[a.role] - RANK[b.role] || new Date(a.joinedAt) - new Date(b.joinedAt),
      newest: (a, b) => new Date(b.joinedAt) - new Date(a.joinedAt),
      oldest: (a, b) => new Date(a.joinedAt) - new Date(b.joinedAt),
      name: (a, b) => a.name.localeCompare(b.name),
    }[sort]
    return [...list].sort(by)
  }, [data, q, sort])

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <div className="flex flex-col gap-4 border-b border-line p-5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <Link to={`/groups/${group.id}`} className="font-display text-2xl font-bold hover:text-violet-500">
            {group.name}
          </Link>
          {group.description && <p className="mt-1 line-clamp-2 text-sm text-muted">{group.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <span className="flex items-center gap-1.5">
              <Users size={15} className="text-muted" /> {group.memberCount}/6 members
            </span>
            <SlotDots count={group.memberCount} />
            <span className="flex items-center gap-1.5">
              <Trophy size={15} className="text-muted" /> {formatPoints(group.points)} pts
            </span>
            {group.pendingJoinRequests > 0 && (
              <Link to={`/groups/${group.id}`} className="flex items-center gap-1.5 font-semibold text-violet-500 hover:underline">
                <Inbox size={15} /> {group.pendingJoinRequests} join request{group.pendingJoinRequests > 1 ? 's' : ''} to review
              </Link>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <label className="relative block md:w-64">
            <span className="sr-only">Search members</span>
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name or roll no." className={`${input} py-2 pl-10 text-sm`} />
          </label>
          <label className="relative block">
            <span className="sr-only">Sort members</span>
            <ArrowDownUp size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
            <select value={sort} onChange={(e) => setSort(e.target.value)} className={`${input} w-auto py-2 pl-9 text-sm`}>
              {SORTS.map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {!data ? (
        <Skeleton className="m-5 h-48" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th className="px-5 py-3 font-semibold">Name</th>
                <th className="hidden px-3 py-3 font-semibold md:table-cell">Member since</th>
                <th className="hidden px-3 py-3 font-semibold lg:table-cell">Joined UNITE</th>
                <th className="hidden px-3 py-3 font-semibold sm:table-cell">Programme</th>
                <th className="px-3 py-3 font-semibold">Role</th>
                <th className="px-5 py-3">
                  <span className="sr-only">Profile</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => {
                const role = ROLE[m.role]
                const RoleIcon = role.icon
                return (
                  <tr key={m.id} className="border-b border-line transition-colors last:border-0 hover:bg-[var(--bg-2)]">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={m.name} size={38} color={programmeColor(m.programmeId)} />
                        <div className="min-w-0">
                          <p className="truncate font-semibold">{m.name}</p>
                          <p className="truncate text-xs text-muted">
                            {m.rollNo}
                            {m.year ? ` · Year ${m.year}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 whitespace-nowrap md:table-cell">{when(m.joinedAt)}</td>
                    <td className="hidden px-3 py-3 whitespace-nowrap lg:table-cell">{when(m.accountCreatedAt)}</td>
                    <td className="hidden px-3 py-3 sm:table-cell">
                      <ProgrammeChip id={m.programmeId} level={m.programmeLevel} name={m.programmeName} />
                    </td>
                    <td className="px-3 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${role.cls}`}>
                        <RoleIcon size={13} /> {role.label}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        to={`/students/${m.id}`}
                        className="inline-grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-[var(--bg-2)] hover:text-ink"
                        aria-label={`View ${m.name}'s profile`}
                        title="View profile"
                      >
                        <UserRound size={17} />
                      </Link>
                    </td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-muted">
                    No members match “{q}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
