import { ArrowRight, Download } from 'lucide-react'
import { scrollToId } from '../hooks/useLenis'
import { btnGhost, btnPrimary } from './ui'

// PSG Tech style: text on the left, a pale panel of numbered steps on the right.
const STEPS = [
  ['Form a union', 'Up to six students, one per programme.'],
  ['Compete together', 'Enter events as a union or a joint team.'],
  ['Get verified', 'Faculty check every result before points count.'],
]

export default function Hero({ onSignIn }) {
  return (
    <section id="top" className="border-b border-line">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 lg:grid-cols-[1.2fr_1fr] lg:py-24">
        <div>
          <h1 className="text-5xl font-bold text-violet-500 sm:text-6xl">UNITE</h1>
          <p className="mt-3 text-lg font-semibold sm:text-xl">University Network for Interdisciplinary Teamwork and Engagement</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={onSignIn} className={btnPrimary}>
              Get started <ArrowRight size={18} />
            </button>
            <button onClick={() => scrollToId('downloads')} className={btnGhost}>
              <Download size={18} /> Project resources
            </button>
          </div>
        </div>

        <ol className="space-y-4 rounded-md bg-bg-2 p-6">
          {STEPS.map(([title, body], i) => (
            <li key={title} className="flex gap-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded bg-violet-500 text-lg font-bold text-white">{i + 1}</span>
              <div>
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted">{body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
