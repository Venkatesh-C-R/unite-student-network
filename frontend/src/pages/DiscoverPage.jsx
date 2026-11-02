import { motion } from 'framer-motion'
import { Search, Sparkles, UserSearch, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { api } from '../api'
import FriendButton from '../components/app/FriendButton'
import { Avatar, Empty, ProgrammeChip, Skeleton } from '../components/app/kit'
import { useToast } from '../context'
import { programmeColor } from '../lib/programme'
import { btn, input } from '../lib/styles'

function StudentCard({ student, highlight, onChange, index = 0, note }) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.03 }}
      className="glass flex flex-col rounded-3xl p-5 transition-colors hover:border-violet-400/60"
    >
      <Link to={`/students/${student.id}`} className="flex items-center gap-3">
        <Avatar name={student.name} size={48} color={programmeColor(student.programmeId)} />
        <span className="min-w-0">
          <span className="block truncate font-display text-lg font-semibold">{student.name}</span>
          <span className="text-xs text-muted">Year {student.year}</span>
        </span>
      </Link>
      <ProgrammeChip id={student.programmeId} level={student.programmeLevel} name={student.programmeName} className="mt-3 self-start" />
      {note && <p className="mt-3 text-xs text-violet-600 dark:text-violet-300">{note}</p>}
      {student.interests?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {student.interests.slice(0, 6).map((i) => (
            <span
              key={i}
              className={`rounded-full px-2.5 py-0.5 text-xs ${i === highlight ? 'bg-gradient-brand font-semibold text-white' : 'bg-violet-500/10 text-muted'}`}
            >
              {i}
            </span>
          ))}
          {student.interests.length > 6 && <span className="px-1 text-xs text-muted">+{student.interests.length - 6}</span>}
        </div>
      )}
      <div className="mt-auto flex items-center justify-between gap-2 pt-5">
        <Link to={`/students/${student.id}`} className="text-sm font-semibold text-muted hover:text-ink">
          View profile
        </Link>
        <FriendButton student={student} onChange={onChange} compact />
      </div>
    </motion.li>
  )
}

export default function DiscoverPage() {
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const q = params.get('q') || ''
  const programmeId = params.get('programme') || ''
  const interest = params.get('interest') || ''
  const [search, setSearch] = useState(q)
  const [programmes, setProgrammes] = useState([])
  const [popular, setPopular] = useState([])
  const [suggested, setSuggested] = useState(null)
  const [results, setResults] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const filtered = Boolean(q || programmeId || interest)

  const setParam = useCallback(
    (key, value) =>
      setParams(
        (p) => {
          const next = new URLSearchParams(p)
          if (value) next.set(key, value)
          else next.delete(key)
          return next
        },
        { replace: true },
      ),
    [setParams],
  )

  useEffect(() => {
    api('/auth/programmes').then((d) => setProgrammes(d.programmes)).catch(() => {})
    api('/interests/popular').then((d) => setPopular(d.interests)).catch(() => {})
    api('/students/suggested').then((d) => setSuggested(d.students)).catch(() => setSuggested([]))
  }, [])

  // Typing updates the URL after a short pause
  useEffect(() => {
    const t = setTimeout(() => setParam('q', search.trim()), 300)
    return () => clearTimeout(t)
  }, [search, setParam])

  useEffect(() => {
    const p = new URLSearchParams()
    if (q) p.set('q', q)
    if (programmeId) p.set('programmeId', programmeId)
    if (interest) p.set('interest', interest)
    p.set('page', String(page))
    let current = true // ignore answers to searches the user has already replaced
    api(`/students?${p}`)
      .then((d) => {
        if (!current) return
        setResults((prev) => (page === 1 ? d.students : [...(prev || []), ...d.students]))
        setHasMore(d.hasMore)
      })
      .catch((e) => current && toast(e.message, 'error'))
    return () => {
      current = false
    }
  }, [q, programmeId, interest, page, toast])

  // New filters start again from page 1
  const [lastFilters, setLastFilters] = useState(`${q}|${programmeId}|${interest}`)
  if (lastFilters !== `${q}|${programmeId}|${interest}`) {
    setLastFilters(`${q}|${programmeId}|${interest}`)
    setPage(1)
    setResults(null)
  }

  const update = (setList) => (id, patch) => setList((list) => list.map((s) => (s.id === id ? { ...s, ...patch } : s)))

  return (
    <div className="space-y-10">
      <section>
        <h1 className="font-display text-3xl font-bold sm:text-4xl">
          Discover <span className="text-gradient">students</span>
        </h1>
        <p className="mt-1 text-muted">Find people across PSG programmes who share your interests.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
          <label className="relative block">
            <span className="sr-only">Search by name or roll number</span>
            <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-muted" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or roll number" className={`${input} pl-11`} />
          </label>
          <label>
            <span className="sr-only">Filter by programme</span>
            <select value={programmeId} onChange={(e) => setParam('programme', e.target.value)} className={input}>
              <option value="">All programmes</option>
              {[...new Set(programmes.map((p) => p.level))].map((lvl) => (
                <optgroup key={lvl} label={lvl}>
                  {programmes
                    .filter((p) => p.level === lvl)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </label>
        </div>

        {popular.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-muted">Interests:</span>
            {popular.map((i) => (
              <button
                key={i.interest}
                onClick={() => setParam('interest', interest === i.interest ? '' : i.interest)}
                aria-pressed={interest === i.interest}
                className={`rounded-full px-3 py-1 text-sm transition ${
                  interest === i.interest ? 'bg-gradient-brand font-semibold text-white' : 'border border-line text-muted hover:border-violet-400 hover:text-ink'
                }`}
              >
                {i.interest} <span className="opacity-70">{i.students}</span>
              </button>
            ))}
          </div>
        )}
        {filtered && (
          <button
            onClick={() => {
              setSearch('')
              setParams({}, { replace: true })
            }}
            className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-violet-600 dark:text-violet-400"
          >
            <X size={15} /> Clear filters
          </button>
        )}
      </section>

      {!filtered && suggested?.length > 0 && (
        <section aria-labelledby="sug-h">
          <h2 id="sug-h" className="mb-4 flex items-center gap-2 font-display text-xl font-semibold">
            <Sparkles size={20} className="text-violet-500" /> Suggested for you
          </h2>
          <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {suggested.slice(0, 6).map((s, i) => (
              <StudentCard
                key={s.id}
                student={s}
                index={i}
                note={`Shares ${s.sharedInterests.join(', ')}`}
                onChange={(patch) => update(setSuggested)(s.id, patch)}
              />
            ))}
          </ul>
        </section>
      )}
      {!filtered && suggested?.length === 0 && (
        <p className="glass rounded-2xl px-5 py-4 text-sm text-muted">
          Add interests to <Link to="/profile" className="font-semibold text-violet-600 dark:text-violet-400">your profile</Link> to get suggestions for people like you.
        </p>
      )}

      <section aria-labelledby="all-h">
        <h2 id="all-h" className="mb-4 font-display text-xl font-semibold">
          {filtered ? 'Results' : 'All students'}
        </h2>
        {!results ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-56" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <Empty icon={UserSearch} title="No students found">
            Try another name, programme or interest.
          </Empty>
        ) : (
          <>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((s, i) => (
                <StudentCard key={s.id} student={s} index={i} highlight={interest} onChange={(patch) => update(setResults)(s.id, patch)} />
              ))}
            </ul>
            {hasMore && (
              <div className="mt-6 text-center">
                <button onClick={() => setPage((p) => p + 1)} className={btn.ghost}>
                  Load more
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  )
}
