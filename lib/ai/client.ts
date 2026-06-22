import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Anthropic SDK client — server-only. The API key must never reach the browser.
// Lazily initialised so a missing ANTHROPIC_API_KEY doesn't crash the build
// (matches the lib/supabase/admin.ts pattern).
let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

// Convenience proxy — same lazy getter, ergonomic `anthropic.messages.create(...)` access.
export const anthropic = new Proxy({} as Anthropic, {
  get(_, prop) {
    return (getAnthropic() as unknown as Record<string | symbol, unknown>)[prop];
  },
});
