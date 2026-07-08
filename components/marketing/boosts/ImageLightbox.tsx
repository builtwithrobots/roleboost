'use client'

import {
  Dialog,
  DialogBackdrop,
  DialogPanel,
  DialogTitle,
} from '@headlessui/react'

interface ImageLightboxProps {
  open: boolean
  onClose: () => void
  src: string
  alt: string
  title: string
}

/**
 * Site-styled lightbox for viewing a Boost image at a larger size.
 *
 * Built on Headless UI's Dialog: focus is trapped while open, ESC closes and
 * focus returns to the trigger, and body scroll is locked. Motion is
 * CSS-based, so globals.css disables it under prefers-reduced-motion.
 */
export default function ImageLightbox({ open, onClose, src, alt, title }: ImageLightboxProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <DialogBackdrop
        transition
        className="fixed inset-0 bg-[#1E3A5F]/70 backdrop-blur-sm transition-opacity duration-200 data-closed:opacity-0"
      />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <DialogPanel
          transition
          className="w-full max-w-5xl max-h-[92vh] flex flex-col rounded-2xl bg-[#FFFBF5] border border-[#E8E0D0] shadow-xl transition duration-200 data-closed:opacity-0 data-closed:scale-95"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-4 p-4 sm:p-5 border-b border-[#E8E0D0]">
            <DialogTitle className="font-jakarta text-base font-bold text-[#1E3A5F]">
              {title}
            </DialogTitle>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg text-gray-600 hover:text-[#1E3A5F] hover:bg-[#F5F0E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D97706] focus-visible:ring-offset-2 focus-visible:ring-offset-[#FFFBF5] transition-colors"
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

          {/* Body: full image (scrollable) */}
          <div className="overflow-auto p-4 sm:p-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              className="w-full h-auto rounded-xl border border-[#E8E0D0] shadow-sm"
            />
          </div>
        </DialogPanel>
      </div>
    </Dialog>
  )
}
