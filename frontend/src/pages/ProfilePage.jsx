import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { Ban, Check, Eye, Mail, Plus, Save, UserMinus, Users, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import { Avatar, Dialog, Empty, ProgrammeChip, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { timeAgo } from '../lib/format'
import { programmeColor } from '../lib/programme'
import { btn, input } from '../lib/styles'

const MAX_INTERESTS = 15
const MAX_LINKS = 10

function isHttpUrl(v) {
  try {
    const u = new URL(v)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

// ---------- About me (edit) ----------
function InterestInput({ value, onChange, suggestions }) {
  const [draft, setDraft] = useState('')
  const add = (raw) => {
    const v = raw.trim().toLowerCase().slice(0, 40)
    if (!v || value.includes(v) || value.length >= MAX_INTERESTS) return
    onChange([...value, v])
  }
  return (
    <div>
      <div className={`${input} flex flex-wrap items-center gap-2 py-2`}>
        {value.map((i) => (
          <span key={i} className="bg-gradient-brand inline-flex items-center gap-1 rounded-full py-1 pr-1.5 pl-3 text-xs font-semibold text-white">
            {i}
            <button type="button" onClick={() => onChange(value.filter((x) => x !== i))} className="rounded-full p-0.5 hover:bg-white/20" aria-label={`Remove ${i}`}>
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(draft)
              setDraft('')
            } else if (e.key === 'Backspace' && !draft && value.length) {
              onChange(value.slice(0, -1))
            }
          }}
          onBlur={() => {
            add(draft)
            setDraft('')
          }}
          placeholder={value.length >= MAX_INTERESTS ? 'Limit reached' : value.length ? 'Add another…' : 'Type an interest and press Enter'}
          disabled={value.length >= MAX_INTERESTS}
          className="min-w-32 flex-1 bg-transparent py-1 text-sm outline-none"
          aria-label="Add interest"
        />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-muted">
          {value.length}/{MAX_INTERESTS}
          {suggestions.length > 0 && ' · Popular:'}
        </span>
        {suggestions
          .filter((s) => !value.includes(s))
          .slice(0, 8)
          .map((s) => (
            <button key={s} type="button" onClick={() => add(s)} className="rounded-full border border-line px-2.5 py-0.5 text-muted hover:border-violet-400 hover:text-ink">
              + {s}
            </button>
          ))}
      </div>
    </div>
  )
}

function AboutTab({ profile, onSaved }) {
  const toast = useToast()
  const [about, setAbout] = useState(profile.about)
  const [interests, setInterests] = useState(profile.interests)
  const [links, setLinks] = useState(profile.links.length ? profile.links : [])
  const [popular, setPopular] = useState([])
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/interests/popular')
      .then((d) => setPopular(d.interests.map((i) => i.interest)))
      .catch(() => {})
  }, [])

  const dirty =
    about !== profile.about || JSON.stringify(interests) !== JSON.stringify(profile.interests) || JSON.stringify(links) !== JSON.stringify(profile.links)
  const linkErrors = links.map((l) => (!l.label.trim() ? 'Add a label' : !isHttpUrl(l.url.trim()) ? 'Use a full https:// link' : null))
  const valid = linkErrors.every((e) => !e)

  async function save(e) {
    e.preventDefault()
    setBusy(true)
    try {
      const { profile: saved } = await api('/me/profile', {
        method: 'PUT',
        body: { about, interests, links: links.map((l) => ({ label: l.label.trim(), url: l.url.trim() })) },
      })
      // The parent re-keys this form with the saved profile, which resets the fields
      onSaved(saved)
      toast('Profile saved.')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <section>
        <label htmlFor="about" className="font-display text-lg font-semibold">
          About
        </label>
        <p className="mb-2 text-sm text-muted">A few lines about you — what you study, build or want to work on.</p>
        <textarea
          id="about"
          value={about}
          onChange={(e) => setAbout(e.target.value)}
          maxLength={600}
          className={`${input} min-h-32 resize-y`}
          placeholder="e.g. MCA student who enjoys web apps and wants to team up for hackathons."
        />
        <p className="mt-1 text-right text-xs text-muted">{about.length}/600</p>
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold">Interests</h3>
        <p className="mb-2 text-sm text-muted">Subjects and skills. Other students can find you by these.</p>
        <InterestInput value={interests} onChange={setInterests} suggestions={popular} />
      </section>

      <section>
        <h3 className="font-display text-lg font-semibold">Links</h3>
        <p className="mb-3 text-sm text-muted">GitHub, LinkedIn, LeetCode, a portfolio — any link you like.</p>
        <ul className="space-y-3">
          <AnimatePresence initial={false}>
            {links.map((l, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-[minmax(0,0.4fr)_minmax(0,1fr)_auto] gap-2">
                  <input
                    className={input}
                    placeholder="Label"
                    aria-label={`Link ${i + 1} label`}
                    maxLength={40}
                    value={l.label}
                    onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  />
                  <input
                    className={`${input} ${l.url && linkErrors[i] ? 'border-rose-500' : ''}`}
                    placeholder="https://"
                    aria-label={`Link ${i + 1} URL`}
                    inputMode="url"
                    maxLength={500}
                    value={l.url}
                    onChange={(e) => setLinks((all) => all.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))}
                  />
                  <button type="button" onClick={() => setLinks((all) => all.filter((_, j) => j !== i))} className={`${btn.icon} self-center`} aria-label={`Remove link ${i + 1}`}>
                    <X size={16} />
                  </button>
                </div>
                {(l.label || l.url) && linkErrors[i] && <p className="mt-1 text-xs text-rose-400">{linkErrors[i]}</p>}
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
        {links.length < MAX_LINKS && (
          <button type="button" onClick={() => setLinks((all) => [...all, { label: '', url: '' }])} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-600 dark:text-violet-400">
            <Plus size={16} /> Add link
          </button>
        )}
      </section>

      <div className="glass sticky bottom-24 z-10 flex items-center justify-between gap-3 rounded-2xl px-4 py-3 md:bottom-4">
        <span className="text-sm text-muted">{dirty ? 'You have unsaved changes.' : 'All changes saved.'}</span>
        <button disabled={!dirty || !valid || busy} className={btn.primary}>
          <Save size={16} /> {busy ? 'Saving…' : 'Save profile'}
        </button>
      </div>
    </form>
  )
}

// ---------- Friends ----------
function PersonRow({ person, children }) {
  return (
    <li className="glass flex items-center gap-3 rounded-2xl p-3">
      <Link to={`/students/${person.userId ?? person.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={person.name} size={42} color={person.programmeId ? programmeColor(person.programmeId) : undefined} />
        <span className="min-w-0">
          <span className="block truncate font-semibold">{person.name}</span>
          <span className="block truncate text-xs text-muted">
            {person.programmeLevel ? `${person.programmeLevel} · ${person.programmeName}` : ''}
            {person.createdAt ? ` · ${timeAgo(person.createdAt)}` : ''}
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5">{children}</div>
    </li>
  )
}

function FriendsTab({ onCount }) {
  const toast = useToast()
  const [friends, setFriends] = useState(null)
  const [requests, setRequests] = useState([])
  const [confirm, setConfirm] = useState(null)

  const load = useCallback(async () => {
    try {
      const [f, r] = await Promise.all([api('/friends'), api('/friends/requests')])
      setFriends(f.friends)
      setRequests(r.requests)
      onCount(r.requests.filter((x) => x.direction === 'incoming').length)
    } catch (e) {
      toast(e.message, 'error')
    }
  }, [toast, onCount])

  useEffect(() => {
    // Fetching on mount; state is only set after the requests resolve
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  async function act(path, message) {
    try {
      await api(path, { method: 'POST' })
      if (message) toast(message)
    } catch (e) {
      toast(e.message, 'error')
    }
    load()
  }

  if (!friends) return <Skeleton className="h-48" />
  const incoming = requests.filter((r) => r.direction === 'incoming')
  const outgoing = requests.filter((r) => r.direction === 'outgoing')

  return (
    <div className="space-y-8">
      {incoming.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-lg font-semibold">Friend requests</h3>
          <ul className="space-y-2">
            {incoming.map((r) => (
              <PersonRow key={r.id} person={r}>
                <button onClick={() => act(`/friends/requests/${r.id}/accept`, `You and ${r.name} are now friends.`)} className={`${btn.primary} px-4 py-2`}>
                  <Check size={16} /> Accept
                </button>
                <button onClick={() => act(`/friends/requests/${r.id}/reject`)} className={btn.icon} aria-label={`Decline ${r.name}`} title="Decline">
                  <X size={16} />
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-3 font-display text-lg font-semibold">
          Friends <span className="text-base font-normal text-muted">({friends.length})</span>
        </h3>
        {friends.length === 0 ? (
          <Empty icon={Users} title="No friends yet" action={<Link to="/discover" className={btn.primary}>Discover students</Link>}>
            Friends can be from any programme — even your own.
          </Empty>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {friends.map((f) => (
              <PersonRow key={f.id} person={f}>
                <button
                  onClick={() =>
                    setConfirm({
                      name: f.name,
                      run: async () => {
                        try {
                          await api(`/friends/${f.id}`, { method: 'DELETE' })
                          toast(`${f.name} removed from friends.`)
                        } catch (e) {
                          toast(e.message, 'error')
                        }
                        load()
                      },
                    })
                  }
                  className={btn.icon}
                  aria-label={`Remove ${f.name} from friends`}
                  title="Remove friend"
                >
                  <UserMinus size={16} />
                </button>
              </PersonRow>
            ))}
          </ul>
        )}
      </section>

      {outgoing.length > 0 && (
        <section>
          <h3 className="mb-3 font-display text-lg font-semibold">Sent requests</h3>
          <ul className="space-y-2">
            {outgoing.map((r) => (
              <PersonRow key={r.id} person={r}>
                <button onClick={() => act(`/friends/requests/${r.id}/cancel`, 'Request cancelled.')} className={`${btn.ghost} px-4 py-2`}>
                  Cancel
                </button>
              </PersonRow>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={Boolean(confirm)} onClose={() => setConfirm(null)} title={`Remove ${confirm?.name}?`}>
        <p className="text-muted">You can send a new friend request later.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setConfirm(null)} className={btn.ghost}>
            Cancel
          </button>
          <button
            onClick={async () => {
              await confirm.run()
              setConfirm(null)
            }}
            className={btn.danger}
          >
            Remove
          </button>
        </div>
      </Dialog>
    </div>
  )
}

function BlockedTab() {
  const toast = useToast()
  const [blocked, setBlocked] = useState(null)
  const load = useCallback(() => api('/blocks').then((d) => setBlocked(d.blocked)).catch((e) => toast(e.message, 'error')), [toast])
  useEffect(() => {
    load()
  }, [load])

  if (!blocked) return <Skeleton className="h-32" />
  if (!blocked.length)
    return (
      <Empty icon={Ban} title="You haven’t blocked anyone">
        Blocked students can’t find you, see your profile or send you requests. Block someone from their profile page.
      </Empty>
    )
  return (
    <ul className="space-y-2">
      {blocked.map((b) => (
        <li key={b.id} className="glass flex items-center gap-3 rounded-2xl p-3">
          <Avatar name={b.name} size={40} color="#64748b" />
          <span className="flex-1 font-semibold">{b.name}</span>
          <button
            onClick={async () => {
              try {
                await api(`/blocks/${b.id}`, { method: 'DELETE' })
                toast(`${b.name} unblocked.`)
              } catch (e) {
                toast(e.message, 'error')
              }
              load()
            }}
            className={`${btn.ghost} px-4 py-2`}
          >
            Unblock
          </button>
        </li>
      ))}
    </ul>
  )
}

// ---------- Page ----------
const TABS = [
  ['about', 'About me'],
  ['friends', 'Friends'],
  ['blocked', 'Blocked'],
]

export default function ProfilePage() {
  const { user } = useAuth()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const tab = TABS.some(([k]) => k === params.get('tab')) ? params.get('tab') : 'about'
  const [profile, setProfile] = useState(null)
  const [incoming, setIncoming] = useState(0)

  useEffect(() => {
    api('/me/profile')
      .then((d) => setProfile(d.profile))
      .catch((e) => toast(e.message, 'error'))
    api('/friends/requests')
      .then((d) => setIncoming(d.requests.filter((r) => r.direction === 'incoming').length))
      .catch(() => {})
  }, [toast])

  const completeness = useMemo(() => {
    if (!profile) return 0
    return Math.round(((profile.about ? 1 : 0) + (profile.interests.length ? 1 : 0) + (profile.links.length ? 1 : 0)) * (100 / 3))
  }, [profile])

  return (
    <div className="space-y-8">
      {/* Header */}
      <section className="glass gradient-border relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="bg-gradient-brand pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-25 blur-3xl" />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="bg-gradient-brand w-fit rounded-full p-[3px]">
            <Avatar name={user.name} size={88} color={user.programmeId ? programmeColor(user.programmeId) : undefined} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold break-words">{user.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {user.programmeName && <ProgrammeChip id={user.programmeId} level={user.programmeLevel} name={user.programmeName} />}
              {user.year && <span>Year {user.year}</span>}
              {user.rollNo && <span>· {user.rollNo}</span>}
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
              <Mail size={14} /> {user.email}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link to={`/students/${user.id}`} className={btn.ghost}>
              <Eye size={16} /> View as others
            </Link>
            <div className="w-48">
              <div className="mb-1 flex justify-between text-xs text-muted">
                <span>Profile</span>
                <span>{completeness}% complete</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-violet-500/15">
                <motion.div className="bg-gradient-brand h-full" animate={{ width: `${completeness}%` }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <LayoutGroup id="profile-tabs">
        <div role="tablist" className="glass inline-flex rounded-full p-1">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              role="tab"
              aria-selected={tab === key}
              onClick={() => setParams(key === 'about' ? {} : { tab: key }, { replace: true })}
              className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors sm:px-5 ${tab === key ? 'text-white' : 'text-muted hover:text-ink'}`}
            >
              {tab === key && <motion.span layoutId="tab-pill" className="bg-gradient-brand absolute inset-0 rounded-full" />}
              <span className="relative flex items-center gap-1.5">
                {label}
                {key === 'friends' && incoming > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-rose-500 px-1 text-[10px] text-white">{incoming}</span>}
              </span>
            </button>
          ))}
        </div>
      </LayoutGroup>

      <div className="max-w-3xl">
        {tab === 'about' &&
          (profile ? (
            <AboutTab key={JSON.stringify(profile)} profile={profile} onSaved={setProfile} />
          ) : (
            <Skeleton className="h-96" />
          ))}
        {tab === 'friends' && <FriendsTab onCount={setIncoming} />}
        {tab === 'blocked' && <BlockedTab />}
      </div>
    </div>
  )
}
