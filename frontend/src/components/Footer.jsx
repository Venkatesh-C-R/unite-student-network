import { ArrowRight } from 'lucide-react'
import { scrollToId } from '../hooks/useLenis'
import { Logo, MagneticButton, Reveal } from './ui'

export default function Footer({ onSignIn }) {
  return (
    <footer className="relative px-5 pt-16 pb-10">
      <Reveal>
        <div className="bg-gradient-brand relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] px-6 py-16 text-center text-white sm:px-16">
          <div className="grid-overlay pointer-events-none absolute inset-0 opacity-30" />
          <h2 className="relative font-display text-3xl font-bold sm:text-5xl">Ready to unite?</h2>
          <p className="relative mx-auto mt-4 max-w-xl text-white/85">
            Find your five teammates from five other programmes, and start building something none of you could build
            alone.
          </p>
          <div className="relative mt-8 flex justify-center">
            <MagneticButton
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 font-semibold text-indigo-700 shadow-xl"
            >
              Join with your college email <ArrowRight size={18} />
            </MagneticButton>
          </div>
        </div>
      </Reveal>

      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-6 border-t border-line pt-8 text-sm text-muted md:flex-row">
        <div className="flex items-center gap-2">
          <Logo size={26} />
          <span className="wordmark font-display font-bold tracking-widest">UNITE</span>
          <span className="hidden sm:inline">· Six programmes. One union. Forward!</span>
        </div>
        <div className="flex flex-wrap justify-center gap-5">
          {['about', 'features', 'scoring', 'downloads', 'faq'].map((id) => (
            <button key={id} onClick={() => scrollToId(id)} className="capitalize hover:text-ink">
              {id}
            </button>
          ))}
        </div>
      </div>
      <p className="mx-auto mt-6 max-w-6xl text-center text-xs text-muted md:text-left">
        Team 8 · MCA · Department of Computer Applications, PSG College of Technology, Coimbatore · 2026–2027
      </p>
    </footer>
  )
}
