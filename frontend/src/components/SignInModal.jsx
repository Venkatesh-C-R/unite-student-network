import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, ArrowLeft, CheckCircle2, KeyRound, Lock, Mail, User, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { api } from '../api'
import { lockScroll } from '../hooks/useLenis'
import { Logo } from './ui'

const EMAIL_RE = /^\d{2}[a-z]{1,3}\d{2,4}@psgtech\.ac\.in$/i

const inputBox =
  'flex items-center gap-3 rounded-2xl border border-line bg-[var(--bg)] px-4 transition-colors focus-within:border-violet-400'
const inputEl = 'w-full bg-transparent py-3 text-ink outline-none placeholder:text-muted/60'
const primary = 'bg-gradient-brand mt-5 w-full rounded-2xl py-3.5 font-semibold text-white disabled:opacity-60'

function Field({ icon: Icon, label, id, ...props }) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label}
      </label>
      <div className={inputBox}>
        {Icon && <Icon size={18} className="shrink-0 text-muted" />}
        <input id={id} className={inputEl} {...props} />
      </div>
    </div>
  )
}

// Views: signin | signup-email | signup-details | reset-email | reset-code | done
export default function SignInModal({ open, onClose, onSignedIn }) {
  const [view, setView] = useState('signin')
  const [form, setForm] = useState({ email: '', password: '', otp: '', name: '', programmeId: '', year: '1' })
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)
  const [programmes, setProgrammes] = useState([])
  const [doneUser, setDoneUser] = useState(null)
  const firstInput = useRef(null)

  const [wasOpen, setWasOpen] = useState(open)
  if (open !== wasOpen) {
    // Start fresh each time the dialog opens
    setWasOpen(open)
    if (open) {
      setView('signin')
      setError('')
      setInfo('')
    }
  }

  useEffect(() => {
    lockScroll(open)
    if (!open) return
    const t = setTimeout(() => firstInput.current?.focus(), 150)
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(t)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose, view])

  useEffect(() => {
    if (view !== 'signup-details' || programmes.length) return
    api('/auth/programmes')
      .then((d) => setProgrammes(d.programmes))
      .catch((e) => setError(e.message))
  }, [view, programmes.length])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const go = (v) => {
    setError('')
    setInfo('')
    setView(v)
  }

  async function run(fn) {
    setBusy(true)
    setError('')
    try {
      await fn()
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const checkEmail = () => {
    if (!EMAIL_RE.test(form.email.trim())) throw new Error('Use your roll-number email, like 26mx354@psgtech.ac.in.')
  }

  const submit = {
    signin: () =>
      run(async () => {
        const { user } = await api('/auth/login', { method: 'POST', body: { email: form.email, password: form.password } })
        setDoneUser(user)
        onSignedIn(user)
        go('done')
      }),
    'signup-email': () =>
      run(async () => {
        checkEmail()
        const r = await api('/auth/otp', { method: 'POST', body: { email: form.email, purpose: 'signup' } })
        go('signup-details')
        setInfo(r.message)
      }),
    'signup-details': () =>
      run(async () => {
        const { user } = await api('/auth/register', {
          method: 'POST',
          body: { ...form, programmeId: Number(form.programmeId), year: Number(form.year) },
        })
        setDoneUser(user)
        onSignedIn(user)
        go('done')
      }),
    'reset-email': () =>
      run(async () => {
        const r = await api('/auth/otp', { method: 'POST', body: { email: form.email, purpose: 'reset' } })
        go('reset-code')
        setInfo(r.message)
      }),
    'reset-code': () =>
      run(async () => {
        const r = await api('/auth/reset', { method: 'POST', body: { email: form.email, otp: form.otp, password: form.password } })
        go('signin')
        setInfo(r.message)
      }),
  }

  const titles = {
    signin: ['Sign in to UNITE', 'Welcome back. Use your college email and password.'],
    'signup-email': ['Create your account', 'Enter your PSG college email. We’ll send a 6-digit code.'],
    'signup-details': ['Almost there', `Enter the code sent to ${form.email} and a few details.`],
    'reset-email': ['Reset password', 'We’ll email you a code to set a new password.'],
    'reset-code': ['Set a new password', `Enter the code sent to ${form.email}.`],
    done: ['You’re in!', ''],
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="signin-title"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="gradient-border relative my-8 w-full max-w-md rounded-3xl bg-surface-strong p-7 shadow-2xl sm:p-8"
          >
            <button onClick={onClose} className="absolute top-4 right-4 rounded-full p-2 text-muted hover:bg-violet-500/10" aria-label="Close">
              <X size={18} />
            </button>
            {!['signin', 'done'].includes(view) && (
              <button onClick={() => go('signin')} className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                <ArrowLeft size={16} /> Back to sign in
              </button>
            )}
            <Logo size={40} />
            <h2 id="signin-title" className="mt-3 font-display text-2xl font-bold">
              {titles[view][0]}
            </h2>
            {titles[view][1] && <p className="mt-1 text-sm text-muted">{titles[view][1]}</p>}

            <AnimatePresence mode="wait" initial={false}>
              <motion.div key={view} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                {view === 'done' ? (
                  <div className="mt-5">
                    <div className="flex gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm">
                      <CheckCircle2 size={20} className="shrink-0 text-emerald-500" />
                      <span>
                        Signed in as <b>{doneUser?.name}</b>
                        {doneUser?.programmeName && ` · ${doneUser.programmeLevel} ${doneUser.programmeName}`}.
                      </span>
                    </div>
                    <button onClick={onClose} className={primary}>
                      Continue
                    </button>
                  </div>
                ) : (
                  <form
                    noValidate
                    onSubmit={(e) => {
                      e.preventDefault()
                      submit[view]()
                    }}
                  >
                    {['signin', 'signup-email', 'reset-email'].includes(view) && (
                      <Field
                        ref={firstInput}
                        icon={Mail}
                        id="email"
                        label="College email"
                        type="email"
                        autoComplete="email"
                        placeholder="26mx354@psgtech.ac.in"
                        value={form.email}
                        onChange={set('email')}
                      />
                    )}
                    {['signup-details', 'reset-code'].includes(view) && (
                      <Field
                        icon={KeyRound}
                        id="otp"
                        label="6-digit code"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        placeholder="123456"
                        value={form.otp}
                        onChange={set('otp')}
                      />
                    )}
                    {view === 'signup-details' && (
                      <>
                        <Field icon={User} id="name" label="Full name" autoComplete="name" value={form.name} onChange={set('name')} />
                        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                          <div className="min-w-0">
                            <label htmlFor="programme" className="mb-1.5 block text-sm font-semibold">
                              Programme
                            </label>
                            <select id="programme" value={form.programmeId} onChange={set('programmeId')} className={`${inputBox} w-full py-3`}>
                              <option value="">Choose…</option>
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
                          </div>
                          <div>
                            <label htmlFor="year" className="mb-1.5 block text-sm font-semibold">
                              Year
                            </label>
                            <select id="year" value={form.year} onChange={set('year')} className={`${inputBox} w-full py-3`}>
                              {[1, 2, 3, 4, 5].map((y) => (
                                <option key={y}>{y}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}
                    {['signin', 'signup-details', 'reset-code'].includes(view) && (
                      <Field
                        icon={Lock}
                        id="password"
                        label={view === 'signin' ? 'Password' : 'New password (8+ characters)'}
                        type="password"
                        autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                        value={form.password}
                        onChange={set('password')}
                      />
                    )}

                    {info && !error && <p className="mt-3 text-xs text-cyan-500">{info}</p>}
                    {error && (
                      <p role="alert" className="mt-3 flex gap-2 text-sm text-rose-400">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" /> {error}
                      </p>
                    )}

                    <button disabled={busy} className={primary}>
                      {busy
                        ? 'Please wait…'
                        : { signin: 'Sign in', 'signup-email': 'Send code', 'signup-details': 'Create account', 'reset-email': 'Send code', 'reset-code': 'Update password' }[view]}
                    </button>

                    {view === 'signin' && (
                      <div className="mt-4 flex justify-between text-sm">
                        <button type="button" onClick={() => go('reset-email')} className="text-muted hover:text-ink">
                          Forgot password?
                        </button>
                        <button type="button" onClick={() => go('signup-email')} className="font-semibold text-violet-600 dark:text-violet-400">
                          Create account
                        </button>
                      </div>
                    )}
                  </form>
                )}
              </motion.div>
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
