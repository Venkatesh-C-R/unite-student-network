// Shared Tailwind class strings for the signed-in app
export const btn = {
  primary:
    'inline-flex items-center justify-center gap-2 rounded-md bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-600 disabled:opacity-60',
  ghost:
    'inline-flex items-center justify-center gap-2 rounded-md border border-line bg-bg-2 px-5 py-2.5 text-sm font-semibold text-ink transition hover:border-violet-400 disabled:opacity-60',
  danger:
    'inline-flex items-center justify-center gap-2 border border-rose-500/40 rounded-md px-5 py-2.5 text-sm font-semibold text-rose-500 transition hover:bg-rose-500/10 disabled:opacity-60',
  icon: 'grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-violet-500/10 hover:text-ink',
}

export const input =
  'w-full rounded-md border border-line bg-[var(--bg)] px-4 py-3 text-ink outline-none transition-colors placeholder:text-muted focus:border-violet-400'
