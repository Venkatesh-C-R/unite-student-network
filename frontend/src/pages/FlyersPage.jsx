import { motion } from 'framer-motion'
import { ArrowLeft, CalendarDays, Check, ExternalLink, Heart, ImagePlus, Megaphone, MessageCircle, Send, Share2, Trash2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { api } from '../api'
import { Avatar, Dialog, Empty, Skeleton } from '../components/app/kit'
import { useAuth, useToast } from '../context'
import { timeAgo } from '../lib/format'
import { btn, input } from '../lib/styles'

const EMPTY_FORM = { title: '', eventDate: '', link: '', details: '' }
const eventDay = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

function PostFlyer({ open, onClose, onPosted }) {
  const toast = useToast()
  const fileInput = useRef(null)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState('')
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function pick(f) {
    if (!f) return
    if (!['image/png', 'image/jpeg'].includes(f.type)) return toast('Choose a PNG or JPG photo of the flyer.', 'error')
    if (f.size > 5 * 1024 * 1024) return toast('The photo must be 5 MB or smaller.', 'error')
    if (preview) URL.revokeObjectURL(preview)
    setFile(f)
    setPreview(URL.createObjectURL(f))
  }

  function close() {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview('')
    setForm(EMPTY_FORM)
    onClose()
  }

  async function submit(e) {
    e.preventDefault()
    if (!file) return toast('Add a photo of the flyer.', 'error')
    const body = new FormData()
    body.append('image', file)
    Object.entries(form).forEach(([k, v]) => body.append(k, v.trim()))
    setSaving(true)
    try {
      const { flyer } = await api('/flyers', { method: 'POST', body })
      toast('Flyer posted for everyone to see.')
      onPosted(flyer)
      close()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={close} title="Post an event flyer" wide>
      <form onSubmit={submit} className="space-y-4">
        <div
          onClick={() => fileInput.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInput.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault()
            pick(e.dataTransfer.files[0])
          }}
          role="button"
          tabIndex={0}
          aria-label={file ? 'Change the flyer photo' : 'Choose a photo of the flyer'}
          className="grid cursor-pointer place-items-center overflow-hidden rounded-2xl border-2 border-dashed border-line text-center text-sm transition hover:border-violet-400/60"
        >
          {preview ? (
            <img src={preview} alt="Flyer preview" className="max-h-72 w-full object-contain" />
          ) : (
            <span className="flex flex-col items-center px-4 py-8">
              <ImagePlus size={26} className="mb-2 text-violet-500" />
              <b>Drop a photo of the flyer here</b>
              <span className="mt-1 text-xs text-muted">or click to choose · PNG or JPG · up to 5 MB</span>
            </span>
          )}
          <input ref={fileInput} type="file" accept=".png,.jpg,.jpeg" hidden onChange={(e) => (pick(e.target.files[0]), (e.target.value = ''))} />
        </div>

        <label className="block">
          <span className="text-sm font-semibold">Event name</span>
          <input className={`${input} mt-1.5`} value={form.title} onChange={set('title')} required minLength={3} maxLength={150} placeholder="e.g. Hack the Campus 2026" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm font-semibold">Event date (optional)</span>
            <input type="date" className={`${input} mt-1.5`} value={form.eventDate} onChange={set('eventDate')} />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Registration link (optional)</span>
            <input type="url" className={`${input} mt-1.5`} value={form.link} onChange={set('link')} placeholder="https://…" maxLength={500} />
          </label>
        </div>
        <label className="block">
          <span className="text-sm font-semibold">Details (optional)</span>
          <textarea className={`${input} mt-1.5 min-h-24`} value={form.details} onChange={set('details')} maxLength={1000} placeholder="Who can enter, team size, prizes, venue…" />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={close} className={btn.ghost}>
            Cancel
          </button>
          <button disabled={saving} className={btn.primary}>
            <Megaphone size={16} /> {saving ? 'Posting…' : 'Post flyer'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function Comments({ flyer, onCount }) {
  const { user } = useAuth()
  const toast = useToast()
  const [list, setList] = useState(null)
  const [text, setText] = useState('')

  useEffect(() => {
    api(`/flyers/${flyer.id}`)
      .then((d) => setList(d.comments))
      .catch((e) => toast(e.message, 'error'))
  }, [flyer.id, toast])

  async function add(e) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const { comment } = await api(`/flyers/${flyer.id}/comments`, { method: 'POST', body: { body: text } })
      const next = [...list, comment]
      setList(next)
      onCount(next.length)
      setText('')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  async function remove(c) {
    try {
      await api(`/flyers/${flyer.id}/comments/${c.id}`, { method: 'DELETE' })
      const next = list.filter((x) => x.id !== c.id)
      setList(next)
      onCount(next.length)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="border-t border-line px-5 py-4">
      {!list ? (
        <Skeleton className="h-12" />
      ) : (
        <ul className="space-y-3">
          {list.length === 0 && <li className="text-sm text-muted">No comments yet. Ask a question or tag your plans.</li>}
          {list.map((c) => (
            <li key={c.id} className="group flex gap-3">
              <Avatar name={c.userName} size={30} />
              <div className="min-w-0 flex-1 rounded-2xl bg-violet-500/5 px-3 py-2">
                <p className="flex items-baseline gap-2 text-sm">
                  <b className="truncate">{c.userName}</b>
                  <span className="shrink-0 text-xs text-muted">{timeAgo(c.createdAt)}</span>
                </p>
                <p className="text-sm break-words whitespace-pre-line">{c.body}</p>
              </div>
              {(c.userId === user.id || user.role === 'admin') && (
                <button onClick={() => remove(c)} className={btn.icon} aria-label={`Delete comment by ${c.userName}`}>
                  <Trash2 size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={add} className="mt-3 flex gap-2">
        <input className={input} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} placeholder="Write a comment…" aria-label="Write a comment" />
        <button className={`${btn.primary} px-4`} aria-label="Post comment" disabled={!text.trim()}>
          <Send size={16} />
        </button>
      </form>
    </div>
  )
}

function FlyerCard({ flyer, union, startOpen = false, onChange, onDelete }) {
  const { user } = useAuth()
  const toast = useToast()
  const [showComments, setShowComments] = useState(startOpen)
  const [confirming, setConfirming] = useState(false)
  const canDelete = flyer.authorId === user.id || user.role === 'admin'

  async function toggleLike() {
    const liked = flyer.likedByMe
    const step = liked ? -1 : 1
    onChange((x) => ({ likedByMe: !liked, likes: x.likes + step }))
    try {
      onChange(await api(`/flyers/${flyer.id}/like`, { method: liked ? 'DELETE' : 'POST' }))
    } catch (e) {
      onChange((x) => ({ likedByMe: liked, likes: x.likes - step }))
      toast(e.message, 'error')
    }
  }

  async function share() {
    try {
      const { union: u } = await api(`/flyers/${flyer.id}/share`, { method: 'POST' })
      onChange({ sharedWithMyUnion: true })
      toast(`Shared with ${u.name}. Your union has been notified.`)
    } catch (e) {
      if (e.code === 'already_shared') onChange({ sharedWithMyUnion: true })
      toast(e.message, 'error')
    }
  }

  const action = 'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-semibold transition hover:bg-violet-500/10 disabled:opacity-60'

  return (
    <motion.article layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="glass overflow-hidden rounded-3xl">
      <header className="flex items-center gap-3 px-5 pt-4 pb-3">
        <Avatar name={flyer.authorName} size={36} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {flyer.authorName}
            {flyer.authorRole !== 'student' && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-500 capitalize">{flyer.authorRole}</span>}
          </p>
          <p className="text-xs text-muted">{timeAgo(flyer.createdAt)}</p>
        </div>
        {canDelete &&
          (confirming ? (
            <span className="flex items-center gap-1">
              <button onClick={() => onDelete(flyer)} className={`${btn.danger} px-3 py-1.5`}>
                Delete
              </button>
              <button onClick={() => setConfirming(false)} className={btn.icon} aria-label="Keep this flyer">
                <X size={16} />
              </button>
            </span>
          ) : (
            <button onClick={() => setConfirming(true)} className={btn.icon} aria-label={flyer.authorId === user.id ? 'Delete your flyer' : 'Remove this flyer (admin)'}>
              <Trash2 size={16} />
            </button>
          ))}
      </header>

      <a href={flyer.imageUrl} target="_blank" rel="noopener" className="block bg-black/5 dark:bg-black/30" aria-label={`Open the full flyer for ${flyer.title}`}>
        <img src={flyer.imageUrl} alt={`Flyer: ${flyer.title}`} className="mx-auto max-h-[30rem] w-full object-contain" loading="lazy" />
      </a>

      <div className="px-5 pt-4">
        <h2 className="font-display text-lg font-semibold">{flyer.title}</h2>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
          {flyer.eventDate && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays size={14} /> {eventDay(flyer.eventDate)}
            </span>
          )}
          {flyer.link && (
            <a href={flyer.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-violet-500 hover:underline">
              <ExternalLink size={14} /> Register / details
            </a>
          )}
        </div>
        {flyer.details && <p className="mt-2 text-sm break-words whitespace-pre-line">{flyer.details}</p>}
      </div>

      <footer className="mt-3 flex flex-wrap items-center gap-1 border-t border-line px-3 py-2">
        <button onClick={toggleLike} className={`${action} ${flyer.likedByMe ? 'text-violet-500' : ''}`} aria-pressed={flyer.likedByMe} aria-label={flyer.likedByMe ? 'Unlike' : 'Like'}>
          <Heart size={17} fill={flyer.likedByMe ? 'currentColor' : 'none'} /> {flyer.likes}
        </button>
        <button onClick={() => setShowComments((s) => !s)} className={action} aria-expanded={showComments} aria-label={showComments ? 'Hide comments' : 'Show comments'}>
          <MessageCircle size={17} /> {flyer.comments}
        </button>
        {user.role === 'student' && (
          <span className="ml-auto">
            {flyer.sharedWithMyUnion ? (
              <span className={`${action} text-emerald-600 hover:bg-transparent dark:text-emerald-400`}>
                <Check size={17} /> Shared with {union?.name || 'your union'}
              </span>
            ) : (
              <button onClick={share} className={action} data-tip={union ? `Share with ${union.name} and notify its members` : 'Join a union to share flyers with it'}>
                <Share2 size={17} /> Share with union
              </button>
            )}
          </span>
        )}
      </footer>

      {showComments && <Comments flyer={flyer} onCount={(n) => onChange({ comments: n })} />}
    </motion.article>
  )
}

function Feed({ id }) {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [flyers, setFlyers] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [union, setUnion] = useState(null)
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (user.role !== 'student') return
    api('/groups/mine')
      .then((d) => setUnion(d.groups[0] || null))
      .catch(() => {})
  }, [user.role])

  useEffect(() => {
    const load = id ? api(`/flyers/${id}`).then((d) => ({ flyers: [d.flyer], hasMore: false })) : api('/flyers')
    load
      .then((d) => {
        setFlyers(d.flyers)
        setHasMore(d.hasMore)
      })
      .catch((e) => {
        setFlyers([])
        toast(e.message, 'error')
      })
  }, [id, toast])

  // Apply a change to one flyer. `patch` may be a function of the latest flyer, so quick
  // successive actions (like, share, comment) never overwrite each other.
  const update = (flyerId, patch) =>
    setFlyers((list) => list.map((x) => (x.id === flyerId ? { ...x, ...(typeof patch === 'function' ? patch(x) : patch) } : x)))

  async function remove(f) {
    try {
      await api(`/flyers/${f.id}`, { method: 'DELETE' })
      toast('Flyer deleted.')
      if (id) navigate('/flyers')
      else setFlyers((list) => list.filter((x) => x.id !== f.id))
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  async function more() {
    try {
      const d = await api(`/flyers?before=${flyers.at(-1).id}`)
      setFlyers((list) => [...list, ...d.flyers])
      setHasMore(d.hasMore)
    } catch (e) {
      toast(e.message, 'error')
    }
  }

  const postButton = (
    <button onClick={() => setPosting(true)} className={btn.primary}>
      <ImagePlus size={17} /> Post a flyer
    </button>
  )

  return (
    <div className="space-y-8">
      {id ? (
        <Link to="/flyers" className="inline-flex items-center gap-2 text-sm font-semibold text-violet-500 hover:underline">
          <ArrowLeft size={16} /> All flyers
        </Link>
      ) : (
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="glass mb-3 inline-flex items-center gap-2 rounded-full px-4 py-1 text-xs font-semibold tracking-widest text-violet-600 uppercase dark:text-violet-300">
              <Megaphone size={14} /> Event flyers
            </span>
            <h1 className="font-display text-3xl font-bold sm:text-4xl">
              Seen a poster? <span className="text-gradient">Spread the word.</span>
            </h1>
            <p className="mt-2 max-w-xl text-muted">Post a photo of any event flyer so every programme sees it. Like it, ask questions, and share it with your union.</p>
          </div>
          {postButton}
        </section>
      )}

      {!flyers ? (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : flyers.length === 0 ? (
        <Empty icon={Megaphone} title={id ? 'This flyer is no longer here' : 'No flyers yet'} action={id ? null : postButton}>
          {id ? 'It may have been deleted by the person who posted it.' : 'Be the first to post a hackathon, symposium or workshop flyer.'}
        </Empty>
      ) : (
        <div className={id ? 'mx-auto max-w-2xl' : 'grid items-start gap-6 md:grid-cols-2'}>
          {flyers.map((f) => (
            <FlyerCard key={f.id} flyer={f} union={union} startOpen={Boolean(id)} onChange={(patch) => update(f.id, patch)} onDelete={remove} />
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <button onClick={more} className={btn.ghost}>
            Show older flyers
          </button>
        </div>
      )}

      <PostFlyer open={posting} onClose={() => setPosting(false)} onPosted={(f) => setFlyers((list) => [f, ...(list || [])])} />
    </div>
  )
}

// /flyers is the feed; /flyers/:id shows one flyer with its comments open (notification links)
export default function FlyersPage() {
  const { id } = useParams()
  return <Feed key={id || 'all'} id={id} />
}
