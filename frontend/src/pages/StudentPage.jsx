import { ArrowLeft, Ban, Send, ExternalLink, Flag, MoreHorizontal, Pencil, UserMinus, UserX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import FriendButton from '../components/app/FriendButton'
import { Avatar, Dialog, Empty, ProgrammeChip, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { programmeColor } from '../lib/programme'
import { btn, input } from '../lib/styles'

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export default function StudentPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [missing, setMissing] = useState(false)
  const [menu, setMenu] = useState(false)
  const [dialog, setDialog] = useState(null) // 'block' | 'report' | 'unfriend'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [myUnion, setMyUnion] = useState(null)
  const [invited, setInvited] = useState(false)
  const menuRef = useRef(null)
  const isMe = Number(id) === user.id

  useEffect(() => {
    let current = true
    api(`/students/${id}`)
      .then((d) => current && setProfile(d.profile))
      .catch((e) => {
        if (!current) return
        if (e.status === 404 || e.status === 400) setMissing(true)
        else toast(e.message, 'error')
      })
    return () => {
      current = false
    }
  }, [id, toast])

  // A union leader can invite other students to it
  useEffect(() => {
    if (user.role !== 'student') return
    api('/groups/mine')
      .then((d) => setMyUnion(d.groups.find((g) => g.myRole === 'owner') || null))
      .catch(() => {})
  }, [user.role])

  useEffect(() => {
    if (!menu) return
    const close = (e) => !menuRef.current?.contains(e.target) && setMenu(false)
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [menu])

  async function run(fn) {
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setBusy(false)
      setDialog(null)
    }
  }

  if (missing)
    return (
      <Empty icon={UserX} title="Student not found" action={<Link to="/discover" className={btn.primary}>Back to Discover</Link>}>
        This profile isn’t available.
      </Empty>
    )
  if (!profile) return <Skeleton className="h-96" />

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft size={16} /> Back
      </button>

      <section className="glass gradient-border relative overflow-hidden rounded-[2rem] p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-30 blur-3xl" style={{ background: programmeColor(profile.programmeId ?? 0) }} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="bg-gradient-brand w-fit rounded-full p-[3px]">
            <Avatar name={profile.name} size={92} color={profile.programmeId ? programmeColor(profile.programmeId) : undefined} />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="font-display text-3xl font-bold break-words">{profile.name}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              {profile.programmeName && <ProgrammeChip id={profile.programmeId} level={profile.programmeLevel} name={profile.programmeName} />}
              {profile.year && <span>Year {profile.year}</span>}
              {profile.role !== 'student' && <span className="rounded-full bg-amber-400/15 px-2 py-0.5 text-xs font-semibold text-amber-500 capitalize">{profile.role}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isMe ? (
              <Link to="/profile" className={btn.primary}>
                <Pencil size={16} /> Edit profile
              </Link>
            ) : (
              profile.role === 'student' && <FriendButton student={profile} onChange={(patch) => setProfile((p) => ({ ...p, ...patch }))} />
            )}
            {!isMe && profile.role === 'student' && myUnion && (
              <button
                disabled={busy || invited}
                onClick={() =>
                  run(async () => {
                    await api(`/groups/${myUnion.id}/invites`, { method: 'POST', body: { userId: profile.id } })
                    setInvited(true)
                    toast(`Invited ${profile.name} to ${myUnion.name}.`)
                  })
                }
                className={btn.ghost}
              >
                <Send size={16} /> {invited ? 'Invited' : `Invite to ${myUnion.name}`}
              </button>
            )}
            {!isMe && (
              <div className="relative" ref={menuRef}>
                <button onClick={() => setMenu((m) => !m)} className={btn.icon} aria-label="More actions" aria-expanded={menu}>
                  <MoreHorizontal size={20} />
                </button>
                {menu && (
                  <div className="absolute right-0 z-20 mt-2 w-48 overflow-hidden rounded-2xl border border-line bg-surface-strong py-1 shadow-2xl">
                    {profile.friendship === 'friends' && (
                      <button onClick={() => (setMenu(false), setDialog('unfriend'))} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-violet-500/10">
                        <UserMinus size={16} /> Remove friend
                      </button>
                    )}
                    <button onClick={() => (setMenu(false), setDialog('report'))} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-violet-500/10">
                      <Flag size={16} /> Report
                    </button>
                    <button onClick={() => (setMenu(false), setDialog('block'))} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-rose-500 hover:bg-rose-500/10">
                      <Ban size={16} /> Block
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="glass rounded-3xl p-6">
        <h2 className="mb-2 font-display text-lg font-semibold">About</h2>
        {profile.about ? <p className="whitespace-pre-line text-muted">{profile.about}</p> : <p className="text-sm text-muted italic">Nothing here yet.</p>}
      </section>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="glass rounded-3xl p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Interests</h2>
          {profile.interests.length ? (
            <div className="flex flex-wrap gap-2">
              {profile.interests.map((i) => (
                <Link
                  key={i}
                  to={`/discover?interest=${encodeURIComponent(i)}`}
                  className="rounded-full bg-violet-500/10 px-3 py-1 text-sm transition hover:bg-violet-500/20"
                  title={`Find others interested in ${i}`}
                >
                  {i}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted italic">No interests added.</p>
          )}
        </section>
        <section className="glass rounded-3xl p-6">
          <h2 className="mb-3 font-display text-lg font-semibold">Links</h2>
          {profile.links.length ? (
            <ul className="space-y-2">
              {profile.links.map((l, i) => (
                <li key={i}>
                  <a
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line px-4 py-3 transition hover:border-violet-400"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">{l.label}</span>
                      <span className="block truncate text-xs text-muted">{hostOf(l.url)}</span>
                    </span>
                    <ExternalLink size={16} className="shrink-0 text-muted" />
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted italic">No links added.</p>
          )}
        </section>
      </div>

      <Dialog open={dialog === 'block'} onClose={() => setDialog(null)} title={`Block ${profile.name}?`}>
        <p className="text-muted">They won’t be able to find you, see your profile or send you requests. Any friendship or pending request between you ends. You can unblock later from your profile.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setDialog(null)} className={btn.ghost}>
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api('/blocks', { method: 'POST', body: { userId: profile.id } })
                toast(`${profile.name} is blocked.`)
                navigate('/discover')
              })
            }
            className={btn.danger}
          >
            <Ban size={16} /> Block
          </button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'report'} onClose={() => setDialog(null)} title={`Report ${profile.name}`}>
        <p className="mb-3 text-sm text-muted">Tell the admins what happened. Reports are private.</p>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={`${input} min-h-28`} placeholder="Describe the problem (at least a few words)" autoFocus />
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={() => setDialog(null)} className={btn.ghost}>
            Cancel
          </button>
          <button
            disabled={busy || reason.trim().length < 5}
            onClick={() =>
              run(async () => {
                const r = await api('/reports', { method: 'POST', body: { userId: profile.id, reason } })
                setReason('')
                toast(r.message)
              })
            }
            className={btn.primary}
          >
            <Flag size={16} /> Send report
          </button>
        </div>
      </Dialog>

      <Dialog open={dialog === 'unfriend'} onClose={() => setDialog(null)} title={`Remove ${profile.name} from friends?`}>
        <p className="text-muted">You can send a new request later.</p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={() => setDialog(null)} className={btn.ghost}>
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() =>
              run(async () => {
                await api(`/friends/${profile.id}`, { method: 'DELETE' })
                setProfile((p) => ({ ...p, friendship: 'none' }))
                toast('Friend removed.')
              })
            }
            className={btn.danger}
          >
            Remove
          </button>
        </div>
      </Dialog>
    </div>
  )
}
