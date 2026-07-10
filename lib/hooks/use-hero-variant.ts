'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'rb_hero_variant'
const VARIANT_COUNT = 3

/**
 * Session-scoped hero copy variant. Picks a random variant (0-2) once per
 * browser session and persists it in sessionStorage so refreshes and
 * navigation between the candidate and recruiter pages keep the same
 * messaging. Returns 0 during SSR and whenever sessionStorage is unavailable.
 */
export function useHeroVariant(): number {
  const [variant, setVariant] = useState<number>(0)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY)
      const parsed = stored !== null ? parseInt(stored, 10) : NaN
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < VARIANT_COUNT) {
        setVariant(parsed)
      } else {
        const next = Math.floor(Math.random() * VARIANT_COUNT)
        sessionStorage.setItem(STORAGE_KEY, String(next))
        setVariant(next)
      }
    } catch {
      // sessionStorage unavailable -- keep the default 0
    }
  }, [])

  return variant
}
