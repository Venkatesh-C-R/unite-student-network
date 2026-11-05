import { useEffect, useState } from 'react'

// Shows what an icon-only button or link will do, on hover or keyboard focus.
// It reads the label the control already has (data-tip, title or aria-label), so no button needs wiring.
const TARGET = 'button, a, [role="button"]'

function labelFor(el) {
  if (el.dataset.tip) return el.dataset.tip
  // Buttons with visible words already say what they do
  if (el.innerText.trim()) return ''
  // aria-label is usually the more specific one ("Remove Diya Raman" rather than "Remove member")
  const label = el.getAttribute('aria-label') || el.getAttribute('title') || ''
  if (el.hasAttribute('title')) {
    // Keep the label but stop the browser's own slow tooltip from doubling up
    el.dataset.tip = label
    el.removeAttribute('title')
  }
  return label
}

export default function HoverTips() {
  const [tip, setTip] = useState(null)

  useEffect(() => {
    let current = null
    const show = (e) => {
      const el = e.target.closest?.(TARGET)
      if (!el || el === current) return
      const text = labelFor(el)
      if (!text) return
      current = el
      const r = el.getBoundingClientRect()
      const below = r.top < 48
      setTip({ text, x: r.left + r.width / 2, y: below ? r.bottom + 8 : r.top - 8, below })
    }
    const hide = (e) => {
      if (!current) return
      if (e.type === 'focusout' || !current.contains(e.relatedTarget)) {
        current = null
        setTip(null)
      }
    }
    const clear = () => {
      current = null
      setTip(null)
    }
    document.addEventListener('mouseover', show)
    document.addEventListener('mouseout', hide)
    document.addEventListener('focusin', show)
    document.addEventListener('focusout', hide)
    document.addEventListener('click', clear, true)
    window.addEventListener('scroll', clear, true)
    return () => {
      document.removeEventListener('mouseover', show)
      document.removeEventListener('mouseout', hide)
      document.removeEventListener('focusin', show)
      document.removeEventListener('focusout', hide)
      document.removeEventListener('click', clear, true)
      window.removeEventListener('scroll', clear, true)
    }
  }, [])

  if (!tip) return null
  const x = Math.min(Math.max(tip.x, 90), window.innerWidth - 90)
  return (
    <div
      role="tooltip"
      className="pointer-events-none fixed z-[200] w-max max-w-[220px] rounded-md bg-[#1e1b16] px-2.5 py-1.5 text-center text-xs font-semibold text-[#fffaf0] shadow-lg ring-1 ring-white/10"
      style={{ left: x, top: tip.y, transform: `translate(-50%, ${tip.below ? '0' : '-100%'})` }}
    >
      {tip.text}
    </div>
  )
}
