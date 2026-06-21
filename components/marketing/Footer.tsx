import Link from 'next/link'

const footerLinks = [
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#for-employers', label: 'For Employers' },
  { href: '#', label: 'Contact' },
]

export default function Footer() {
  return (
    <footer className="bg-gray-900" aria-label="Site footer">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div>
            <p className="font-jakarta text-xl font-bold text-white mb-3">RoleBoost</p>
            <p className="font-inter text-sm text-gray-400 leading-relaxed max-w-xs">
              The world&apos;s first AI-powered candidate intelligence platform.
            </p>
          </div>

          {/* Nav links */}
          <nav aria-label="Footer navigation">
            <p className="font-jakarta text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Navigation
            </p>
            <ul className="space-y-3">
              {footerLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="font-inter text-sm text-gray-400 hover:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Builder credit */}
          <div>
            <p className="font-jakarta text-[13px] font-semibold text-gray-500 uppercase tracking-wide mb-4">
              Built by
            </p>
            <p className="font-inter text-sm text-gray-400 leading-relaxed">
              Rob Ramos — 20+ years in operations and logistics.
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-inter text-sm text-gray-500">
            © {new Date().getFullYear()} RoleBoost. All rights reserved.
          </p>
          <div className="flex items-center gap-6">
            <Link
              href="#"
              className="font-inter text-sm text-gray-500 hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
            >
              Privacy Policy
            </Link>
            <Link
              href="#"
              className="font-inter text-sm text-gray-500 hover:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 rounded"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
