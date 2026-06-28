'use client';

import { useEffect, useRef, useState, useId } from 'react';
import { Send, Sparkles, X, Download, CalendarClock, Check } from 'lucide-react';
import type { ChatTurn } from '@/lib/types';

interface Props {
  candidateSlug: string;
  candidateName: string;
  /** 'live' = public recruiter view. 'preview' = candidate testing their own assistant. */
  mode?: 'live' | 'preview';
  /** Fired after each assistant answer with the question + answer (sandbox analysis). */
  onExchange?: (question: string, answer: string) => void;
  /** Push a question in from outside (e.g. a sandbox library chip). Bump nonce to resend. */
  externalQuestion?: { text: string; nonce: number };
  /** One-tap opener chips shown in the empty state (calling-card hero). */
  suggestedQuestions?: string[];
  /** Focus the input on mount (used inside the chat overlay). */
  autoFocus?: boolean;
  /** Fill the parent height and drop the card chrome. */
  fill?: boolean;
  /** Render a close button in the header. */
  onClose?: () => void;
}

const HISTORY_LIMIT = 20;

type ScheduleState = 'idle' | 'prompt' | 'form' | 'sending' | 'done';

export default function ChatPanel({
  candidateSlug,
  candidateName,
  mode = 'live',
  onExchange,
  externalQuestion,
  suggestedQuestions,
  autoFocus,
  fill,
  onClose,
}: Props) {
  const [messages, setMessages] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Scheduling handoff, shown when the assistant cannot answer and offers to meet.
  const [scheduleState, setScheduleState] = useState<ScheduleState>('idle');
  const [availability, setAvailability] = useState('');
  const [email, setEmail] = useState('');
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  const inputId = useId();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const sessionIdRef = useRef<string | null>(null);

  const firstName = candidateName.split(' ')[0] || candidateName;
  const assistantName = `${firstName}'s Personal Assistant`;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading, scheduleState]);

  useEffect(() => {
    if (externalQuestion?.text) void send(externalQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalQuestion?.nonce]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Deliver the transcript when a live conversation closes (the panel unmounts).
  useEffect(() => {
    return () => {
      if (mode === 'live' && sessionIdRef.current && typeof navigator !== 'undefined' && navigator.sendBeacon) {
        try {
          const blob = new Blob([JSON.stringify({ sessionId: sessionIdRef.current })], {
            type: 'application/json',
          });
          navigator.sendBeacon('/api/transcripts/deliver', blob);
        } catch {
          // best-effort
        }
      }
    };
  }, [mode]);

  async function send(explicitMessage?: string) {
    const trimmed = (explicitMessage ?? input).trim();
    if (!trimmed || loading) return;

    const history = messages.slice(-HISTORY_LIMIT);
    setMessages((m) => [...m, { role: 'user', content: trimmed }]);
    if (explicitMessage === undefined) setInput('');
    setLoading(true);
    setScheduleState('idle'); // a new question resets any prior scheduling offer

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSlug,
          message: trimmed,
          sessionId: sessionId ?? undefined,
          conversationHistory: history,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message ?? 'Request failed');

      if (data.sessionId) setSessionId(data.sessionId);
      const assistantAnswer = data.answer as string;
      setMessages((m) => [...m, { role: 'assistant', content: assistantAnswer }]);
      onExchange?.(trimmed, assistantAnswer);
      if (mode === 'live' && data.offerSchedule) setScheduleState('prompt');
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            'Something went wrong reaching the assistant just now. Please try sending that again in a moment.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function submitSchedule() {
    if (!email.trim() || !availability.trim()) return;
    setScheduleError(null);
    setScheduleState('sending');
    try {
      const res = await fetch('/api/chat/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateSlug,
          email: email.trim(),
          availability: availability.trim(),
          sessionId: sessionId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error('failed');
      setScheduleState('done');
    } catch {
      setScheduleError('Could not send that just now. Please try again.');
      setScheduleState('form');
    }
  }

  function downloadTranscript() {
    if (messages.length === 0) return;
    const lines = [
      `# Conversation with ${assistantName}`,
      new Date().toLocaleString(),
      '',
      ...messages.flatMap((m) => [`**${m.role === 'user' ? 'You' : assistantName}:** ${m.content}`, '']),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roleboost-conversation-${candidateSlug}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  const inputClass =
    'w-full rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2 text-sm text-[var(--rb-text)] outline-none placeholder:text-[var(--rb-text-muted)] focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30';

  return (
    <div
      className={
        fill
          ? 'flex h-full flex-col overflow-hidden bg-[var(--rb-bg-surface)]'
          : 'rb-card flex flex-col overflow-hidden'
      }
      style={fill ? undefined : { height: 'min(70vh, 560px)' }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-[var(--rb-border)] px-4 py-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--rb-brand)] text-white">
          <Sparkles className="size-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-[var(--rb-text)]">
            {mode === 'preview' ? `How ${assistantName} responds to recruiters` : `Ask ${assistantName} anything`}
          </p>
          {mode === 'preview' ? (
            <p className="text-xs text-[var(--rb-text-muted)]">Private test, nothing is sent.</p>
          ) : (
            <p className="text-xs text-[var(--rb-text-muted)]">Honest by design · you both get the transcript</p>
          )}
        </div>
        {messages.length > 0 && (
          <button
            onClick={downloadTranscript}
            aria-label="Download transcript"
            title="Download transcript"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
          >
            <Download className="size-4" />
          </button>
        )}
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Close conversation"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-[var(--rb-text-muted)] transition-colors hover:bg-[var(--rb-bg-surface-raised)] hover:text-[var(--rb-text)]"
          >
            <X className="size-5" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-label={`Conversation with ${assistantName}`}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
            <p className="max-w-xs text-sm text-[var(--rb-text-muted)]">
              {mode === 'preview'
                ? `Try a hard recruiter question and see how ${assistantName} answers.`
                : `Ask about ${firstName}'s experience, decisions, and what they're looking for next.`}
            </p>
            {suggestedQuestions && suggestedQuestions.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2">
                {suggestedQuestions.map((q) => (
                  <button
                    key={q}
                    onClick={() => void send(q)}
                    className="rounded-full border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-1.5 text-xs text-[var(--rb-text-secondary)] transition-colors hover:border-[var(--rb-brand)] hover:text-[var(--rb-text)]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[85%] whitespace-pre-wrap rounded-[var(--radius-lg)] px-3.5 py-2.5 text-sm leading-relaxed ${
                m.role === 'user'
                  ? 'bg-[var(--rb-brand)] text-white'
                  : 'border border-[var(--rb-border)] bg-[var(--rb-bg-page)] text-[var(--rb-text-secondary)]'
              }`}
            >
              <span className="sr-only">{m.role === 'user' ? 'You said: ' : `${assistantName} said: `}</span>
              {m.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start" aria-hidden="true">
            <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--rb-border)] bg-[var(--rb-bg-page)] px-3.5 py-3">
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)] [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)] [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-[var(--rb-text-muted)]" />
            </div>
          </div>
        )}

        {/* Scheduling handoff */}
        {scheduleState !== 'idle' && (
          <div className="rounded-[var(--radius-lg)] border border-[var(--rb-border-brand)] bg-[var(--rb-brand-subtle)]/50 p-3">
            {scheduleState === 'prompt' && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setScheduleState('form')}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                >
                  <CalendarClock className="size-3.5" />
                  Yes, schedule a time
                </button>
                <button
                  onClick={() => setScheduleState('idle')}
                  className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
                >
                  No thanks
                </button>
              </div>
            )}

            {(scheduleState === 'form' || scheduleState === 'sending') && (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-[var(--rb-text)]">
                  Share a couple of date and time ranges that work, and where to reach you.
                </p>
                <textarea
                  value={availability}
                  onChange={(e) => setAvailability(e.target.value)}
                  rows={2}
                  placeholder="e.g. Tue 10am to 12pm ET, or Thu afternoon"
                  className={`${inputClass} resize-none`}
                  aria-label="Your availability"
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className={inputClass}
                  aria-label="Your email"
                />
                {scheduleError && <p className="text-xs text-[var(--color-error)]">{scheduleError}</p>}
                <div className="flex items-center gap-2">
                  <button
                    onClick={submitSchedule}
                    disabled={scheduleState === 'sending' || !email.trim() || !availability.trim()}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--rb-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    {scheduleState === 'sending' ? 'Sending…' : 'Send request'}
                  </button>
                  <button
                    onClick={() => setScheduleState('idle')}
                    className="rounded-[var(--radius-md)] px-3 py-1.5 text-xs font-medium text-[var(--rb-text-secondary)] hover:text-[var(--rb-text)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {scheduleState === 'done' && (
              <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-success)]">
                <Check className="size-4" />
                Sent. {firstName} will respond soon.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-[var(--rb-border)] p-3"
      >
        <div className="flex items-end gap-2">
          <label htmlFor={inputId} className="sr-only">
            Ask {assistantName} a question
          </label>
          <textarea
            id={inputId}
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder={`Ask ${firstName} anything about their career`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-[var(--radius-md)] border border-[var(--rb-border)] bg-[var(--rb-bg-surface)] px-3 py-2.5 text-sm text-[var(--rb-text)] outline-none placeholder:text-[var(--rb-text-muted)] focus-visible:border-[var(--rb-brand)] focus-visible:ring-2 focus-visible:ring-[var(--rb-brand)]/30"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            aria-label="Send message"
            className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-md)] bg-[var(--rb-brand)] text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send className="size-4" strokeWidth={2} />
          </button>
        </div>
        <p className="mt-2 text-center text-[11px] text-[var(--rb-text-muted)]">
          Powered by RoleBoost. {assistantName} represents {firstName}&apos;s career history and may
          not reflect every detail.
        </p>
      </form>
    </div>
  );
}
