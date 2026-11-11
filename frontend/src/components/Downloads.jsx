import { AnimatePresence, motion } from 'framer-motion'
import { Download, Eye, FileImage, FileText, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DOWNLOADS } from '../data'
import { lockScroll } from '../hooks/useLenis'
import { Reveal, SectionHeading } from './ui'

function Lightbox({ item, onClose }) {
  useEffect(() => {
    lockScroll(Boolean(item))
    if (!item) return
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])

  return (
    <AnimatePresence>
      {item && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={item.title}
        >
          <motion.figure
            initial={{ scale: 0.92, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="relative max-h-full w-full max-w-5xl overflow-auto rounded-3xl bg-white p-3 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={`/downloads/${item.file}`} alt={item.title} className="mx-auto h-auto max-h-[78vh] w-auto rounded-2xl" />
            <figcaption className="flex flex-wrap items-center justify-between gap-3 px-2 pt-3 text-sm text-slate-700">
              <span className="font-semibold">{item.title}</span>
              <a href={`/downloads/${item.file}`} download className="bg-gradient-brand inline-flex items-center gap-2 rounded-full px-4 py-2 font-semibold text-white">
                <Download size={16} /> Download
              </a>
            </figcaption>
            <button onClick={onClose} className="absolute top-5 right-5 rounded-full bg-slate-900/80 p-2 text-white" aria-label="Close preview">
              <X size={18} />
            </button>
          </motion.figure>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Downloads() {
  const [preview, setPreview] = useState(null)

  return (
    <section id="downloads" className="relative px-5 py-28">
      <div className="relative mx-auto max-w-6xl">
        <SectionHeading title={<>Download the <span className="text-gradient">project files</span></>}>
          The abstract, design document, diagrams and quick guides for UNITE. Preview them here or download a copy.
        </SectionHeading>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DOWNLOADS.map((d, i) => {
            const isImage = d.type === 'PNG'
            const Icon = isImage ? FileImage : FileText
            const href = `/downloads/${d.file}`
            return (
              <Reveal key={d.file} delay={(i % 3) * 0.08}>
                <motion.div
                  whileHover={{ y: -6 }}
                  transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                  className="glass group relative flex h-full flex-col overflow-hidden rounded-3xl p-6"
                >
                  <div className="bg-gradient-brand pointer-events-none absolute -top-16 -right-16 h-40 w-40 rounded-full opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-40" />
                  <div className="flex items-start justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-600 dark:text-violet-400">
                      <Icon size={22} />
                    </span>
                    <span className="rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold text-muted">
                      {d.type} · {d.size}
                    </span>
                  </div>
                  <h3 className="mt-5 font-display text-lg font-semibold">{d.title}</h3>
                  <p className="mt-1.5 flex-1 text-sm text-muted">{d.desc}</p>
                  <p className="mt-4 text-xs text-muted">{d.pages}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    {isImage ? (
                      <button onClick={() => setPreview(d)} className="glass inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 font-semibold">
                        <Eye size={16} /> Preview
                      </button>
                    ) : (
                      <a href={href} target="_blank" rel="noopener" className="glass inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 font-semibold">
                        <Eye size={16} /> Open
                      </a>
                    )}
                    <a href={href} download className="bg-gradient-brand inline-flex items-center justify-center gap-1.5 rounded-full py-2.5 font-semibold text-white">
                      <Download size={16} /> Download
                    </a>
                  </div>
                </motion.div>
              </Reveal>
            )
          })}
        </div>
      </div>
      <Lightbox item={preview} onClose={() => setPreview(null)} />
    </section>
  )
}
