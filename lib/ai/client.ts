import 'server-only';
import Anthropic from '@anthropic-ai/sdk';

// Anthropic SDK client — server-only. The API key must never reach the browser.
// Lazily initialised so a missing ANTHROPIC_API_KEY doesn't crash the build
// (matches the lib/supabase/admin.ts pattern).
let _anthropic: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      // Diagnostic (names only -- never values): distinguishes the failure modes.
      //  - hasExactKey=true  -> the var exists but its value is empty
      //  - a similar name in `related` -> the key is mis-named (typo / trailing space)
      //  - related lists other *_KEY vars but no Anthropic one -> truly absent here
      const hasExactKey = Object.prototype.hasOwnProperty.call(process.env, 'ANTHROPIC_API_KEY');
      const related = Object.keys(process.env).filter((k) => /anthropic|claude|key/i.test(k));
      console.error(
        `ANTHROPIC_API_KEY missing or empty. hasExactKey=${hasExactKey}. Related env var names present: ${JSON.stringify(related)}`,
      );
      throw new Error('ANTHROPIC_API_KEY not set');
    }
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
