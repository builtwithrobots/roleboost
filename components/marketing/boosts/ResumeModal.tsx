'use client'

import { useState } from 'react'
import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'

interface ResumeModalProps {
  open: boolean
  onClose: () => void
}

/**
 * Site-styled modal that previews Jordan Mills' ATS resume.
 *
 * The image is served from /public/boosts. Drop the real file at
 * public/boosts/jordan-mills-resume.jpg and it appears here automatically;
 * until then an on-brand placeholder is shown via the onError fallback.
 *
 * Headless UI's Dialog provides the accessibility spine: focus is trapped
 * while open, ESC closes and focus returns to the trigger, and body scroll
 * is locked. Motion is CSS-based, so globals.css disables it under
 * prefers-reduced-motion.
 */
export default function ResumeModal({ open, onClose }: ResumeModalProps) {
  const [imgError, setImgError] = useState(false)

  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#1E3A5F]/60 backdrop-blur-sm transition-opacity duration-200 data-closed:opacity-0"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#FFFBF5] border border-[#E8E0D0] shadow-xl transition duration-200 data-closed:opacity-0 data-closed:scale-95"
        >
          {/* Header */}
          <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-[#E8E0D0]">
            <div className="min-w-0">
              <DialogTitle className="font-jakarta text-lg font-bold text-[#1E3A5F]">
                Jordan Mills, ATS Resume
              </DialogTitle>
              <p className="hidden sm:block font-inter text-sm text-gray-600 mt-1">
                A clean, applicant-tracking-ready resume, one of Jordan&apos;s Boosts.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <a
                href="/boosts/jordan-mills-resume.jpg"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open resume at full size in a new tab"
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D97706] px-3 py-2 min-w-[44px] font-jakarta text-sm font-semibold text-[#B45309] hover:bg-[#FEF3C7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors min-h-[44px]"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                  <polyline points="15 3 21 3 21 9" />
                  <line x1="10" y1="14" x2="21" y2="3" />
                </svg>
                <span className="hidden sm:inline">Open full size</span>
              </a>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close resume preview"
                className="inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 hover:text-[#1E3A5F] hover:bg-[#F5F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body: resume image (scrollable) */}
          <div className="overflow-y-auto p-5 sm:p-6">
            {imgError ? (
              <div
                className="flex flex-col items-center justify-center gap-3 aspect-[8.5/11] w-full rounded-xl border-2 border-dashed border-[#D4C8B8] bg-white p-8 text-center"
                role="img"
                aria-label="Placeholder for Jordan Mills' ATS resume. The resume image will appear here once uploaded."
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="40"
                  height="40"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#D97706"
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                <p className="font-jakarta text-sm font-semibold text-[#1E3A5F]">ATS Resume</p>
                <p className="font-inter text-sm text-gray-500">Preview coming soon</p>
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/boosts/jordan-mills-resume.jpg"
                alt="Jordan Mills ATS resume"
                onError={() => setImgError(true)}
                className="w-full h-auto rounded-xl border border-[#E8E0D0] shadow-sm"
              />
            )}
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
