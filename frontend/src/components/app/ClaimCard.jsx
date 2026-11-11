import { BadgeCheck, Clock, FileText, Undo2, XCircle } from 'lucide-react'
import { HOST_CATEGORIES } from '../../data'
import { CATEGORY_ICON, claimRef, resultLabel } from '../../lib/claims'
import { formatPoints, timeAgo } from '../../lib/format'

const STATUS = {
  pending: { label: 'Pending review', icon: Clock, cls: 'bg-amber-400/15 text-amber-500' },
  approved: { label: 'Verified', icon: BadgeCheck, cls: 'bg-emerald-500/15 text-emerald-500' },
  rejected: { label: 'Not approved', icon: XCircle, cls: 'bg-rose-500/15 text-rose-400' },
  withdrawn: { label: 'Withdrawn', icon: Undo2, cls: 'bg-[var(--bg-2)] text-muted' },
}

function StatusBadge({ status }) {
  const s = STATUS[status]
  const Icon = s.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${s.cls}`}>
      <Icon size={13} /> {s.label}
    </span>
  )
}

function Evidence({ files }) {
  return (
    <div className="flex flex-wrap gap-2">
      {files.map((f) =>
        f.type.startsWith('image/') ? (
          <a key={f.id} href={f.url} target="_blank" rel="noopener" className="group block overflow-hidden rounded-xl border border-line" title={f.name}>
            <img src={f.url} alt={f.name} className="h-20 w-28 object-cover transition group-hover:scale-105" loading="lazy" />
          </a>
        ) : (
          <a
            key={f.id}
            href={f.url}
            target="_blank"
            rel="noopener"
            className="flex max-w-56 items-center gap-2 rounded-xl border border-line px-3 py-2 text-xs transition hover:border-violet-400"
            title={f.name}
          >
            <FileText size={18} className="shrink-0 text-rose-400" />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{f.name}</span>
              <span className="text-muted">{Math.max(1, Math.round(f.size / 1024))} KB</span>
            </span>
          </a>
        ),
      )}
    </div>
  )
}

// One achievement claim. `children` holds role-specific actions (e.g. the review form).
export default function ClaimCard({ claim, showSubmitter = false, children }) {
  const cat = HOST_CATEGORIES.find((c) => c.key === claim.hostCategory)
  const CatIcon = CATEGORY_ICON[claim.hostCategory]
  return (
    <article className="glass rounded-3xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-semibold text-muted">{claimRef(claim.id)}</p>
          <h3 className="font-display text-lg font-semibold break-words">{claim.eventTitle}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <CatIcon size={14} /> {claim.hostInstitution}
            </span>
            <span>·</span>
            <span>
              {cat.label} ×{cat.multiplier.toFixed(1)}
            </span>
          </p>
        </div>
        <StatusBadge status={claim.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
        <span className="bg-gradient-brand rounded-full px-3 py-1 font-semibold text-white">{resultLabel(claim.result)}</span>
        {claim.groups.map((g) => (
          <span key={g.id} className="rounded-full border border-line px-3 py-1">
            {g.name}
          </span>
        ))}
        {claim.groups.length > 1 && <span className="text-xs text-muted">· joint event team</span>}
      </div>

      {claim.description && <p className="mt-3 text-sm text-muted">{claim.description}</p>}

      <div className="mt-4">
        <Evidence files={claim.evidence} />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <span>
          {showSubmitter ? `Submitted by ${claim.submitterName} · ` : ''}
          {timeAgo(claim.createdAt)}
        </span>
        {claim.status === 'approved' && (
          <span className="font-semibold text-emerald-500">
            +{formatPoints(claim.points)} pts {claim.groups.length > 1 ? 'to each union' : ''} · verified by {claim.reviewerName}
          </span>
        )}
      </div>
      {['rejected', 'withdrawn'].includes(claim.status) && claim.reviewNote && (
        <p className="mt-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm text-rose-400">
          <b>{claim.reviewerName}:</b> {claim.reviewNote}
        </p>
      )}
      {claim.status === 'approved' && claim.reviewNote && <p className="mt-3 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm">{claim.reviewNote}</p>}
      {children}
    </article>
  )
}
