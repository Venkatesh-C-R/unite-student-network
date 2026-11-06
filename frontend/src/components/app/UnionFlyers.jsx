import { Megaphone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../../api'
import { timeAgo } from '../../lib/format'

// Event flyers members have shared with the union, newest first
export default function UnionFlyers() {
  const [shares, setShares] = useState(null)

  useEffect(() => {
    api('/flyers/shared')
      .then((d) => setShares(d.shares))
      .catch(() => setShares([]))
  }, [])

  if (!shares) return null
  return (
    <section aria-labelledby="union-flyers-h" className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 id="union-flyers-h" className="flex items-center gap-2 font-display text-lg font-semibold">
          <Megaphone size={18} className="text-violet-500" /> Flyers shared with your union
        </h3>
        <Link to="/flyers" className="shrink-0 text-sm font-semibold text-violet-500 hover:underline">
          All flyers
        </Link>
      </div>
      {shares.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-sm text-muted">
          Nothing shared yet. Spot an event on the <Link to="/flyers" className="font-semibold text-violet-500 hover:underline">Flyers</Link> page and share it here.
        </p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shares.slice(0, 8).map((f) => (
            <li key={f.id}>
              <Link to={`/flyers/${f.id}`} className="glass block overflow-hidden rounded-2xl transition hover:border-violet-400/60">
                <img src={f.imageUrl} alt={`Flyer: ${f.title}`} className="aspect-[4/5] w-full bg-black/5 object-cover" loading="lazy" />
                <div className="p-3">
                  <p className="truncate text-sm font-semibold">{f.title}</p>
                  <p className="truncate text-xs text-muted">
                    {f.sharedByName ? `Shared by ${f.sharedByName}` : 'Shared'} · {timeAgo(f.sharedAt)}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
