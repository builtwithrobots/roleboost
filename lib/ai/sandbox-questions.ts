import type { SandboxQuestion } from '@/lib/types';

// The 20 hardest recruiter questions, grouped by category. Drawn from real
// recruiter behavior in screening calls; phrased generically with light
// placeholders so they apply to any candidate. Each maps to the brain field(s)
// it stress-tests, so a weak answer can point straight at the field to fix.
export const SANDBOX_QUESTIONS: SandboxQuestion[] = [
  // ── Gaps and departures ────────────────────────────────────────────────────
  {
    id: 'gap-1',
    category: 'gap_departure',
    question: 'Walk me through the gap between your last two roles.',
    whyItMatters: 'Employment gaps get flagged in the first minute of most screens.',
    brainFields: ['departure_reasons'],
  },
  {
    id: 'gap-2',
    category: 'gap_departure',
    question: 'Why did you leave your most recent role?',
    whyItMatters: 'The single most common opening question — your answer sets the tone.',
    brainFields: ['departure_reasons'],
  },
  {
    id: 'gap-3',
    category: 'gap_departure',
    question: 'What actually happened at your last company?',
    whyItMatters: 'Probes for a layoff, conflict, or anything you might be smoothing over.',
    brainFields: ['departure_reasons', 'biggest_challenge'],
  },
  {
    id: 'gap-4',
    category: 'gap_departure',
    question: 'I see a few short stints in the last few years. What was going on?',
    whyItMatters: 'Pattern questions need one calm, consistent narrative.',
    brainFields: ['departure_reasons'],
  },

  // ── Commitment and tenure ──────────────────────────────────────────────────
  {
    id: 'tenure-1',
    category: 'commitment_tenure',
    question: 'Your average tenure is under two years. What guarantees you will stay?',
    whyItMatters: 'Hiring is expensive; recruiters screen hard for flight risk.',
    brainFields: ['departure_reasons', 'ideal_environment'],
  },
  {
    id: 'tenure-2',
    category: 'commitment_tenure',
    question: 'You look overqualified for this role. Why do you want it?',
    whyItMatters: 'Overqualification reads as "will leave when something better appears."',
    brainFields: ['ideal_environment', 'wish_questions'],
  },
  {
    id: 'tenure-3',
    category: 'commitment_tenure',
    question: 'Where do you see yourself in five years?',
    whyItMatters: 'Tests whether this role fits your real trajectory.',
    brainFields: ['wish_questions', 'ideal_environment'],
  },

  // ── Metric and achievement verification ───────────────────────────────────
  {
    id: 'metric-1',
    category: 'metric_verification',
    question: 'Walk me through exactly how you calculated that cost-savings figure.',
    whyItMatters: 'Recruiters pressure-test big numbers; vague math kills credibility.',
    brainFields: ['key_wins'],
  },
  {
    id: 'metric-2',
    category: 'metric_verification',
    question: 'How did you measure the improvement you mention?',
    whyItMatters: 'A claimed result you cannot explain looks invented.',
    brainFields: ['key_wins'],
  },
  {
    id: 'metric-3',
    category: 'metric_verification',
    question: 'That team size seems large for that role. Can you clarify your actual scope?',
    whyItMatters: 'Scope inflation is a classic background-check failure point.',
    brainFields: ['key_wins'],
  },

  // ── Leadership and management ──────────────────────────────────────────────
  {
    id: 'lead-1',
    category: 'leadership',
    question: 'Describe how you handle an underperforming team member. Give me a real example.',
    whyItMatters: 'Generic leadership platitudes fail; they want a concrete story.',
    brainFields: ['leadership_philosophy', 'biggest_challenge'],
  },
  {
    id: 'lead-2',
    category: 'leadership',
    question: 'Tell me about a time you disagreed with your manager. What did you do?',
    whyItMatters: 'Reveals how you handle conflict and authority.',
    brainFields: ['leadership_philosophy', 'manager_needs'],
  },
  {
    id: 'lead-3',
    category: 'leadership',
    question: 'What would your last direct report say is your biggest weakness as a leader?',
    whyItMatters: 'Self-awareness under a pointed framing is hard to fake.',
    brainFields: ['honest_weaknesses', 'leadership_philosophy'],
  },

  // ── Adversarial premise ────────────────────────────────────────────────────
  {
    id: 'adv-1',
    category: 'adversarial',
    question: 'Given your background, why should I trust your commitment to this role?',
    whyItMatters: 'A loaded premise; the AI must stay calm and pivot to evidence.',
    brainFields: ['wish_questions', 'departure_reasons'],
  },
  {
    id: 'adv-2',
    category: 'adversarial',
    question: 'Your resume shows accomplishments but no degree. How do you respond to that?',
    whyItMatters: 'Credential gaps need a confident, non-defensive answer.',
    brainFields: ['key_wins'],
  },
  {
    id: 'adv-3',
    category: 'adversarial',
    question: 'Candidates with your profile usually struggle in this kind of role. How are you different?',
    whyItMatters: 'A false-premise trap; capitulating to it is a losing move.',
    brainFields: ['key_wins', 'ideal_environment'],
  },

  // ── Weakness and failure ───────────────────────────────────────────────────
  {
    id: 'weak-1',
    category: 'weakness_failure',
    question: 'What are you genuinely not good at? Be honest.',
    whyItMatters: 'A humblebrag is obvious; a real answer builds trust.',
    brainFields: ['honest_weaknesses'],
  },
  {
    id: 'weak-2',
    category: 'weakness_failure',
    question: 'Tell me about your biggest professional failure and what you learned.',
    whyItMatters: 'Failure questions test ownership and growth.',
    brainFields: ['biggest_challenge', 'honest_weaknesses'],
  },
  {
    id: 'weak-3',
    category: 'weakness_failure',
    question: 'What would your references say are your weaknesses?',
    whyItMatters: 'Third-party framing makes a vague answer obvious.',
    brainFields: ['honest_weaknesses'],
  },
  {
    id: 'weak-4',
    category: 'weakness_failure',
    question: 'What is the hardest problem you have solved, and how did you approach it?',
    whyItMatters: 'Depth question; thin answers reveal a thin brain.',
    brainFields: ['biggest_challenge', 'key_wins'],
  },
];
