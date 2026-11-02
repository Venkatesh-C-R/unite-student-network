// Shared Tailwind class strings for the signed-in app
export const btn = {
  primary:
    'bg-gradient-brand inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_30px_-10px_rgba(139,92,246,0.7)] transition hover:brightness-110 disabled:opacity-60',
  ghost:
    'glass inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-violet-400 disabled:opacity-60',
  danger:
    'inline-flex items-center justify-center gap-2 rounded-full border border-rose-500/40 px-5 py-2.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-60',
  icon: 'grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-violet-500/10 hover:text-ink',
}

export const input =
  'w-full rounded-2xl border border-line bg-[var(--bg)] px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted/60 focus:border-violet-400'
