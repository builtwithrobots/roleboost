'use client'

import { useSyncExternalStore } from 'react'

const STORAGE_KEY = 'rb_hero_variant'
const VARIANT_COUNT = 3

// The variant is fixed for the lifetime of the session, so the store never
// emits changes; useSyncExternalStore is used purely for its SSR-safe
// server-snapshot -> client-snapshot handoff (no setState-in-effect).
function subscribe() {
  return () => {}
}

// Cached so getSnapshot stays referentially stable per session even if a
// later sessionStorage read throws (e.g. storage cleared mid-session).
let cachedVariant: number | null = null

function getSnapshot(): number {
  if (cachedVariant !== null) return cachedVariant
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY)
    const parsed = stored !== null ? parseInt(stored, 10) : NaN
    if (Number.isInteger(parsed) && parsed >= 0 && parsed < VARIANT_COUNT) {
      cachedVariant = parsed
    } else {
      cachedVariant = Math.floor(Math.random() * VARIANT_COUNT)
      sessionStorage.setItem(STORAGE_KEY, String(cachedVariant))
    }
  } catch {
    // sessionStorage unavailable -- fall back to the default variant
    cachedVariant = 0
  }
  return cachedVariant
}

function getServerSnapshot(): number {
  return 0
}

/**
 * Session-scoped hero copy variant. Picks a random variant (0-2) once per
 * browser session and persists it in sessionStorage so refreshes and
 * navigation between the candidate and recruiter pages keep the same
 * messaging. Returns 0 during SSR and whenever sessionStorage is unavailable.
 */
export function useHeroVariant(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
