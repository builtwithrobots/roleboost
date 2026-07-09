'use client'

import { useEffect, useState } from 'react'

// Distance scrolled before the button appears. Long enough that it never shows
// on a short page, short enough to help on the long marketing pages.
const SHOW_AFTER_PX = 500

/**
 * A non-intrusive "scroll to top" button. Fixed in the lower-right, it fades in
 * once the page has scrolled past SHOW_AFTER_PX and returns the viewer to the
 * top on click. Mounted site-wide in the root layout; it only appears when the
 * window actually scrolls, so short pages and internally-scrolling surfaces
 * never show it. Sits below modals (z-40) and respects reduced motion.
 */
export default function ScrollToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > SHOW_AFTER_PX)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll back to top"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-5 right-5 z-40 flex h-11 w-11 items-center justify-center rounded-full bg-[#1E3A5F] text-white shadow-lg ring-1 ring-black/5 transition-all duration-200 hover:bg-[#15293C] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] ${
        visible ? 'opacity-90 hover:opacity-100' : 'pointer-events-none translate-y-2 opacity-0'
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    </button>
  )
}
