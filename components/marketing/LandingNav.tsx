'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navLinks = [
  { href: '/boosts', label: 'Boosts' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#pricing', label: 'Pricing' },
  { href: '/recruiters', label: 'For Recruiters' },
]

export default function LandingNav() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const hamburgerRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()

  const onRecruitersPage = pathname?.startsWith('/recruiters') ?? false
  // The recruiter page gets a way back to the candidate story in the center links
  const links = onRecruitersPage
    ? [...navLinks.slice(0, 3), { href: '/', label: 'For Candidates' }, navLinks[3]]
    : navLinks
  const isActive = (href: string) => href === '/recruiters' && onRecruitersPage

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8)
    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
        hamburgerRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <header
      className={`sticky top-0 z-30 transition-[background-color,box-shadow,border-color] duration-200 ${
        scrolled || isOpen
          ? 'bg-[#FFFBF5]/85 backdrop-blur-md border-b border-[rgba(30,58,95,0.08)] shadow-sm'
          : 'bg-[#FFFBF5] border-b border-transparent'
      }`}
      role="banner"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href="/"
            className="font-jakarta text-xl font-extrabold text-[#1E3A5F] rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
            aria-label="RoleBoost home"
          >
            RoleBoost
          </Link>

          {/* Desktop links */}
          <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`font-inter text-[15px] transition-colors rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] ${
                  isActive(link.href)
                    ? 'font-semibold text-[#B45309]'
                    : 'font-medium text-[#1E3A5F]/80 hover:text-[#1E3A5F]'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Desktop actions */}
          <div className="hidden md:flex items-center gap-2">
            <Link
              href="/sign-in"
              className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg font-jakarta text-[15px] font-semibold text-[#1E3A5F] hover:text-[#B45309] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="inline-flex items-center justify-center min-h-[44px] px-6 py-2 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5]"
            >
              Get Started Free
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            ref={hamburgerRef}
            type="button"
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-[#1E3A5F] hover:bg-[#F5F0E8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F]"
            aria-expanded={isOpen}
            aria-controls="landing-mobile-menu"
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
            onClick={() => setIsOpen(!isOpen)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              {isOpen ? (
                <path d="M18 6L6 18M6 6l12 12" />
              ) : (
                <path d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div
          id="landing-mobile-menu"
          className="md:hidden bg-[#FFFBF5] border-b border-[rgba(30,58,95,0.08)] px-4 py-4 space-y-1"
        >
          <nav aria-label="Mobile navigation">
            {links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                aria-current={isActive(link.href) ? 'page' : undefined}
                className={`flex items-center min-h-[44px] font-inter text-[15px] py-3 px-3 rounded-lg hover:bg-[#F5F0E8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] ${
                  isActive(link.href)
                    ? 'font-semibold text-[#B45309]'
                    : 'font-medium text-[#1E3A5F]/80 hover:text-[#1E3A5F]'
                }`}
                onClick={() => setIsOpen(false)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="space-y-2 pt-3 pb-1">
            <Link
              href="/sign-in"
              className="flex w-full items-center justify-center min-h-[44px] px-6 py-3 rounded-lg border border-[rgba(30,58,95,0.2)] font-jakarta text-[15px] font-semibold text-[#1E3A5F] hover:bg-[#F5F0E8] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1E3A5F] focus-visible:ring-offset-2"
              onClick={() => setIsOpen(false)}
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="flex w-full items-center justify-center min-h-[44px] px-6 py-3 rounded-lg bg-[#D97706] text-white font-jakarta text-[15px] font-semibold hover:bg-[#B45309] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2"
              onClick={() => setIsOpen(false)}
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </header>
  )
}
