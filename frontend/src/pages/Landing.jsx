import { AnimatePresence } from 'framer-motion'
import { useCallback, useState } from 'react'
import About from '../components/About'
import BackToTop from '../components/BackToTop'
import Downloads from '../components/Downloads'
import Faq from '../components/Faq'
import Features from '../components/Features'
import Footer from '../components/Footer'
import Hero from '../components/Hero'
import HowItWorks from '../components/HowItWorks'
import Loader from '../components/Loader'
import Navbar from '../components/Navbar'
import Playground from '../components/Playground'
import Scoring from '../components/Scoring'
import Team from '../components/Team'
import { useAuth } from '../context'
import { useLenis } from '../hooks/useLenis'

// Show the full intro once per browser session (or whenever ?intro is set), never with reduced motion.
function shouldShowLoader() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false
  // ?intro (used by start-unite.command) plays it every time
  const params = new URLSearchParams(window.location.search)
  if (params.has('intro')) {
    window.history.replaceState(null, '', window.location.pathname + window.location.hash)
    return true
  }
  try {
    if (sessionStorage.getItem('unite-intro-seen')) return false
    sessionStorage.setItem('unite-intro-seen', '1')
  } catch {
    /* storage unavailable */
  }
  return true
}

export default function Landing({ theme, onToggleTheme }) {
  const [loading, setLoading] = useState(shouldShowLoader)
  const { user, signOut, openSignIn } = useAuth()
  const done = useCallback(() => setLoading(false), [])

  useLenis(!loading)

  return (
    <>
      <AnimatePresence>{loading && <Loader onDone={done} />}</AnimatePresence>
      {!loading && (
        <>
          <a
            href="#main"
            className="bg-gradient-brand fixed top-3 left-3 z-[70] -translate-y-20 rounded-full px-4 py-2 text-sm font-semibold text-white focus:translate-y-0"
          >
            Skip to content
          </a>
          <Navbar theme={theme} onToggleTheme={onToggleTheme} onSignIn={openSignIn} user={user} onSignOut={signOut} />
          <main id="main">
            <Hero onSignIn={openSignIn} />
            <About />
            <Features />
            <Playground />
            <HowItWorks />
            <Scoring />
            <Downloads />
            <Team />
            <Faq />
          </main>
          <Footer onSignIn={openSignIn} />
          <BackToTop />
        </>
      )}
    </>
  )
}
